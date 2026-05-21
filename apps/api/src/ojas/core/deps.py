from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ojas.core.errors import NotFoundError
from ojas.db.session import get_db
from ojas.models.user import User


async def get_current_user(session: AsyncSession = Depends(get_db)) -> User:
    """Stub dependency — always returns the seeded Dr Sreekanth user. Replace with JWT auth later."""
    result = await session.execute(select(User).where(User.name == "Dr Sreekanth").limit(1))
    user = result.scalar_one_or_none()
    if not user:
        raise NotFoundError("Seeded user not found — run: make seed")
    return user
