"""JWT verification using Supabase JWKS endpoint (ECC P-256 / ES256)."""

from datetime import datetime, timedelta
from typing import Any

import httpx
from jose import jwk, jwt
from jose.exceptions import JWTError

from app.config import settings
from app.logging import get_logger

logger = get_logger(__name__)

JWKS_URL = f"{settings.supabase.url}/auth/v1/.well-known/jwks.json"
SUPPORTED_ALGORITHMS = ["ES256", "RS256"]


class JWKSClient:
    """Fetches and caches JWKS public keys from Supabase."""

    def __init__(self, url: str, ttl_seconds: int = 3600) -> None:
        self._url = url
        self._ttl_seconds = ttl_seconds
        self._cache: dict[str, Any] | None = None
        self._expires_at: datetime | None = None

    @property
    def _is_expired(self) -> bool:
        return self._expires_at is None or datetime.now() > self._expires_at

    async def get_keys(self) -> dict[str, Any]:
        if not self._is_expired and self._cache is not None:
            return self._cache

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self._url, timeout=10)
                response.raise_for_status()
                data = response.json()
        except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPStatusError) as exc:
            if self._cache is not None:
                logger.warning("jwks_fetch_failed_using_stale_cache", error=str(exc))
                return self._cache
            raise

        self._cache = data
        self._expires_at = datetime.now() + timedelta(seconds=self._ttl_seconds)
        logger.debug("jwks_refreshed", key_count=len(data.get("keys", [])))
        return data

    def _get_signing_key(self, kid: str, jwks_data: dict[str, Any]) -> str:
        for key in jwks_data.get("keys", []):
            if key.get("kid") == kid:
                return jwk.construct(key).to_pem().decode("utf-8")
        raise ValueError(f"No key found for kid: {kid}")

    async def verify_token(self, token: str) -> dict[str, Any]:
        """Verify a JWT and return the decoded payload."""
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if not kid:
            raise JWTError("Token header missing 'kid'")

        jwks_data = await self.get_keys()
        signing_key = self._get_signing_key(kid, jwks_data)

        payload: dict[str, Any] = jwt.decode(
            token,
            signing_key,
            algorithms=SUPPORTED_ALGORITHMS,
            options={"verify_aud": False},
        )
        return payload


jwks_client = JWKSClient(url=JWKS_URL)
