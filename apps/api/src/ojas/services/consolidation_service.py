"""Consolidation service for generating clinical consultation summaries and Q&A."""

import json
import uuid
from typing import Any
import structlog
from openai import AsyncOpenAI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.config import settings
from ojas.models.artifact import Artifact
from ojas.models.consultation import Consultation
from ojas.models.patient import Patient
from ojas.utils.llm_client import generate_chat_completion

logger = structlog.get_logger(__name__)

_CONSOLIDATION_SYSTEM = """\
You are a clinical scribe AI. Given a consultation manifest with a patient name and timeline of snippets, produce a structured clinical overview.

RULES:
- Be concise. Use short bullet points, never paragraphs.
- Bold all clinical values, drug names, and diagnoses (e.g., **RBS: 130 mg/dL**, **Amoxicillin 500mg**).
- Cite EVERY fact with [Snippet Title](snippet://<id>). Never omit citations.
- Only include sections that have data. Skip empty sections entirely.
- Extract maximum clinical value: dosages, frequencies, lab values with units, conditions, allergies, plans.
- If snippets contain contradictory information (e.g. appointment dates changed), ALWAYS prioritize the information from the LATEST snippet in the timeline.

FORMAT the "summary" markdown EXACTLY like this:

### 👤 Patient Details
- **Name:** {patient_name}
- **Contact:** {patient_phone}
- List any other personal details (age, gender, address, email) extracted from the provided snippets.

### 🩺 Presenting Complaint
- bullet points here

### 🔬 Clinical Findings & Reports
- bullet points with **bolded values**

### 🛡️ Allergies
- bullet points (or "No known allergies" if explicitly stated)

### 🕰️ Patient History
- bullet points (past medical, surgical, or family history)

### 💊 Medications & Prescriptions
- Drug name, dose, frequency

### 📋 Plan & Next Steps
- bullet points

### ⚠️ Possible Data Mismatch
(ONLY include this section if ANY reports or documents clearly refer to a DIFFERENT patient name than the one in the manifest. If all documents match, DO NOT include this section at all.)
- List EVERY mismatched report here using this format: "Report [Title](snippet://id) appears to belong to a different patient"

Provide 3 to 5 sample questions the doctor could click to instantly query this consultation's data.
- THESE ARE NOT QUESTIONS FOR THE DOCTOR TO ASK THE PATIENT.
- These are queries the doctor can ask YOU (the AI) to extract information ALREADY present in the notes.
- CRITICAL: You are FORBIDDEN from suggesting a question if the answer is not explicitly written in the snippets. Every question MUST be answerable using only the provided text.
- Format them as a JSON array of strings in the `questions` field.

Return EXACTLY this JSON:
{
  "summary": "markdown string",
  "questions": ["q1", "q2", "q3", "q4"]
}
"""

_ASK_SYSTEM = """\
You are a clinical assistant. Answer the doctor's question using ONLY the provided consultation manifest. 
- Cite every fact using [Snippet Title](snippet://<id>).
- If the answer is not in the manifest, say "This information is not available in the current consultation."
- NEVER infer, diagnose, or add information not present in the manifest.
"""

async def consolidate_consultation(session: AsyncSession, consultation_id: uuid.UUID) -> None:
    """Build a lightweight manifest of all artifacts in a consultation and generate a summary."""
    # 1. Fetch Consultation and Patient to ensure they exist and get patient name and phone
    result = await session.execute(
        select(Consultation, Patient.name, Patient.phone_e164)
        .join(Patient, Consultation.patient_id == Patient.id)
        .where(Consultation.id == consultation_id)
    )
    row = result.first()
    if not row:
        logger.error(f"Consultation {consultation_id} not found for consolidation.")
        return
    consultation, patient_name, patient_phone = row

    # 2. Query artifacts (lightweight read)
    artifacts_result = await session.execute(
        select(Artifact)
        .where(Artifact.consultation_id == consultation_id)
        .order_by(Artifact.created_at.asc())
    )
    artifacts = artifacts_result.scalars().all()

    # 3. Build manifest
    timeline = []
    for artifact in artifacts:
        summary_str = "No summary available."
        
        if artifact.structured_note:
            # Drop null values to save tokens
            note_data = {k: v for k, v in artifact.structured_note.items() if v}
            if note_data:
                summary_str = json.dumps(note_data)
        elif artifact.prescription_summary:
            presc_data = {k: v for k, v in artifact.prescription_summary.items() if v}
            if presc_data:
                summary_str = json.dumps(presc_data)
        elif artifact.type == "audio" and artifact.raw_transcript:
            summary_str = artifact.raw_transcript[:4000] + "..." if len(artifact.raw_transcript) > 4000 else artifact.raw_transcript
        elif artifact.text_content:
            summary_str = artifact.text_content[:4000] + "..." if len(artifact.text_content) > 4000 else artifact.text_content
        elif artifact.summary:
            summary_str = artifact.summary
        
        timeline.append({
            "id": str(artifact.id),
            "type": artifact.type,
            "title": artifact.title,
            "summary": summary_str,
        })
        
    manifest = {
        "patient_name": patient_name,
        "patient_phone": patient_phone,
        "snippet_count": len(artifacts),
        "timeline": timeline,
    }

    # If no artifacts, clear summary and return
    if not timeline:
        consultation.summary_text = None
        consultation.suggested_questions = None
        consultation.clinical_manifest = manifest
        await session.commit()
        return

    # 4. Single LLM Call (use primary model for speed and intelligence)
    try:
        raw = await generate_chat_completion(
            messages=[
                {"role": "system", "content": _CONSOLIDATION_SYSTEM},
                {"role": "user", "content": f"Manifest:\n{json.dumps(manifest, indent=2)}"}
            ],
            max_tokens=4000,
            response_format={"type": "json_object"},
            is_pro=True
        )
        
        result_json = raw
        if result_json:
            # Strip markdown formatting if present
            clean_json = result_json.strip()
            if clean_json.startswith("```json"):
                clean_json = clean_json[7:]
            if clean_json.startswith("```"):
                clean_json = clean_json[3:]
            if clean_json.endswith("```"):
                clean_json = clean_json[:-3]
            clean_json = clean_json.strip()

            parsed = json.loads(clean_json)
            consultation.summary_text = parsed.get("summary")
            consultation.suggested_questions = parsed.get("questions")
            consultation.clinical_manifest = manifest
            
            await session.commit()
            logger.info(f"Successfully consolidated consultation {consultation_id}")
    except openai.RateLimitError as e:
        logger.warning(f"Rate limit exceeded during consolidation: {e}")
        consultation.summary_text = "### ⚠️ AI Provider Rate Limit Exceeded\nYou have made too many back-to-back requests. The primary AI provider has temporarily paused your access. Please wait a minute before making a new recording."
        consultation.clinical_manifest = manifest
        await session.commit()
    except Exception as e:
        logger.exception(f"Failed to consolidate consultation {consultation_id}: {e}")
        consultation.summary_text = "### ⚠️ Consolidation Failed\nAn error occurred while generating the summary."
        consultation.clinical_manifest = manifest
        await session.commit()


async def ask_consultation(
    session: AsyncSession, 
    consultation_id: uuid.UUID, 
    question: str,
    history: list[dict[str, str]] = None
) -> str:
    """Answer a user's question using the pre-compiled clinical manifest and chat history."""
    result = await session.execute(
        select(Consultation.clinical_manifest).where(Consultation.id == consultation_id)
    )
    manifest = result.scalar_one_or_none()
    
    if not manifest:
        return "This information is not available in the current consultation."
        
    messages = [
        {"role": "system", "content": _ASK_SYSTEM},
        {"role": "system", "content": f"Manifest:\n{json.dumps(manifest, indent=2)}"}
    ]
    
    if history:
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
    messages.append({"role": "user", "content": question})
    
    try:
        answer = await generate_chat_completion(
            messages=messages,
            max_tokens=2000,
            is_pro=True
        )
        return answer
    except openai.RateLimitError as e:
        logger.warning(f"Rate limit exceeded during QA: {e}")
        return "AI Provider Rate Limit Exceeded. Please try again later."
    except Exception as e:
        logger.exception(f"Failed to answer question for consultation {consultation_id}: {e}")
        # Re-raise so the endpoint can handle CancelledError properly
        raise
