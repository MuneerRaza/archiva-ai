"""Detect thinking, vision, and budget capabilities for LLM models.

Detection strategy:
  - Ollama: live API call to /api/show. Family "gptoss" → budget + always_on.
  - Cloud providers (OpenAI, Anthropic, Gemini) + vLLM: lookup in known_models.json.
    Unknown models return empty capabilities (user sets manually in UI).

Capabilities stored in ai_models.capabilities[]:
  "thinking"           — model supports thinking (on/off toggle)
  "thinking_budget"    — model supports budget levels (low/medium/high)
  "thinking_always_on" — model cannot disable thinking (e.g. gptoss)
  "vision"             — model supports image input
"""

import json
from pathlib import Path
from typing import Any

import httpx

from app.logging import get_logger
from app.models.workspace import LLMProviderEnum

logger = get_logger(__name__)

# Load known models config once at import time
_CONFIG_PATH = Path(__file__).parent / "known_models.json"
_KNOWN_MODELS: dict[str, dict[str, Any]] = {}

with _CONFIG_PATH.open() as f:
    _KNOWN_MODELS = json.load(f)


async def detect_all_capabilities(
    provider: str,
    model: str,
    base_url: str = "",
) -> list[str]:
    """Detect all capabilities for a provider/model combination."""
    try:
        provider_enum = LLMProviderEnum(provider)
    except ValueError:
        return []

    if provider_enum == LLMProviderEnum.OLLAMA:
        return await _detect_ollama(model, base_url)

    return _lookup_known_model(provider, model)


def _lookup_known_model(provider: str, model: str) -> list[str]:
    """Lookup model in known_models.json. Returns empty list if unknown."""
    provider_models = _KNOWN_MODELS.get(provider, {})
    model_info = provider_models.get(model)

    if model_info is None:
        logger.info("unknown_model_no_caps", provider=provider, model=model)
        return []

    caps: list[str] = []
    if model_info.get("thinking"):
        caps.append("thinking")
    if model_info.get("thinking_budget"):
        caps.append("thinking_budget")
    if model_info.get("thinking_always_on"):
        caps.append("thinking_always_on")
    if model_info.get("vision"):
        caps.append("vision")
    return caps


async def _detect_ollama(model: str, base_url: str) -> list[str]:
    """Detect Ollama model capabilities via /api/show.

    - Reads capabilities array for "thinking" and "vision".
    - Checks details.family for "gptoss" → adds thinking_budget + thinking_always_on.
    """
    base = base_url.rstrip("/") if base_url else "http://localhost:11434"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(f"{base}/api/show", json={"name": model})
            resp.raise_for_status()
            data = resp.json()
    except httpx.ConnectError:
        raise
    except httpx.TimeoutException:
        raise
    except Exception as exc:
        logger.warning("ollama_show_failed", model=model, error=str(exc))
        return []

    ollama_caps: list[str] = data.get("capabilities", [])
    family = (data.get("details", {}).get("family", "") or "").lower()
    caps: list[str] = []

    if "thinking" in ollama_caps:
        caps.append("thinking")

        if family == "gptoss":
            # gptoss uses think:"low"/"medium"/"high" and cannot disable thinking
            caps.append("thinking_budget")
            caps.append("thinking_always_on")

    if "vision" in ollama_caps:
        caps.append("vision")

    logger.info(
        "ollama_capabilities_detected",
        model=model,
        family=family,
        capabilities=caps,
    )

    return caps
