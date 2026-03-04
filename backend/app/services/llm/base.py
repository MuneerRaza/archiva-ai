from abc import ABC, abstractmethod

from app.logging import get_logger

logger = get_logger(__name__)


class LLMProvider(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system: str | None = None) -> str:
        """Generate a response from the LLM."""

    async def test_connection(self) -> tuple[bool, str]:
        """Test if the LLM provider is reachable and the model is available."""
        try:
            await self.generate("Say hi")
            return (True, "OK")
        except Exception as exc:
            logger.warning("llm_connection_test_failed", error=str(exc))
            return (False, str(exc))
