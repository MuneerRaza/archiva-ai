from fastapi import APIRouter

from app.database import get_pool

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check() -> dict[str, str]:
    """Basic health check."""
    return {"status": "ok"}


@router.get("/health/db")
async def health_check_db() -> dict[str, str | bool]:
    """Health check including database connectivity."""
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return {"status": "ok", "database": True}
    except Exception:
        return {"status": "degraded", "database": False}
