import uuid
from enum import StrEnum

import asyncpg

from app.repositories.base import BaseRepository


class FileSortField(StrEnum):
    NAME = "name"
    SIZE = "size_bytes"
    CREATED = "created_at"
    UPDATED = "updated_at"


class SortDirection(StrEnum):
    ASC = "asc"
    DESC = "desc"


SORT_COLUMNS = {
    FileSortField.NAME: "name",
    FileSortField.SIZE: "size_bytes",
    FileSortField.CREATED: "created_at",
    FileSortField.UPDATED: "updated_at",
}


class FileRepository(BaseRepository):

    async def list_by_folder(
        self,
        workspace_id: uuid.UUID,
        folder_id: uuid.UUID | None,
        sort_by: FileSortField = FileSortField.NAME,
        sort_dir: SortDirection = SortDirection.ASC,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[asyncpg.Record], int]:
        col = SORT_COLUMNS[sort_by]
        direction = "ASC" if sort_dir == SortDirection.ASC else "DESC"

        if folder_id is None:
            rows = await self._conn.fetch(
                f"""
                SELECT id, workspace_id, folder_id, name, original_name,
                       mime_type, size_bytes, storage_key, status, content_hash,
                       uploaded_by, created_at, updated_at,
                       COUNT(*) OVER() AS _total
                FROM files
                WHERE workspace_id = $1 AND folder_id IS NULL
                ORDER BY {col} {direction}
                LIMIT $2 OFFSET $3
                """,
                workspace_id,
                limit,
                offset,
            )
        else:
            rows = await self._conn.fetch(
                f"""
                SELECT id, workspace_id, folder_id, name, original_name,
                       mime_type, size_bytes, storage_key, status, content_hash,
                       uploaded_by, created_at, updated_at,
                       COUNT(*) OVER() AS _total
                FROM files
                WHERE workspace_id = $1 AND folder_id = $2
                ORDER BY {col} {direction}
                LIMIT $3 OFFSET $4
                """,
                workspace_id,
                folder_id,
                limit,
                offset,
            )

        total = rows[0]["_total"] if rows else 0
        return rows, total

    async def get_by_id(
        self, file_id: uuid.UUID, workspace_id: uuid.UUID
    ) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            SELECT id, workspace_id, folder_id, name, original_name,
                   mime_type, size_bytes, storage_key, status, content_hash,
                   uploaded_by, created_at, updated_at
            FROM files
            WHERE id = $1 AND workspace_id = $2
            """,
            file_id,
            workspace_id,
        )

    async def create(
        self,
        workspace_id: uuid.UUID,
        folder_id: uuid.UUID | None,
        name: str,
        original_name: str,
        mime_type: str,
        size_bytes: int,
        storage_key: str,
        uploaded_by: str,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO files (workspace_id, folder_id, name, original_name,
                               mime_type, size_bytes, storage_key, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, workspace_id, folder_id, name, original_name,
                      mime_type, size_bytes, storage_key, status, content_hash,
                      uploaded_by, created_at, updated_at
            """,
            workspace_id,
            folder_id,
            name,
            original_name,
            mime_type,
            size_bytes,
            storage_key,
            uploaded_by,
        )

    async def update(
        self,
        file_id: uuid.UUID,
        workspace_id: uuid.UUID,
        name: str | None = None,
        folder_id: uuid.UUID | None = None,
        move_to_root: bool = False,
    ) -> asyncpg.Record | None:
        fields: list[str] = []
        values: list[object] = []
        idx = 2  # $1=file_id, $2=workspace_id

        if name is not None:
            idx += 1
            fields.append(f"name = ${idx}")
            values.append(name)

        if move_to_root:
            fields.append("folder_id = NULL")
        elif folder_id is not None:
            idx += 1
            fields.append(f"folder_id = ${idx}")
            values.append(folder_id)

        if not fields:
            return await self.get_by_id(file_id, workspace_id)

        query = f"""
            UPDATE files
            SET {', '.join(fields)}
            WHERE id = $1 AND workspace_id = $2
            RETURNING id, workspace_id, folder_id, name, original_name,
                      mime_type, size_bytes, storage_key, status, content_hash,
                      uploaded_by, created_at, updated_at
        """
        return await self._conn.fetchrow(query, file_id, workspace_id, *values)

    async def delete(self, file_id: uuid.UUID, workspace_id: uuid.UUID) -> str | None:
        """Delete a file and return its storage_key, or None if not found."""
        return await self._conn.fetchval(
            """
            DELETE FROM files
            WHERE id = $1 AND workspace_id = $2
            RETURNING storage_key
            """,
            file_id,
            workspace_id,
        )

    _CLEARABLE_ARTIFACTS = {"summary", "overview", "structure", "raw_text"}

    async def clear_artifacts(
        self, file_id: uuid.UUID, fields: set[str],
    ) -> bool:
        """Set specified artifact columns to NULL. Returns True if row existed."""
        allowed = fields & self._CLEARABLE_ARTIFACTS
        if not allowed:
            return False
        set_clauses = ", ".join(f"{f} = NULL" for f in allowed)
        result = await self._conn.execute(
            f"UPDATE file_contents SET {set_clauses}, updated_at = NOW() "  # noqa: S608
            "WHERE file_id = $1",
            file_id,
        )
        return result == "UPDATE 1"

    async def get_content(self, file_id: uuid.UUID) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            SELECT id, file_id, raw_text, summary, overview, structure,
                   page_count, word_count, language, created_at, updated_at
            FROM file_contents
            WHERE file_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            file_id,
        )

    async def move_files(
        self,
        file_ids: list[uuid.UUID],
        workspace_id: uuid.UUID,
        target_folder_id: uuid.UUID | None,
    ) -> int:
        """Move files to a target folder (or root if None). Returns count moved."""
        if target_folder_id is None:
            result = await self._conn.execute(
                """
                UPDATE files
                SET folder_id = NULL, updated_at = NOW()
                WHERE id = ANY($1::uuid[]) AND workspace_id = $2
                """,
                file_ids,
                workspace_id,
            )
        else:
            result = await self._conn.execute(
                """
                UPDATE files
                SET folder_id = $3, updated_at = NOW()
                WHERE id = ANY($1::uuid[]) AND workspace_id = $2
                """,
                file_ids,
                workspace_id,
                target_folder_id,
            )
        # result is like "UPDATE 5"
        return int(result.split()[-1])

    async def delete_many(
        self, file_ids: list[uuid.UUID], workspace_id: uuid.UUID
    ) -> list[str]:
        """Delete multiple files and return their storage keys."""
        rows = await self._conn.fetch(
            """
            DELETE FROM files
            WHERE id = ANY($1::uuid[]) AND workspace_id = $2
            RETURNING storage_key
            """,
            file_ids,
            workspace_id,
        )
        return [r["storage_key"] for r in rows]
