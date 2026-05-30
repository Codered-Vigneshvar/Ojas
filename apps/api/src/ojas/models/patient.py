import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from ojas.db.base import BaseModel


class Patient(BaseModel):
    __tablename__ = "patients"

    __table_args__ = (
        UniqueConstraint("clinic_id", "phone_e164", name="uq_patient_clinic_phone"),
    )

    clinic_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    phone_e164: Mapped[str] = mapped_column(nullable=False)
    last_accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
