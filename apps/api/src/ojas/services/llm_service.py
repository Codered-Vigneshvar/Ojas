"""GPT-4o clinical structuring service.

All prompts enforce strict extraction — no inventing information not present in
the source text. Medical accuracy requires returning null over guessing.
"""

from __future__ import annotations

from datetime import datetime
import json
import structlog
from openai import AsyncOpenAI

from ojas.config import settings
from ojas.utils.json_helper import clean_json
from ojas.utils.llm_client import generate_chat_completion

logger = structlog.get_logger(__name__)


_TRANSCRIPT_SYSTEM = """\
You are a clinical note assistant for a medical/dental clinic.
Given a raw consultation transcript (may be in any language or a mix of languages), \
intelligently extract and structure the information into a list of logical sections \
based on the conversation. Return ONLY a JSON object with these exact keys:

{
  "sections": [
    {
      "heading": "String (e.g. 'Chief Complaint', 'Vitals', 'Clinical Findings', 'Treatment Plan', etc.)",
      "points": ["String bullet point", "String bullet point"]
    }
  ],
  "tags": ["3 to 5 short topic tags"]
}

CRITICAL RULES:
- Create as many sections as necessary to accurately capture the consultation.
- Use professional medical terminology for the headings (e.g., 'Chief Complaint', 'Diagnosis', 'Treatment Plan').
- IMPORTANT: If any information is mentioned that falls outside standard clinical structure (e.g., financial concerns, parent preferences, appointment scheduling), CREATE a dynamic, custom section heading for it (e.g., 'Patient Preferences', 'Scheduling Notes', 'Financial Considerations').
- Do NOT discard any spoken information just because it doesn't fit a traditional medical category.
- NEVER generate, infer, or assume a medical diagnosis. Only extract a diagnosis if it was explicitly and literally stated by the doctor in the transcript. If not explicitly stated, return null.
- Extract ONLY information explicitly stated in the transcript.
- Do NOT infer, assume, or add any details not spoken aloud.
- If a field is not mentioned in the transcript, use null — do not guess.
- Medical accuracy is paramount: returning null is always safer than inventing information.
- Return ONLY valid JSON. No explanation. No markdown code fences."""


_PRESCRIPTION_SYSTEM = """\
You are a clinical assistant. Given OCR-extracted text from a medical document image (like a prescription, lab report, or diagnostic scan), \
analyze the content, understand what type of document it is, and extract ALL available information into the following structured JSON format:

{
  "document_type": "prescription | lab_report | clinical_note | other",
  "patient_metadata": {
    "name": "string or null",
    "age": "string or null",
    "gender": "string or null",
    "patient_id": "string or null",
    "report_id": "string or null",
    "date": "string or null",
    "referred_by": "string or null"
  },
  "medications": [
    {
      "name": "string",
      "dose": "string or null",
      "frequency": "string or null",
      "duration": "string or null"
    }
  ],
  "lab_results": [
    {
      "test_name": "string",
      "result_value": "string",
      "reference_range": "string or null",
      "unit": "string or null"
    }
  ],
  "special_instructions": "string or null",
  "interpretation_notes": "string or null",
  "reference_tables": [
    {
      "key": "string",
      "value": "string"
    }
  ],
  "diagnosis_mentioned": "string or null"
}

CRITICAL RULES FOR STRUCTURING:
1. **Extract ALL Information**: Ensure absolutely no relevant information from the document is skipped or discarded. All text blocks, interpretations, tables, and metadata should be structured and placed into their appropriate fields.
2. **Document Classification**: Determine the `document_type` ("prescription", "lab_report", "clinical_note", "other").
3. **Patient & Report Metadata**: Extract all metadata values into the `patient_metadata` object, including Patient Name, Age, Gender, Patient ID, Report ID, referred by, and date (collection date or report date).
4. **Medications Table**: If it contains drugs/medications, extract them into the `"medications"` array. If none are listed, return `[]`.
5. **Lab Results Table**: If it contains lab test values, extract each test name, result value, reference range, and unit into `"lab_results"`.
6. **Interpretation & RBS Explanations**: Extract any general interpretations or scientific explanations of tests (e.g. RBS interpretations or descriptions) into `"interpretation_notes"`.
7. **Reference Tables & Interpretations**: If the document contains any reference tables (e.g., standard normal/high reference value tables or result interpretations like "Normal: Less than 140"), extract them into the `"reference_tables"` list with `"key"` (e.g. "Normal") and `"value"` (e.g. "Less than 140").
8. **Strict Diagnosis Extraction**: NEVER generate, infer, or assume a medical diagnosis. Only extract a diagnosis into `"diagnosis_mentioned"` if it is literally and explicitly written in the document text. If not explicitly written, return `null`.
9. **JSON Output**: Return ONLY valid JSON matching this schema. Do not add markdown code fences or explanations."""


_VOICE_CORRECTION_SYSTEM = """\
You are updating a clinical note based on the doctor's spoken correction.

CRITICAL RULES:
- ONLY modify fields that the doctor explicitly mentioned in the correction.
- Do NOT change, add, or infer information for fields that were not mentioned.
- Do NOT extrapolate beyond what was literally said.
- If the correction is unclear or does not reference any specific field, return the note unchanged.
- Return the complete updated JSON with ALL original fields preserved (including unchanged ones).
- Return ONLY valid JSON. No explanation. No markdown code fences."""


async def structure_transcript(raw_transcript: str) -> tuple[dict[str, object], list[str]]:
    """Structure a raw consultation transcript into clinical note fields.

    Returns (note_dict, tags) — tags are extracted from the LLM response and
    returned separately so the caller can store them in the artifact.tags column.
    """
    logger.info("llm_structure_transcript_start", chars=len(raw_transcript))
    
    if not raw_transcript.strip():
        return {}, []
    
    if not settings.openai_api_key and not settings.gemini_api_key:
        logger.info("llm_structure_transcript_stub_mode_active")
        mock_note = {
            "sections": [
                {
                    "heading": "Chief Complaint",
                    "points": ["Patient presents with symptoms mentioned in the raw transcript."]
                },
                {
                    "heading": "Clinical Findings",
                    "points": [f"Observed findings based on transcription: \"{raw_transcript[:100]}...\""]
                },
                {
                    "heading": "Treatment Plan",
                    "points": [
                        "Supportive care and monitoring.",
                        "To be customized by attending physician."
                    ]
                }
            ]
        }
        mock_tags = ["General", "Consultation", "AI-Stub"]
        return mock_note, mock_tags

    raw = await generate_chat_completion(
        messages=[
            {"role": "system", "content": _TRANSCRIPT_SYSTEM},
            {"role": "user", "content": f"Transcript:\n{raw_transcript}"},
        ],
        max_tokens=1024,
        response_format={"type": "json_object"},
    )
    result: dict[str, object] = json.loads(clean_json(raw))
    tags: list[str] = result.pop("tags", [])  # type: ignore[assignment]
    logger.info("llm_structure_transcript_done", tags=tags)
    return result, tags


async def structure_prescription(ocr_text: str) -> dict[str, object]:
    """Structure prescription OCR text into a medications list dict."""
    logger.info("llm_structure_prescription_start", chars=len(ocr_text))
    
    if not settings.openai_api_key and not settings.gemini_api_key:
        logger.info("llm_structure_prescription_stub_mode_active")
        return {
            "document_type": "prescription",
            "patient_metadata": {
                "name": "Dr Sreekanth's Patient",
                "age": "35",
                "gender": "Male",
                "patient_id": None,
                "report_id": None,
                "date": datetime.now().strftime("%Y-%m-%d"),
                "referred_by": None
            },
            "medications": [
                {
                    "name": "Amoxicillin 500mg (Stub)",
                    "dose": "1 capsule",
                    "frequency": "Three times daily",
                    "duration": "7 days"
                },
                {
                    "name": "Paracetamol 650mg (Stub)",
                    "dose": "1 tablet",
                    "frequency": "As needed for fever",
                    "duration": "3 days"
                }
              ],
              "lab_results": [],
              "special_instructions": "Take medications after food.",
              "interpretation_notes": "Prescription successfully structured under local AI Stub mode.",
              "reference_tables": [],
              "diagnosis_mentioned": "Acute upper respiratory tract infection (Stub)"
        }

    raw = await generate_chat_completion(
        messages=[
            {"role": "system", "content": _PRESCRIPTION_SYSTEM},
            {"role": "user", "content": f"OCR Text:\n{ocr_text}"},
        ],
        max_tokens=1024,
        response_format={"type": "json_object"},
    )
    result: dict[str, object] = json.loads(clean_json(raw))
    logger.info("llm_structure_prescription_done")
    return result


async def apply_voice_correction(
    current_note: dict[str, object],
    correction_transcript: str,
) -> dict[str, object]:
    """Apply a doctor's spoken correction to an existing structured note.

    Only fields explicitly mentioned in the correction are changed.
    All other fields are returned unchanged.
    """
    logger.info("llm_voice_correction_start", chars=len(correction_transcript))
    
    if not settings.openai_api_key and not settings.gemini_api_key:
        logger.info("llm_voice_correction_stub_mode_active")
        updated_note = dict(current_note)
        sections = updated_note.get("sections", [])
        if sections and isinstance(sections, list):
            sections[-1]["points"].append(f"Correction applied: {correction_transcript}")
        return updated_note

    user_content = (
        f"Current note:\n{json.dumps(current_note, indent=2)}\n\n"
        f"Doctor's correction:\n\"{correction_transcript}\""
    )
    raw = await generate_chat_completion(
        messages=[
            {"role": "system", "content": _VOICE_CORRECTION_SYSTEM},
            {"role": "user", "content": user_content},
        ],
        max_tokens=2048,
        response_format={"type": "json_object"},
        is_pro=True
    )
    result: dict[str, object] = json.loads(clean_json(raw))
    logger.info("llm_voice_correction_done")
    return result
