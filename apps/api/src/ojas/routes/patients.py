import uuid

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.deps import get_current_user
from ojas.db.session import get_db
from ojas.models.user import User
from ojas.schemas.artifact import (
    ArtifactOut,
    NoteCreate,
)
from ojas.schemas.patient import PatientCreate, PatientOut, PatientUpdate
from ojas.services.artifact_service import ArtifactService
from ojas.services.patient_service import PatientService
from ojas.storage.base import ObjectStorage, get_storage

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/patients", tags=["patients"])


def _get_storage() -> ObjectStorage:
    return get_storage()



def _patient_svc(session: AsyncSession, user: User) -> PatientService:
    return PatientService(session=session, actor_id=user.id, clinic_id=user.clinic_id)


async def _artifact_svc(
    session: AsyncSession, user: User, storage: ObjectStorage
) -> ArtifactService:
    return ArtifactService(
        session=session,
        actor_id=user.id,
        clinic_id=user.clinic_id,
        storage=storage,
    )


# ── Patients ──────────────────────────────────────────────────────────────────

@router.post("", response_model=PatientOut, status_code=201)
async def create_patient(
    body: PatientCreate,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PatientOut:
    svc = _patient_svc(session, user)
    patient = await svc.create_patient(body.name, body.phone)
    return PatientOut(
        id=patient.id,
        clinic_id=patient.clinic_id,
        name=patient.name,
        phone_e164=patient.phone_e164,
        last_accessed_at=patient.last_accessed_at,
        created_at=patient.created_at,
        artifact_count=0,
    )


@router.get("", response_model=list[PatientOut])
async def list_patients(
    q: str | None = None,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PatientOut]:
    svc = _patient_svc(session, user)
    patients = await svc.search(q) if q else await svc.list_recent()
    return [
        PatientOut(
            id=p.id,
            clinic_id=p.clinic_id,
            name=p.name,
            phone_e164=p.phone_e164,
            last_accessed_at=p.last_accessed_at,
            created_at=p.created_at,
            artifact_count=0,
        )
        for p in patients
    ]


@router.get("/{patient_id}", response_model=PatientOut)
async def get_patient(
    patient_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PatientOut:
    svc = _patient_svc(session, user)
    patient = await svc.get(patient_id)
    return PatientOut(
        id=patient.id,
        clinic_id=patient.clinic_id,
        name=patient.name,
        phone_e164=patient.phone_e164,
        last_accessed_at=patient.last_accessed_at,
        created_at=patient.created_at,
    )


@router.post("/{patient_id}/open", response_model=PatientOut)
async def open_patient(
    patient_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PatientOut:
    svc = _patient_svc(session, user)
    patient, artifact_count = await svc.open_patient(patient_id)
    return PatientOut(
        id=patient.id,
        clinic_id=patient.clinic_id,
        name=patient.name,
        phone_e164=patient.phone_e164,
        last_accessed_at=patient.last_accessed_at,
        created_at=patient.created_at,
        artifact_count=artifact_count,
    )
@router.patch("/{patient_id}", response_model=PatientOut)
async def update_patient(
    patient_id: uuid.UUID,
    body: PatientUpdate,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PatientOut:
    svc = _patient_svc(session, user)
    patient = await svc.update_patient(patient_id, name=body.name, phone_raw=body.phone)
    return PatientOut(
        id=patient.id,
        clinic_id=patient.clinic_id,
        name=patient.name,
        phone_e164=patient.phone_e164,
        last_accessed_at=patient.last_accessed_at,
        created_at=patient.created_at,
    )


@router.delete("/{patient_id}", status_code=204)
async def delete_patient(
    patient_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    svc = _patient_svc(session, user)
    await svc.delete_patient(patient_id)

# ── Artifacts ─────────────────────────────────────────────────────────────────

@router.get("/{patient_id}/artifacts", response_model=list[ArtifactOut])
async def list_artifacts(
    patient_id: uuid.UUID,
    consultation_id: uuid.UUID | None = None,
    q: str | None = None,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[ArtifactOut]:
    from sqlalchemy import select, or_, func
    from ojas.models.artifact import Artifact

    query = select(Artifact).where(Artifact.patient_id == patient_id)
    if consultation_id:
        query = query.where(Artifact.consultation_id == consultation_id)
    if q:
        pattern = f"%{q.lower()}%"
        query = query.where(
            or_(
                func.lower(Artifact.title).like(pattern),
                func.lower(Artifact.text_content).like(pattern),
            )
        )
    query = query.order_by(Artifact.created_at.desc())
    result = await session.execute(query)
    return [ArtifactOut.model_validate(a) for a in result.scalars().all()]


@router.post("/{patient_id}/artifacts/upload", response_model=ArtifactOut, status_code=201)
async def upload_artifact(
    patient_id: uuid.UUID,
    file: UploadFile = File(...),
    consultation_id: str | None = Form(None),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
    background_tasks: BackgroundTasks = None,  # type: ignore[assignment]
) -> ArtifactOut:
    svc = await _artifact_svc(session, user, storage)
    artifact = await svc.upload_file(patient_id, file)
    if consultation_id:
        artifact.consultation_id = uuid.UUID(consultation_id)  # type: ignore[assignment]
        await session.commit()
        await session.refresh(artifact)

    # Background AI labeling + OCR for images in parallel
    if background_tasks:
        background_tasks.add_task(
            _label_file_background, artifact.id, artifact.title, artifact.mime_type or ""
        )
        if artifact.mime_type and artifact.mime_type.startswith("image/"):
            background_tasks.add_task(_auto_ocr_background, artifact.id)

    return ArtifactOut.model_validate(artifact)


@router.post("/{patient_id}/artifacts/note", response_model=ArtifactOut, status_code=201)
async def create_note(
    patient_id: uuid.UUID,
    body: NoteCreate,
    consultation_id: uuid.UUID | None = None,
    parent_id: uuid.UUID | None = None,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
    background_tasks: BackgroundTasks = None,  # type: ignore[assignment]
) -> ArtifactOut:
    svc = ArtifactService(
        session=session,
        actor_id=user.id,
        clinic_id=user.clinic_id,
        storage=storage,
    )
    artifact = await svc.create_note(patient_id, body.text, parent_id=parent_id)
    if consultation_id:
        artifact.consultation_id = consultation_id
        await session.commit()
        await session.refresh(artifact)

    # Background AI labeling
    if background_tasks:
        background_tasks.add_task(_label_note_background, artifact.id, body.text)

    return ArtifactOut.model_validate(artifact)


@router.post("/{patient_id}/artifacts/audio", response_model=ArtifactOut, status_code=201)
async def save_audio(
    patient_id: uuid.UUID,
    audio: UploadFile = File(...),
    duration_seconds: float = Form(...),
    consultation_id: str | None = Form(None),
    parent_id: str | None = Form(None),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
    background_tasks: BackgroundTasks = None,  # type: ignore[assignment]
) -> ArtifactOut:
    svc = await _artifact_svc(session, user, storage)
    audio_bytes = await audio.read()
    
    parsed_parent_id = uuid.UUID(parent_id) if parent_id else None
    
    artifact = await svc.save_audio_artifact(
        patient_id=patient_id,
        audio_bytes=audio_bytes,
        mime_type=audio.content_type or "audio/webm",
        duration_seconds=int(duration_seconds),
        parent_id=parsed_parent_id,
    )
    if consultation_id:
        artifact.consultation_id = uuid.UUID(consultation_id)  # type: ignore[assignment]
        await session.commit()
        await session.refresh(artifact)

    if background_tasks:
        background_tasks.add_task(_process_audio_background, artifact.id)

    return ArtifactOut.model_validate(artifact)


# ── Background labeling helpers ──────────────────────────────────────────────


async def _label_note_background(artifact_id: uuid.UUID, text: str) -> None:
    """AI-label a note artifact in the background."""
    try:
        from ojas.services.labeling_service import label_note
        from ojas.services.llm_service import structure_transcript
        from ojas.db.session import async_session_factory
        from ojas.repositories.artifact_repository import ArtifactRepository

        title = await label_note(text)
        note, tags = await structure_transcript(text)

        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if artifact is not None:
                artifact.title = title
                artifact.structured_note = note
                artifact.tags = tags
                await session.commit()
                if artifact.consultation_id:
                    from ojas.services.consolidation_service import consolidate_consultation
                    await consolidate_consultation(session, artifact.consultation_id)
        logger.info("label_note_bg_done", artifact_id=str(artifact_id), title=title)
    except Exception as exc:
        logger.warning("label_note_bg_failed", artifact_id=str(artifact_id), error=str(exc))


async def _label_file_background(artifact_id: uuid.UUID, filename: str, mime_type: str) -> None:
    """AI-label an uploaded file in the background. Also triggers OCR for images."""
    try:
        from ojas.services.labeling_service import label_file
        from ojas.db.session import async_session_factory
        from ojas.repositories.artifact_repository import ArtifactRepository

        title, category = await label_file(filename, mime_type)
        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if artifact is not None:
                artifact.title = title
                artifact.type = category
                await session.commit()
                if artifact.consultation_id:
                    from ojas.services.consolidation_service import consolidate_consultation
                    await consolidate_consultation(session, artifact.consultation_id)
        logger.info(
            "label_file_bg_done",
            artifact_id=str(artifact_id),
            title=title,
            category=category,
        )


    except Exception as exc:
        logger.warning("label_file_bg_failed", artifact_id=str(artifact_id), error=str(exc))


async def _auto_ocr_background(artifact_id: uuid.UUID) -> None:
    """Auto-OCR an image artifact in the background."""
    try:
        from ojas.db.session import async_session_factory
        from ojas.repositories.artifact_repository import ArtifactRepository
        from ojas.services.ocr_service import extract_text_from_image
        from ojas.services.llm_service import structure_prescription
        from ojas.storage.base import S3Storage

        # Step 1: Quick read metadata from the database
        storage_key = None
        mime_type = None
        title = None
        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if artifact is None or not artifact.storage_key:
                return
            storage_key = artifact.storage_key
            mime_type = artifact.mime_type or "image/jpeg"
            title = artifact.title

        # Step 2: Download and run AI processing outside of the database session
        from ojas.storage.base import get_storage
        storage = get_storage()
        image_bytes = await storage.get(storage_key)
        
        ocr_text = ""
        try:
            ocr_text = await extract_text_from_image(image_bytes, mime_type)
        except Exception as e:
            logger.error("extract_text_from_image_failed", error=str(e), artifact_id=str(artifact_id))

        summary = None
        new_title = None
        new_category = None

        if ocr_text.strip():
            try:
                summary = await structure_prescription(ocr_text)
                # Re-label with OCR context
                from ojas.services.labeling_service import label_file
                new_title, new_category = await label_file(
                    title, mime_type, ocr_text
                )
            except Exception as e:
                logger.error("structure_prescription_failed", error=str(e), artifact_id=str(artifact_id))

        # Step 3: Quick write results to the database in a new transaction
        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if artifact is not None:
                if ocr_text.strip():
                    artifact.prescription_ocr_text = ocr_text
                    artifact.prescription_summary = summary
                    if new_title and new_category:
                        artifact.title = new_title
                        artifact.type = new_category
                else:
                    artifact.prescription_ocr_text = ""
                await session.commit()
                if artifact.consultation_id:
                    from ojas.services.consolidation_service import consolidate_consultation
                    await consolidate_consultation(session, artifact.consultation_id)
        logger.info("auto_ocr_bg_done", artifact_id=str(artifact_id))
    except Exception as exc:
        logger.warning("auto_ocr_bg_failed", artifact_id=str(artifact_id), error=str(exc))
        try:
            from ojas.db.session import async_session_factory
            from ojas.repositories.artifact_repository import ArtifactRepository
            async with async_session_factory() as session:
                repo = ArtifactRepository(session)
                artifact = await repo.get(artifact_id)
                if artifact:
                    artifact.prescription_ocr_text = ""
                    await session.commit()
        except Exception:
            pass


async def _process_audio_background(artifact_id: uuid.UUID) -> None:
    """End-to-end background transcription, structuring, and labeling for audio."""
    try:
        from ojas.db.session import async_session_factory
        from ojas.repositories.artifact_repository import ArtifactRepository
        from ojas.services.llm_service import structure_transcript
        from ojas.services.labeling_service import label_audio
        from ojas.storage.base import S3Storage

        from ojas.storage.base import get_storage
        storage = get_storage()

        # Step 1: Quick read metadata from the database
        storage_key = None
        mime_type = None
        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if not artifact or not artifact.storage_key:
                return
            storage_key = artifact.storage_key
            mime_type = artifact.mime_type or "audio/webm"

        # Step 2: Download and transcribe outside of database session
        audio_bytes = await storage.get(storage_key)
        filename = storage_key.split("/")[-1]
        
        from ojas.stt import get_stt_client
        stt_client = get_stt_client()
        stt_res = await stt_client.transcribe(audio_bytes)
        transcript = stt_res.text

        # Step 3: Quick write transcript to the database
        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if artifact:
                artifact.raw_transcript = transcript
                artifact.text_content = transcript
                await session.commit()

        if not transcript.strip():
            logger.info("process_audio_bg_done_empty_speech", artifact_id=str(artifact_id))
            return

        # Step 4: Structure clinical note outside of database session
        note, tags = await structure_transcript(transcript)

        # Step 5: Quick write structured note to the database
        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if artifact:
                artifact.structured_note = note
                artifact.tags = tags
                await session.commit()

        # Step 6: Generate audio title outside of database session
        title = await label_audio(transcript)

        # Step 7: Quick write title to the database
        async with async_session_factory() as session:
            repo = ArtifactRepository(session)
            artifact = await repo.get(artifact_id)
            if artifact:
                artifact.title = title
                await session.commit()
                if artifact.consultation_id:
                    from ojas.services.consolidation_service import consolidate_consultation
                    await consolidate_consultation(session, artifact.consultation_id)
            
        logger.info("process_audio_bg_done", artifact_id=str(artifact_id), title=title)
    except Exception as exc:
        logger.warning("process_audio_bg_failed", artifact_id=str(artifact_id), error=str(exc))
        try:
            from ojas.db.session import async_session_factory
            from ojas.repositories.artifact_repository import ArtifactRepository
            async with async_session_factory() as session:
                repo = ArtifactRepository(session)
                artifact = await repo.get(artifact_id)
                if artifact:
                    artifact.structured_note = {"error": "processing_failed", "details": str(exc)}
                    await session.commit()
        except Exception:
            pass

