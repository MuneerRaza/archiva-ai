import uuid

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DbConn
from app.models.responses import DataResponse, ListResponse, Pagination
from app.models.workspace import (
    WorkspaceCreate,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.repositories.workspace import WorkspaceRepository
from app.services.workspace import WorkspaceService

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


def _get_service(conn: DbConn) -> WorkspaceService:
    return WorkspaceService(WorkspaceRepository(conn))


@router.get("", response_model=ListResponse[WorkspaceResponse])
async def list_workspaces(
    conn: DbConn,
    user: CurrentUser,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ListResponse[WorkspaceResponse]:
    service = _get_service(conn)
    workspaces, total = await service.list_workspaces(user, limit, offset)
    return ListResponse(
        data=workspaces,
        pagination=Pagination(
            total=total,
            limit=limit,
            offset=offset,
            has_more=offset + limit < total,
        ),
    )


@router.post("", response_model=DataResponse[WorkspaceResponse], status_code=201)
async def create_workspace(
    body: WorkspaceCreate,
    conn: DbConn,
    user: CurrentUser,
) -> DataResponse[WorkspaceResponse]:
    service = _get_service(conn)
    workspace = await service.create_workspace(user, body)
    return DataResponse(data=workspace)


@router.get("/{workspace_id}", response_model=DataResponse[WorkspaceResponse])
async def get_workspace(
    workspace_id: uuid.UUID,
    conn: DbConn,
    user: CurrentUser,
) -> DataResponse[WorkspaceResponse]:
    service = _get_service(conn)
    workspace = await service.get_workspace(user, workspace_id)
    return DataResponse(data=workspace)


@router.patch("/{workspace_id}", response_model=DataResponse[WorkspaceResponse])
async def update_workspace(
    workspace_id: uuid.UUID,
    body: WorkspaceUpdate,
    conn: DbConn,
    user: CurrentUser,
) -> DataResponse[WorkspaceResponse]:
    service = _get_service(conn)
    workspace = await service.update_workspace(user, workspace_id, body)
    return DataResponse(data=workspace)


@router.delete("/{workspace_id}", status_code=204)
async def delete_workspace(
    workspace_id: uuid.UUID,
    conn: DbConn,
    user: CurrentUser,
) -> None:
    service = _get_service(conn)
    await service.delete_workspace(user, workspace_id)


