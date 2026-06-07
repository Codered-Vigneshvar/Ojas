import uuid

import structlog
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.deps import get_current_user
from ojas.db.session import get_db
from ojas.models.clinic import Clinic
from ojas.models.user import User

logger = structlog.get_logger(__name__)
router = APIRouter(tags=["users"])


class MeOut(BaseModel):
    id: uuid.UUID
    name: str
    role: str
    clinic_id: uuid.UUID
    clinic_name: str

    model_config = {"from_attributes": True}


class PatchMeBody(BaseModel):
    name: str | None = None
    clinic_name: str | None = None


@router.get("/users/me", response_model=MeOut)
async def get_me(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MeOut:
    result = await session.execute(select(Clinic).where(Clinic.id == user.clinic_id))
    clinic = result.scalar_one()
    return MeOut(
        id=user.id,
        name=user.name,
        role=user.role,
        clinic_id=user.clinic_id,
        clinic_name=clinic.name,
    )


@router.patch("/users/me", response_model=MeOut)
async def patch_me(
    body: PatchMeBody,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
) -> MeOut:
    if body.name is not None:
        await session.execute(
            update(User).where(User.id == user.id).values(name=body.name)
        )

    if body.clinic_name is not None:
        await session.execute(
            update(Clinic).where(Clinic.id == user.clinic_id).values(name=body.clinic_name)
        )

    await session.commit()

    result = await session.execute(select(Clinic).where(Clinic.id == user.clinic_id))
    clinic = result.scalar_one()

    await session.refresh(user)
    return MeOut(
        id=user.id,
        name=user.name,
        role=user.role,
        clinic_id=user.clinic_id,
        clinic_name=clinic.name,
    )
