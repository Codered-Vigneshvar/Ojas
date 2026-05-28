"""Run once to create the initial clinic user: chaithanya / ojas123"""
import asyncio

from sqlalchemy import select

from database import AsyncSessionLocal
from models import DEMO_CLINIC_ID, User
from services.auth import hash_password


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.username == "chaithanya"))
        if result.scalar_one_or_none() is not None:
            print("User 'chaithanya' already exists — skipping.")
            return

        user = User(
            clinic_id=DEMO_CLINIC_ID,
            username="chaithanya",
            password_hash=hash_password("ojas123"),
        )
        db.add(user)
        await db.commit()
        print(f"Created user: chaithanya  (clinic_id={DEMO_CLINIC_ID})")


asyncio.run(seed())
