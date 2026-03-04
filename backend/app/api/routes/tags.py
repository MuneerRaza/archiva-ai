import uuid

from fastapi import APIRouter

from app.api.deps import DbConn, VerifiedWorkspaceId
from app.exceptions import ConflictError, NotFoundError
from app.models.responses import DataResponse
from app.models.tag import TagCreate, TagResponse
from app.repositories.tag import TagRepository

router = APIRouter(
    prefix="/workspaces/{workspace_id}/tags",
    tags=["tags"],
)


def _get_repo(conn: DbConn) -> TagRepository:
    return TagRepository(conn)


@router.get("", response_model=list[TagResponse])
async def list_tags(
    workspace_id: VerifiedWorkspaceId,
    conn: DbConn,
) -> list[TagResponse]:
    repo = _get_repo(conn)
    rows = await repo.list_by_workspace(workspace_id)
    return [TagResponse.from_row(r) for r in rows]


@router.post("", response_model=DataResponse[TagResponse], status_code=201)
async def create_tag(
    workspace_id: VerifiedWorkspaceId,
    body: TagCreate,
    conn: DbConn,
) -> DataResponse[TagResponse]:
    repo = _get_repo(conn)
    try:
        row = await repo.create(workspace_id, body.name, body.color)
    except Exception as e:
        if "unique" in str(e).lower():
            raise ConflictError(f"Tag '{body.name}' already exists") from e
        raise
    return DataResponse(data=TagResponse.from_row(row))


@router.delete("/{tag_id}", status_code=204)
async def delete_tag(
    workspace_id: VerifiedWorkspaceId,
    tag_id: uuid.UUID,
    conn: DbConn,
) -> None:
    repo = _get_repo(conn)
    deleted = await repo.delete(tag_id, workspace_id)
    if not deleted:
        raise NotFoundError("Tag", str(tag_id))


@router.get("/files/{file_id}", response_model=list[TagResponse])
async def get_file_tags(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    conn: DbConn,
) -> list[TagResponse]:
    repo = _get_repo(conn)
    rows = await repo.get_file_tags(file_id)
    return [TagResponse.from_row(r) for r in rows]


@router.post("/files/{file_id}/{tag_id}", status_code=204)
async def add_tag_to_file(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    tag_id: uuid.UUID,
    conn: DbConn,
) -> None:
    repo = _get_repo(conn)
    await repo.add_to_file(file_id, tag_id)


@router.delete("/files/{file_id}/{tag_id}", status_code=204)
async def remove_tag_from_file(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    tag_id: uuid.UUID,
    conn: DbConn,
) -> None:
    repo = _get_repo(conn)
    await repo.remove_from_file(file_id, tag_id)
