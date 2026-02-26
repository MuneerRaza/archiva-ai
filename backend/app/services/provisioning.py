"""Auto-provision profile, organization, and default workspace for new users."""

import asyncpg

from app.logging import get_logger
from app.models.auth import AuthUser

logger = get_logger(__name__)

DEFAULT_WORKSPACE_SETTINGS = """{
    "ingestion": {
        "auto_ingest": true,
        "summary_generation": true,
        "structure_extraction": true,
        "table_extraction": true,
        "transcription": false,
        "image_description": false,
        "video_description": false,
        "processing_llm": {"provider": "ollama", "model": "qwen2.5:14b"},
        "language": "en",
        "reprocess_on_update": true
    },
    "agent": {
        "llm_provider": "ollama",
        "llm_model": "qwen2.5:14b",
        "custom_instructions": "",
        "language": "en"
    }
}"""


async def ensure_user_provisioned(conn: asyncpg.Connection, user: AuthUser) -> str:
    """Ensure user has a profile, org, and workspace. Returns the workspace ID.

    Idempotent — safe to call on every request (checks first, creates if missing).
    """
    profile = await conn.fetchrow(
        "SELECT id FROM profiles WHERE id = $1", user.id
    )

    if profile is not None:
        workspace = await conn.fetchrow(
            """
            SELECT w.id FROM workspaces w
            JOIN organizations o ON w.org_id = o.id
            WHERE o.owner_id = $1
            ORDER BY w.created_at
            LIMIT 1
            """,
            user.id,
        )
        return str(workspace["id"]) if workspace else ""

    # New user — provision everything in a transaction
    logger.info("provisioning_new_user", user_id=user.id, email=user.email)

    async with conn.transaction():
        await conn.execute(
            "INSERT INTO profiles (id, full_name) VALUES ($1, $2)",
            user.id,
            user.email.split("@")[0],
        )

        org_id = await conn.fetchval(
            """
            INSERT INTO organizations (name, owner_id)
            VALUES ($1, $2)
            RETURNING id
            """,
            f"{user.email.split('@')[0]}'s Org",
            user.id,
        )

        workspace_id = await conn.fetchval(
            """
            INSERT INTO workspaces (org_id, name, description, settings)
            VALUES ($1, $2, $3, $4::jsonb)
            RETURNING id
            """,
            org_id,
            "My Workspace",
            "Default workspace",
            DEFAULT_WORKSPACE_SETTINGS,
        )

    logger.info(
        "user_provisioned",
        user_id=user.id,
        org_id=str(org_id),
        workspace_id=str(workspace_id),
    )
    return str(workspace_id)
