from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import bcrypt
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models import User

_ALGORITHM = "HS256"
_EXPIRE_DAYS = 30
_bearer = HTTPBearer()


@dataclass
class UserInfo:
    user_id: uuid.UUID
    clinic_id: uuid.UUID
    username: str


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=_EXPIRE_DAYS)
    payload = {
        "sub": str(user.id),
        "username": user.username,
        "clinic_id": str(user.clinic_id),
        "exp": expire,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=_ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    db: AsyncSession = Depends(get_db),
) -> UserInfo:
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            credentials.credentials, settings.secret_key, algorithms=[_ALGORITHM]
        )
        user_id: str | None = payload.get("sub")
        clinic_id: str | None = payload.get("clinic_id")
        username: str | None = payload.get("username")
        if not user_id or not clinic_id or not username:
            raise exc
    except JWTError:
        raise exc

    result = await db.execute(select(User).where(User.id == uuid.UUID(user_id)))
    if result.scalar_one_or_none() is None:
        raise exc

    return UserInfo(
        user_id=uuid.UUID(user_id),
        clinic_id=uuid.UUID(clinic_id),
        username=username,
    )
