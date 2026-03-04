import httpx

from app.logging import get_logger
from app.services.llm.base import LLMProvider
from app.services.llm.clients import get_client

logger = get_logger(__name__)


class OllamaProvider(LLMProvider):

    def __init__(self, base_url: str = "http://localhost:11434", model: str = "qwen2.5:7b") -> None:
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def generate(self, prompt: str, system: str | None = None) -> str:
        payload: dict = {
            "model": self._model,
            "prompt": prompt,
            "stream": False,
        }
        if system:
            payload["system"] = system

        client = get_client(self._base_url)
        response = await client.post(
            f"{self._base_url}/api/generate",
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("response", "")

    async def test_connection(self) -> tuple[bool, str]:
        try:
            client = get_client(self._base_url, timeout=10.0)
            response = await client.post(
                f"{self._base_url}/api/show",
                json={"model": self._model},
            )
            if response.status_code == 404:
                return (False, f"Model '{self._model}' not found")
            response.raise_for_status()
            return (True, self._model)
        except httpx.ConnectError:
            return (False, f"Connection refused — is Ollama running at {self._base_url}?")
        except httpx.TimeoutException:
            return (False, f"Connection timed out reaching {self._base_url}")
        except Exception as exc:
            return (False, str(exc))
