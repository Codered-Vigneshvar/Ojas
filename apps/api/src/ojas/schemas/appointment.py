import uuid
from datetime import datetime
from pydantic import BaseModel

class AppointmentCreate(BaseModel):
    patient_id: uuid.UUID
    scheduled_time: datetime
    duration_minutes: int = 15
    notes: str | None = None

class AppointmentOut(BaseModel):
    id: uuid.UUID
    clinic_id: uuid.UUID
    patient_id: uuid.UUID
    consultation_id: uuid.UUID | None
    scheduled_time: datetime
    actual_arrival_time: datetime | None
    duration_minutes: int
    status: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    
    # We will include patient_name in the output by joining with Patient
    patient_name: str | None = None

    model_config = {"from_attributes": True}

class AppointmentPatch(BaseModel):
    status: str | None = None
    actual_arrival_time: datetime | None = None
    consultation_id: uuid.UUID | None = None
    scheduled_time: datetime | None = None
    duration_minutes: int | None = None
    notes: str | None = None
