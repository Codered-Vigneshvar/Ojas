import uuid
from typing import TYPE_CHECKING

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ojas.db.base import BaseModel

if TYPE_CHECKING:
    from ojas.models.patient import Patient
    from ojas.models.user import User


class Clinic(BaseModel):
    __tablename__ = "clinics"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    patients: Mapped[list["Patient"]] = relationship("Patient", back_populates="clinic")
    users: Mapped[list["User"]] = relationship("User", back_populates="clinic")
