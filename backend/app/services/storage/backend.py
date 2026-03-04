from abc import ABC, abstractmethod


class StorageBackend(ABC):
    """Abstract base class for file storage backends."""

    @abstractmethod
    async def upload(self, key: str, data: bytes, content_type: str) -> None:
        """Upload file data to the given storage key."""

    @abstractmethod
    async def generate_download_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a pre-signed download URL for the given storage key."""

    @abstractmethod
    async def delete(self, key: str) -> None:
        """Delete a single file by storage key."""

    @abstractmethod
    async def delete_many(self, keys: list[str]) -> None:
        """Delete multiple files by storage keys."""
