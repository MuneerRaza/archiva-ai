import uuid

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import DbConn, VerifiedWorkspaceId
from app.models.file import FileResponse
from app.models.folder import FolderResponse
from app.models.responses import Pagination
from app.repositories.file import FileRepository, FileSortField, SortDirection
from app.repositories.folder import FolderRepository

router = APIRouter(tags=["browse"])


class BrowseResponse(BaseModel):
    folders: list[FolderResponse]
    files: list[FileResponse]
    pagination: Pagination


@router.get(
    "/workspaces/{workspace_id}/browse",
    response_model=BrowseResponse,
)
async def browse_folder(
    workspace_id: VerifiedWorkspaceId,
    conn: DbConn,
    folder_id: uuid.UUID | None = Query(default=None),
    sort_by: FileSortField = Query(default=FileSortField.NAME),
    sort_dir: SortDirection = Query(default=SortDirection.ASC),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> BrowseResponse:
    """Single endpoint returning folders + files for a given parent. One access check, one connection."""
    folder_repo = FolderRepository(conn)
    file_repo = FileRepository(conn)

    folder_rows = await folder_repo.list_children(workspace_id, folder_id)
    file_rows, total_files = await file_repo.list_by_folder(
        workspace_id, folder_id, sort_by, sort_dir, limit, offset
    )

    return BrowseResponse(
        folders=[FolderResponse.from_row(r) for r in folder_rows],
        files=[FileResponse.from_row(r) for r in file_rows],
        pagination=Pagination(
            total=total_files,
            limit=limit,
            offset=offset,
            has_more=offset + limit < total_files,
        ),
    )
