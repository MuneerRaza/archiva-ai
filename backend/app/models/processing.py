import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class ProcessingStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ProcessingStep(StrEnum):
    EXTRACTION = "extraction"
    TRANSCRIPTION = "transcription"
    SUMMARY = "summary"
    STRUCTURE = "structure"
    TABLES = "tables"
    OVERVIEW = "overview"


class ProcessingJobResponse(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    workspace_id: uuid.UUID
    status: ProcessingStatus
    steps: dict | None
    progress: float
    retry_count: int
    error_message: str | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    file_name: str | None = None
    file_mime_type: str | None = None

    @classmethod
    def from_row(cls, row: object) -> "ProcessingJobResponse":
        from asyncpg import Record

        r: Record = row  # type: ignore[assignment]
        import json as _json

        steps = r["steps"]
        if isinstance(steps, str):
            steps = _json.loads(steps)
        # DB default is '[]' (list) — normalize to dict
        if isinstance(steps, list):
            steps = {} if not steps else {str(i): v for i, v in enumerate(steps)}

        # file_name and file_mime_type come from JOIN queries — may not be present
        file_name = r["file_name"] if "file_name" in r.keys() else None
        file_mime_type = r["file_mime_type"] if "file_mime_type" in r.keys() else None

        return cls(
            id=r["id"],
            file_id=r["file_id"],
            workspace_id=r["workspace_id"],
            status=ProcessingStatus(r["status"]),
            steps=steps,
            progress=float(r["progress"]),
            retry_count=r["retry_count"],
            error_message=r["error_message"],
            started_at=r["started_at"],
            completed_at=r["completed_at"],
            created_at=r["created_at"],
            file_name=file_name,
            file_mime_type=file_mime_type,
        )
