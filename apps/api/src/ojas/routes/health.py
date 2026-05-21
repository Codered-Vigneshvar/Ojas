from typing import Any

import redis.asyncio as aioredis
import structlog
from fastapi import APIRouter
from sqlalchemy import text

from ojas.config import settings
from ojas.db.session import async_session_factory

router = APIRouter(tags=["health"])
logger = structlog.get_logger(__name__)


@router.get("/health")
async def health_check() -> dict[str, Any]:
    status: dict[str, Any] = {"status": "ok", "checks": {}}

    # DB
    try:
        async with async_session_factory() as session:
            await session.execute(text("SELECT 1"))
        status["checks"]["database"] = "ok"
    except Exception as exc:
        logger.error("health_db_fail", error=str(exc))
        status["checks"]["database"] = "error"
        status["status"] = "degraded"

    # Redis
    try:
        client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await client.ping()
        await client.aclose()
        status["checks"]["redis"] = "ok"
    except Exception as exc:
        logger.error("health_redis_fail", error=str(exc))
        status["checks"]["redis"] = "error"
        status["status"] = "degraded"

    return status
