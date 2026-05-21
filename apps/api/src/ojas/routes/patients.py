import uuid

import structlog
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.deps import get_current_user
from ojas.db.session import get_db
from ojas.models.user import User
from ojas.schemas.artifact import (
    ArtifactOut,
    NoteCreate,
)
from ojas.schemas.patient import PatientCreate, PatientOut
from ojas.services.artifact_service import ArtifactService
from ojas.services.patient_service import PatientService
from ojas.storage.base import ObjectStorage, S3Storage

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/patients", tags=["patients"])


def _get_storage() -> ObjectStorage:
    return S3Storage()



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


# ── Artifacts ─────────────────────────────────────────────────────────────────

@router.get("/{patient_id}/artifacts", response_model=list[ArtifactOut])
async def list_artifacts(
    patient_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    _user: User = Depends(get_current_user),
) -> list[ArtifactOut]:
    from ojas.repositories.artifact_repository import ArtifactRepository
    repo = ArtifactRepository(session)
    artifacts = await repo.list_for_patient(patient_id)
    return [ArtifactOut.model_validate(a) for a in artifacts]


@router.post("/{patient_id}/artifacts/upload", response_model=ArtifactOut, status_code=201)
async def upload_artifact(
    patient_id: uuid.UUID,
    file: UploadFile = File(...),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
) -> ArtifactOut:
    svc = await _artifact_svc(session, user, storage)
    artifact = await svc.upload_file(patient_id, file)
    return ArtifactOut.model_validate(artifact)


@router.post("/{patient_id}/artifacts/note", response_model=ArtifactOut, status_code=201)
async def create_note(
    patient_id: uuid.UUID,
    body: NoteCreate,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
) -> ArtifactOut:
    svc = ArtifactService(
        session=session,
        actor_id=user.id,
        clinic_id=user.clinic_id,
        storage=storage,
    )
    artifact = await svc.create_note(patient_id, body.text)
    return ArtifactOut.model_validate(artifact)


@router.post("/{patient_id}/artifacts/audio", response_model=ArtifactOut, status_code=201)
async def save_audio(
    patient_id: uuid.UUID,
    audio: UploadFile = File(...),
    duration_seconds: float = Form(...),
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
) -> ArtifactOut:
    svc = await _artifact_svc(session, user, storage)
    audio_bytes = await audio.read()
    artifact = await svc.save_audio_artifact(
        patient_id=patient_id,
        audio_bytes=audio_bytes,
        mime_type=audio.content_type or "audio/webm",
        duration_seconds=int(duration_seconds),
    )
    return ArtifactOut.model_validate(artifact)
