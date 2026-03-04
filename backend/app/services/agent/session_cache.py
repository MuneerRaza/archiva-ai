"""In-memory cache for active agent sessions.

Eliminates 8+ DB queries on subsequent messages in the same session.
Cache miss falls back to full DB load transparently.
"""

import time
import uuid
from dataclasses import dataclass, field

import asyncpg

from app.cache import TTLCache
from app.logging import get_logger
from app.models.workspace import AgentSettings

logger = get_logger(__name__)

SESSION_TTL = 1800.0  # 30 minutes
SYSTEM_PROMPT_REFRESH_INTERVAL = 300.0  # 5 minutes
MAX_CACHED_SESSIONS = 100


@dataclass
class CachedSession:
    session_id: uuid.UUID
    workspace_id: uuid.UUID
    model_row: asyncpg.Record
    system_prompt: str
    message_history: list  # Pydantic AI ModelMessage format
    agent_settings: AgentSettings
    ws_settings: dict
    system_prompt_built_at: float = field(default_factory=time.monotonic)


_cache: TTLCache[CachedSession] = TTLCache(
    default_ttl=SESSION_TTL,
    max_size=MAX_CACHED_SESSIONS,
)


def _key(session_id: uuid.UUID) -> str:
    return f"session:{session_id}"


def get_cached_session(session_id: uuid.UUID) -> CachedSession | None:
    return _cache.get(_key(session_id))


def cache_session(session: CachedSession) -> None:
    _cache.set(_key(session.session_id), session)


def invalidate_session(session_id: uuid.UUID) -> None:
    _cache.invalidate(_key(session_id))
    logger.debug("session_cache_invalidated", session_id=str(session_id))


def invalidate_all_sessions() -> None:
    """Invalidate all cached sessions (e.g., on workspace settings or model change)."""
    _cache.invalidate_by_prefix("session:")
    logger.debug("session_cache_invalidated_all")


def needs_prompt_refresh(session: CachedSession) -> bool:
    """Check if the system prompt is stale and should be rebuilt."""
    elapsed = time.monotonic() - session.system_prompt_built_at
    return elapsed >= SYSTEM_PROMPT_REFRESH_INTERVAL
