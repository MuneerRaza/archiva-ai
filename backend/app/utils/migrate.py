"""Simple SQL migration runner. Tracks applied migrations in a _migrations table."""

import asyncio
from pathlib import Path

import asyncpg

from app.config import settings
from app.logging import get_logger, setup_logging

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent.parent / "migrations"

logger = get_logger(__name__)


async def run_migrations() -> None:
    conn = await asyncpg.connect(dsn=settings.database.url)

    try:
        # Create migrations tracking table
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS _migrations (
                name TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)

        applied: set[str] = {
            row["name"]
            for row in await conn.fetch("SELECT name FROM _migrations ORDER BY name")
        }

        migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))

        for migration_file in migration_files:
            name = migration_file.name
            if name in applied:
                logger.info("migration_skipped", name=name, reason="already applied")
                continue

            sql = migration_file.read_text()
            logger.info("migration_applying", name=name)

            async with conn.transaction():
                await conn.execute(sql)
                await conn.execute(
                    "INSERT INTO _migrations (name) VALUES ($1)", name
                )

            logger.info("migration_applied", name=name)

    finally:
        await conn.close()


def main() -> None:
    setup_logging()
    asyncio.run(run_migrations())


if __name__ == "__main__":
    main()
