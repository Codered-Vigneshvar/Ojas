import uuid

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import StreamingResponse
import tempfile
import pathlib
import os
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.audit import audit_log
from ojas.core.deps import get_current_user
from ojas.core.errors import NotFoundError
from ojas.db.session import get_db
from ojas.models.user import User
from ojas.schemas.artifact import (
    ArtifactOut,
    ArtifactPatch,
    DownloadUrl,
)
from ojas.services.artifact_service import ArtifactService
from ojas.storage.base import ObjectStorage, S3Storage

router = APIRouter(tags=["artifacts"])


def _get_storage() -> ObjectStorage:
    return S3Storage()



async def _make_svc(
    session: AsyncSession, user: User, storage: ObjectStorage | None = None
) -> ArtifactService:
    return ArtifactService(
        session=session,
        actor_id=user.id,
        clinic_id=user.clinic_id,
        storage=storage or S3Storage(),
    )


@router.get("/artifacts/{artifact_id}", response_model=ArtifactOut)
async def get_artifact(
    artifact_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArtifactOut:
    svc = await _make_svc(session, user)
    artifact = await svc.get(artifact_id)
    if artifact is None:
        raise NotFoundError("Artifact not found")
    return ArtifactOut.model_validate(artifact)


@router.patch("/artifacts/{artifact_id}", response_model=ArtifactOut)
async def patch_artifact(
    artifact_id: uuid.UUID,
    body: ArtifactPatch,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArtifactOut:
    svc = await _make_svc(session, user)
    updates = body.model_dump(exclude_none=True)
    artifact = await svc.patch(artifact_id, **updates)
    return ArtifactOut.model_validate(artifact)


@router.delete("/artifacts/{artifact_id}", status_code=204)
async def delete_artifact(
    artifact_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
) -> None:
    svc = await _make_svc(session, user, storage)
    await svc.delete_artifact(artifact_id)


@router.get("/artifacts/{artifact_id}/download", response_model=DownloadUrl)
async def download_artifact(
    artifact_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
) -> DownloadUrl:
    svc = await _make_svc(session, user, storage)
    url = await svc.get_download_url(artifact_id)
    return DownloadUrl(url=url)


