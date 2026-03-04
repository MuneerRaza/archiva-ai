import asyncio
from functools import partial

import boto3
from botocore.config import Config as BotoConfig

from app.config import settings
from app.exceptions import StorageError
from app.logging import get_logger
from app.services.storage.backend import StorageBackend

logger = get_logger(__name__)


class R2StorageBackend(StorageBackend):
    """Cloudflare R2 storage backend using S3-compatible API."""

    def __init__(self) -> None:
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.r2.endpoint_url,
            aws_access_key_id=settings.r2.access_key_id,
            aws_secret_access_key=settings.r2.secret_access_key,
            config=BotoConfig(
                region_name="auto",
                s3={"addressing_style": "path"},
            ),
        )
        self._bucket = settings.r2.bucket_name

    async def upload(self, key: str, data: bytes, content_type: str) -> None:
        try:
            await asyncio.to_thread(
                partial(
                    self._client.put_object,
                    Bucket=self._bucket,
                    Key=key,
                    Body=data,
                    ContentType=content_type,
                )
            )
        except Exception as e:
            logger.exception("r2_upload_failed", key=key)
            raise StorageError(f"Failed to upload file: {e}") from e

    async def generate_download_url(self, key: str, expires_in: int = 3600) -> str:
        try:
            url: str = await asyncio.to_thread(
                partial(
                    self._client.generate_presigned_url,
                    "get_object",
                    Params={"Bucket": self._bucket, "Key": key},
                    ExpiresIn=expires_in,
                )
            )
            return url
        except Exception as e:
            logger.exception("r2_presign_failed", key=key)
            raise StorageError(f"Failed to generate download URL: {e}") from e

    async def delete(self, key: str) -> None:
        try:
            await asyncio.to_thread(
                partial(
                    self._client.delete_object,
                    Bucket=self._bucket,
                    Key=key,
                )
            )
        except Exception as e:
            logger.exception("r2_delete_failed", key=key)
            raise StorageError(f"Failed to delete file: {e}") from e

    async def delete_many(self, keys: list[str]) -> None:
        if not keys:
            return
        try:
            objects = [{"Key": k} for k in keys]
            await asyncio.to_thread(
                partial(
                    self._client.delete_objects,
                    Bucket=self._bucket,
                    Delete={"Objects": objects},
                )
            )
        except Exception as e:
            logger.exception("r2_bulk_delete_failed", count=len(keys))
            raise StorageError(f"Failed to delete files: {e}") from e
