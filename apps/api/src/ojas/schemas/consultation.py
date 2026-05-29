import uuid
from datetime import datetime

from pydantic import BaseModel


class ConsultationCreate(BaseModel):
    title: str | None = None  # auto-generated if omitted


class ConsultationOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    title: str
    notes: str | None
    created_at: datetime
    updated_at: datetime
    artifact_count: int = 0
    summary_text: str | None = None
    suggested_questions: list[str] | None = None

    model_config = {"from_attributes": True}


class ConsultationPatch(BaseModel):
    title: str | None = None
    notes: str | None = None


class ConsultationSummaryOut(BaseModel):
    summary_text: str | None
    suggested_questions: list[str] | None
    snippet_count: int


class AskRequest(BaseModel):
    question: str


class ConsultationMessageOut(BaseModel):
    id: uuid.UUID
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AskResponse(BaseModel):
    user_message: ConsultationMessageOut
    assistant_message: ConsultationMessageOut
