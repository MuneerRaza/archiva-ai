"""Processing routes — job status, reprocessing, and SSE events."""

import asyncio
import json
import uuid

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.deps import DbConn, VerifiedWorkspaceId
from app.exceptions import NotFoundError
from app.models.processing import ProcessingJobResponse
from app.models.responses import DataResponse, ListResponse, Pagination
from app.repositories.processing import ProcessingRepository
from app.services.processing.events import (
    FileUploaded,
    ProcessingCompleted,
    ProcessingEvent,
    ProcessingFailed,
    ProcessingStarted,
    event_bus,
    shutdown_event,
)

router = APIRouter(tags=["processing"])


@router.get(
    "/workspaces/{workspace_id}/files/{file_id}/processing",
    response_model=DataResponse[ProcessingJobResponse],
)
async def get_processing_status(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    conn: DbConn,
) -> DataResponse[ProcessingJobResponse]:
    repo = ProcessingRepository(conn)
    job = await repo.get_job_by_file(file_id)
    if job is None:
        raise NotFoundError("ProcessingJob", str(file_id))
    return DataResponse(data=ProcessingJobResponse.from_row(job))


class ReprocessRequest(BaseModel):
    steps: list[str] | None = None


class ReprocessResponse(BaseModel):
    status: str
    file_id: str


@router.post(
    "/workspaces/{workspace_id}/files/{file_id}/reprocess",
    response_model=DataResponse[ReprocessResponse],
)
async def reprocess_file(
    workspace_id: VerifiedWorkspaceId,
    file_id: uuid.UUID,
    conn: DbConn,
    body: ReprocessRequest | None = None,
) -> DataResponse[ReprocessResponse]:
    # Fetch file info
    file_row = await conn.fetchrow(
        "SELECT id, storage_key, mime_type FROM files WHERE id = $1 AND workspace_id = $2",
        file_id,
        workspace_id,
    )
    if file_row is None:
        raise NotFoundError("File", str(file_id))

    step_overrides = body.steps if body else None

    # Emit event — the worker's pipeline will create/reset the job
    await event_bus.emit(FileUploaded(
        file_id=file_id,
        workspace_id=workspace_id,
        storage_key=file_row["storage_key"],
        mime_type=file_row["mime_type"],
        step_overrides=step_overrides,
    ))

    return DataResponse(data=ReprocessResponse(status="queued", file_id=str(file_id)))


@router.get(
    "/workspaces/{workspace_id}/processing/jobs",
    response_model=ListResponse[ProcessingJobResponse],
)
async def list_active_jobs(
    workspace_id: VerifiedWorkspaceId,
    conn: DbConn,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ListResponse[ProcessingJobResponse]:
    repo = ProcessingRepository(conn)
    rows, total = await repo.get_active_jobs(workspace_id, limit, offset)
    return ListResponse(
        data=[ProcessingJobResponse.from_row(r) for r in rows],
        pagination=Pagination(
            total=total, limit=limit, offset=offset, has_more=offset + limit < total,
        ),
    )


@router.get(
    "/workspaces/{workspace_id}/processing/history",
    response_model=ListResponse[ProcessingJobResponse],
)
async def list_all_jobs(
    workspace_id: VerifiedWorkspaceId,
    conn: DbConn,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> ListResponse[ProcessingJobResponse]:
    repo = ProcessingRepository(conn)
    rows, total = await repo.get_all_jobs(workspace_id, limit, offset)
    return ListResponse(
        data=[ProcessingJobResponse.from_row(r) for r in rows],
        pagination=Pagination(
            total=total, limit=limit, offset=offset, has_more=offset + limit < total,
        ),
    )


@router.get("/workspaces/{workspace_id}/processing/events")
async def processing_events_sse(
    workspace_id: VerifiedWorkspaceId,
) -> StreamingResponse:
    """SSE endpoint for real-time processing status updates."""
    queue: asyncio.Queue[ProcessingEvent] = asyncio.Queue()

    async def on_event(event: ProcessingEvent) -> None:
        if event.workspace_id == workspace_id:
            await queue.put(event)

    async def event_generator():
        event_bus.subscribe(on_event)
        try:
            while not shutdown_event.is_set():
                # Race: either we get an event from the queue, or shutdown fires
                queue_task = asyncio.ensure_future(queue.get())
                shutdown_task = asyncio.ensure_future(shutdown_event.wait())
                done, pending = await asyncio.wait(
                    {queue_task, shutdown_task},
                    timeout=30,
                    return_when=asyncio.FIRST_COMPLETED,
                )
                for task in pending:
                    task.cancel()

                if shutdown_task in done:
                    break
                if queue_task in done:
                    event_data = _serialize_event(queue_task.result())
                    yield f"event: {event_data['type']}\ndata: {json.dumps(event_data)}\n\n"
                else:
                    yield ": keepalive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(on_event)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _serialize_event(event: ProcessingEvent) -> dict:
    if isinstance(event, ProcessingStarted):
        return {
            "type": "processing_started",
            "file_id": str(event.file_id),
            "workspace_id": str(event.workspace_id),
        }
    if isinstance(event, ProcessingCompleted):
        return {
            "type": "processing_completed",
            "file_id": str(event.file_id),
            "workspace_id": str(event.workspace_id),
        }
    if isinstance(event, ProcessingFailed):
        return {
            "type": "processing_failed",
            "file_id": str(event.file_id),
            "workspace_id": str(event.workspace_id),
            "error": event.error,
        }
    # FileUploaded events — not sent to clients
    return {"type": "file_uploaded", "file_id": str(event.file_id)}
