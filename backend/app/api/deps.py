from collections.abc import AsyncGenerator

import asyncpg
from fastapi import Depends

from app.database import get_pool


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire a database connection from the pool for the request lifetime."""
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn


DbConnection = asyncpg.Connection
DbDep = Depends(get_db)
