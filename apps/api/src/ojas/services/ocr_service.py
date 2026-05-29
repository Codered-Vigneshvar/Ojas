"""GPT-4o Vision OCR — extracts raw text from prescription images."""

from __future__ import annotations

import base64
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


async def extract_text_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """Base64-encode image and send to GPT-4o Vision; return raw extracted text.

    Does NOT use json_object response format — this is a free-text OCR pass.
    The caller passes the result to llm_service.structure_prescription for structuring.
    """
    b64 = base64.b64encode(image_bytes).decode()
    logger.info("ocr_start", mime_type=mime_type, bytes=len(image_bytes))

    client = _get_client()
    response = await client.chat.completions.create(
        model=settings.openai_model,
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{b64}"},
                    },
                    {
                        "type": "text",
                        "text": (
                            "Extract all text from this medical prescription image. "
                            "Return only the raw text exactly as written, preserving layout. "
                            "Do not interpret, summarize, or add any information not present."
                        ),
                    },
                ],
            }
        ],
    )
    result = response.choices[0].message.content or ""
    logger.info("ocr_done", chars=len(result))
    return result
