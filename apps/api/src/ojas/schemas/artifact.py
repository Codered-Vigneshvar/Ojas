import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ArtifactOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    consultation_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    type: str
    title: str
    summary: str | None
    storage_key: str | None
    mime_type: str | None
    size_bytes: int | None
    text_content: str | None
    duration_seconds: int | None
    created_at: datetime
    updated_at: datetime
    # AI fields — null until processed
    raw_transcript: str | None = None
    structured_note: dict[str, Any] | None = None
    tags: list[str] | None = None
    prescription_ocr_text: str | None = None
    prescription_summary: dict[str, Any] | None = None
    doctor_confirmed_at: datetime | None = None

    model_config = {"from_attributes": True}


class ArtifactPatch(BaseModel):
    title: str | None = None
    summary: str | None = None
    raw_transcript: str | None = None
    text_content: str | None = None
    structured_note: dict[str, Any] | None = None
    prescription_summary: dict[str, Any] | None = None
    tags: list[str] | None = None



class NoteCreate(BaseModel):
    text: str


class DownloadUrl(BaseModel):
    url: str


class TranscribeResponse(BaseModel):
    transcript: str
    duration_seconds: int


# ── AI response schemas ────────────────────────────────────────────────────────


class TranscribeAIResponse(BaseModel):
    artifact_id: uuid.UUID
    raw_transcript: str
    structured_note: dict[str, Any] | None = None


class StructureResponse(BaseModel):
    artifact_id: uuid.UUID
    structured_note: dict[str, Any]
    tags: list[str]


class PrescriptionOCRResponse(BaseModel):
    artifact_id: uuid.UUID
    prescription_ocr_text: str
    prescription_summary: dict[str, Any]


class ConfirmResponse(BaseModel):
    artifact_id: uuid.UUID
    doctor_confirmed_at: datetime


class VoiceEditResponse(BaseModel):
    artifact_id: uuid.UUID
    structured_note: dict[str, Any]
    correction_transcript: str


class QuickTranscribeResponse(BaseModel):
    transcript: str
