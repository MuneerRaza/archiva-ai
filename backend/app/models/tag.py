import uuid

from pydantic import BaseModel, Field


class TagCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: str = Field(default="#6366f1", pattern=r"^#[0-9a-fA-F]{6}$")


class TagResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    name: str
    color: str

    @classmethod
    def from_row(cls, row: object) -> "TagResponse":
        from asyncpg import Record  # noqa: TC002 — runtime cast

        r: Record = row  # type: ignore[assignment]
        return cls(
            id=r["id"],
            workspace_id=r["workspace_id"],
            name=r["name"],
            color=r["color"],
        )
