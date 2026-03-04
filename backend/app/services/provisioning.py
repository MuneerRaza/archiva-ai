"""Auto-provision profile, organization, and default workspace for new users."""

import json

import asyncpg

from app.logging import get_logger
from app.models.auth import AuthUser
from app.models.workspace import WorkspaceSettingsModel

logger = get_logger(__name__)

DEFAULT_WORKSPACE_SETTINGS = json.dumps(
    WorkspaceSettingsModel().model_dump(),
)


async def ensure_user_provisioned(
    conn: asyncpg.Connection, user: AuthUser,
) -> tuple[str, str | None]:
    """Ensure user has a profile, org, and workspace.

    Returns (workspace_id, full_name). Idempotent — safe to call on every request.
    """
    profile = await conn.fetchrow(
        "SELECT id, full_name FROM profiles WHERE id = $1", user.id
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
        ws_id = str(workspace["id"]) if workspace else ""
        return ws_id, profile["full_name"]

    # New user — provision everything in a transaction
    logger.info("provisioning_new_user", user_id=user.id, email=user.email)
    full_name = user.email.split("@")[0]

    async with conn.transaction():
        await conn.execute(
            "INSERT INTO profiles (id, full_name) VALUES ($1, $2)",
            user.id,
            full_name,
        )

        org_id = await conn.fetchval(
            """
            INSERT INTO organizations (name, owner_id)
            VALUES ($1, $2)
            RETURNING id
            """,
            f"{full_name}'s Org",
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
    return str(workspace_id), full_name
