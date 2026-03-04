import uuid

from app.exceptions import ConflictError, NotFoundError
from app.logging import get_logger
from app.models.folder import FolderCreate, FolderResponse, FolderUpdate
from app.repositories.folder import FolderRepository
from app.services.storage.backend import StorageBackend

logger = get_logger(__name__)


class FolderService:

    def __init__(self, repo: FolderRepository, storage: StorageBackend | None = None) -> None:
        self._repo = repo
        self._storage = storage

    async def list_folders(
        self,
        workspace_id: uuid.UUID,
        parent_id: uuid.UUID | None,
    ) -> list[FolderResponse]:
        rows = await self._repo.list_children(workspace_id, parent_id)
        return [FolderResponse.from_row(r) for r in rows]

    async def get_folder(
        self,
        workspace_id: uuid.UUID,
        folder_id: uuid.UUID,
    ) -> FolderResponse:
        row = await self._repo.get_by_id(folder_id, workspace_id)
        if row is None:
            raise NotFoundError("Folder", str(folder_id))
        return FolderResponse.from_row(row)

    async def get_ancestors(
        self,
        workspace_id: uuid.UUID,
        folder_id: uuid.UUID,
    ) -> list[FolderResponse]:
        rows = await self._repo.get_ancestors(folder_id, workspace_id)
        return [FolderResponse.from_row(r) for r in rows]

    async def create_folder(
        self,
        workspace_id: uuid.UUID,
        data: FolderCreate,
    ) -> FolderResponse:
        # Check name conflict
        if await self._repo.name_exists_in_parent(
            workspace_id, data.parent_id, data.name
        ):
            raise ConflictError(f"Folder '{data.name}' already exists in this location")

        # Compute materialized path
        if data.parent_id is not None:
            parent = await self._repo.get_by_id(data.parent_id, workspace_id)
            if parent is None:
                raise NotFoundError("Parent folder", str(data.parent_id))
            path = f"{parent['path']}/{data.name}"
        else:
            path = f"/{data.name}"

        row = await self._repo.create(
            workspace_id=workspace_id,
            parent_id=data.parent_id,
            name=data.name,
            path=path,
        )

        logger.info(
            "folder_created",
            folder_id=str(row["id"]),
            workspace_id=str(workspace_id),
            path=path,
        )
        return FolderResponse.from_row(row)

    async def rename_folder(
        self,
        workspace_id: uuid.UUID,
        folder_id: uuid.UUID,
        data: FolderUpdate,
    ) -> FolderResponse:
        folder = await self._repo.get_by_id(folder_id, workspace_id)
        if folder is None:
            raise NotFoundError("Folder", str(folder_id))

        if folder["name"] == data.name:
            return FolderResponse.from_row(folder)

        # Check name conflict
        if await self._repo.name_exists_in_parent(
            workspace_id, folder["parent_id"], data.name, exclude_id=folder_id
        ):
            raise ConflictError(f"Folder '{data.name}' already exists in this location")

        old_path = folder["path"]
        # Replace the last segment of the path
        parent_path = old_path.rsplit("/", 1)[0]
        new_path = f"{parent_path}/{data.name}" if parent_path else f"/{data.name}"

        # Transactional rename: update self + all descendants
        async with self._repo._conn.transaction():
            row = await self._repo.update_name_and_path(folder_id, data.name, new_path)
            if old_path != new_path:
                count = await self._repo.update_paths_prefix(
                    workspace_id, old_path, new_path
                )
                logger.info(
                    "folder_descendants_updated",
                    folder_id=str(folder_id),
                    old_path=old_path,
                    new_path=new_path,
                    descendants_updated=count,
                )

        logger.info(
            "folder_renamed",
            folder_id=str(folder_id),
            old_name=folder["name"],
            new_name=data.name,
        )
        return FolderResponse.from_row(row)

    async def delete_folder(
        self,
        workspace_id: uuid.UUID,
        folder_id: uuid.UUID,
    ) -> None:
        # Verify folder exists
        folder = await self._repo.get_by_id(folder_id, workspace_id)
        if folder is None:
            raise NotFoundError("Folder", str(folder_id))

        # Get all descendant folder IDs (including this one)
        all_folder_ids = await self._repo.get_all_descendant_folder_ids(folder_id, workspace_id)

        # Get files to delete from storage
        file_rows = await self._repo.get_files_in_folders(all_folder_ids)

        # Delete storage files
        if self._storage and file_rows:
            for row in file_rows:
                try:
                    await self._storage.delete(row["storage_key"])
                except Exception:
                    logger.warning("storage_delete_failed", storage_key=row["storage_key"])

        # Delete all files in these folders (DB cascade handles file_contents, file_tables, etc.)
        file_count = await self._repo.delete_files_in_folders(all_folder_ids)

        # Delete the folder (DB cascade handles subfolders)
        await self._repo.delete(folder_id, workspace_id)

        logger.info(
            "folder_deleted",
            folder_id=str(folder_id),
            workspace_id=str(workspace_id),
            files_deleted=file_count,
            folders_deleted=len(all_folder_ids),
        )
