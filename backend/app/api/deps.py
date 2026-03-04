import uuid
from collections.abc import AsyncGenerator
from typing import Annotated

import asyncpg
import httpx
from fastapi import Depends, Path, Request
from jose.exceptions import JWTError

from app.auth import jwks_client
from app.cache import TTLCache
from app.database import get_pool
from app.exceptions import AuthError, PermissionDeniedError
from app.logging import get_logger
from app.models.auth import AuthUser
from app.repositories.workspace import WorkspaceRepository

logger = get_logger(__name__)

# Workspace access cache: key "access:{user_id}:{workspace_id}" → True
_access_cache: TTLCache[bool] = TTLCache(default_ttl=60.0, max_size=500)

# /auth/me response cache: key "{user_id}" → MeResponse dict
me_cache: TTLCache[dict] = TTLCache(default_ttl=300.0, max_size=200)


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire a database connection from the pool for the request lifetime.

    Instead of a SELECT 1 ping, catches stale connection errors on first real
    query and retries with a fresh connection (handled by the caller).
    99% of requests save one round-trip.
    """
    pool = get_pool()
    conn = await pool.acquire()

    try:
        yield conn
    finally:
        try:
            await pool.release(conn, timeout=5)
        except (TimeoutError, asyncpg.InterfaceError, asyncpg.InternalClientError):
            logger.warning("pool_release_failed_closing_connection")
            try:
                await conn.close()
            except Exception:
                pass


async def get_current_user(request: Request) -> AuthUser:
    """Extract and verify the JWT from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    token = auth_header.removeprefix("Bearer ") if auth_header and auth_header.startswith("Bearer ") else None

    if not token:
        raise AuthError("Missing or invalid Authorization header")

    try:
        payload = await jwks_client.verify_token(token)
    except JWTError as e:
        logger.warning("jwt_verification_failed", error=str(e))
        raise AuthError("Invalid or expired token") from e
    except ValueError as e:
        logger.warning("jwt_key_error", error=str(e))
        raise AuthError("Invalid token signing key") from e
    except (httpx.ConnectError, httpx.TimeoutException) as e:
        logger.error("jwks_network_error", error=str(e))
        raise AuthError("Authentication service temporarily unavailable") from e

    user_id = payload.get("sub")
    if not user_id:
        raise AuthError("Token missing user ID")

    return AuthUser(
        id=user_id,
        email=payload.get("email", ""),
        role=payload.get("role", "authenticated"),
    )


async def _verify_workspace(
    workspace_id: uuid.UUID = Path(),
    conn: asyncpg.Connection = Depends(get_db),
    user: AuthUser = Depends(get_current_user),
) -> asyncpg.Record:
    """Verify user access and return the full workspace row. Single query.

    Uses a TTL cache to skip the DB query entirely on repeat requests.
    """
    cache_key = f"access:{user.id}:{workspace_id}"
    repo = WorkspaceRepository(conn)

    # Fast path: cache hit means access was recently verified
    if _access_cache.get(cache_key):
        row = await repo.get_by_id(workspace_id)
        if row:
            return row

    # Combined access check + data fetch in one query
    row = await repo.get_with_access_check(user.id, workspace_id)
    if not row:
        raise PermissionDeniedError("You do not have access to this workspace")

    _access_cache.set(cache_key, True)
    return row


async def verify_workspace_access(
    ws_row: asyncpg.Record = Depends(_verify_workspace),
) -> uuid.UUID:
    """Thin wrapper returning just workspace_id for routes that only need the UUID."""
    return ws_row["id"]


DbConn = Annotated[asyncpg.Connection, Depends(get_db)]
CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
VerifiedWorkspace = Annotated[asyncpg.Record, Depends(_verify_workspace)]
VerifiedWorkspaceId = Annotated[uuid.UUID, Depends(verify_workspace_access)]
