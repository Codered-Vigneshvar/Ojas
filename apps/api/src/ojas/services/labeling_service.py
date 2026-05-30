"""AI labeling service — generates short descriptive titles for artifacts.

Uses GPT-4o with max_tokens=100 for fast labeling.
"""

from __future__ import annotations

import json
import structlog
from openai import AsyncOpenAI

from ojas.config import settings
from ojas.utils.json_helper import clean_json
from ojas.utils.llm_client import generate_chat_completion

logger = structlog.get_logger(__name__)


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


async def label_audio(raw_transcript: str) -> str:
    """Generate a title for an audio consultation."""
    logger.info("label_audio_start", chars=len(raw_transcript))
    
    if not settings.openai_api_key and not settings.gemini_api_key:
        return "Audio Consultation"
        
    snippet = raw_transcript[:500]
    raw = await generate_chat_completion(
        messages=[
            {"role": "system", "content": _AUDIO_LABEL_SYSTEM},
            {"role": "user", "content": f"Transcript:\n{snippet}"},
        ],
        max_tokens=100,
        response_format={"type": "json_object"},
    )
    result = json.loads(clean_json(raw))
    title = result.get("title", "Consultation Recording")[:60]
    logger.info("label_audio_done", title=title)
    return title


async def label_note(text: str) -> str:
    """Generate a short descriptive title for a typed note."""
    if not text.strip():
        return "Note"

    logger.info("label_note_start", chars=len(text))
    snippet = text[:500]
    raw = await generate_chat_completion(
        messages=[
            {"role": "system", "content": _NOTE_LABEL_SYSTEM},
            {"role": "user", "content": f"Note:\n{snippet}"},
        ],
        max_tokens=100,
        response_format={"type": "json_object"},
    )
    result = json.loads(clean_json(raw))
    title = result.get("title", "Note")[:60]
    logger.info("label_note_done", title=title)
    return title


async def label_file(filename: str, mime_type: str, ocr_text: str | None = None) -> tuple[str, str]:
    """Generate a title and category for an uploaded file.

    Returns (title, category) where category is one of: image, prescription, report, file.
    """
    logger.info("label_file_start", filename=filename, mime_type=mime_type)
    snippet = ocr_text[:500] if ocr_text else ""
    raw = await generate_chat_completion(
        messages=[
            {"role": "system", "content": _FILE_LABEL_SYSTEM},
            {"role": "user", "content": f"Filename: {filename}\nMIME: {mime_type}\nExtracted Text:\n{snippet}"},
        ],
        max_tokens=100,
        response_format={"type": "json_object"},
    )
    result = json.loads(clean_json(raw))
    title = result.get("title", filename)[:60]
    category = result.get("category", "file")
    if category not in ("image", "prescription", "report", "file"):
        category = "file"
    logger.info("label_file_done", title=title, category=category)
    return title, category
