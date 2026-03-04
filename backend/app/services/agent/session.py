"""Session management — load, save, and future compression."""

import uuid

import asyncpg

from app.logging import get_logger
from app.models.agent import AgentMessageResponse, AgentSessionDetail, AgentSessionResponse
from app.repositories.agent import AgentRepository
from app.services.agent.session_cache import invalidate_session

logger = get_logger(__name__)


class SessionService:
    """Manages agent chat sessions."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        self._repo = AgentRepository(conn)

    async def list_sessions(
        self,
        workspace_id: uuid.UUID,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[AgentSessionResponse], int]:
        rows, total = await self._repo.list_sessions(workspace_id, user_id, limit, offset)
        sessions = [AgentSessionResponse.from_row(r) for r in rows]
        return sessions, total

    async def get_session_detail(
        self,
        session_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> AgentSessionDetail | None:
        session_row = await self._repo.get_session(session_id, workspace_id)
        if not session_row:
            return None

        message_rows = await self._repo.get_messages(session_id)
        messages = [AgentMessageResponse.from_row(r) for r in message_rows]

        session = AgentSessionResponse.from_row(session_row)
        return AgentSessionDetail(
            **session.model_dump(),
            messages=messages,
        )

    async def delete_session(
        self,
        session_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> bool:
        invalidate_session(session_id)
        return await self._repo.delete_session(session_id, workspace_id)

    async def update_title(
        self,
        session_id: uuid.UUID,
        title: str,
    ) -> AgentSessionResponse | None:
        row = await self._repo.update_session_title(session_id, title)
        return AgentSessionResponse.from_row(row) if row else None

    async def truncate_messages(
        self,
        session_id: uuid.UUID,
        workspace_id: uuid.UUID,
        after_message_id: uuid.UUID,
        *,
        inclusive: bool = False,
    ) -> int:
        """Delete messages after (or at) the given message ID.

        Returns count deleted, -1 if session not found.
        """
        session = await self._repo.get_session(session_id, workspace_id)
        if not session:
            return -1
        invalidate_session(session_id)
        return await self._repo.delete_messages_after(
            session_id, after_message_id, inclusive=inclusive,
        )
