import uuid
from datetime import datetime

import phonenumbers
from phonenumbers import NumberParseException
from pydantic import BaseModel, field_validator


class PatientCreate(BaseModel):
    name: str
    phone: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        try:
            parsed = phonenumbers.parse(v, "IN")
            if not phonenumbers.is_valid_number(parsed):
                raise ValueError("Invalid phone number — please ensure it is exactly 10 digits or includes the correct country code")
            return phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
        except NumberParseException as err:
            raise ValueError(
                "Invalid phone number — expected +91XXXXXXXXXX or 10-digit Indian number"
            ) from err


class PatientOut(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    name: str
    phone_e164: str
    last_accessed_at: datetime
    created_at: datetime
    artifact_count: int | None = None

    model_config = {"from_attributes": True}


class PatientUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
