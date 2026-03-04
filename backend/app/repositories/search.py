import uuid

import asyncpg

from app.repositories.base import BaseRepository


class SearchRepository(BaseRepository):

    async def search(
        self,
        workspace_id: uuid.UUID,
        query: str,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[asyncpg.Record], int]:
        """Search files by full-text content and fuzzy filename matching.

        Uses a CTE to deduplicate by file ID, then sorts by rank and applies
        COUNT(*) OVER() to return total in a single query.
        """
        rows = await self._conn.fetch(
            """
            WITH ranked AS (
                SELECT DISTINCT ON (f.id)
                    f.id, f.workspace_id, f.folder_id, f.name, f.original_name,
                    f.mime_type, f.size_bytes, f.status, f.uploaded_by,
                    f.created_at, f.updated_at,
                    fc.summary, fc.page_count, fc.word_count, fc.language,
                    COALESCE(
                        ts_rank_cd(fc.tsv, plainto_tsquery('english', $2)),
                        0
                    ) + COALESCE(
                        similarity(f.name, $2),
                        0
                    ) AS rank
                FROM files f
                LEFT JOIN file_contents fc ON fc.file_id = f.id
                WHERE f.workspace_id = $1
                  AND (
                    fc.tsv @@ plainto_tsquery('english', $2)
                    OR f.name % $2
                    OR f.name ILIKE '%' || $2 || '%'
                  )
                ORDER BY f.id, rank DESC
            )
            SELECT *, COUNT(*) OVER() AS _total
            FROM ranked
            ORDER BY rank DESC
            LIMIT $3 OFFSET $4
            """,
            workspace_id,
            query,
            limit,
            offset,
        )

        total = rows[0]["_total"] if rows else 0
        return rows, total
