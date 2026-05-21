import asyncio
import uuid
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from ojas.config import settings
from ojas.db.base import Base
from ojas.main import create_app

url = make_url(settings.database_url)
TEST_DATABASE_URL = url.set(database="ojas_test").render_as_string(hide_password=False)

from sqlalchemy.pool import NullPool

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
test_session_factory = async_sessionmaker(bind=test_engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
def configure_test_settings():
    """Set test-specific config values."""
    settings.stt_provider = "stub"


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="session")
async def seeded_data(setup_db) -> tuple[uuid.UUID, uuid.UUID]:  # type: ignore[misc]
    """Seed a test clinic and user once for the whole test session."""
    from ojas.models.clinic import Clinic
    from ojas.models.user import User

    async with test_session_factory() as session:
        clinic = Clinic(name="Test Clinic")
        session.add(clinic)
        await session.flush()
        user = User(clinic_id=clinic.id, name="Dr Sreekanth", role="doctor")
        session.add(user)
        await session.commit()
        return clinic.id, user.id


@pytest_asyncio.fixture
async def db_session(setup_db) -> AsyncGenerator[AsyncSession, None]:  # type: ignore[misc]
    async with test_session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(seeded_data: tuple[uuid.UUID, uuid.UUID]) -> AsyncGenerator[AsyncClient, None]:
    from sqlalchemy import select

    from ojas.core.deps import get_current_user
    from ojas.db.session import get_db
    from ojas.models.user import User as UserModel
    from ojas.routes.artifacts import _get_storage as artifacts_get_storage
    from ojas.routes.patients import _get_storage as patients_get_storage
    from ojas.storage.base import ObjectStorage

    _clinic_id, user_id = seeded_data

    class MockStorage(ObjectStorage):
        async def put(self, key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
            return key

        async def get(self, key: str) -> bytes:
            return b""

        async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
            return f"http://mock-storage/{key}"

        async def delete(self, key: str) -> None:
            pass

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with test_session_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    async def override_get_user() -> UserModel:
        async with test_session_factory() as session:
            result = await session.execute(select(UserModel).where(UserModel.id == user_id))
            return result.scalar_one()

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_user
    app.dependency_overrides[patients_get_storage] = lambda: MockStorage()
    app.dependency_overrides[artifacts_get_storage] = lambda: MockStorage()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
