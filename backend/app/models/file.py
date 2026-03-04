import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class FileStatus(StrEnum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    FAILED = "failed"


_STATUS_ALIASES = {"running": FileStatus.PROCESSING, "partial": FileStatus.READY}


def _safe_file_status(raw: str) -> FileStatus:
    """Convert a raw status string to FileStatus, handling legacy values."""
    try:
        return FileStatus(raw)
    except ValueError:
        return _STATUS_ALIASES.get(raw, FileStatus.UPLOADED)


class FileResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    folder_id: uuid.UUID | None
    name: str
    original_name: str
    mime_type: str
    size_bytes: int
    status: FileStatus
    uploaded_by: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: object) -> "FileResponse":
        from asyncpg import Record  # noqa: TC002 — runtime cast

        r: Record = row  # type: ignore[assignment]
        return cls(
            id=r["id"],
            workspace_id=r["workspace_id"],
            folder_id=r["folder_id"],
            name=r["name"],
            original_name=r["original_name"],
            mime_type=r["mime_type"],
            size_bytes=r["size_bytes"],
            status=_safe_file_status(r["status"]),
            uploaded_by=str(r["uploaded_by"]),
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )


class FileUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    folder_id: uuid.UUID | None = None
    move_to_root: bool = False


class FileDownloadResponse(BaseModel):
    url: str
    expires_in: int


class BulkDeleteRequest(BaseModel):
    file_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


class MoveFilesRequest(BaseModel):
    file_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)
    target_folder_id: uuid.UUID | None = None


class FileContentResponse(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    raw_text: str | None
    summary: str | None
    overview: str | None
    structure: dict | None
    page_count: int | None
    word_count: int | None
    language: str | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: object) -> "FileContentResponse":
        from asyncpg import Record  # noqa: TC002 — runtime cast

        r: Record = row  # type: ignore[assignment]
        import json as _json

        structure = r["structure"]
        if isinstance(structure, str):
            structure = _json.loads(structure)
        return cls(
            id=r["id"],
            file_id=r["file_id"],
            raw_text=r["raw_text"],
            summary=r["summary"],
            overview=r["overview"],
            structure=structure,
            page_count=r["page_count"],
            word_count=r["word_count"],
            language=r["language"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )


class FileDetailResponse(BaseModel):
    file: FileResponse
    storage_key: str
    content: FileContentResponse | None
    tags: list["TagResponse"]


# Deferred import to avoid circular dependency
from app.models.tag import TagResponse  # noqa: E402

FileDetailResponse.model_rebuild()
