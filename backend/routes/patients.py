from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Patient
from services.auth import UserInfo, get_current_user

router = APIRouter(tags=["patients"])


class CreatePatientBody(BaseModel):
    name: str
    phone: str | None = None
    age: int | None = None
    gender: str | None = None


def _serialize(p: Patient) -> dict:
    return {
        "id": str(p.id),
        "clinic_id": str(p.clinic_id),
        "name": p.name,
        "phone": p.phone,
        "age": p.age,
        "gender": p.gender,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.post("/patients", status_code=201)
async def create_patient(
    body: CreatePatientBody,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> dict:
    patient = Patient(
        clinic_id=current_user.clinic_id,
        name=body.name,
        phone=body.phone,
        age=body.age,
        gender=body.gender,
    )
    db.add(patient)
    await db.commit()
    await db.refresh(patient)
    return _serialize(patient)


@router.get("/patients")
async def list_patients(
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> list[dict]:
    stmt = select(Patient).where(Patient.clinic_id == current_user.clinic_id)
    if q:
        stmt = stmt.where(
            or_(Patient.name.ilike(f"%{q}%"), Patient.phone.ilike(f"%{q}%"))
        )
    stmt = stmt.order_by(Patient.created_at.desc())
    result = await db.execute(stmt)
    return [_serialize(p) for p in result.scalars().all()]


@router.get("/patients/{patient_id}")
async def get_patient(
    patient_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: UserInfo = Depends(get_current_user),
) -> dict:
    result = await db.execute(
        select(Patient).where(
            Patient.id == patient_id,
            Patient.clinic_id == current_user.clinic_id,
        )
    )
    p = result.scalar_one_or_none()
    if p is None:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _serialize(p)
