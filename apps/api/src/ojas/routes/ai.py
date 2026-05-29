"""AI processing routes.

All artifact-scoped endpoints require an existing Artifact by artifact_id.
Auth uses the same stub get_current_user dependency as the other routes.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, File, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.audit import audit_log
from ojas.core.deps import get_current_user
from ojas.core.errors import NotFoundError, ValidationError
from ojas.db.session import async_session_factory, get_db
from ojas.models.user import User
from ojas.repositories.artifact_repository import ArtifactRepository
from ojas.schemas.artifact import (
    ConfirmResponse,
    PrescriptionOCRResponse,
    QuickTranscribeResponse,
    StructureResponse,
    TranscribeAIResponse,
    VoiceEditResponse,
)
from ojas.services.llm_service import (
    apply_voice_correction,
    structure_prescription,
    structure_transcript,
)
from ojas.services.ocr_service import extract_text_from_image
from ojas.services.stt_deepgram import transcribe_audio_deepgram
from ojas.storage.base import S3Storage

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/ai", tags=["ai"])


# ── Background helper ──────────────────────────────────────────────────────────


async def _structure_in_background(artifact_id: uuid.UUID, raw_transcript: str) -> None:
    """Structure a transcript after the /transcribe response is already sent.

    Opens its own DB session — the request session is closed by this point.
    Also AI-labels the artifact with a descriptive title.
    Silently swallows errors so the doctor always sees the raw transcript even
    if GPT-4o structuring fails.
    """
    try:
        note, tags = await structure_transcript(raw_transcript)

        # Also generate a descriptive title
        from ojas.services.labeling_service import label_audio
        title = await label_audio(raw_transcript)

        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if artifact is not None:
                artifact.structured_note = note
                artifact.tags = tags
                if title and artifact.title in ("Consultation recording", "Consultation Recording"):
                    artifact.title = title
                await session.commit()
        logger.info(
            "background_structure_done",
            artifact_id=str(artifact_id),
            tags=tags,
            title=title,
        )
    except Exception as exc:
        logger.warning(
            "background_structure_failed",
            artifact_id=str(artifact_id),
            error=str(exc),
        )


# ── Endpoints ──────────────────────────────────────────────────────────────────


@router.post("/transcribe-bytes", response_model=QuickTranscribeResponse)
async def transcribe_bytes(
    audio: UploadFile = File(...),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> QuickTranscribeResponse:
    """Transcribe uploaded audio bytes without saving anything to DB.

    Used for pause-time partial transcription in the recording flow.
    The audio is never persisted — only the transcript text is returned.
    """
    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/webm"
    transcript = await transcribe_audio_deepgram(
        audio_bytes=audio_bytes,
        content_type=content_type,
        filename=audio.filename or "partial.webm",
    )
    return QuickTranscribeResponse(transcript=transcript)


@router.post("/artifacts/{artifact_id}/transcribe", response_model=TranscribeAIResponse)
async def transcribe_artifact(
    artifact_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TranscribeAIResponse:
    """Download audio from MinIO, transcribe with Deepgram, save raw_transcript.

    Kicks off GPT-4o structuring in the background and returns immediately
    with the raw transcript. Poll GET /artifacts/{id} to check when
    structured_note is populated.
    """
    repo = ArtifactRepository(session)
    artifact = await repo.get(artifact_id)
    if artifact is None:
        raise NotFoundError("Artifact not found")
    if artifact.type != "audio":
        raise ValidationError("Only audio artifacts can be transcribed")
    if not artifact.storage_key:
        raise ValidationError("Artifact has no audio file in storage")

    storage = S3Storage()
    audio_bytes = await storage.get(artifact.storage_key)

    transcript = await transcribe_audio_deepgram(
        audio_bytes=audio_bytes,
        content_type=artifact.mime_type or "audio/webm",
        filename=artifact.storage_key.split("/")[-1],
    )

    artifact.raw_transcript = transcript
    artifact.text_content = transcript  # mirror so existing transcript display works
    await session.commit()

    await audit_log(
        session=session,
        actor_id=user.id,
        action="artifact.ai.transcribe",
        resource_type="artifact",
        resource_id=artifact_id,
    )

    if transcript:
        background_tasks.add_task(_structure_in_background, artifact_id, transcript)

    return TranscribeAIResponse(
        artifact_id=artifact_id,
        raw_transcript=transcript,
        structured_note=None,
    )


@router.post("/artifacts/{artifact_id}/structure", response_model=StructureResponse)
async def structure_artifact_transcript(
    artifact_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StructureResponse:
    """Explicitly (re-)structure a saved raw transcript.

    Useful if the background task failed or the doctor wants to refresh.
    The artifact must already have raw_transcript saved.
    """
    repo = ArtifactRepository(session)
    artifact = await repo.get(artifact_id)
    if artifact is None:
        raise NotFoundError("Artifact not found")
    if not artifact.raw_transcript:
        raise ValidationError("No transcript saved — run /transcribe first")

    note, tags = await structure_transcript(artifact.raw_transcript)
    artifact.structured_note = note
    artifact.tags = tags
    await session.commit()

    await audit_log(
        session=session,
        actor_id=user.id,
        action="artifact.ai.structure",
        resource_type="artifact",
        resource_id=artifact_id,
    )

    return StructureResponse(
        artifact_id=artifact_id,
        structured_note=note,
        tags=tags,
    )


@router.post("/artifacts/{artifact_id}/ocr", response_model=PrescriptionOCRResponse)
async def ocr_prescription(
    artifact_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PrescriptionOCRResponse:
    """Download image from MinIO, run GPT-4o Vision OCR, structure prescription.

    Saves prescription_ocr_text (raw) and prescription_summary (structured) on the artifact.
    """
    repo = ArtifactRepository(session)
    artifact = await repo.get(artifact_id)
    if artifact is None:
        raise NotFoundError("Artifact not found")
    if artifact.type not in ("image", "prescription"):
        raise ValidationError("Only image or prescription artifacts can be OCR-processed")
    if not artifact.storage_key:
        raise ValidationError("Artifact has no image file in storage")

    storage = S3Storage()
    image_bytes = await storage.get(artifact.storage_key)
    mime_type = artifact.mime_type or "image/jpeg"

    ocr_text = await extract_text_from_image(image_bytes, mime_type)
    summary = await structure_prescription(ocr_text)

    artifact.prescription_ocr_text = ocr_text
    artifact.prescription_summary = summary
    await session.commit()

    await audit_log(
        session=session,
        actor_id=user.id,
        action="artifact.ai.ocr",
        resource_type="artifact",
        resource_id=artifact_id,
    )

    return PrescriptionOCRResponse(
        artifact_id=artifact_id,
        prescription_ocr_text=ocr_text,
        prescription_summary=summary,
    )


@router.post("/artifacts/{artifact_id}/confirm", response_model=ConfirmResponse)
async def confirm_artifact(
    artifact_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ConfirmResponse:
    """Doctor explicitly confirms the AI-extracted content for this artifact.

    Sets doctor_confirmed_at to now. The confirm button in the UI changes from
    glowing (pending) to a stable confirmed state after this call succeeds.
    """
    repo = ArtifactRepository(session)
    artifact = await repo.get(artifact_id)
    if artifact is None:
        raise NotFoundError("Artifact not found")

    confirmed_at = datetime.now(tz=timezone.utc)
    artifact.doctor_confirmed_at = confirmed_at
    await session.commit()

    await audit_log(
        session=session,
        actor_id=user.id,
        action="artifact.ai.confirm",
        resource_type="artifact",
        resource_id=artifact_id,
    )

    return ConfirmResponse(
        artifact_id=artifact_id,
        doctor_confirmed_at=confirmed_at,
    )


@router.post("/artifacts/{artifact_id}/voice-edit", response_model=VoiceEditResponse)
async def voice_edit_artifact(
    artifact_id: uuid.UUID,
    audio: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> VoiceEditResponse:
    """Apply a doctor's spoken correction to the structured note.

    Transcribes the uploaded audio, then asks GPT-4o to update ONLY the fields
    explicitly mentioned in the correction. All other fields remain unchanged.
    Does NOT reset doctor_confirmed_at — doctor must re-confirm if desired.
    """
    repo = ArtifactRepository(session)
    artifact = await repo.get(artifact_id)
    if artifact is None:
        raise NotFoundError("Artifact not found")
    if not artifact.structured_note:
        raise ValidationError("No structured note saved — run /transcribe and /structure first")

    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/webm"
    correction_transcript = await transcribe_audio_deepgram(
        audio_bytes=audio_bytes,
        content_type=content_type,
        filename=audio.filename or "correction.webm",
    )

    updated_note = await apply_voice_correction(
        current_note=artifact.structured_note,
        correction_transcript=correction_transcript,
    )

    artifact.structured_note = updated_note
    await session.commit()

    await audit_log(
        session=session,
        actor_id=user.id,
        action="artifact.ai.voice_edit",
        resource_type="artifact",
        resource_id=artifact_id,
    )

    return VoiceEditResponse(
        artifact_id=artifact_id,
        structured_note=updated_note,
        correction_transcript=correction_transcript,
    )
