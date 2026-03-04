import uuid

from app.exceptions import NotFoundError, ValidationError
from app.logging import get_logger
from app.models.file import (
    FileContentResponse,
    FileDetailResponse,
    FileDownloadResponse,
    FileResponse,
    FileUpdate,
)
from app.models.tag import TagResponse
from app.repositories.file import FileRepository, FileSortField, SortDirection
from app.repositories.tag import TagRepository
from app.services.processing.events import FileUploaded, event_bus
from app.services.storage.backend import StorageBackend

logger = get_logger(__name__)

MAX_FILE_SIZE = 100 * 1024 * 1024  # 100 MB


class FileService:

    def __init__(
        self,
        repo: FileRepository,
        storage: StorageBackend,
        tag_repo: TagRepository | None = None,
        auto_ingest: bool = True,
    ) -> None:
        self._repo = repo
        self._storage = storage
        self._tag_repo = tag_repo
        self._auto_ingest = auto_ingest

    async def list_files(
        self,
        workspace_id: uuid.UUID,
        folder_id: uuid.UUID | None,
        sort_by: FileSortField = FileSortField.NAME,
        sort_dir: SortDirection = SortDirection.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[FileResponse], int]:
        rows, total = await self._repo.list_by_folder(
            workspace_id, folder_id, sort_by, sort_dir, limit, offset
        )
        files = [FileResponse.from_row(r) for r in rows]
        return files, total

    async def upload_file(
        self,
        workspace_id: uuid.UUID,
        folder_id: uuid.UUID | None,
        filename: str,
        content_type: str,
        data: bytes,
        uploaded_by: str,
    ) -> FileResponse:
        size = len(data)
        if size > MAX_FILE_SIZE:
            raise ValidationError(
                f"File too large ({size} bytes). Maximum is {MAX_FILE_SIZE} bytes."
            )

        file_uuid = uuid.uuid4()
        storage_key = f"workspaces/{workspace_id}/files/{file_uuid}/{filename}"

        await self._storage.upload(storage_key, data, content_type)

        row = await self._repo.create(
            workspace_id=workspace_id,
            folder_id=folder_id,
            name=filename,
            original_name=filename,
            mime_type=content_type,
            size_bytes=size,
            storage_key=storage_key,
            uploaded_by=uploaded_by,
        )

        logger.info(
            "file_uploaded",
            file_id=str(row["id"]),
            workspace_id=str(workspace_id),
            filename=filename,
            size_bytes=size,
        )

        file_response = FileResponse.from_row(row)

        # Auto-trigger processing if enabled
        if self._auto_ingest:
            await event_bus.emit(FileUploaded(
                file_id=file_response.id,
                workspace_id=workspace_id,
                storage_key=storage_key,
                mime_type=content_type,
            ))

        return file_response

    async def get_file_detail(
        self,
        workspace_id: uuid.UUID,
        file_id: uuid.UUID,
    ) -> FileDetailResponse:
        row = await self._repo.get_by_id(file_id, workspace_id)
        if row is None:
            raise NotFoundError("File", str(file_id))

        file = FileResponse.from_row(row)

        content_row = await self._repo.get_content(file_id)
        content = FileContentResponse.from_row(content_row) if content_row else None

        tags: list[TagResponse] = []
        if self._tag_repo:
            tag_rows = await self._tag_repo.get_file_tags(file_id)
            tags = [TagResponse.from_row(r) for r in tag_rows]

        return FileDetailResponse(
            file=file,
            storage_key=row["storage_key"],
            content=content,
            tags=tags,
        )

    async def get_file(
        self,
        workspace_id: uuid.UUID,
        file_id: uuid.UUID,
    ) -> FileResponse:
        row = await self._repo.get_by_id(file_id, workspace_id)
        if row is None:
            raise NotFoundError("File", str(file_id))
        return FileResponse.from_row(row)

    async def update_file(
        self,
        workspace_id: uuid.UUID,
        file_id: uuid.UUID,
        data: FileUpdate,
    ) -> FileResponse:
        row = await self._repo.update(
            file_id=file_id,
            workspace_id=workspace_id,
            name=data.name,
            folder_id=data.folder_id,
            move_to_root=data.move_to_root,
        )
        if row is None:
            raise NotFoundError("File", str(file_id))

        logger.info("file_updated", file_id=str(file_id))
        return FileResponse.from_row(row)

    async def get_download_url(
        self,
        workspace_id: uuid.UUID,
        file_id: uuid.UUID,
    ) -> FileDownloadResponse:
        row = await self._repo.get_by_id(file_id, workspace_id)
        if row is None:
            raise NotFoundError("File", str(file_id))

        url = await self._storage.generate_download_url(row["storage_key"])
        return FileDownloadResponse(url=url, expires_in=3600)

    async def clear_artifacts(
        self,
        workspace_id: uuid.UUID,
        file_id: uuid.UUID,
        fields: set[str],
    ) -> None:
        # Verify file belongs to workspace
        row = await self._repo.get_by_id(file_id, workspace_id)
        if row is None:
            raise NotFoundError("File", str(file_id))
        await self._repo.clear_artifacts(file_id, fields)
        logger.info("artifacts_cleared", file_id=str(file_id), fields=list(fields))

    async def delete_file(
        self,
        workspace_id: uuid.UUID,
        file_id: uuid.UUID,
    ) -> None:
        storage_key = await self._repo.delete(file_id, workspace_id)
        if storage_key is None:
            raise NotFoundError("File", str(file_id))

        await self._storage.delete(storage_key)
        logger.info("file_deleted", file_id=str(file_id))

    async def move_files(
        self,
        workspace_id: uuid.UUID,
        file_ids: list[uuid.UUID],
        target_folder_id: uuid.UUID | None,
    ) -> int:
        count = await self._repo.move_files(file_ids, workspace_id, target_folder_id)
        logger.info(
            "files_moved",
            workspace_id=str(workspace_id),
            count=count,
            target_folder_id=str(target_folder_id) if target_folder_id else "root",
        )
        return count

    async def bulk_delete(
        self,
        workspace_id: uuid.UUID,
        file_ids: list[uuid.UUID],
    ) -> int:
        storage_keys = await self._repo.delete_many(file_ids, workspace_id)
        if storage_keys:
            await self._storage.delete_many(storage_keys)
        logger.info(
            "files_bulk_deleted",
            workspace_id=str(workspace_id),
            count=len(storage_keys),
        )
        return len(storage_keys)
