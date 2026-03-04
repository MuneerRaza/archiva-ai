import asyncpg

from app.repositories.base import BaseRepository


class ProfileRepository(BaseRepository):

    async def get_by_user_id(self, user_id: str) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            SELECT id, full_name, avatar_url, created_at, updated_at
            FROM profiles
            WHERE id = $1
            """,
            user_id,
        )

    async def update(self, user_id: str, full_name: str | None = None) -> asyncpg.Record | None:
        fields: list[str] = []
        values: list[object] = []
        idx = 1  # $1 = user_id

        if full_name is not None:
            idx += 1
            fields.append(f"full_name = ${idx}")
            values.append(full_name)

        if not fields:
            return await self.get_by_user_id(user_id)

        query = f"""
            UPDATE profiles
            SET {', '.join(fields)}
            WHERE id = $1
            RETURNING id, full_name, avatar_url, created_at, updated_at
        """
        return await self._conn.fetchrow(query, user_id, *values)
