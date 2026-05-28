from __future__ import annotations

import json

from openai import AsyncOpenAI

from config import settings

_client = AsyncOpenAI(api_key=settings.openai_api_key)

_TRANSCRIPT_SYSTEM = """\
You are a clinical note structuring assistant for a dental/medical clinic.
Given a raw consultation transcript (may be in any language or a mix of languages), \
extract and return ONLY a JSON object with these exact keys:

{
  "chief_complaint": "string or null",
  "clinical_findings": "string or null",
  "diagnosis": "string or null",
  "treatment_plan": "string or null",
  "medications_prescribed": "string or null",
  "follow_up_instructions": "string or null",
  "tags": ["3 to 5 short topic tags, e.g. RCT, Tooth 36, Antibiotic prescribed"]
}

Return ONLY valid JSON. No explanation. No markdown fences. If a field is not mentioned in the transcript, use null."""

_PRESCRIPTION_SYSTEM = """\
You are a clinical assistant. Given OCR-extracted text from a prescription image, \
extract and return ONLY a JSON object:

{
  "medications": [
    {
      "name": "string",
      "dose": "string or null",
      "frequency": "string or null",
      "duration": "string or null"
    }
  ],
  "diagnosis_mentioned": "string or null",
  "special_instructions": "string or null"
}

Return ONLY valid JSON. No explanation. No markdown fences. \
If a field is not present, use null."""


async def structure_transcript(raw_transcript: str) -> dict:
    response = await _client.chat.completions.create(
        model=settings.openai_model,
        max_tokens=1024,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _TRANSCRIPT_SYSTEM},
            {"role": "user", "content": f"Transcript:\n{raw_transcript}"},
        ],
    )
    return json.loads(response.choices[0].message.content)


async def structure_prescription(ocr_text: str, raw_transcript: str | None = None) -> dict:
    content = f"Prescription OCR text:\n{ocr_text}"
    if raw_transcript:
        content += f"\n\nConsultation transcript for additional context:\n{raw_transcript}"

    response = await _client.chat.completions.create(
        model=settings.openai_model,
        max_tokens=1024,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _PRESCRIPTION_SYSTEM},
            {"role": "user", "content": content},
        ],
    )
    return json.loads(response.choices[0].message.content)
