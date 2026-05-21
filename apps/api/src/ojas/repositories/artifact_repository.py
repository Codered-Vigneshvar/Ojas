import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.models.artifact import Artifact


class ArtifactRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, **kwargs: Any) -> Artifact:
        artifact = Artifact(**kwargs)
        self._session.add(artifact)
        await self._session.flush()
        return artifact

    async def list_for_patient(self, patient_id: uuid.UUID) -> list[Artifact]:
        # WHERE on patient_id enforces per-patient scoping at the SQL level.
        result = await self._session.execute(
            select(Artifact)
            .where(Artifact.patient_id == patient_id)
            .order_by(Artifact.created_at.desc())
        )
        return list(result.scalars().all())

    async def get(self, artifact_id: uuid.UUID) -> Artifact | None:
        result = await self._session.execute(
            select(Artifact).where(Artifact.id == artifact_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, artifact_id: uuid.UUID) -> None:
        artifact = await self.get(artifact_id)
        if artifact:
            await self._session.delete(artifact)
            await self._session.flush()

    async def count_for_patient(self, patient_id: uuid.UUID) -> int:
        from sqlalchemy import func

        result = await self._session.execute(
            select(func.count(Artifact.id)).where(Artifact.patient_id == patient_id)
        )
        return result.scalar_one()

    async def update(self, artifact_id: uuid.UUID, **fields: Any) -> Artifact | None:
        artifact = await self.get(artifact_id)
        if artifact is None:
            return None
        for key, value in fields.items():
            setattr(artifact, key, value)
        await self._session.flush()
        return artifact
