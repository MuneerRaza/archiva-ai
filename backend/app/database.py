import asyncpg

from app.config import settings
from app.logging import get_logger

logger = get_logger(__name__)

_pool: asyncpg.Pool | None = None


async def create_pool() -> asyncpg.Pool:
    """Create and return the asyncpg connection pool."""
    global _pool
    if _pool is not None:
        return _pool

    logger.info(
        "creating_database_pool",
        min_size=settings.database.pool_min,
        max_size=settings.database.pool_max,
    )

    _pool = await asyncpg.create_pool(
        dsn=settings.database.url,
        min_size=settings.database.pool_min,
        max_size=settings.database.pool_max,
    )

    logger.info("database_pool_created")
    return _pool


async def close_pool() -> None:
    """Close the connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("database_pool_closed")


def get_pool() -> asyncpg.Pool:
    """Get the current connection pool. Raises if not initialized."""
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call create_pool() first.")
    return _pool
