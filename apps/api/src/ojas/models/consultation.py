import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ojas.db.base import BaseModel

if TYPE_CHECKING:
    from ojas.models.artifact import Artifact
    from ojas.models.patient import Patient


class Consultation(BaseModel):
    __tablename__ = "consultations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggested_questions: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    clinical_manifest: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="consultations")
    artifacts: Mapped[list["Artifact"]] = relationship("Artifact", back_populates="consultation")
    messages: Mapped[list["ConsultationMessage"]] = relationship("ConsultationMessage", back_populates="consultation", order_by="ConsultationMessage.created_at")


class ConsultationMessage(BaseModel):
    __tablename__ = "consultation_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    consultation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("consultations.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    consultation: Mapped["Consultation"] = relationship("Consultation", back_populates="messages")
