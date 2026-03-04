import asyncpg

from app.config import settings
from app.models.ai_model import AIModelProvider
from app.services.llm.base import LLMProvider
from app.services.llm.ollama import OllamaProvider
from app.services.llm.openai_provider import OpenAILLMProvider
from app.services.llm.vllm import VLLMProvider

_OPENAI_COMPAT_PROVIDERS = {
    AIModelProvider.OPENAI,
    AIModelProvider.ANTHROPIC,
    AIModelProvider.GEMINI,
    AIModelProvider.GROQ,
}


def get_llm_provider(config: dict | None = None) -> LLMProvider:
    config = config or {}
    provider = AIModelProvider(config.get("provider", settings.llm.provider))
    model = config.get("model", settings.llm.processing_model)
    base_url = config.get("base_url", "").strip()
    api_key = config.get("api_key", "").strip()

    if provider == AIModelProvider.VLLM:
        return VLLMProvider(
            base_url=base_url or settings.llm.vllm_base_url,
            model=model,
        )

    if provider in _OPENAI_COMPAT_PROVIDERS:
        return OpenAILLMProvider(
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
        )

    # Default to ollama
    return OllamaProvider(
        base_url=base_url or settings.llm.ollama_base_url,
        model=model,
    )


def get_llm_provider_from_model(row: asyncpg.Record) -> LLMProvider:
    """Create an LLMProvider from an ai_models DB row."""
    provider = AIModelProvider(row["provider"])
    model = row["model"]
    base_url = row["base_url"] or ""
    api_key = row["api_key"] or ""

    if provider == AIModelProvider.VLLM:
        return VLLMProvider(
            base_url=base_url or settings.llm.vllm_base_url,
            model=model,
        )

    if provider in _OPENAI_COMPAT_PROVIDERS:
        return OpenAILLMProvider(
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
        )

    # Default to ollama
    return OllamaProvider(
        base_url=base_url or settings.llm.ollama_base_url,
        model=model,
    )
