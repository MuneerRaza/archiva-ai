import uuid

from fastapi import APIRouter, Query

from app.api.deps import DbConn, VerifiedWorkspaceId
from app.config import settings, StorageBackendType
from app.models.folder import FolderCreate, FolderResponse, FolderUpdate
from app.models.responses import DataResponse
from app.repositories.folder import FolderRepository
from app.services.folder import FolderService
from app.services.storage.backend import StorageBackend

router = APIRouter(
    prefix="/workspaces/{workspace_id}/folders",
    tags=["folders"],
)

_storage: StorageBackend | None = None


def _get_storage() -> StorageBackend:
    global _storage
    if _storage is None:
        if settings.app.storage_backend == StorageBackendType.R2:
            from app.services.storage.r2 import R2StorageBackend
            _storage = R2StorageBackend()
        else:
            from app.services.storage.local import LocalStorageBackend
            _storage = LocalStorageBackend()
    return _storage


def _get_service(conn: DbConn, with_storage: bool = False) -> FolderService:
    storage = _get_storage() if with_storage else None
    return FolderService(FolderRepository(conn), storage=storage)


@router.get("", response_model=list[FolderResponse])
async def list_folders(
    workspace_id: VerifiedWorkspaceId,
    conn: DbConn,
    parent_id: uuid.UUID | None = Query(default=None),
) -> list[FolderResponse]:
    service = _get_service(conn)
    return await service.list_folders(workspace_id, parent_id)


@router.post("", response_model=DataResponse[FolderResponse], status_code=201)
async def create_folder(
    workspace_id: VerifiedWorkspaceId,
    body: FolderCreate,
    conn: DbConn,
) -> DataResponse[FolderResponse]:
    service = _get_service(conn)
    folder = await service.create_folder(workspace_id, body)
    return DataResponse(data=folder)


@router.post("/ensure", response_model=DataResponse[FolderResponse])
async def ensure_folder(
    workspace_id: VerifiedWorkspaceId,
    body: FolderCreate,
    conn: DbConn,
) -> DataResponse[FolderResponse]:
    service = _get_service(conn)
    folder = await service.ensure_folder(workspace_id, body)
    return DataResponse(data=folder)


@router.get("/{folder_id}", response_model=DataResponse[FolderResponse])
async def get_folder(
    workspace_id: VerifiedWorkspaceId,
    folder_id: uuid.UUID,
    conn: DbConn,
) -> DataResponse[FolderResponse]:
    service = _get_service(conn)
    folder = await service.get_folder(workspace_id, folder_id)
    return DataResponse(data=folder)


@router.get("/{folder_id}/ancestors", response_model=list[FolderResponse])
async def get_folder_ancestors(
    workspace_id: VerifiedWorkspaceId,
    folder_id: uuid.UUID,
    conn: DbConn,
) -> list[FolderResponse]:
    service = _get_service(conn)
    return await service.get_ancestors(workspace_id, folder_id)


@router.patch("/{folder_id}", response_model=DataResponse[FolderResponse])
async def rename_folder(
    workspace_id: VerifiedWorkspaceId,
    folder_id: uuid.UUID,
    body: FolderUpdate,
    conn: DbConn,
) -> DataResponse[FolderResponse]:
    service = _get_service(conn)
    folder = await service.rename_folder(workspace_id, folder_id, body)
    return DataResponse(data=folder)


@router.delete("/{folder_id}", status_code=204)
async def delete_folder(
    workspace_id: VerifiedWorkspaceId,
    folder_id: uuid.UUID,
    conn: DbConn,
) -> None:
    service = _get_service(conn, with_storage=True)
    await service.delete_folder(workspace_id, folder_id)
