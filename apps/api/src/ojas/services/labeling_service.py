"""AI labeling service — generates short descriptive titles for artifacts.

Uses GPT-4o with max_tokens=100 for fast labeling.
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


_AUDIO_LABEL_SYSTEM = """\
Given a raw consultation transcript, generate a SHORT descriptive title (max 60 chars).
The title should describe what this consultation is about.
Examples: "Knee Pain Follow-Up", "Root Canal — Molar #36", "Diabetes Medication Review"

Return ONLY a JSON object: {"title": "..."} — no explanation, no markdown."""


_NOTE_LABEL_SYSTEM = """\
Given a doctor's typed note, generate a SHORT descriptive title (max 60 chars).
The title should describe what kind of information this note contains.
Examples: "Post-Op Care Instructions", "Medication Adjustment Notes", "Lab Results Summary"

Return ONLY a JSON object: {"title": "..."} — no explanation, no markdown."""


_FILE_LABEL_SYSTEM = """\
Given a filename, MIME type, and any extracted text from a medical file, generate:
1. A SHORT descriptive title (max 60 chars)
2. A category: one of "image", "prescription", "report", "file"

Classification rules:
- X-ray images → category "image", title like "Chest X-Ray" or "Dental X-Ray — Molar Region"
- Prescription images/docs → category "prescription", title like "Prescription — Dr. Kumar"
- Lab reports, blood work → category "report", title like "Complete Blood Count Report"
- MRI/CT scan → category "image", title like "MRI — Lumbar Spine"
- Unknown → category "file", use a cleaned-up version of the filename

Return ONLY a JSON object: {"title": "...", "category": "..."} — no explanation, no markdown."""


async def label_audio(transcript: str) -> str:
    """Generate a short descriptive title for an audio recording based on its transcript."""
    if not transcript.strip():
        return "Consultation Recording"

    logger.info("label_audio_start", chars=len(transcript))
    client = _get_client()
    # Use just the first 500 chars of transcript for speed
    snippet = transcript[:500]
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=100,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _AUDIO_LABEL_SYSTEM},
            {"role": "user", "content": f"Transcript:\n{snippet}"},
        ],
    )
    result = json.loads(response.choices[0].message.content or '{"title": "Consultation Recording"}')
    title = result.get("title", "Consultation Recording")[:60]
    logger.info("label_audio_done", title=title)
    return title


async def label_note(text: str) -> str:
    """Generate a short descriptive title for a typed note."""
    if not text.strip():
        return "Note"

    logger.info("label_note_start", chars=len(text))
    client = _get_client()
    snippet = text[:500]
    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=100,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _NOTE_LABEL_SYSTEM},
            {"role": "user", "content": f"Note:\n{snippet}"},
        ],
    )
    result = json.loads(response.choices[0].message.content or '{"title": "Note"}')
    title = result.get("title", "Note")[:60]
    logger.info("label_note_done", title=title)
    return title


async def label_file(filename: str, mime_type: str, ocr_text: str | None = None) -> tuple[str, str]:
    """Generate a title and category for an uploaded file.

    Returns (title, category) where category is one of: image, prescription, report, file.
    """
    logger.info("label_file_start", filename=filename, mime_type=mime_type)
    client = _get_client()
    content = f"Filename: {filename}\nMIME type: {mime_type}"
    if ocr_text:
        content += f"\n\nExtracted text (first 500 chars):\n{ocr_text[:500]}"

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        max_tokens=100,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": _FILE_LABEL_SYSTEM},
            {"role": "user", "content": content},
        ],
    )
    result = json.loads(
        response.choices[0].message.content or '{"title": "' + filename + '", "category": "file"}'
    )
    title = result.get("title", filename)[:60]
    category = result.get("category", "file")
    if category not in ("image", "prescription", "report", "file"):
        category = "file"
    logger.info("label_file_done", title=title, category=category)
    return title, category
