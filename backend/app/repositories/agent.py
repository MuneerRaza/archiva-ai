"""Repository for agent sessions and messages."""

import json
import uuid

import asyncpg

from app.models.agent import MessageRole, SessionStatus
from app.repositories.base import BaseRepository


class AgentRepository(BaseRepository):

    # ----- Sessions -----

    async def create_session(
        self,
        workspace_id: uuid.UUID,
        user_id: str,
        title: str | None = None,
        context_location: dict | None = None,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO agent_sessions (workspace_id, user_id, title, context_location)
            VALUES ($1, $2::uuid, $3, $4::jsonb)
            RETURNING *
            """,
            workspace_id,
            user_id,
            title,
            json.dumps(context_location) if context_location else None,
        )

    async def get_session(
        self, session_id: uuid.UUID, workspace_id: uuid.UUID,
    ) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            SELECT * FROM agent_sessions
            WHERE id = $1 AND workspace_id = $2
            """,
            session_id,
            workspace_id,
        )

    async def list_sessions(
        self,
        workspace_id: uuid.UUID,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[asyncpg.Record], int]:
        rows = await self._conn.fetch(
            """
            SELECT *, COUNT(*) OVER() AS _total
            FROM agent_sessions
            WHERE workspace_id = $1 AND user_id = $2::uuid
            ORDER BY updated_at DESC
            LIMIT $3 OFFSET $4
            """,
            workspace_id,
            user_id,
            limit,
            offset,
        )
        total = rows[0]["_total"] if rows else 0
        return rows, total

    async def update_session_title(
        self, session_id: uuid.UUID, title: str,
    ) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            UPDATE agent_sessions SET title = $2
            WHERE id = $1
            RETURNING *
            """,
            session_id,
            title,
        )

    async def set_session_status(
        self, session_id: uuid.UUID, status: SessionStatus,
    ) -> None:
        await self._conn.execute(
            "UPDATE agent_sessions SET status = $2 WHERE id = $1",
            session_id,
            status,
        )

    async def delete_session(
        self, session_id: uuid.UUID, workspace_id: uuid.UUID,
    ) -> bool:
        result = await self._conn.execute(
            "DELETE FROM agent_sessions WHERE id = $1 AND workspace_id = $2",
            session_id,
            workspace_id,
        )
        return result == "DELETE 1"

    # ----- Messages -----

    async def add_message(
        self,
        session_id: uuid.UUID,
        role: MessageRole,
        content: str | None = None,
        tool_name: str | None = None,
        tool_args: dict | None = None,
        tool_result: dict | None = None,
        token_count: int | None = None,
        thinking: str | None = None,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO agent_messages
                (session_id, role, content, tool_name, tool_args, tool_result, token_count, thinking)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
            RETURNING *
            """,
            session_id,
            role,
            content,
            tool_name,
            json.dumps(tool_args) if tool_args else None,
            json.dumps(tool_result) if tool_result else None,
            token_count,
            thinking,
        )

    async def get_messages(
        self, session_id: uuid.UUID, limit: int = 200,
    ) -> list[asyncpg.Record]:
        return await self._conn.fetch(
            """
            SELECT * FROM agent_messages
            WHERE session_id = $1
            ORDER BY created_at ASC
            LIMIT $2
            """,
            session_id,
            limit,
        )

    async def count_messages(self, session_id: uuid.UUID) -> int:
        return await self._conn.fetchval(
            "SELECT COUNT(*) FROM agent_messages WHERE session_id = $1",
            session_id,
        )

    async def delete_messages_after(
        self,
        session_id: uuid.UUID,
        after_message_id: uuid.UUID,
        *,
        inclusive: bool = False,
    ) -> int:
        """Delete messages in a session created after (or at) the reference.

        Args:
            inclusive: If True, also delete the referenced message itself.
        """
        ref = await self._conn.fetchrow(
            "SELECT created_at FROM agent_messages "
            "WHERE id = $1 AND session_id = $2",
            after_message_id, session_id,
        )
        if not ref:
            return 0
        op = ">=" if inclusive else ">"
        result = await self._conn.execute(
            f"DELETE FROM agent_messages WHERE session_id = $1 AND created_at {op} $2",
            session_id, ref["created_at"],
        )
        return int(result.split()[-1])
