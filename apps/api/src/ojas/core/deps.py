import uuid

import structlog
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.auth import verify_supabase_token
from ojas.db.session import get_db
from ojas.models.clinic import Clinic
from ojas.models.user import User

logger = structlog.get_logger(__name__)
_bearer = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    session: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = verify_supabase_token(credentials.credentials)
    except PyJWTError as exc:
        logger.warning("auth_token_invalid", error=str(exc))
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = uuid.UUID(payload["sub"])

    result = await session.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        # First login — auto-provision a clinic and user row for this doctor
        email: str = payload.get("email", "")
        meta: dict = payload.get("user_metadata") or {}
        name: str = meta.get("full_name") or meta.get("name") or email.split("@")[0]

        clinic = Clinic(name=f"Dr {name}'s Clinic")
        session.add(clinic)
        await session.flush()

        user = User(id=user_id, clinic_id=clinic.id, name=name, role="doctor")
        session.add(user)
        await session.commit()
        await session.refresh(user)

        logger.info("doctor_provisioned", user_id=str(user_id), name=name)

    return user
