import io
import asyncio
from abc import ABC, abstractmethod
from pathlib import Path

import boto3
from botocore.config import Config

from ojas.config import settings


class ObjectStorage(ABC):
    """Abstract interface for object storage (MinIO locally, S3/R2 in prod)."""

    @abstractmethod
    async def put(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        """Upload object, return key."""

    @abstractmethod
    async def get(self, key: str) -> bytes:
        """Download object bytes."""

    @abstractmethod
    async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a presigned GET URL."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete object."""


class LocalFileStorage(ObjectStorage):
    """Saves files to a local directory — used as a fallback when MinIO is not running."""

    def __init__(self, base_dir: str = "./uploads") -> None:
        self._base = Path(base_dir)
        self._base.mkdir(parents=True, exist_ok=True)

    def _path(self, key: str) -> Path:
        p = self._base / key
        p.parent.mkdir(parents=True, exist_ok=True)
        return p

    async def put(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, self._path(key).write_bytes, data)
        return key

    async def get(self, key: str) -> bytes:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._path(key).read_bytes)

    async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        # In local mode, return a relative path (audio playback uses in-memory blob URL anyway)
        return f"/local-storage/{key}"

    async def delete(self, key: str) -> None:
        p = self._path(key)
        if p.exists():
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, p.unlink)


class S3Storage(ObjectStorage):
    """S3-compatible implementation — works against MinIO in dev and S3/R2 in prod."""

    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(signature_version="s3v4"),
        )
        self._bucket = settings.s3_bucket

    async def put(
        self, key: str, data: bytes, content_type: str = "application/octet-stream"
    ) -> str:
        self._client.upload_fileobj(
            io.BytesIO(data),
            self._bucket,
            key,
            ExtraArgs={"ContentType": content_type},
        )
        return key

    async def get(self, key: str) -> bytes:
        response = self._client.get_object(Bucket=self._bucket, Key=key)
        return response["Body"].read()  # type: ignore[no-any-return]

    async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        return self._client.generate_presigned_url(  # type: ignore[no-any-return]
            "get_object",
            Params={"Bucket": self._bucket, "Key": key},
            ExpiresIn=expires_in,
        )

    async def delete(self, key: str) -> None:
        self._client.delete_object(Bucket=self._bucket, Key=key)


# Module-level cache so connectivity is only checked once at startup
_storage_instance: ObjectStorage | None = None


def get_storage() -> ObjectStorage:
    """
    Returns S3Storage if MinIO/S3 is reachable, otherwise falls back to
    LocalFileStorage (saves to ./uploads on disk).

    This prevents hard failures when MinIO is not running locally.
    """
    global _storage_instance
    if _storage_instance is not None:
        return _storage_instance

    try:
        # Quick connectivity check with very short timeout — fails fast if MinIO is down
        probe = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url,
            aws_access_key_id=settings.s3_access_key,
            aws_secret_access_key=settings.s3_secret_key,
            config=Config(
                signature_version="s3v4",
                connect_timeout=1,
                read_timeout=1,
                retries={"max_attempts": 0},
            ),
        )
        probe.head_bucket(Bucket=settings.s3_bucket)
        _storage_instance = S3Storage()
        import structlog
        structlog.get_logger(__name__).info(
            "storage_backend_s3",
            endpoint=settings.s3_endpoint_url,
            bucket=settings.s3_bucket,
        )
    except Exception as exc:
        uploads_dir = getattr(settings, "uploads_dir", "./uploads")
        _storage_instance = LocalFileStorage(base_dir=uploads_dir)
        import structlog
        structlog.get_logger(__name__).warning(
            "storage_backend_local_fallback",
            reason="MinIO/S3 not reachable — using LocalFileStorage",
            uploads_dir=uploads_dir,
            error=str(exc),
        )

    return _storage_instance
