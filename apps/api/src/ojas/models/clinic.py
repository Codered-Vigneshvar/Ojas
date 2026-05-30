from sqlalchemy.orm import Mapped, mapped_column
from ojas.db.base import BaseModel


class Clinic(BaseModel):
    __tablename__ = "clinics"

    name: Mapped[str] = mapped_column(nullable=False)
