import base64

import httpx

from config import settings


async def extract_text_from_image(image_bytes: bytes) -> str:
    """Send image to Google Vision and return all extracted text."""
    encoded = base64.b64encode(image_bytes).decode()
    payload = {
        "requests": [
            {
                "image": {"content": encoded},
                "features": [{"type": "TEXT_DETECTION"}],
            }
        ]
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"https://vision.googleapis.com/v1/images:annotate?key={settings.google_vision_api_key}",
            json=payload,
        )
        response.raise_for_status()
        annotations = response.json()["responses"][0].get("textAnnotations", [])
        return annotations[0]["description"] if annotations else ""
