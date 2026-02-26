from collections.abc import AsyncGenerator
from typing import Annotated

import asyncpg
from fastapi import Depends, Request
from jose.exceptions import JWTError

from app.auth import jwks_client
from app.database import get_pool
from app.exceptions import AuthError
from app.logging import get_logger
from app.models.auth import AuthUser

logger = get_logger(__name__)


async def get_db() -> AsyncGenerator[asyncpg.Connection, None]:
    """Acquire a database connection from the pool for the request lifetime."""
    pool = get_pool()
    async with pool.acquire() as conn:
        yield conn


async def get_current_user(request: Request) -> AuthUser:
    """Extract and verify the JWT from the Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise AuthError("Missing or invalid Authorization header")

    token = auth_header.removeprefix("Bearer ")

    try:
        payload = await jwks_client.verify_token(token)
    except JWTError as e:
        logger.warning("jwt_verification_failed", error=str(e))
        raise AuthError("Invalid or expired token") from e
    except ValueError as e:
        logger.warning("jwt_key_error", error=str(e))
        raise AuthError("Invalid token signing key") from e

    user_id = payload.get("sub")
    if not user_id:
        raise AuthError("Token missing user ID")

    return AuthUser(
        id=user_id,
        email=payload.get("email", ""),
        role=payload.get("role", "authenticated"),
    )


DbConn = Annotated[asyncpg.Connection, Depends(get_db)]
CurrentUser = Annotated[AuthUser, Depends(get_current_user)]
