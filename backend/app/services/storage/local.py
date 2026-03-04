import asyncio
from pathlib import Path

import aiofiles

from app.config import settings
from app.exceptions import StorageError
from app.logging import get_logger
from app.services.storage.backend import StorageBackend

logger = get_logger(__name__)

STORAGE_DIR = Path(settings.app.local_storage_path)


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend for development."""

    def __init__(self) -> None:
        STORAGE_DIR.mkdir(parents=True, exist_ok=True)
        logger.info("local_storage_initialized", path=str(STORAGE_DIR))

    def _full_path(self, key: str) -> Path:
        return STORAGE_DIR / key

    async def upload(self, key: str, data: bytes, content_type: str) -> None:
        try:
            path = self._full_path(key)
            path.parent.mkdir(parents=True, exist_ok=True)
            async with aiofiles.open(path, "wb") as f:
                await f.write(data)
        except Exception as e:
            logger.exception("local_upload_failed", key=key)
            raise StorageError(f"Failed to upload file locally: {e}") from e

    async def generate_download_url(self, key: str, expires_in: int = 3600) -> str:
        path = self._full_path(key)
        if not await asyncio.to_thread(path.exists):
            raise StorageError(f"File not found: {key}")
        # Return a relative API path — the download route serves the file
        return f"/api/storage/local/{key}"

    async def delete(self, key: str) -> None:
        try:
            path = self._full_path(key)
            if await asyncio.to_thread(path.exists):
                await asyncio.to_thread(path.unlink)
        except Exception as e:
            logger.exception("local_delete_failed", key=key)
            raise StorageError(f"Failed to delete file locally: {e}") from e

    async def delete_many(self, keys: list[str]) -> None:
        for key in keys:
            await self.delete(key)
