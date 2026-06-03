import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ojas.db.base import BaseModel

if TYPE_CHECKING:
    from ojas.models.artifact import Artifact
    from ojas.models.clinic import Clinic
    from ojas.models.consultation import Consultation


class Patient(BaseModel):
    __tablename__ = "patients"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone_e164: Mapped[str] = mapped_column(String(20), nullable=False)
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    clinic: Mapped["Clinic"] = relationship("Clinic", back_populates="patients")
    artifacts: Mapped[list["Artifact"]] = relationship("Artifact", back_populates="patient")
    consultations: Mapped[list["Consultation"]] = relationship("Consultation", back_populates="patient")
