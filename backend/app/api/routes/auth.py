"""Auth routes — session info and provisioning trigger."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbConn
from app.models.auth import AuthUser
from app.services.provisioning import ensure_user_provisioned

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(AuthUser):
    """Response for /auth/me — user info plus active workspace."""

    workspace_id: str


@router.get("/me", response_model=MeResponse)
async def get_me(user: CurrentUser, conn: DbConn) -> MeResponse:
    """Return the current user's profile and ensure provisioning."""
    workspace_id = await ensure_user_provisioned(conn, user)
    return MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        workspace_id=workspace_id,
    )
