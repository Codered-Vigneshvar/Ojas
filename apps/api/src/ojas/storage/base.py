import io
from abc import ABC, abstractmethod

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
