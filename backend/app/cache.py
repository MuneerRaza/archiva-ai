"""Generic in-memory TTL cache with LRU eviction."""

import threading
import time
from dataclasses import dataclass, field
from typing import Generic, TypeVar

T = TypeVar("T")


@dataclass
class _Entry(Generic[T]):
    value: T
    expires_at: float
    last_accessed: float = field(default_factory=time.monotonic)


class TTLCache(Generic[T]):
    """Thread-safe in-memory cache with per-key TTL and LRU eviction.

    Never raises — all errors are swallowed silently. The cache is an
    optimization layer, never a failure point.
    """

    def __init__(self, default_ttl: float = 60.0, max_size: int = 1000) -> None:
        self._default_ttl = default_ttl
        self._max_size = max_size
        self._data: dict[str, _Entry[T]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> T | None:
        try:
            with self._lock:
                entry = self._data.get(key)
                if entry is None:
                    return None
                now = time.monotonic()
                if now >= entry.expires_at:
                    del self._data[key]
                    return None
                entry.last_accessed = now
                return entry.value
        except Exception:
            return None

    def set(self, key: str, value: T, ttl: float | None = None) -> None:
        try:
            with self._lock:
                now = time.monotonic()
                self._data[key] = _Entry(
                    value=value,
                    expires_at=now + (ttl if ttl is not None else self._default_ttl),
                    last_accessed=now,
                )
                if len(self._data) > self._max_size:
                    self._evict()
        except Exception:
            pass

    def invalidate(self, key: str) -> None:
        try:
            with self._lock:
                self._data.pop(key, None)
        except Exception:
            pass

    def invalidate_by_prefix(self, prefix: str) -> None:
        try:
            with self._lock:
                keys_to_remove = [k for k in self._data if k.startswith(prefix)]
                for k in keys_to_remove:
                    del self._data[k]
        except Exception:
            pass

    def _evict(self) -> None:
        """Remove expired entries first, then LRU until under max_size."""
        now = time.monotonic()
        expired = [k for k, v in self._data.items() if now >= v.expires_at]
        for k in expired:
            del self._data[k]

        if len(self._data) <= self._max_size:
            return

        # LRU eviction: remove oldest-accessed entries
        sorted_keys = sorted(self._data, key=lambda k: self._data[k].last_accessed)
        to_remove = len(self._data) - self._max_size
        for k in sorted_keys[:to_remove]:
            del self._data[k]
