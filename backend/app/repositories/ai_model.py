import uuid

import asyncpg

from app.repositories.base import BaseRepository


class AIModelRepository(BaseRepository):

    async def list_by_org(self, org_id: uuid.UUID) -> list[asyncpg.Record]:
        return await self._conn.fetch(
            """
            SELECT id, org_id, label, model_type, provider, model,
                   base_url, api_key, capabilities, context_length, created_at, updated_at
            FROM ai_models
            WHERE org_id = $1
            ORDER BY created_at
            """,
            org_id,
        )

    async def get_by_id(self, model_id: uuid.UUID) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            SELECT id, org_id, label, model_type, provider, model,
                   base_url, api_key, capabilities, context_length, created_at, updated_at
            FROM ai_models
            WHERE id = $1
            """,
            model_id,
        )

    async def create(
        self,
        org_id: uuid.UUID,
        label: str,
        model_type: str,
        provider: str,
        model: str,
        base_url: str,
        api_key: str | None,
        capabilities: list[str],
        context_length: int | None = None,
    ) -> asyncpg.Record:
        return await self._conn.fetchrow(
            """
            INSERT INTO ai_models (org_id, label, model_type, provider, model, base_url, api_key, capabilities, context_length)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, org_id, label, model_type, provider, model,
                      base_url, api_key, capabilities, context_length, created_at, updated_at
            """,
            org_id,
            label,
            model_type,
            provider,
            model,
            base_url,
            api_key,
            capabilities,
            context_length,
        )

    async def update(
        self,
        model_id: uuid.UUID,
        org_id: uuid.UUID | None = None,
        label: str | None = None,
        model_type: str | None = None,
        provider: str | None = None,
        model: str | None = None,
        base_url: str | None = None,
        api_key: str | None = None,
        capabilities: list[str] | None = None,
        context_length: int | None = None,
        clear_api_key: bool = False,
    ) -> asyncpg.Record | None:
        fields: list[str] = ["updated_at = NOW()"]
        values: list[object] = []
        idx = 1

        # Optional org_id ownership filter — skips separate pre-fetch
        where = "WHERE id = $1"
        if org_id is not None:
            idx += 1
            where += f" AND org_id = ${idx}"
            values.insert(0, org_id)

        if label is not None:
            idx += 1
            fields.append(f"label = ${idx}")
            values.append(label)

        if model_type is not None:
            idx += 1
            fields.append(f"model_type = ${idx}")
            values.append(model_type)

        if provider is not None:
            idx += 1
            fields.append(f"provider = ${idx}")
            values.append(provider)

        if model is not None:
            idx += 1
            fields.append(f"model = ${idx}")
            values.append(model)

        if base_url is not None:
            idx += 1
            fields.append(f"base_url = ${idx}")
            values.append(base_url)

        if api_key is not None:
            idx += 1
            fields.append(f"api_key = ${idx}")
            values.append(api_key)
        elif clear_api_key:
            fields.append("api_key = NULL")

        if capabilities is not None:
            idx += 1
            fields.append(f"capabilities = ${idx}")
            values.append(capabilities)

        if context_length is not None:
            idx += 1
            fields.append(f"context_length = ${idx}")
            values.append(context_length)

        query = f"""
            UPDATE ai_models
            SET {', '.join(fields)}
            {where}
            RETURNING id, org_id, label, model_type, provider, model,
                      base_url, api_key, capabilities, context_length, created_at, updated_at
        """
        return await self._conn.fetchrow(query, model_id, *values)

    async def delete(self, model_id: uuid.UUID, org_id: uuid.UUID | None = None) -> bool:
        if org_id is not None:
            result = await self._conn.execute(
                "DELETE FROM ai_models WHERE id = $1 AND org_id = $2",
                model_id, org_id,
            )
        else:
            result = await self._conn.execute(
                "DELETE FROM ai_models WHERE id = $1",
                model_id,
            )
        return result == "DELETE 1"

    async def update_capabilities(
        self, model_id: uuid.UUID, capabilities: list[str],
    ) -> asyncpg.Record | None:
        return await self._conn.fetchrow(
            """
            UPDATE ai_models
            SET capabilities = $2, updated_at = NOW()
            WHERE id = $1
            RETURNING id, org_id, label, model_type, provider, model,
                      base_url, api_key, capabilities, context_length, created_at, updated_at
            """,
            model_id,
            capabilities,
        )
