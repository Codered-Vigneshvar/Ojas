import pathlib
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import ConsultationSession
from services.auth import UserInfo, get_current_user
from services.llm import structure_prescription, structure_transcript
from services.ocr import extract_text_from_image

router = APIRouter(tags=["structuring"])


class StructureTranscriptBody(BaseModel):
    session_id: uuid.UUID


@router.post("/structure/transcript")
async def structure_transcript_endpoint(
    body: StructureTranscriptBody,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(ConsultationSession).where(ConsultationSession.id == body.session_id)
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if not s.raw_transcript:
        raise HTTPException(status_code=400, detail="No transcript saved for this session yet")

    structured = await structure_transcript(s.raw_transcript)
    tags = structured.pop("tags", [])

    s.structured_note = structured
    s.tags = tags
    await db.commit()

    return {"session_id": str(s.id), "structured_note": structured, "tags": tags}


@router.post("/structure/prescription")
async def structure_prescription_endpoint(
    current_user: UserInfo = Depends(get_current_user),
    session_id: str = Form(...),
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid session_id")

    result = await db.execute(
        select(ConsultationSession).where(ConsultationSession.id == session_uuid)
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")

    image_bytes = await image.read()
    mime_type = image.content_type or "image/jpeg"
    ext = pathlib.Path(image.filename or "prescription.jpg").suffix or ".jpg"
    image_filename = f"{session_id}{ext}"
    image_path = pathlib.Path(settings.uploads_dir) / image_filename
    image_path.write_bytes(image_bytes)

    ocr_text = await extract_text_from_image(image_bytes, mime_type)
    summary = await structure_prescription(ocr_text, s.raw_transcript)

    s.prescription_storage_key = str(image_path)
    s.prescription_summary = summary
    await db.commit()

    return {
        "session_id": session_id,
        "ocr_text": ocr_text,
        "prescription_summary": summary,
        "prescription_storage_key": str(image_path),
    }
