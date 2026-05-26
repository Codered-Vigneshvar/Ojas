import httpx

from config import settings


async def transcribe_audio(audio_bytes: bytes, filename: str, content_type: str) -> str:
    """Send audio to Deepgram and return transcript text."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            "https://api.deepgram.com/v1/listen",
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": content_type,
            },
            params={
                "model": "nova-2",
                "detect_language": "true",
                "punctuate": "true",
            },
            content=audio_bytes,
        )
        response.raise_for_status()
        return (
            response.json()
            .get("results", {})
            .get("channels", [{}])[0]
            .get("alternatives", [{}])[0]
            .get("transcript", "")
        )
