from datetime import datetime

import asyncpg
from pydantic import BaseModel


class AuthUser(BaseModel):
    """Authenticated user extracted from JWT."""

    id: str
    email: str
    role: str = "authenticated"


class ProfileResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    avatar_url: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: asyncpg.Record, email: str) -> "ProfileResponse":
        return cls(
            id=str(row["id"]),
            email=email,
            full_name=row["full_name"],
            avatar_url=row["avatar_url"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )


class ProfileUpdate(BaseModel):
    full_name: str | None = None
