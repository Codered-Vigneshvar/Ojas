import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import ConsultationSession

router = APIRouter(tags=["sessions"])


class CreateSessionBody(BaseModel):
    patient_id: uuid.UUID
    clinic_id: uuid.UUID


class PatchSessionBody(BaseModel):
    raw_transcript: str | None = None
    structured_note: dict[str, Any] | None = None
    tags: list[str] | None = None
    prescription_summary: dict[str, Any] | None = None


def _serialize(s: ConsultationSession) -> dict:
    return {
        "session_id": str(s.id),
        "patient_id": str(s.patient_id),
        "clinic_id": str(s.clinic_id),
        "raw_transcript": s.raw_transcript,
        "structured_note": s.structured_note,
        "tags": s.tags,
        "prescription_storage_key": s.prescription_storage_key,
        "prescription_summary": s.prescription_summary,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.post("/session/create", status_code=201)
async def create_session(
    body: CreateSessionBody, db: AsyncSession = Depends(get_db)
) -> dict:
    session = ConsultationSession(patient_id=body.patient_id, clinic_id=body.clinic_id)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"session_id": str(session.id)}


@router.get("/session/{session_id}")
async def get_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        select(ConsultationSession).where(ConsultationSession.id == session_id)
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return _serialize(s)


@router.patch("/session/{session_id}")
async def patch_session(
    session_id: uuid.UUID,
    body: PatchSessionBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(ConsultationSession).where(ConsultationSession.id == session_id)
    )
    s = result.scalar_one_or_none()
    if s is None:
        raise HTTPException(status_code=404, detail="Session not found")

    for key, value in body.model_dump(exclude_none=True).items():
        setattr(s, key, value)

    await db.commit()
    await db.refresh(s)
    return _serialize(s)


@router.get("/patient/{patient_id}/sessions")
async def list_patient_sessions(
    patient_id: uuid.UUID,
    clinic_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await db.execute(
        select(ConsultationSession)
        .where(
            ConsultationSession.patient_id == patient_id,
            ConsultationSession.clinic_id == clinic_id,
        )
        .order_by(ConsultationSession.created_at.desc())
    )
    sessions = result.scalars().all()
    return [
        {
            "session_id": str(s.id),
            "patient_id": str(s.patient_id),
            "clinic_id": str(s.clinic_id),
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "tags": s.tags,
            "has_transcript": s.raw_transcript is not None,
            "has_note": s.structured_note is not None,
            "has_prescription": s.prescription_summary is not None,
        }
        for s in sessions
    ]
