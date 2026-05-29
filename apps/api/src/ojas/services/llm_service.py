"""GPT-4o clinical structuring service.

All prompts enforce strict extraction — no inventing information not present in
the source text. Medical accuracy requires returning null over guessing.
"""

from __future__ import annotations

import json
import structlog
from openai import AsyncOpenAI

from ojas.config import settings

logger = structlog.get_logger(__name__)

_client: AsyncOpenAI | None = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=settings.openai_api_key)
    return _client


_TRANSCRIPT_SYSTEM = """\
You are a clinical note assistant for a medical/dental clinic.
Given a raw consultation transcript (may be in any language or a mix of languages), \
extract and return ONLY a JSON object with these exact keys:

{
  "chief_complaint": "string or null",
  "clinical_findings": "string or null",
  "diagnosis": "string or null",
  "treatment_plan": "string or null",
  "medications_prescribed": "string or null",
  "follow_up_instructions": "string or null",
  "tags": ["3 to 5 short topic tags"]
}

CRITICAL RULES:
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
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openai_model,
        max_tokens=1024,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _TRANSCRIPT_SYSTEM},
            {"role": "user", "content": f"Transcript:\n{raw_transcript}"},
        ],
    )
    result: dict[str, object] = json.loads(response.choices[0].message.content or "{}")
    tags: list[str] = result.pop("tags", [])  # type: ignore[assignment]
    logger.info("llm_structure_transcript_done", tags=tags)
    return result, tags


async def structure_prescription(ocr_text: str) -> dict[str, object]:
    """Structure prescription OCR text into a medications list dict."""
    logger.info("llm_structure_prescription_start", chars=len(ocr_text))
    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openai_model,
        max_tokens=1024,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _PRESCRIPTION_SYSTEM},
            {"role": "user", "content": f"Prescription OCR text:\n{ocr_text}"},
        ],
    )
    result: dict[str, object] = json.loads(response.choices[0].message.content or "{}")
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
    client = _get_client()
    user_content = (
        f"Current note:\n{json.dumps(current_note, indent=2)}\n\n"
        f"Doctor's correction:\n\"{correction_transcript}\""
    )
    response = await client.chat.completions.create(
        model=settings.openai_model,
        max_tokens=1024,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _VOICE_CORRECTION_SYSTEM},
            {"role": "user", "content": user_content},
        ],
    )
    result: dict[str, object] = json.loads(response.choices[0].message.content or "{}")
    logger.info("llm_voice_correction_done")
    return result
