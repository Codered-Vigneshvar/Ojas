from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import AsyncSessionLocal, get_db
from models import ConsultationSession
from services.auth import UserInfo, get_current_user
from services.llm import structure_transcript
from services.stt import transcribe_audio

router = APIRouter(tags=["transcription"])

# In-memory chunk accumulator keyed by session_id string.
# Works fine for single-worker demo; not shared across processes.
_accumulators: dict[str, list[str]] = {}


class StartBody(BaseModel):
    session_id: uuid.UUID


class StopBody(BaseModel):
    session_id: uuid.UUID


@router.post("/transcribe/start")
async def start_transcription(
    body: StartBody,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(ConsultationSession).where(ConsultationSession.id == body.session_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Session not found")

    _accumulators[str(body.session_id)] = []
    return {"session_id": str(body.session_id), "status": "recording"}


@router.post("/transcribe/stream")
async def stream_chunk(
    current_user: UserInfo = Depends(get_current_user),
    session_id: str = Form(...),
    audio: UploadFile = File(...),
) -> dict:
    """
    Accepts one audio chunk, sends to Sarvam AI, returns partial transcript.
    Frontend calls this repeatedly while recording; chunks accumulate server-side.
    Sarvam processes each chunk independently — not true word-by-word streaming.
    """
    audio_bytes = await audio.read()
    partial = await transcribe_audio(
        audio_bytes,
        audio.filename or "chunk.webm",
        audio.content_type or "audio/webm",
    )
    if session_id in _accumulators:
        _accumulators[session_id].append(partial)
    return {"partial_transcript": partial}


@router.post("/transcribe/stop")
async def stop_transcription(
    body: StopBody,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> dict:
    key = str(body.session_id)
    chunks = _accumulators.pop(key, [])
    full_transcript = " ".join(c for c in chunks if c)

    result = await db.execute(
        select(ConsultationSession).where(ConsultationSession.id == body.session_id)
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")

    s.raw_transcript = full_transcript
    await db.commit()

    return {"session_id": key, "raw_transcript": full_transcript}


async def _structure_in_background(session_id: str, raw_transcript: str) -> None:
    """Run AI structuring after the HTTP response has already been sent."""
    try:
        structured = await structure_transcript(raw_transcript)
        tags = structured.pop("tags", [])
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(ConsultationSession).where(ConsultationSession.id == uuid.UUID(session_id))
            )
            s = result.scalar_one_or_none()
            if s:
                s.structured_note = structured
                s.tags = tags
                await db.commit()
    except Exception:
        pass  # background failure is silent — doctor sees raw transcript, can re-structure manually


@router.post("/transcribe/full")
async def transcribe_full(
    background_tasks: BackgroundTasks,
    current_user: UserInfo = Depends(get_current_user),
    session_id: str = Form(...),
    audio: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Transcribes full recording, saves transcript immediately, structures in background."""
    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/webm"
    if ";" in content_type:
        content_type = content_type.split(";")[0].strip()

    transcript = await transcribe_audio(
        audio_bytes,
        audio.filename or "recording.webm",
        content_type,
    )

    result = await db.execute(
        select(ConsultationSession).where(ConsultationSession.id == uuid.UUID(session_id))
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")

    s.raw_transcript = transcript
    await db.commit()

    if transcript:
        background_tasks.add_task(_structure_in_background, session_id, transcript)

    return {"session_id": session_id, "raw_transcript": transcript}
