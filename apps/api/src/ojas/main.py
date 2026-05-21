from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from ojas.config import settings
from ojas.core.errors import register_exception_handlers
from ojas.core.logging import configure_logging
from ojas.db.session import engine
from ojas.routes.artifacts import router as artifacts_router
from ojas.routes.health import router as health_router
from ojas.routes.patients import router as patients_router

configure_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "startup",
        environment=settings.environment,
        stt_provider=settings.stt_provider,
    )
    yield
    await engine.dispose()
    logger.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Ojas API",
        version="0.3.0",
        description="Clinical patient workspace starter kit — ready for AI extension",
        lifespan=lifespan,
        docs_url="/docs" if settings.is_dev else None,
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(patients_router)
    app.include_router(artifacts_router)

    return app


app = create_app()
