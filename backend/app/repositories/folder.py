import uuid

import asyncpg

from app.repositories.base import BaseRepository


class FolderRepository(BaseRepository):

    async def list_children(
        self,
        workspace_id: uuid.UUID,
        parent_id: uuid.UUID | None,
    ) -> list[asyncpg.Record]:
        """List immediate child folders of a parent (None = root)."""
        if parent_id is None:
            return await self._conn.fetch(
                """
                SELECT id, workspace_id, parent_id, name, path,
                       created_at, updated_at
                FROM folders
                WHERE workspace_id = $1 AND parent_id IS NULL
                ORDER BY name
                """,
                workspace_id,
            )
        return await self._conn.fetch(
            """
            SELECT id, workspace_id, parent_id, name, path,
                   created_at, updated_at
            FROM folders
            WHERE workspace_id = $1 AND parent_id = $2
            ORDER BY name
            """,
            workspace_id,
            parent_id,
        )

    async def get_by_id(
        self, folder_id: uuid.UUID, workspace_id: uuid.UUID
    ) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            SELECT id, workspace_id, parent_id, name, path,
                   created_at, updated_at
            FROM folders
            WHERE id = $1 AND workspace_id = $2
            """,
            folder_id,
            workspace_id,
        )

    async def create(
        self,
        workspace_id: uuid.UUID,
        parent_id: uuid.UUID | None,
        name: str,
        path: str,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO folders (workspace_id, parent_id, name, path)
            VALUES ($1, $2, $3, $4)
            RETURNING id, workspace_id, parent_id, name, path,
                      created_at, updated_at
            """,
            workspace_id,
            parent_id,
            name,
            path,
        )

    async def update_name_and_path(
        self,
        folder_id: uuid.UUID,
        name: str,
        new_path: str,
    ) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            UPDATE folders
            SET name = $2, path = $3
            WHERE id = $1
            RETURNING id, workspace_id, parent_id, name, path,
                      created_at, updated_at
            """,
            folder_id,
            name,
            new_path,
        )

    async def update_paths_prefix(
        self,
        workspace_id: uuid.UUID,
        old_prefix: str,
        new_prefix: str,
    ) -> int:
        """Batch-update materialized paths for all descendants when a folder is renamed."""
        result = await self._conn.execute(
            """
            UPDATE folders
            SET path = $3 || substring(path FROM $4)
            WHERE workspace_id = $1 AND path LIKE $2 || '%'
              AND path != $3
            """,
            workspace_id,
            old_prefix,
            new_prefix,
            len(old_prefix) + 1,
        )
        # result is like "UPDATE N"
        return int(result.split()[-1])

    async def get_all_descendant_folder_ids(
        self, folder_id: uuid.UUID, workspace_id: uuid.UUID,
    ) -> list[uuid.UUID]:
        """Get all descendant folder IDs (including self) using recursive CTE."""
        rows = await self._conn.fetch(
            """
            WITH RECURSIVE tree AS (
                SELECT id FROM folders WHERE id = $1 AND workspace_id = $2
                UNION ALL
                SELECT f.id FROM folders f JOIN tree t ON f.parent_id = t.id
            )
            SELECT id FROM tree
            """,
            folder_id,
            workspace_id,
        )
        return [r["id"] for r in rows]

    async def get_files_in_folders(
        self, folder_ids: list[uuid.UUID],
    ) -> list[asyncpg.Record]:
        """Get all files in the given folder IDs (id, storage_key)."""
        return await self._conn.fetch(
            "SELECT id, storage_key FROM files WHERE folder_id = ANY($1::uuid[])",
            folder_ids,
        )

    async def delete_files_in_folders(self, folder_ids: list[uuid.UUID]) -> int:
        """Delete all files in the given folders. Returns count deleted."""
        result = await self._conn.execute(
            "DELETE FROM files WHERE folder_id = ANY($1::uuid[])",
            folder_ids,
        )
        return int(result.split()[-1])

    async def delete(self, folder_id: uuid.UUID, workspace_id: uuid.UUID) -> bool:
        result = await self._conn.execute(
            "DELETE FROM folders WHERE id = $1 AND workspace_id = $2",
            folder_id,
            workspace_id,
        )
        return result == "DELETE 1"

    async def name_exists_in_parent(
        self,
        workspace_id: uuid.UUID,
        parent_id: uuid.UUID | None,
        name: str,
        exclude_id: uuid.UUID | None = None,
    ) -> bool:
        """Check if a folder with this name already exists in the same parent."""
        if parent_id is None:
            if exclude_id:
                result = await self._conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM folders
                        WHERE workspace_id = $1 AND parent_id IS NULL
                          AND name = $2 AND id != $3
                    )
                    """,
                    workspace_id,
                    name,
                    exclude_id,
                )
            else:
                result = await self._conn.fetchval(
                    """
                    SELECT EXISTS(
                        SELECT 1 FROM folders
                        WHERE workspace_id = $1 AND parent_id IS NULL AND name = $2
                    )
                    """,
                    workspace_id,
                    name,
                )
        elif exclude_id:
            result = await self._conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM folders
                    WHERE workspace_id = $1 AND parent_id = $2
                      AND name = $3 AND id != $4
                )
                """,
                workspace_id,
                parent_id,
                name,
                exclude_id,
            )
        else:
            result = await self._conn.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM folders
                    WHERE workspace_id = $1 AND parent_id = $2 AND name = $3
                )
                """,
                workspace_id,
                parent_id,
                name,
            )
        return bool(result)

    async def get_ancestors(
        self, folder_id: uuid.UUID, workspace_id: uuid.UUID
    ) -> list[asyncpg.Record]:
        """Get ancestor chain from root to this folder using the materialized path."""
        folder = await self.get_by_id(folder_id, workspace_id)
        if folder is None:
            return []

        # Walk up the tree using recursive CTE
        return await self._conn.fetch(
            """
            WITH RECURSIVE ancestors AS (
                SELECT id, workspace_id, parent_id, name, path,
                       created_at, updated_at
                FROM folders WHERE id = $1 AND workspace_id = $2
                UNION ALL
                SELECT f.id, f.workspace_id, f.parent_id, f.name, f.path,
                       f.created_at, f.updated_at
                FROM folders f
                JOIN ancestors a ON f.id = a.parent_id
            )
            SELECT * FROM ancestors ORDER BY path
            """,
            folder_id,
            workspace_id,
        )
