import uuid

from fastapi import APIRouter, File, Form, Query, UploadFile

from pydantic import BaseModel

from app.api.deps import CurrentUser, DbConn, VerifiedWorkspaceId

from app.models.file import (
    BulkDeleteRequest,
    FileDetailResponse,
    FileDownloadResponse,
    FileResponse,
    FileUpdate,
    MoveFilesRequest,
)
from app.models.responses import DataResponse, ListResponse, Pagination
from app.repositories.file import FileRepository, FileSortField, SortDirection
from app.repositories.tag import TagRepository
from app.config import StorageBackendType, settings
from app.models.workspace import WorkspaceSettingsModel
from app.services.file import FileService
from app.services.storage.backend import StorageBackend

router = APIRouter(tags=["files"])

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


def _get_service(conn: DbConn, auto_ingest: bool = True) -> FileService:
    return FileService(FileRepository(conn), _get_storage(), TagRepository(conn), auto_ingest=auto_ingest)


@router.post(
    "/workspaces/{workspace_id}/files",
    response_model=DataResponse[FileResponse],
    status_code=201,
)
async def upload_file(
    workspace_id: VerifiedWorkspaceId,
    conn: DbConn,
    user: CurrentUser,
    file: UploadFile = File(),
    folder_id: uuid.UUID | None = Form(default=None),
) -> DataResponse[FileResponse]:
    data = await file.read()

    # Check workspace auto_ingest setting
    ws_row = await conn.fetchrow("SELECT settings FROM workspaces WHERE id = $1", workspace_id)
    ws_settings = WorkspaceSettingsModel()
    if ws_row and ws_row["settings"]:
        raw = ws_row["settings"]
        if isinstance(raw, str):
            import json as _json
            raw = _json.loads(raw)
        ws_settings = WorkspaceSettingsModel.model_validate(raw)

    service = _get_service(conn, auto_ingest=ws_settings.ingestion.auto_ingest)
    result = await service.upload_file(
        workspace_id=workspace_id,
        folder_id=folder_id,
        filename=file.filename or "unnamed",
        content_type=file.content_type or "application/octet-stream",
        data=data,
        uploaded_by=user.id,
    )
    return DataResponse(data=result)


@router.get(
    "/workspaces/{workspace_id}/files",
    response_model=ListResponse[FileResponse],
)
async def list_files(
    workspace_id: VerifiedWorkspaceId,
    conn: DbConn,
    folder_id: uuid.UUID | None = Query(default=None),
    sort_by: FileSortField = Query(default=FileSortField.NAME),
    sort_dir: SortDirection = Query(default=SortDirection.ASC),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> ListResponse[FileResponse]:
    service = _get_service(conn)
    files, total = await service.list_files(
        workspace_id, folder_id, sort_by, sort_dir, limit, offset
    )
    return ListResponse(
        data=files,
        pagination=Pagination(
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + limit < total,
        ),
    )


@router.patch(
    "/workspaces/{workspace_id}/files/move",
    response_model=DataResponse[dict],
)
async def move_files(
    workspace_id: VerifiedWorkspaceId,
    body: MoveFilesRequest,
    conn: DbConn,
) -> DataResponse[dict]:
    service = _get_service(conn)
    moved = await service.move_files(workspace_id, body.file_ids, body.target_folder_id)
    return DataResponse(data={"moved": moved})


@router.get(
    "/workspaces/{workspace_id}/files/{file_id}",
    response_model=DataResponse[FileResponse],
)
async def get_file(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    conn: DbConn,
) -> DataResponse[FileResponse]:
    service = _get_service(conn)
    file = await service.get_file(workspace_id, file_id)
    return DataResponse(data=file)


@router.get(
    "/workspaces/{workspace_id}/files/{file_id}/detail",
    response_model=DataResponse[FileDetailResponse],
)
async def get_file_detail(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    conn: DbConn,
) -> DataResponse[FileDetailResponse]:
    service = _get_service(conn)
    detail = await service.get_file_detail(workspace_id, file_id)
    return DataResponse(data=detail)


@router.patch(
    "/workspaces/{workspace_id}/files/{file_id}",
    response_model=DataResponse[FileResponse],
)
async def update_file(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    body: FileUpdate,
    conn: DbConn,
) -> DataResponse[FileResponse]:
    service = _get_service(conn)
    file = await service.update_file(workspace_id, file_id, body)
    return DataResponse(data=file)


@router.get(
    "/workspaces/{workspace_id}/files/{file_id}/download",
    response_model=DataResponse[FileDownloadResponse],
)
async def get_download_url(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    conn: DbConn,
) -> DataResponse[FileDownloadResponse]:
    service = _get_service(conn)
    download = await service.get_download_url(workspace_id, file_id)
    return DataResponse(data=download)


class ClearArtifactsRequest(BaseModel):
    fields: list[str]


@router.delete(
    "/workspaces/{workspace_id}/files/{file_id}/artifacts",
    status_code=204,
)
async def clear_artifacts(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    body: ClearArtifactsRequest,
    conn: DbConn,
) -> None:
    service = _get_service(conn)
    await service.clear_artifacts(workspace_id, file_id, set(body.fields))


@router.delete(
    "/workspaces/{workspace_id}/files/{file_id}",
    status_code=204,
)
async def delete_file(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    conn: DbConn,
) -> None:
    service = _get_service(conn)
    await service.delete_file(workspace_id, file_id)


@router.delete(
    "/workspaces/{workspace_id}/files",
    response_model=DataResponse[dict],
)
async def bulk_delete_files(
    workspace_id: VerifiedWorkspaceId,
    body: BulkDeleteRequest,
    conn: DbConn,
) -> DataResponse[dict]:
    service = _get_service(conn)
    deleted = await service.bulk_delete(workspace_id, body.file_ids)
    return DataResponse(data={"deleted": deleted})
