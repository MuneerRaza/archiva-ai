"""Search routes — full-text search across workspace files."""

from fastapi import APIRouter, Query

from app.api.deps import DbConn, VerifiedWorkspaceId
from app.models.responses import ListResponse, Pagination
from app.repositories.search import SearchRepository
from app.services.search.search import SearchResult, SearchService

router = APIRouter(tags=["search"])


@router.get(
    "/workspaces/{workspace_id}/search",
    response_model=ListResponse[SearchResult],
)
async def search_files(
    workspace_id: VerifiedWorkspaceId,
    conn: DbConn,
    q: str = Query(min_length=1, max_length=500),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> ListResponse[SearchResult]:
    service = SearchService(SearchRepository(conn))
    results, total = await service.search(workspace_id, q, limit, offset)
    return ListResponse(
        data=results,
        pagination=Pagination(
            total=total, limit=limit, offset=offset, has_more=offset + limit < total,
        ),
    )
