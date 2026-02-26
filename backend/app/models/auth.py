from pydantic import BaseModel


class AuthUser(BaseModel):
    """Authenticated user extracted from JWT."""

    id: str
    email: str
    role: str = "authenticated"
