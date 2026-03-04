"""Build Pydantic AI Model instances and ModelSettings from workspace config or ai_models DB row."""

import httpx
import asyncpg
from pydantic_ai import models
from pydantic_ai.settings import ModelSettings

from app.config import settings as app_settings
from app.models.ai_model import AIModelProvider
from app.models.workspace import LLMProviderEnum

# Budget mapping: label -> token count (for Anthropic/Gemini style budgets)
_THINKING_BUDGET_TOKENS = {"low": 1024, "medium": 4096, "high": 16384}

# Timeout for local LLM providers (Ollama / vLLM).
# Large models can take minutes to generate the first token, so we use a
# long read timeout. Connect is kept short to fail fast if the server is down.
_LOCAL_LLM_TIMEOUT = httpx.Timeout(connect=10.0, read=600.0, write=30.0, pool=10.0)

# Shared HTTP clients keyed by base_url — reuse TCP connections across
# requests instead of creating a new client (and TCP/TLS handshake) per call.
_shared_clients: dict[str, httpx.AsyncClient] = {}


def _get_shared_client(base_url: str) -> httpx.AsyncClient:
    if base_url not in _shared_clients:
        _shared_clients[base_url] = httpx.AsyncClient(timeout=_LOCAL_LLM_TIMEOUT)
    return _shared_clients[base_url]


def create_model_from_record(row: asyncpg.Record) -> models.Model:
    """Create the correct Pydantic AI model from an ai_models DB row."""
    provider = AIModelProvider(row["provider"])
    model_name = row["model"]
    base_url = (row["base_url"] or "").strip()
    api_key = row["api_key"] or ""

    return _build_model(provider, model_name, base_url, api_key)


def _build_model(
    provider: AIModelProvider,
    model_name: str,
    base_url: str,
    api_key: str,
) -> models.Model:
    match provider:
        case AIModelProvider.OLLAMA:
            from pydantic_ai.models.openai import OpenAIChatModel
            from pydantic_ai.providers.ollama import OllamaProvider

            ollama_base = base_url or app_settings.llm.ollama_base_url
            ollama_base = ollama_base.rstrip("/")
            if not ollama_base.endswith("/v1"):
                ollama_base = f"{ollama_base}/v1"

            return OpenAIChatModel(
                model_name,
                provider=OllamaProvider(
                    base_url=ollama_base,
                    http_client=_get_shared_client(ollama_base),
                ),
            )

        case AIModelProvider.VLLM:
            from pydantic_ai.models.openai import OpenAIChatModel
            from pydantic_ai.providers.openai import OpenAIProvider

            vllm_base = base_url or app_settings.llm.vllm_base_url
            vllm_base = vllm_base.rstrip("/")
            if not vllm_base.endswith("/v1"):
                vllm_base = f"{vllm_base}/v1"

            return OpenAIChatModel(
                model_name,
                provider=OpenAIProvider(
                    base_url=vllm_base,
                    api_key=api_key or "dummy",
                    http_client=_get_shared_client(vllm_base),
                ),
            )

        case AIModelProvider.OPENAI:
            from pydantic_ai.models.openai import OpenAIChatModel
            from pydantic_ai.providers.openai import OpenAIProvider

            return OpenAIChatModel(
                model_name,
                provider=OpenAIProvider(api_key=api_key),
            )

        case AIModelProvider.ANTHROPIC:
            from pydantic_ai.models.anthropic import AnthropicModel
            from pydantic_ai.providers.anthropic import AnthropicProvider

            return AnthropicModel(
                model_name,
                provider=AnthropicProvider(api_key=api_key),
            )

        case AIModelProvider.GEMINI:
            from pydantic_ai.models.google import GoogleModel
            from pydantic_ai.providers.google import GoogleProvider

            return GoogleModel(
                model_name,
                provider=GoogleProvider(api_key=api_key),
            )

        case AIModelProvider.GROQ:
            from pydantic_ai.models.openai import OpenAIChatModel
            from pydantic_ai.providers.openai import OpenAIProvider

            groq_base = base_url or "https://api.groq.com/openai/v1"
            return OpenAIChatModel(
                model_name,
                provider=OpenAIProvider(base_url=groq_base, api_key=api_key),
            )

        case _:
            raise ValueError(f"Unknown provider: {provider}")


def build_model_settings_from_record(
    row: asyncpg.Record,
    thinking_enabled: bool,
    thinking_budget: str,
    has_thinking: bool,
    has_budget: bool,
) -> ModelSettings | None:
    """Build ModelSettings from an ai_models row + agent config.

    Special cases:
      - Ollama: No settings needed — models output <think> tags inline,
        Pydantic AI's built-in thinking_tags parsing handles them.
      - vLLM: enable_thinking via chat_template_kwargs.
      - Cloud providers: native thinking support (reasoning_effort, etc).
    """
    stored_caps = row["capabilities"] or []
    always_on = "thinking_always_on" in stored_caps
    provider = AIModelProvider(row["provider"])

    # If thinking is off and model can actually turn it off, return None
    if not thinking_enabled and not always_on:
        if not has_thinking:
            return None
        return None

    # If thinking is off but model is always_on, send minimum budget
    if not thinking_enabled and always_on:
        return _build_settings(provider, "low", has_budget=True)

    if not has_thinking:
        return None

    return _build_settings(provider, thinking_budget, has_budget=has_budget)


def _build_settings(
    provider: AIModelProvider,
    budget: str,
    *,
    has_budget: bool,
) -> ModelSettings | None:
    match provider:
        case AIModelProvider.OLLAMA:
            # Don't pass think param — let models output <think> tags inline.
            # Pydantic AI's built-in thinking_tags parsing handles them.
            # Passing think:true triggers Ollama's structured `reasoning` field,
            # which causes Pydantic AI to drop the first token(s) after thinking.
            return None

        case AIModelProvider.VLLM:
            return ModelSettings(
                extra_body={
                    "chat_template_kwargs": {"enable_thinking": True},
                },
            )

        case AIModelProvider.OPENAI:
            from pydantic_ai.models.openai import OpenAIChatModelSettings

            effort = budget if budget in ("low", "medium", "high") else "medium"
            return OpenAIChatModelSettings(
                openai_reasoning_effort=effort,  # type: ignore[arg-type]
            )

        case AIModelProvider.ANTHROPIC:
            from pydantic_ai.models.anthropic import AnthropicModelSettings

            budget_tokens = _THINKING_BUDGET_TOKENS.get(budget, 4096)
            return AnthropicModelSettings(
                anthropic_thinking={"type": "enabled", "budget_tokens": budget_tokens},
            )

        case AIModelProvider.GEMINI:
            from pydantic_ai.models.google import GoogleModelSettings

            return GoogleModelSettings(
                google_thinking_config={"include_thoughts": True},
            )

    return None
