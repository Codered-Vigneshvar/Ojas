import uuid

from sqlalchemy import Column, DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class ConsultationSession(Base):
    __tablename__ = "consultation_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    clinic_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    raw_transcript = Column(Text, nullable=True)
    structured_note = Column(JSONB, nullable=True)
    tags = Column(JSONB, nullable=True)  # list[str]
    prescription_storage_key = Column(Text, nullable=True)  # matches artifacts.storage_key naming
    prescription_summary = Column(JSONB, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
