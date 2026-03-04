import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    parent_id: uuid.UUID | None = None


class FolderUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)


class FolderResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    parent_id: uuid.UUID | None
    name: str
    path: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: object) -> "FolderResponse":
        from asyncpg import Record  # noqa: TC002 — runtime cast

        r: Record = row  # type: ignore[assignment]
        return cls(
            id=r["id"],
            workspace_id=r["workspace_id"],
            parent_id=r["parent_id"],
            name=r["name"],
            path=r["path"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
