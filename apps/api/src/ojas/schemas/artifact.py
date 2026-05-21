import uuid
from datetime import datetime

from pydantic import BaseModel


class ArtifactOut(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
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

    model_config = {"from_attributes": True}


class ArtifactPatch(BaseModel):
    title: str | None = None
    summary: str | None = None


class NoteCreate(BaseModel):
    text: str


class DownloadUrl(BaseModel):
    url: str


class TranscribeResponse(BaseModel):
    transcript: str
    duration_seconds: int
