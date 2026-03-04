import httpx

from app.logging import get_logger
from app.services.llm.base import LLMProvider
from app.services.llm.clients import get_client

logger = get_logger(__name__)


class VLLMProvider(LLMProvider):
    """Provider for vLLM (OpenAI-compatible API)."""

    def __init__(self, base_url: str = "http://localhost:8001", model: str = "qwen2.5:14b") -> None:
        self._base_url = base_url.rstrip("/")
        # Strip /v1 suffix — we append it internally in all API calls
        if self._base_url.endswith("/v1"):
            self._base_url = self._base_url[:-3]
        self._model = model

    async def generate(self, prompt: str, system: str | None = None) -> str:
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self._model,
            "messages": messages,
            "stream": False,
        }

        client = get_client(self._base_url)
        response = await client.post(
            f"{self._base_url}/v1/chat/completions",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def test_connection(self) -> tuple[bool, str]:
        try:
            client = get_client(self._base_url, timeout=10.0)
            response = await client.get(f"{self._base_url}/v1/models")
            response.raise_for_status()
            data = response.json()
            available = [m["id"] for m in data.get("data", [])]
            if self._model in available:
                return (True, self._model)
            if available:
                avail = ", ".join(available)
                return (False, f"Model '{self._model}' not found. Available: {avail}")
            return (False, "Server reachable but no models loaded")
        except httpx.ConnectError:
            return (False, f"Connection refused — is vLLM running at {self._base_url}?")
        except httpx.TimeoutException:
            return (False, f"Connection timed out reaching {self._base_url}")
        except Exception as exc:
            return (False, str(exc))
