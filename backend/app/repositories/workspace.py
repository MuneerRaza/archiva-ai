import uuid

import asyncpg

from app.repositories.base import BaseRepository


class WorkspaceRepository(BaseRepository):

    async def list_by_user(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[asyncpg.Record], int]:
        """List workspaces the user owns (via their org). Returns (rows, total)."""
        rows = await self._conn.fetch(
            """
            SELECT w.id, w.org_id, w.name, w.description, w.settings,
                   w.created_at, w.updated_at,
                   COUNT(*) OVER() AS _total
            FROM workspaces w
            JOIN organizations o ON w.org_id = o.id
            WHERE o.owner_id = $1
            ORDER BY w.created_at
            LIMIT $2 OFFSET $3
            """,
            user_id,
            limit,
            offset,
        )

        total = rows[0]["_total"] if rows else 0
        return rows, total

    async def get_by_id(self, workspace_id: uuid.UUID) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            SELECT id, org_id, name, description, settings,
                   created_at, updated_at
            FROM workspaces
            WHERE id = $1
            """,
            workspace_id,
        )

    async def create(
        self,
        org_id: uuid.UUID,
        name: str,
        description: str | None,
        settings_json: str,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO workspaces (org_id, name, description, settings)
            VALUES ($1, $2, $3, $4::jsonb)
            RETURNING id, org_id, name, description, settings,
                      created_at, updated_at
            """,
            org_id,
            name,
            description,
            settings_json,
        )

    async def update(
        self,
        workspace_id: uuid.UUID,
        name: str | None = None,
        description: str | None = None,
        settings_json: str | None = None,
    ) -> asyncpg.Record | None:
        # Build dynamic SET clause
        fields: list[str] = []
        values: list[object] = []
        idx = 1

        if name is not None:
            idx += 1
            fields.append(f"name = ${idx}")
            values.append(name)

        if description is not None:
            idx += 1
            fields.append(f"description = ${idx}")
            values.append(description)

        if settings_json is not None:
            idx += 1
            fields.append(f"settings = ${idx}::jsonb")
            values.append(settings_json)

        if not fields:
            return await self.get_by_id(workspace_id)

        query = f"""
            UPDATE workspaces
            SET {', '.join(fields)}
            WHERE id = $1
            RETURNING id, org_id, name, description, settings,
                      created_at, updated_at
        """
        return await self._conn.fetchrow(query, workspace_id, *values)

    async def delete(self, workspace_id: uuid.UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM workspaces WHERE id = $1",
            workspace_id,
        )
        return result == "DELETE 1"

    async def get_org_id_for_user(self, user_id: str) -> uuid.UUID | None:
        """Get the user's organization ID."""
        return await self._conn.fetchval(
            "SELECT id FROM organizations WHERE owner_id = $1 LIMIT 1",
            user_id,
        )

    async def user_has_access(
        self, user_id: str, workspace_id: uuid.UUID
    ) -> bool:
        """Check if user owns the org that owns this workspace."""
        result = await self._conn.fetchval(
            """
            SELECT EXISTS(
                SELECT 1 FROM workspaces w
                JOIN organizations o ON w.org_id = o.id
                WHERE w.id = $1 AND o.owner_id = $2
            )
            """,
            workspace_id,
            user_id,
        )
        return bool(result)

    async def get_with_access_check(
        self, user_id: str, workspace_id: uuid.UUID
    ) -> asyncpg.Record | None:
        """Get workspace row if user has access, else None. Single query."""
        return await self._conn.fetchrow(
            """
            SELECT w.id, w.org_id, w.name, w.description, w.settings,
                   w.created_at, w.updated_at
            FROM workspaces w
            JOIN organizations o ON w.org_id = o.id
            WHERE w.id = $1 AND o.owner_id = $2
            """,
            workspace_id,
            user_id,
        )

    async def count_by_org(self, org_id: uuid.UUID) -> int:
        result = await self._conn.fetchval(
            "SELECT COUNT(*) FROM workspaces WHERE org_id = $1",
            org_id,
        )
        return int(result)
