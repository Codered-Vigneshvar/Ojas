import uuid
from datetime import UTC
from datetime import datetime as dt

from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.errors import ConflictError
from ojas.models.patient import Patient


class PatientRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, clinic_id: uuid.UUID, name: str, phone_e164: str) -> Patient:
        patient = Patient(clinic_id=clinic_id, name=name, phone_e164=phone_e164)
        self._session.add(patient)
        try:
            await self._session.flush()
            return patient
        except IntegrityError as err:
            await self._session.rollback()
            raise ConflictError(
                "A patient with this phone number already exists in this clinic"
            ) from err

    async def get(self, patient_id: uuid.UUID) -> Patient | None:
        result = await self._session.execute(select(Patient).where(Patient.id == patient_id))
        return result.scalar_one_or_none()

    async def search(self, clinic_id: uuid.UUID, query: str, limit: int = 10) -> list[Patient]:
        q = f"%{query.lower()}%"
        result = await self._session.execute(
            select(Patient)
            .where(
                Patient.clinic_id == clinic_id,
                or_(
                    func.lower(Patient.name).like(q),
                    Patient.phone_e164.like(f"%{query}%"),
                ),
            )
            .order_by(Patient.last_accessed_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_recent(self, clinic_id: uuid.UUID, limit: int = 6) -> list[Patient]:
        result = await self._session.execute(
            select(Patient)
            .where(Patient.clinic_id == clinic_id)
            .order_by(Patient.last_accessed_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def touch_last_accessed(self, patient_id: uuid.UUID) -> None:
        await self._session.execute(
            update(Patient)
            .where(Patient.id == patient_id)
            .values(last_accessed_at=dt.now(UTC))
        )

    async def count(self, clinic_id: uuid.UUID) -> int:
        result = await self._session.execute(
            select(func.count(Patient.id)).where(Patient.clinic_id == clinic_id)
        )
        return result.scalar_one()
