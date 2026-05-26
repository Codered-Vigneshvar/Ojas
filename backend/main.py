import pathlib
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes.sessions import router as sessions_router
from routes.structure import router as structure_router
from routes.transcribe import router as transcribe_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None, None]:
    pathlib.Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="Ojas Demo API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions_router)
app.include_router(transcribe_router)
app.include_router(structure_router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
