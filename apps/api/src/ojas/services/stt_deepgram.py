"""Deepgram cloud STT — sends audio bytes to nova-2, returns transcript text."""

from __future__ import annotations

import structlog

import httpx

from ojas.config import settings

logger = structlog.get_logger(__name__)

_DEEPGRAM_URL = "https://api.deepgram.com/v1/listen"


async def transcribe_audio_deepgram(
    audio_bytes: bytes,
    content_type: str,
    filename: str = "recording.webm",
) -> str:
    """POST audio bytes to Deepgram nova-2, return transcript string.

    Strips codec suffix (e.g. 'audio/webm;codecs=opus' → 'audio/webm') before
    sending, because Deepgram rejects the extended MIME form.
    Returns empty string if Deepgram returns no alternatives.
    Raises httpx.HTTPStatusError on non-2xx.
    """
    clean_ct = content_type.split(";")[0].strip()

    logger.info(
        "deepgram_transcribe_start",
        filename=filename,
        content_type=clean_ct,
        bytes=len(audio_bytes),
    )

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            _DEEPGRAM_URL,
            headers={
                "Authorization": f"Token {settings.deepgram_api_key}",
                "Content-Type": clean_ct,
            },
            params={
                "model": "nova-2",
                "detect_language": "true",
                "punctuate": "true",
            },
            content=audio_bytes,
        )
        response.raise_for_status()

    data = response.json()
    transcript: str = (
        data.get("results", {})
        .get("channels", [{}])[0]
        .get("alternatives", [{}])[0]
        .get("transcript", "")
    )

    logger.info("deepgram_transcribe_done", chars=len(transcript))
    return transcript
