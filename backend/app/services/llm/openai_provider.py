import httpx

from app.logging import get_logger
from app.services.llm.base import LLMProvider
from app.services.llm.clients import get_client

logger = get_logger(__name__)

# Base URLs for cloud providers
_PROVIDER_URLS = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "groq": "https://api.groq.com/openai/v1",
}


class OpenAILLMProvider(LLMProvider):
    """OpenAI-compatible provider for cloud APIs (OpenAI, Anthropic, Gemini).

    Uses the OpenAI chat completions format. Anthropic and Gemini both
    offer OpenAI-compatible endpoints.
    """

    def __init__(
        self,
        provider: str,
        model: str,
        api_key: str = "",
        base_url: str = "",
    ) -> None:
        self._provider = provider
        self._model = model
        self._api_key = api_key
        self._base_url = (base_url or _PROVIDER_URLS.get(provider, "")).rstrip("/")

    async def generate(self, prompt: str, system: str | None = None) -> str:
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        headers: dict[str, str] = {"Content-Type": "application/json"}

        if self._provider == "anthropic":
            headers["x-api-key"] = self._api_key
            headers["anthropic-version"] = "2023-06-01"
        else:
            headers["Authorization"] = f"Bearer {self._api_key}"

        payload = {
            "model": self._model,
            "messages": messages,
            "stream": False,
        }

        client = get_client(self._base_url)
        response = await client.post(
            f"{self._base_url}/chat/completions",
            json=payload,
            headers=headers,
        )
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def test_connection(self) -> tuple[bool, str]:
        try:
            result = await self.generate("Say hi in one word.")
            if result:
                return (True, self._model)
            return (False, "Empty response from model")
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (401, 403):
                return (False, "Authentication failed — check your API key")
            return (False, f"HTTP {status}: {exc.response.text[:200]}")
        except httpx.ConnectError:
            return (False, f"Connection refused — cannot reach {self._base_url}")
        except httpx.TimeoutException:
            return (False, f"Connection timed out reaching {self._base_url}")
        except Exception as exc:
            return (False, str(exc))
