import json
import uuid

import asyncpg

from app.models.file import FileStatus
from app.models.processing import ProcessingStatus
from app.repositories.base import BaseRepository


class ProcessingRepository(BaseRepository):

    async def create_job(
        self,
        file_id: uuid.UUID,
        workspace_id: uuid.UUID,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO processing_jobs (file_id, workspace_id, status, progress, retry_count, steps)
            VALUES ($1, $2, 'queued', 0, 0, '{}'::jsonb)
            RETURNING *
            """,
            file_id,
            workspace_id,
        )

    async def update_job_status(
        self,
        job_id: uuid.UUID,
        status: ProcessingStatus,
        progress: float = 0,
        error_message: str | None = None,
        steps: dict | None = None,
    ) -> asyncpg.Record | None:
        fields = ["status = $2", "progress = $3", "error_message = $4"]
        values: list[object] = [job_id, status, progress, error_message]
        idx = 4

        if steps is not None:
            idx += 1
            fields.append(f"steps = ${idx}::jsonb")
            values.append(json.dumps(steps))

        if status == ProcessingStatus.RUNNING:
            fields.append("started_at = NOW()")
        elif status in (ProcessingStatus.COMPLETED, ProcessingStatus.FAILED):
            fields.append("completed_at = NOW()")

        query = f"""
            UPDATE processing_jobs
            SET {', '.join(fields)}
            WHERE id = $1
            RETURNING *
        """
        return await self._conn.fetchrow(query, *values)

    async def get_job_by_file(self, file_id: uuid.UUID) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            "SELECT * FROM processing_jobs WHERE file_id = $1 ORDER BY created_at DESC LIMIT 1",
            file_id,
        )

    async def get_active_jobs(
        self, workspace_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> tuple[list[asyncpg.Record], int]:
        rows = await self._conn.fetch(
            """
            SELECT *, COUNT(*) OVER() AS _total
            FROM processing_jobs
            WHERE workspace_id = $1 AND status IN ('queued', 'running')
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            workspace_id,
            limit,
            offset,
        )
        total = rows[0]["_total"] if rows else 0
        return rows, total

    async def get_all_jobs(
        self, workspace_id: uuid.UUID, limit: int = 50, offset: int = 0
    ) -> tuple[list[asyncpg.Record], int]:
        rows = await self._conn.fetch(
            """
            SELECT pj.*, f.name AS file_name, f.mime_type AS file_mime_type,
                   COUNT(*) OVER() AS _total
            FROM processing_jobs pj
            LEFT JOIN files f ON f.id = pj.file_id
            WHERE pj.workspace_id = $1
            ORDER BY pj.created_at DESC
            LIMIT $2 OFFSET $3
            """,
            workspace_id,
            limit,
            offset,
        )
        total = rows[0]["_total"] if rows else 0
        return rows, total

    async def get_file_content(self, file_id: uuid.UUID) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            "SELECT raw_text, summary FROM file_contents WHERE file_id = $1",
            file_id,
        )

    async def upsert_file_content(
        self,
        file_id: uuid.UUID,
        raw_text: str | None = None,
        summary: str | None = None,
        overview: str | None = None,
        structure: dict | None = None,
        page_count: int | None = None,
        word_count: int | None = None,
        language: str | None = None,
    ) -> asyncpg.Record:
        structure_json = json.dumps(structure) if structure is not None else None
        return await self._conn.fetchrow(
            """
            INSERT INTO file_contents (file_id, raw_text, summary, overview, structure, page_count, word_count,
                                       language, tsv)
            VALUES ($1, $2::text, $3::text, $4::text, $5::jsonb, $6::int, $7::int, $8::text,
                    CASE WHEN $2::text IS NOT NULL THEN to_tsvector('english', $2::text) ELSE NULL END)
            ON CONFLICT (file_id) DO UPDATE
                SET raw_text = COALESCE(EXCLUDED.raw_text, file_contents.raw_text),
                    summary = COALESCE(EXCLUDED.summary, file_contents.summary),
                    overview = COALESCE(EXCLUDED.overview, file_contents.overview),
                    structure = COALESCE(EXCLUDED.structure, file_contents.structure),
                    page_count = COALESCE(EXCLUDED.page_count, file_contents.page_count),
                    word_count = COALESCE(EXCLUDED.word_count, file_contents.word_count),
                    language = COALESCE(EXCLUDED.language, file_contents.language),
                    tsv = CASE WHEN EXCLUDED.raw_text IS NOT NULL
                               THEN to_tsvector('english', EXCLUDED.raw_text)
                               ELSE file_contents.tsv END,
                    updated_at = NOW()
            RETURNING *
            """,
            file_id,
            raw_text,
            summary,
            overview,
            structure_json,
            page_count,
            word_count,
            language,
        )

    async def delete_file_tables(self, file_id: uuid.UUID) -> None:
        await self._conn.execute(
            "DELETE FROM file_tables WHERE file_id = $1", file_id
        )

    async def insert_file_table(
        self,
        file_id: uuid.UUID,
        table_index: int,
        headers: list[str],
        rows: list[list[str]],
        page_number: int | None = None,
        sheet_name: str | None = None,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO file_tables (file_id, table_index, headers, rows, page_number, sheet_name)
            VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6)
            RETURNING *
            """,
            file_id,
            table_index,
            json.dumps(headers),
            json.dumps(rows),
            page_number,
            sheet_name,
        )

    async def update_file_status(self, file_id: uuid.UUID, status: FileStatus) -> None:
        await self._conn.execute(
            "UPDATE files SET status = $2, updated_at = NOW() WHERE id = $1",
            file_id,
            status,
        )
