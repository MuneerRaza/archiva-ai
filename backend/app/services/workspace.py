import uuid

from app.exceptions import ConflictError, NotFoundError, PermissionDeniedError
from app.logging import get_logger
from app.models.auth import AuthUser
from app.models.workspace import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate
from app.repositories.workspace import WorkspaceRepository
from app.services.agent.session_cache import invalidate_all_sessions
from app.services.provisioning import DEFAULT_WORKSPACE_SETTINGS

logger = get_logger(__name__)

MAX_WORKSPACES_PER_ORG = 10


class WorkspaceService:

    def __init__(self, repo: WorkspaceRepository) -> None:
        self._repo = repo

    async def list_workspaces(
        self,
        user: AuthUser,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[WorkspaceResponse], int]:
        rows, total = await self._repo.list_by_user(user.id, limit, offset)
        workspaces = [WorkspaceResponse.from_row(r) for r in rows]
        return workspaces, total

    async def get_workspace(
        self,
        user: AuthUser,
        workspace_id: uuid.UUID,
    ) -> WorkspaceResponse:
        row = await self._repo.get_with_access_check(user.id, workspace_id)
        if row is None:
            raise PermissionDeniedError("You do not have access to this workspace")

        return WorkspaceResponse.from_row(row)

    async def create_workspace(
        self,
        user: AuthUser,
        data: WorkspaceCreate,
    ) -> WorkspaceResponse:
        org_id = await self._repo.get_org_id_for_user(user.id)
        if org_id is None:
            raise NotFoundError("Organization")

        count = await self._repo.count_by_org(org_id)
        if count >= MAX_WORKSPACES_PER_ORG:
            raise ConflictError(
                f"Maximum of {MAX_WORKSPACES_PER_ORG} workspaces per organization"
            )

        settings_json = DEFAULT_WORKSPACE_SETTINGS
        row = await self._repo.create(
            org_id=org_id,
            name=data.name,
            description=data.description,
            settings_json=settings_json,
        )

        logger.info(
            "workspace_created",
            workspace_id=str(row["id"]),
            user_id=user.id,
        )
        return WorkspaceResponse.from_row(row)

    async def update_workspace(
        self,
        user: AuthUser,
        workspace_id: uuid.UUID,
        data: WorkspaceUpdate,
    ) -> WorkspaceResponse:
        # Combined access check — returns None if no access
        existing = await self._repo.get_with_access_check(user.id, workspace_id)
        if existing is None:
            raise PermissionDeniedError("You do not have access to this workspace")

        settings_json = data.settings.model_dump_json() if data.settings is not None else None
        row = await self._repo.update(
            workspace_id=workspace_id,
            name=data.name,
            description=data.description,
            settings_json=settings_json,
        )
        if row is None:
            raise NotFoundError("Workspace", str(workspace_id))

        # Settings change may affect agent config — invalidate session caches
        if data.settings is not None:
            invalidate_all_sessions()

        logger.info(
            "workspace_updated",
            workspace_id=str(workspace_id),
            user_id=user.id,
        )
        return WorkspaceResponse.from_row(row)

    async def delete_workspace(
        self,
        user: AuthUser,
        workspace_id: uuid.UUID,
    ) -> None:
        existing = await self._repo.get_with_access_check(user.id, workspace_id)
        if existing is None:
            raise PermissionDeniedError("You do not have access to this workspace")

        deleted = await self._repo.delete(workspace_id)
        if not deleted:
            raise NotFoundError("Workspace", str(workspace_id))

        logger.info(
            "workspace_deleted",
            workspace_id=str(workspace_id),
            user_id=user.id,
        )
