"""Dev data seeder — idempotently seeds Clinic and User for local development."""

import asyncio
import sys

import structlog

logger = structlog.get_logger(__name__)


async def seed() -> None:
    from ojas.db.session import async_session_factory
    from ojas.models.clinic import Clinic
    from ojas.models.user import User
    from sqlalchemy import select

    async with async_session_factory() as session:
        result = await session.execute(select(Clinic).where(Clinic.name == "Dr Sreekanth Clinic").limit(1))
        clinic = result.scalar_one_or_none()
        if not clinic:
            clinic = Clinic(name="Dr Sreekanth Clinic")
            session.add(clinic)
            await session.flush()
            logger.info("seed_clinic_created", name="Dr Sreekanth Clinic")
        else:
            logger.info("seed_clinic_exists", name="Dr Sreekanth Clinic")

        result = await session.execute(select(User).where(User.name == "Dr Sreekanth").limit(1))
        user = result.scalar_one_or_none()
        if not user:
            user = User(clinic_id=clinic.id, name="Dr Sreekanth", role="doctor")
            session.add(user)
            logger.info("seed_user_created", name="Dr Sreekanth", clinic_id=str(clinic.id))
        else:
            logger.info("seed_user_exists", name="Dr Sreekanth")

        await session.commit()

    logger.info("seed_complete", records="clinic + user ready")


if __name__ == "__main__":
    asyncio.run(seed())
    sys.exit(0)
