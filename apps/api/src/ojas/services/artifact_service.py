import uuid
from typing import Any

from fastapi import UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.audit import audit_log
from ojas.core.errors import NotFoundError
from ojas.models.artifact import Artifact
from ojas.repositories.artifact_repository import ArtifactRepository
from ojas.storage.base import ObjectStorage
from ojas.stt.base import STTClient

_MIME_TO_TYPE: dict[str, str] = {
    "application/pdf": "report",
    "image/jpeg": "image",
    "image/png": "image",
    "image/heic": "image",
    "image/heif": "image",
    "image/webp": "image",
    "image/gif": "image",
    "image/bmp": "image",
}


def _classify_mime(mime: str) -> str:
    return _MIME_TO_TYPE.get(mime.lower(), "file")


def _human_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes // 1024} KB"
    return f"{size_bytes / (1024 * 1024):.1f} MB"


class ArtifactService:
    def __init__(
        self,
        session: AsyncSession,
        actor_id: uuid.UUID,
        clinic_id: uuid.UUID,
        storage: ObjectStorage,
        stt: STTClient | None = None,
    ) -> None:
        self._session = session
        self._actor_id = actor_id
        self._clinic_id = clinic_id
        self._storage = storage
        self._stt = stt
        self._repo = ArtifactRepository(session)

    async def upload_file(self, patient_id: uuid.UUID, file: UploadFile) -> Artifact:
        data = await file.read()
        mime = file.content_type or "application/octet-stream"
        artifact_type = _classify_mime(mime)
        filename = file.filename or "unnamed"
        storage_key = f"patients/{patient_id}/{uuid.uuid4()}/{filename}"
        await self._storage.put(storage_key, data, content_type=mime)
        summary = f"{mime.split('/')[-1].upper()} · {_human_size(len(data))}"
        artifact = await self._repo.create(
            patient_id=patient_id,
            clinic_id=self._clinic_id,
            type=artifact_type,
            title=filename,
            summary=summary,
            storage_key=storage_key,
            mime_type=mime,
            size_bytes=len(data),
        )
        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="artifact.create",
            resource_type="artifact",
            resource_id=artifact.id,
            metadata={"artifact_type": artifact_type, "patient_id": str(patient_id)},
        )
        await self._session.commit()
        await self._session.refresh(artifact)
        return artifact

    async def create_note(self, patient_id: uuid.UUID, text: str, parent_id: uuid.UUID | None = None) -> Artifact:
        lines = text.strip().splitlines()
        title = (lines[0][:200] if lines else "Note") or "Note"
        line_count = len(lines)
        summary = f"{line_count} line{'s' if line_count != 1 else ''}"
        artifact = await self._repo.create(
            patient_id=patient_id,
            parent_id=parent_id,
            clinic_id=self._clinic_id,
            type="note",
            title=title,
            summary=summary,
            text_content=text,
        )
        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="artifact.create",
            resource_type="artifact",
            resource_id=artifact.id,
            metadata={"artifact_type": "note", "patient_id": str(patient_id)},
        )
        await self._session.commit()
        await self._session.refresh(artifact)
        return artifact

    async def transcribe_audio(self, audio_bytes: bytes, mime_type: str) -> tuple[str, int]:
        if self._stt is None:
            raise RuntimeError("STT client not configured for this service instance")
        transcript = await self._stt.transcribe(audio_bytes)
        return transcript.text, int(transcript.duration_seconds)

    async def save_audio_artifact(
        self,
        patient_id: uuid.UUID,
        audio_bytes: bytes,
        mime_type: str,
        duration_seconds: int,
        parent_id: uuid.UUID | None = None,
    ) -> Artifact:
        extension = ".mp4" if "mp4" in mime_type else ".webm"
        storage_key = f"patients/{patient_id}/audio/{uuid.uuid4()}{extension}"
        await self._storage.put(storage_key, audio_bytes, content_type=mime_type)
        mins = duration_seconds // 60
        secs = duration_seconds % 60
        duration_str = f"{mins} min" if mins > 0 else f"{secs}s"
        artifact = await self._repo.create(
            patient_id=patient_id,
            parent_id=parent_id,
            clinic_id=self._clinic_id,
            type="audio",
            title="Consultation recording",
            summary=f"{duration_str} audio",
            storage_key=storage_key,
            mime_type=mime_type,
            size_bytes=len(audio_bytes),
            duration_seconds=duration_seconds,
        )
        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="artifact.create",
            resource_type="artifact",
            resource_id=artifact.id,
            metadata={"artifact_type": "audio", "patient_id": str(patient_id)},
        )
        await self._session.commit()
        return artifact

    async def list_for_patient(self, patient_id: uuid.UUID) -> list[Artifact]:
        return await self._repo.list_for_patient(patient_id)

    async def get(self, artifact_id: uuid.UUID) -> Artifact | None:
        return await self._repo.get(artifact_id)

    async def delete_artifact(self, artifact_id: uuid.UUID) -> None:
        artifact = await self._repo.get(artifact_id)
        if not artifact:
            raise NotFoundError("Artifact not found")

        # Delete from object storage if a file exists
        if artifact.storage_key:
            try:
                await self._storage.delete(artifact.storage_key)
            except Exception as e:
                import structlog
                logger = structlog.get_logger(__name__)
                logger.warning("storage_delete_failed", error=str(e), key=artifact.storage_key)

        await self._repo.delete(artifact_id)

        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="artifact.delete",
            resource_type="artifact",
            resource_id=artifact_id,
        )
        await self._session.commit()

    async def get_download_url(self, artifact_id: uuid.UUID) -> str:
        artifact = await self._repo.get(artifact_id)
        if not artifact or not artifact.storage_key:
            raise NotFoundError("Artifact not found or has no associated file")
        return await self._storage.presigned_url(artifact.storage_key, expires_in=900)

    async def patch(self, artifact_id: uuid.UUID, **fields: Any) -> Artifact:
        artifact = await self._repo.update(artifact_id, **fields)
        if artifact is None:
            raise NotFoundError("Artifact not found")
        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="artifact.edit",
            resource_type="artifact",
            resource_id=artifact_id,
        )
        await self._session.commit()
        await self._session.refresh(artifact)
        return artifact
