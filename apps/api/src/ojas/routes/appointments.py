import uuid
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from ojas.core.deps import get_current_user
from ojas.core.errors import NotFoundError
from ojas.db.session import get_db
from ojas.models.appointment import Appointment
from ojas.models.patient import Patient
from ojas.models.consultation import Consultation
from ojas.models.user import User
from ojas.schemas.appointment import AppointmentCreate, AppointmentOut, AppointmentPatch

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/appointments", tags=["appointments"])


def _default_consultation_title() -> str:
    now = datetime.now(tz=timezone.utc)
    return now.strftime("Consultation — %d %b %Y, %I:%M %p")


@router.post("", response_model=AppointmentOut, status_code=201)
async def create_appointment(
    body: AppointmentCreate,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    # Verify patient exists
    result = await session.execute(
        select(Patient).where(Patient.id == body.patient_id, Patient.clinic_id == user.clinic_id)
    )
    patient = result.scalar_one_or_none()
    if not patient:
        raise NotFoundError("Patient not found")

    appointment = Appointment(
        clinic_id=user.clinic_id,
        patient_id=body.patient_id,
        scheduled_time=body.scheduled_time,
        duration_minutes=body.duration_minutes,
        status="scheduled",
        notes=body.notes,
    )
    session.add(appointment)
    await session.commit()
    await session.refresh(appointment)

    # Return with patient name
    out = AppointmentOut.model_validate(appointment)
    out.patient_name = patient.name
    return out


@router.get("/today", response_model=list[AppointmentOut])
async def list_today_appointments(
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    # Use database date functions to get today's appointments in UTC, but practically 
    # we might want to allow passing a date or timezone offset. For simplicity, we just 
    # filter by current date in UTC.
    from datetime import timedelta
    today_start = datetime.now(tz=timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    
    query = (
        select(Appointment, Patient.name.label("patient_name"))
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(
            Appointment.clinic_id == user.clinic_id,
            Appointment.scheduled_time >= today_start,
            Appointment.scheduled_time < tomorrow_start
        )
        .order_by(Appointment.scheduled_time.asc())
    )
    
    result = await session.execute(query)
    rows = result.all()
    
    out = []
    for appt, patient_name in rows:
        appt_out = AppointmentOut.model_validate(appt)
        appt_out.patient_name = patient_name
        out.append(appt_out)
        
    return out


@router.get("", response_model=list[AppointmentOut])
async def list_appointments(
    date: str | None = None, # format YYYY-MM-DD
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    query = (
        select(Appointment, Patient.name.label("patient_name"))
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(Appointment.clinic_id == user.clinic_id)
    )
    
    if date:
        try:
            dt = datetime.strptime(date, "%Y-%m-%d")
            # We assume the date passed is the start of the day in local time or UTC
            query = query.where(func.date(Appointment.scheduled_time) == dt.date())
        except ValueError:
            pass
            
    query = query.order_by(Appointment.scheduled_time.asc())
    
    result = await session.execute(query)
    rows = result.all()
    
    out = []
    for appt, patient_name in rows:
        appt_out = AppointmentOut.model_validate(appt)
        appt_out.patient_name = patient_name
        out.append(appt_out)
        
    return out


@router.patch("/{appointment_id}", response_model=AppointmentOut)
async def patch_appointment(
    appointment_id: uuid.UUID,
    body: AppointmentPatch,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    result = await session.execute(
        select(Appointment, Patient.name.label("patient_name"))
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(Appointment.id == appointment_id, Appointment.clinic_id == user.clinic_id)
    )
    row = result.first()
    if not row:
        raise NotFoundError("Appointment not found")
        
    appointment, patient_name = row

    old_consultation_id = appointment.consultation_id

    updates = body.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(appointment, key, value)

    # Flush the appointment update to avoid foreign key conflicts
    await session.flush()

    if "consultation_id" in updates and updates["consultation_id"] is None and old_consultation_id is not None:
        from sqlalchemy import delete, update
        from ojas.models.artifact import Artifact
        # Orphan artifacts rather than deleting them
        await session.execute(
            update(Artifact)
            .where(Artifact.consultation_id == old_consultation_id)
            .values(consultation_id=None)
        )
        await session.execute(
            delete(Consultation).where(Consultation.id == old_consultation_id)
        )

    if updates.get("status") == "completed":
        from sqlalchemy import update
        await session.execute(
            update(Patient)
            .where(Patient.id == appointment.patient_id)
            .values(last_accessed_at=datetime.now(tz=timezone.utc))
        )

    await session.commit()
    await session.refresh(appointment)

    out = AppointmentOut.model_validate(appointment)
    out.patient_name = patient_name
    return out


@router.delete("/{appointment_id}", status_code=204)
async def delete_appointment(
    appointment_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    result = await session.execute(
        select(Appointment).where(Appointment.id == appointment_id, Appointment.clinic_id == user.clinic_id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise NotFoundError("Appointment not found")

    old_consultation_id = appointment.consultation_id

    await session.delete(appointment)

    if old_consultation_id:
        from sqlalchemy import update, delete
        from ojas.models.artifact import Artifact
        await session.execute(
            update(Artifact)
            .where(Artifact.consultation_id == old_consultation_id)
            .values(consultation_id=None)
        )
        await session.execute(
            delete(Consultation).where(Consultation.id == old_consultation_id)
        )

    await session.commit()


@router.post("/{appointment_id}/start", response_model=dict)
async def start_consultation(
    appointment_id: uuid.UUID,
    session: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Any:
    """
    Shortcut endpoint:
    1. Sets actual_arrival_time = now() if not set
    2. Sets status = 'in_consultation'
    3. Creates a new Consultation
    4. Links the Consultation to the Appointment
    """
    result = await session.execute(
        select(Appointment, Patient.name.label("patient_name"))
        .join(Patient, Patient.id == Appointment.patient_id)
        .where(Appointment.id == appointment_id, Appointment.clinic_id == user.clinic_id)
    )
    row = result.first()
    if not row:
        raise NotFoundError("Appointment not found")
        
    appointment, patient_name = row
    
    # Create new consultation
    consultation = Consultation(
        patient_id=appointment.patient_id,
        clinic_id=user.clinic_id,
        title=_default_consultation_title(),
    )
    session.add(consultation)
    await session.flush() # flush to get consultation.id

    # Update appointment
    if not appointment.actual_arrival_time:
        appointment.actual_arrival_time = datetime.now(tz=timezone.utc)
    
    appointment.status = "in_consultation"
    appointment.consultation_id = consultation.id
    
    await session.commit()
    await session.refresh(appointment)
    
    out = AppointmentOut.model_validate(appointment)
    out.patient_name = patient_name
    
    return {
        "appointment": out,
        "consultation_id": str(consultation.id)
    }
