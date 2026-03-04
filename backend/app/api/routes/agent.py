"""Agent API routes — SSE streaming chat + session CRUD."""

import asyncio
import json
import uuid

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.api.deps import CurrentUser, DbConn, VerifiedWorkspace, VerifiedWorkspaceId
from app.exceptions import NotFoundError
from app.logging import get_logger
from app.models.agent import (
    AgentSessionDetail,
    AgentSessionResponse,
    ChatRequest,
)
from app.models.responses import DataResponse, ListResponse, Pagination
from app.services.agent.core import run_agent
from app.services.agent.session import SessionService

logger = get_logger(__name__)

router = APIRouter(tags=["agent"])

KEEPALIVE_INTERVAL = 15  # seconds


@router.post("/workspaces/{workspace_id}/agent/chat")
async def chat(
    body: ChatRequest,
    ws_row: VerifiedWorkspace,
    user: CurrentUser,
    conn: DbConn,
) -> StreamingResponse:
    """Stream an agent response via SSE."""
    workspace_id = ws_row["id"]
    session_id = uuid.UUID(body.session_id) if body.session_id else None

    async def event_stream():
        queue: asyncio.Queue[str | None] = asyncio.Queue()

        async def producer():
            try:
                async for event in run_agent(
                    conn=conn,
                    workspace_id=workspace_id,
                    ws_row=ws_row,
                    user_id=user.id,
                    user_message=body.message,
                    session_id=session_id,
                    context_location=body.context_location,
                ):
                    data = json.dumps(event.data, default=str)
                    await queue.put(f"event: {event.event.value}\ndata: {data}\n\n")
            except asyncio.CancelledError:
                logger.info("agent_stream_cancelled")
            except Exception as exc:
                logger.exception("agent_stream_error", error=str(exc))
                error_data = json.dumps({"message": str(exc)})
                await queue.put(f"event: error\ndata: {error_data}\n\n")
            finally:
                await queue.put(None)

        async def keepalive():
            try:
                while True:
                    await asyncio.sleep(KEEPALIVE_INTERVAL)
                    await queue.put(": keepalive\n\n")
            except asyncio.CancelledError:
                pass

        producer_task = asyncio.create_task(producer())
        keepalive_task = asyncio.create_task(keepalive())

        try:
            while True:
                msg = await queue.get()
                if msg is None:
                    break
                yield msg
        finally:
            # Client disconnected or stream ended — cancel both tasks
            keepalive_task.cancel()
            producer_task.cancel()
            # Wait for tasks to finish cleanup (e.g. setting session status to idle)
            await asyncio.gather(producer_task, keepalive_task, return_exceptions=True)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/workspaces/{workspace_id}/agent/sessions")
async def list_sessions(
    workspace_id: VerifiedWorkspaceId,
    user: CurrentUser,
    conn: DbConn,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> ListResponse[AgentSessionResponse]:
    service = SessionService(conn)
    sessions, total = await service.list_sessions(workspace_id, user.id, limit, offset)
    return ListResponse(
        data=sessions,
        pagination=Pagination(
            total=total,
            limit=limit,
            offset=offset,
            has_more=(offset + limit) < total,
        ),
    )


@router.get("/workspaces/{workspace_id}/agent/sessions/{session_id}")
async def get_session(
    session_id: uuid.UUID,
    workspace_id: VerifiedWorkspaceId,
    user: CurrentUser,
    conn: DbConn,
) -> DataResponse[AgentSessionDetail]:
    service = SessionService(conn)
    detail = await service.get_session_detail(session_id, workspace_id)
    if not detail:
        raise NotFoundError("Session", str(session_id))
    return DataResponse(data=detail)


@router.delete("/workspaces/{workspace_id}/agent/sessions/{session_id}")
async def delete_session(
    session_id: uuid.UUID,
    workspace_id: VerifiedWorkspaceId,
    user: CurrentUser,
    conn: DbConn,
) -> None:
    service = SessionService(conn)
    deleted = await service.delete_session(session_id, workspace_id)
    if not deleted:
        raise NotFoundError("Session", str(session_id))


@router.delete("/workspaces/{workspace_id}/agent/sessions/{session_id}/messages")
async def truncate_messages(
    session_id: uuid.UUID,
    workspace_id: VerifiedWorkspaceId,
    user: CurrentUser,
    conn: DbConn,
    after: uuid.UUID = Query(description="Delete messages after this message ID"),
    inclusive: bool = Query(default=False, description="Also delete the referenced message"),
) -> DataResponse[dict]:
    """Truncate message history after a specific message (for retry/edit)."""
    service = SessionService(conn)
    count = await service.truncate_messages(
        session_id, workspace_id, after, inclusive=inclusive,
    )
    if count == -1:
        raise NotFoundError("Session", str(session_id))
    return DataResponse(data={"deleted": count})


@router.patch("/workspaces/{workspace_id}/agent/sessions/{session_id}")
async def update_session(
    session_id: uuid.UUID,
    workspace_id: VerifiedWorkspaceId,
    user: CurrentUser,
    conn: DbConn,
    title: str = Query(min_length=1, max_length=200),
) -> DataResponse[AgentSessionResponse]:
    service = SessionService(conn)
    result = await service.update_title(session_id, title)
    if not result:
        raise NotFoundError("Session", str(session_id))
    return DataResponse(data=result)
