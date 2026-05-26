"""Run once to create tables: python init_db.py"""

import asyncio

from database import engine
from models import Base


async def init() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Tables created in ojas_demo.")


if __name__ == "__main__":
    asyncio.run(init())
