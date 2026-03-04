"""Shared HTTP clients for LLM providers — reuses TCP connections."""

import httpx

from app.logging import get_logger

logger = get_logger(__name__)

_clients: dict[str, httpx.AsyncClient] = {}


def get_client(base_url: str, timeout: float = 120.0) -> httpx.AsyncClient:
    """Get or create a shared httpx.AsyncClient for the given base URL."""
    if base_url not in _clients:
        _clients[base_url] = httpx.AsyncClient(
            timeout=timeout,
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
            ),
        )
    return _clients[base_url]


async def close_all() -> None:
    """Close all shared HTTP clients. Called on application shutdown."""
    for url, client in _clients.items():
        try:
            await client.aclose()
        except Exception:
            logger.warning("failed_to_close_http_client", base_url=url)
    _clients.clear()
