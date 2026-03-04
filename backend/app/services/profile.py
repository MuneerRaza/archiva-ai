from app.exceptions import NotFoundError
from app.models.auth import ProfileResponse, ProfileUpdate
from app.repositories.profile import ProfileRepository


class ProfileService:

    def __init__(self, repo: ProfileRepository) -> None:
        self._repo = repo

    async def get_profile(self, user_id: str, email: str) -> ProfileResponse:
        row = await self._repo.get_by_user_id(user_id)
        if row is None:
            raise NotFoundError("Profile", user_id)
        return ProfileResponse.from_row(row, email)

    async def update_profile(
        self, user_id: str, email: str, data: ProfileUpdate
    ) -> ProfileResponse:
        row = await self._repo.update(user_id, full_name=data.full_name)
        if row is None:
            raise NotFoundError("Profile", user_id)
        return ProfileResponse.from_row(row, email)
