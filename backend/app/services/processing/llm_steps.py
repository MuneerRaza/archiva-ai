"""LLM processing steps — called by the pipeline when workspace settings enable them."""

import re

from app.logging import get_logger
from app.services.llm.base import LLMProvider
from app.services.processing.prompts import (
    OVERVIEW_PROMPT,
    OVERVIEW_SYSTEM,
    SUMMARIZE_PROMPTS,
    SUMMARIZE_SYSTEM,
    _CONTENT_FOCUS_INSTRUCTIONS,
)

logger = get_logger(__name__)

MIN_CONTENT_LENGTH = 100

_THINKING_TAGS_RE = re.compile(
    r"<(?:think|thinking|reasoning)>.*?</(?:think|thinking|reasoning)>",
    re.DOTALL,
)


def _strip_thinking_tags(text: str) -> str:
    return _THINKING_TAGS_RE.sub("", text).strip()


async def generate_summary(
    text: str,
    provider: LLMProvider,
    length: str = "medium",
    custom_instructions: str = "",
) -> str:
    if len(text.strip()) < MIN_CONTENT_LENGTH:
        return ""
    template = SUMMARIZE_PROMPTS.get(length, SUMMARIZE_PROMPTS["medium"])
    instructions_block = f"\nAdditional instructions: {custom_instructions}\n" if custom_instructions else ""
    prompt = template.format(
        text=text,
        instructions=instructions_block,
        content_focus=_CONTENT_FOCUS_INSTRUCTIONS,
    )
    result = await provider.generate(prompt, system=SUMMARIZE_SYSTEM)
    return _strip_thinking_tags(result)


async def generate_overview(text: str, provider: LLMProvider) -> str:
    if len(text.strip()) < MIN_CONTENT_LENGTH:
        return ""
    prompt = OVERVIEW_PROMPT.format(text=text)
    result = await provider.generate(prompt, system=OVERVIEW_SYSTEM)
    return _strip_thinking_tags(result)
