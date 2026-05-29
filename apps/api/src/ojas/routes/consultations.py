"""Consultation CRUD routes."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.audit import audit_log
from ojas.core.deps import get_current_user
from ojas.core.errors import NotFoundError
from ojas.db.session import get_db
from ojas.models.artifact import Artifact
from ojas.models.consultation import Consultation, ConsultationMessage
from ojas.models.user import User
from ojas.schemas.consultation import (
    ConsultationCreate, ConsultationOut, ConsultationPatch, 
    ConsultationSummaryOut, AskRequest, AskResponse, ConsultationMessageOut
)
from ojas.services.consolidation_service import ask_consultation
import asyncio

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["consultations"])


def _default_title() -> str:
    now = datetime.now(tz=timezone.utc)
    return now.strftime("Consultation — %d %b %Y, %I:%M %p")


@router.post(
    "/patients/{patient_id}/consultations",
    response_model=ConsultationOut,
    status_code=201,
)
async def create_consultation(
    patient_id: uuid.UUID,
    body: ConsultationCreate,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConsultationOut:
    title = body.title or _default_title()
    consultation = Consultation(
        patient_id=patient_id,
        clinic_id=user.clinic_id,
        title=title,
    )
    session.add(consultation)
    await session.flush()

    await audit_log(
        session=session,
        actor_id=user.id,
        action="consultation.create",
        resource_type="consultation",
        resource_id=consultation.id,
        metadata={"patient_id": str(patient_id)},
    )
    await session.commit()

    return ConsultationOut(
        id=consultation.id,
        patient_id=consultation.patient_id,
        title=consultation.title,
        notes=consultation.notes,
        created_at=consultation.created_at,
        updated_at=consultation.updated_at,
        artifact_count=0,
        summary_text=consultation.summary_text,
        suggested_questions=consultation.suggested_questions,
    )


@router.get(
    "/patients/{patient_id}/consultations",
    response_model=list[ConsultationOut],
)
async def list_consultations(
    patient_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[ConsultationOut]:
    # Subquery to count artifacts per consultation
    artifact_count_sq = (
        select(
            Artifact.consultation_id,
            func.count(Artifact.id).label("cnt"),
        )
        .where(Artifact.consultation_id.isnot(None))
        .group_by(Artifact.consultation_id)
        .subquery()
    )

    result = await session.execute(
        select(Consultation, func.coalesce(artifact_count_sq.c.cnt, 0).label("artifact_count"))
        .outerjoin(artifact_count_sq, Consultation.id == artifact_count_sq.c.consultation_id)
        .where(Consultation.patient_id == patient_id)
        .order_by(Consultation.created_at.desc())
    )

    return [
        ConsultationOut(
            id=row.Consultation.id,
            patient_id=row.Consultation.patient_id,
            title=row.Consultation.title,
            notes=row.Consultation.notes,
            created_at=row.Consultation.created_at,
            updated_at=row.Consultation.updated_at,
            artifact_count=row.artifact_count,
            summary_text=row.Consultation.summary_text,
            suggested_questions=row.Consultation.suggested_questions,
        )
        for row in result
    ]


@router.get("/consultations/{consultation_id}", response_model=ConsultationOut)
async def get_consultation(
    consultation_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ConsultationOut:
    result = await session.execute(
        select(Consultation).where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    if consultation is None:
        raise NotFoundError("Consultation not found")

    count_result = await session.execute(
        select(func.count(Artifact.id)).where(Artifact.consultation_id == consultation_id)
    )
    artifact_count = count_result.scalar_one()

    return ConsultationOut(
        id=consultation.id,
        patient_id=consultation.patient_id,
        title=consultation.title,
        notes=consultation.notes,
        created_at=consultation.created_at,
        updated_at=consultation.updated_at,
        artifact_count=artifact_count,
        summary_text=consultation.summary_text,
        suggested_questions=consultation.suggested_questions,
    )


@router.patch("/consultations/{consultation_id}", response_model=ConsultationOut)
async def patch_consultation(
    consultation_id: uuid.UUID,
    body: ConsultationPatch,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConsultationOut:
    result = await session.execute(
        select(Consultation).where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    if consultation is None:
        raise NotFoundError("Consultation not found")

    updates = body.model_dump(exclude_none=True)
    for key, value in updates.items():
        setattr(consultation, key, value)

    await audit_log(
        session=session,
        actor_id=user.id,
        action="consultation.edit",
        resource_type="consultation",
        resource_id=consultation_id,
    )
    await session.commit()

    count_result = await session.execute(
        select(func.count(Artifact.id)).where(Artifact.consultation_id == consultation_id)
    )
    artifact_count = count_result.scalar_one()

    return ConsultationOut(
        id=consultation.id,
        patient_id=consultation.patient_id,
        title=consultation.title,
        notes=consultation.notes,
        created_at=consultation.created_at,
        updated_at=consultation.updated_at,
        artifact_count=artifact_count,
        summary_text=consultation.summary_text,
        suggested_questions=consultation.suggested_questions,
    )


@router.delete("/consultations/{consultation_id}", status_code=204)
async def delete_consultation(
    consultation_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    result = await session.execute(
        select(Consultation).where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    if consultation is None:
        raise NotFoundError("Consultation not found")

    # Orphan artifacts (set consultation_id to NULL) rather than deleting them
    from sqlalchemy import update
    await session.execute(
        update(Artifact)
        .where(Artifact.consultation_id == consultation_id)
        .values(consultation_id=None)
    )

    await session.delete(consultation)
    await audit_log(
        session=session,
        actor_id=user.id,
        action="consultation.delete",
        resource_type="consultation",
        resource_id=consultation_id,
    )
    await session.commit()


@router.get("/consultations/{consultation_id}/summary", response_model=ConsultationSummaryOut)
async def get_consultation_summary(
    consultation_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> ConsultationSummaryOut:
    result = await session.execute(
        select(Consultation).where(Consultation.id == consultation_id)
    )
    consultation = result.scalar_one_or_none()
    if consultation is None:
        raise NotFoundError("Consultation not found")
        
    count_result = await session.execute(
        select(func.count(Artifact.id)).where(Artifact.consultation_id == consultation_id)
    )
    artifact_count = count_result.scalar_one()

    return ConsultationSummaryOut(
        summary_text=consultation.summary_text,
        suggested_questions=consultation.suggested_questions,
        snippet_count=artifact_count,
    )


@router.get("/consultations/{consultation_id}/messages", response_model=list[ConsultationMessageOut])
async def get_consultation_messages(
    consultation_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[ConsultationMessageOut]:
    result = await session.execute(
        select(ConsultationMessage)
        .where(ConsultationMessage.consultation_id == consultation_id)
        .order_by(ConsultationMessage.created_at.asc())
    )
    return [ConsultationMessageOut.model_validate(msg) for msg in result.scalars().all()]


@router.delete("/consultations/{consultation_id}/messages/{message_id}", status_code=204)
async def delete_consultation_message(
    consultation_id: uuid.UUID,
    message_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> None:
    result = await session.execute(
        select(ConsultationMessage)
        .where(ConsultationMessage.id == message_id, ConsultationMessage.consultation_id == consultation_id)
    )
    message = result.scalar_one_or_none()
    if not message:
        raise NotFoundError("Message not found")
        
    await session.delete(message)
    await session.commit()


@router.post("/consultations/{consultation_id}/ask", response_model=AskResponse)
async def post_ask_consultation(
    consultation_id: uuid.UUID,
    body: AskRequest,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> AskResponse:
    # Check if consultation exists
    result = await session.execute(
        select(Consultation.id).where(Consultation.id == consultation_id)
    )
    if not result.scalar_one_or_none():
        raise NotFoundError("Consultation not found")
        
    # Fetch history
    history_result = await session.execute(
        select(ConsultationMessage)
        .where(ConsultationMessage.consultation_id == consultation_id)
        .order_by(ConsultationMessage.created_at.asc())
    )
    history_msgs = history_result.scalars().all()
    history_dicts = [{"role": m.role, "content": m.content} for m in history_msgs]
    
    # Save user message
    user_msg = ConsultationMessage(
        consultation_id=consultation_id,
        role="user",
        content=body.question
    )
    session.add(user_msg)
    await session.commit()
    await session.refresh(user_msg)
        
    try:
        answer = await ask_consultation(session, consultation_id, body.question, history=history_dicts)
        
        # Save assistant message
        assistant_msg = ConsultationMessage(
            consultation_id=consultation_id,
            role="assistant",
            content=answer
        )
        session.add(assistant_msg)
        await session.commit()
        await session.refresh(assistant_msg)
        
        return AskResponse(
            user_message=ConsultationMessageOut.model_validate(user_msg),
            assistant_message=ConsultationMessageOut.model_validate(assistant_msg)
        )
    except asyncio.CancelledError:
        logger.info(f"Request cancelled for consultation {consultation_id} during ask_consultation")
        raise

