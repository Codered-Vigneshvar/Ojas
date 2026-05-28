from __future__ import annotations

import base64

from openai import AsyncOpenAI

from config import settings

_client = AsyncOpenAI(api_key=settings.openai_api_key)


async def extract_text_from_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> str:
    """Use GPT-4o Vision to extract text from a prescription image."""
    b64 = base64.b64encode(image_bytes).decode()
    response = await _client.chat.completions.create(
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
                            "Do not interpret or summarize."
                        ),
                    },
                ],
            }
        ],
    )
    return response.choices[0].message.content or ""
