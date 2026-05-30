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
from ojas.storage.base import ObjectStorage, get_storage
from fastapi import BackgroundTasks

router = APIRouter(tags=["artifacts"])


def _get_storage() -> ObjectStorage:
    return get_storage()



async def _make_svc(
    session: AsyncSession, user: User, storage: ObjectStorage | None = None
) -> ArtifactService:
    return ArtifactService(
        session=session,
        actor_id=user.id,
        clinic_id=user.clinic_id,
        storage=storage or get_storage(),
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
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ArtifactOut:
    svc = await _make_svc(session, user)
    updates = body.model_dump(exclude_none=True)

    # Auto-label note when its content changes (unless user explicitly customized the title)
    orig = await svc.get(artifact_id)
    if orig and orig.type == "note" and "text_content" in updates:
        title_explicit = updates.get("title")
        if not title_explicit or title_explicit == orig.title:
            try:
                from ojas.services.labeling_service import label_note
                new_title = await label_note(updates["text_content"])
                updates["title"] = new_title
            except Exception:
                pass

    artifact = await svc.patch(artifact_id, **updates)
    
    if artifact and artifact.consultation_id:
        background_tasks.add_task(_trigger_consolidation, str(artifact.consultation_id))
        
    return ArtifactOut.model_validate(artifact)


@router.delete("/artifacts/{artifact_id}", status_code=204)
async def delete_artifact(
    artifact_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    storage: ObjectStorage = Depends(_get_storage),
) -> None:
    svc = await _make_svc(session, user, storage)
    orig = await svc.get(artifact_id)
    if orig and orig.consultation_id:
        consultation_id = str(orig.consultation_id)
    else:
        consultation_id = None
        
    await svc.delete_artifact(artifact_id)
    
    if consultation_id:
        background_tasks.add_task(_trigger_consolidation, consultation_id)


async def _trigger_consolidation(consultation_id_str: str) -> None:
    """Run consolidation in a fresh session."""
    from ojas.db.session import async_session_factory
    from ojas.services.consolidation_service import consolidate_consultation
    try:
        async with async_session_factory() as session:
            await consolidate_consultation(session, uuid.UUID(consultation_id_str))
    except Exception as exc:
        import structlog
        structlog.get_logger(__name__).warning("consolidation_bg_failed", error=str(exc))


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


