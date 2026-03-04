import uuid

import asyncpg

from app.repositories.base import BaseRepository


class TagRepository(BaseRepository):

    async def list_by_workspace(
        self, workspace_id: uuid.UUID
    ) -> list[asyncpg.Record]:
        return await self._conn.fetch(
            """
            SELECT id, workspace_id, name, color
            FROM tags
            WHERE workspace_id = $1
            ORDER BY name
            """,
            workspace_id,
        )

    async def create(
        self,
        workspace_id: uuid.UUID,
        name: str,
        color: str,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO tags (workspace_id, name, color)
            VALUES ($1, $2, $3)
            RETURNING id, workspace_id, name, color
            """,
            workspace_id,
            name,
            color,
        )

    async def delete(
        self, tag_id: uuid.UUID, workspace_id: uuid.UUID
    ) -> bool:
        result = await self._conn.execute(
            "DELETE FROM tags WHERE id = $1 AND workspace_id = $2",
            tag_id,
            workspace_id,
        )
        return result == "DELETE 1"

    async def add_to_file(
        self, file_id: uuid.UUID, tag_id: uuid.UUID
    ) -> None:
        await self._conn.execute(
            """
            INSERT INTO file_tags (file_id, tag_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            """,
            file_id,
            tag_id,
        )

    async def remove_from_file(
        self, file_id: uuid.UUID, tag_id: uuid.UUID
    ) -> None:
        await self._conn.execute(
            "DELETE FROM file_tags WHERE file_id = $1 AND tag_id = $2",
            file_id,
            tag_id,
        )

    async def get_file_tags(
        self, file_id: uuid.UUID
    ) -> list[asyncpg.Record]:
        return await self._conn.fetch(
            """
            SELECT t.id, t.workspace_id, t.name, t.color
            FROM tags t
            JOIN file_tags ft ON t.id = ft.tag_id
            WHERE ft.file_id = $1
            ORDER BY t.name
            """,
            file_id,
        )
