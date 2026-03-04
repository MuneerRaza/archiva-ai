import asyncpg


class BaseRepository:
    """Base class for all repositories. Holds a database connection."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        self._conn = conn
