import uuid

from pydantic import BaseModel

from app.repositories.search import SearchRepository


class SearchResult(BaseModel):
    id: str
    name: str
    original_name: str
    mime_type: str
    size_bytes: int
    status: str
    folder_id: str | None
    summary: str | None
    page_count: int | None
    word_count: int | None
    language: str | None
    rank: float
    created_at: str
    updated_at: str


class SearchService:

    def __init__(self, repo: SearchRepository) -> None:
        self._repo = repo

    async def search(
        self,
        workspace_id: uuid.UUID,
        query: str,
        limit: int = 20,
        offset: int = 0,
    ) -> tuple[list[SearchResult], int]:
        rows, total = await self._repo.search(workspace_id, query, limit, offset)
        results = [
            SearchResult(
                id=str(r["id"]),
                name=r["name"],
                original_name=r["original_name"],
                mime_type=r["mime_type"],
                size_bytes=r["size_bytes"],
                status=r["status"],
                folder_id=str(r["folder_id"]) if r["folder_id"] else None,
                summary=r["summary"],
                page_count=r["page_count"],
                word_count=r["word_count"],
                language=r["language"],
                rank=float(r["rank"]),
                created_at=str(r["created_at"]),
                updated_at=str(r["updated_at"]),
            )
            for r in rows
        ]
        return results, total
