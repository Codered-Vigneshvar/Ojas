import uuid

import phonenumbers
from phonenumbers import NumberParseException
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.audit import audit_log
from ojas.core.errors import NotFoundError, ValidationError
from ojas.models.patient import Patient
from ojas.repositories.artifact_repository import ArtifactRepository
from ojas.repositories.patient_repository import PatientRepository


class PatientService:
    def __init__(
        self, session: AsyncSession, actor_id: uuid.UUID, clinic_id: uuid.UUID
    ) -> None:
        self._session = session
        self._actor_id = actor_id
        self._clinic_id = clinic_id
        self._repo = PatientRepository(session)
        self._artifact_repo = ArtifactRepository(session)

    @staticmethod
    def normalize_phone(raw: str) -> str:
        try:
            parsed = phonenumbers.parse(raw, "IN")
            if not phonenumbers.is_valid_number(parsed):
                raise ValidationError("Invalid phone number — please ensure it is exactly 10 digits or includes the correct country code")
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except NumberParseException as err:
            raise ValidationError(
                "Invalid phone number — expected +91XXXXXXXXXX or 10-digit Indian number"
            ) from err

    async def create_patient(self, name: str, phone_raw: str) -> Patient:
        phone_e164 = self.normalize_phone(phone_raw)
        patient = await self._repo.create(
            clinic_id=self._clinic_id,
            name=name.strip(),
            phone_e164=phone_e164,
        )
        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="patient.create",
            resource_type="patient",
            resource_id=patient.id,
        )
        return patient

    async def open_patient(self, patient_id: uuid.UUID) -> tuple[Patient, int]:
        patient = await self._repo.get(patient_id)
        if not patient:
            raise NotFoundError("Patient not found")
        count = await self._artifact_repo.count_for_patient(patient_id)
        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="patient.open",
            resource_type="patient",
            resource_id=patient_id,
        )
        return patient, count

    async def get(self, patient_id: uuid.UUID) -> Patient:
        patient = await self._repo.get(patient_id)
        if not patient:
            raise NotFoundError("Patient not found")
        return patient

    async def list_recent(self) -> list[Patient]:
        return await self._repo.list_recent(self._clinic_id)

    async def search(self, query: str) -> list[Patient]:
        return await self._repo.search(self._clinic_id, query)

    async def update_patient(
        self, patient_id: uuid.UUID, name: str | None = None, phone_raw: str | None = None
    ) -> Patient:
        patient = await self._repo.get(patient_id)
        if not patient or patient.clinic_id != self._clinic_id:
            raise NotFoundError("Patient not found")

        phone_e164 = None
        if phone_raw is not None:
            phone_e164 = self.normalize_phone(phone_raw)

        updated_patient = await self._repo.update(
            patient_id=patient_id,
            name=name if name is not None else None,
            phone_e164=phone_e164
        )
        
        if not updated_patient:
            raise NotFoundError("Patient not found")

        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="patient.update",
            resource_type="patient",
            resource_id=patient.id,
        )
        return updated_patient

    async def delete_patient(self, patient_id: uuid.UUID) -> None:
        patient = await self._repo.get(patient_id)
        if not patient or patient.clinic_id != self._clinic_id:
            raise NotFoundError("Patient not found")

        success = await self._repo.delete(patient_id)
        if not success:
            raise NotFoundError("Patient not found")

        await audit_log(
            session=self._session,
            actor_id=self._actor_id,
            action="patient.delete",
            resource_type="patient",
            resource_id=patient_id,
        )
