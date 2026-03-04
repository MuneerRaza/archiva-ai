"""Auth routes — session info, provisioning, and profile management."""

from fastapi import APIRouter

from app.api.deps import CurrentUser, DbConn, me_cache
from app.models.auth import AuthUser, ProfileResponse, ProfileUpdate
from app.models.responses import DataResponse
from app.repositories.profile import ProfileRepository
from app.services.profile import ProfileService
from app.services.provisioning import ensure_user_provisioned

router = APIRouter(prefix="/auth", tags=["auth"])


class MeResponse(AuthUser):
    """Response for /auth/me — user info plus active workspace."""

    workspace_id: str
    full_name: str | None = None


@router.get("/me", response_model=MeResponse)
async def get_me(user: CurrentUser, conn: DbConn) -> MeResponse:
    """Return the current user's profile and ensure provisioning."""
    cached = me_cache.get(user.id)
    if cached:
        return MeResponse(**cached)

    workspace_id, full_name = await ensure_user_provisioned(conn, user)

    response = MeResponse(
        id=user.id,
        email=user.email,
        role=user.role,
        workspace_id=workspace_id,
        full_name=full_name,
    )
    me_cache.set(user.id, response.model_dump())
    return response


@router.get("/profile", response_model=DataResponse[ProfileResponse])
async def get_profile(user: CurrentUser, conn: DbConn) -> DataResponse[ProfileResponse]:
    service = ProfileService(ProfileRepository(conn))
    profile = await service.get_profile(user.id, user.email)
    return DataResponse(data=profile)


@router.patch("/profile", response_model=DataResponse[ProfileResponse])
async def update_profile(
    data: ProfileUpdate, user: CurrentUser, conn: DbConn
) -> DataResponse[ProfileResponse]:
    service = ProfileService(ProfileRepository(conn))
    profile = await service.update_profile(user.id, user.email, data)
    # Invalidate /me cache on profile update
    me_cache.invalidate(user.id)
    return DataResponse(data=profile)
