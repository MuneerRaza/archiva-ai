import asyncpg

from app.services.transcription.base import TranscriptionProvider
from app.services.transcription.whisper import WhisperProvider

_WHISPER_PROVIDERS = {"openai", "groq"}


def get_transcription_provider(model_row: asyncpg.Record) -> TranscriptionProvider:
    """Create a TranscriptionProvider from an ai_models DB row."""
    provider = model_row["provider"]
    model = model_row["model"]
    api_key = model_row["api_key"] or ""
    base_url = model_row["base_url"] or ""

    if provider in _WHISPER_PROVIDERS:
        return WhisperProvider(
            provider=provider,
            model=model,
            api_key=api_key,
            base_url=base_url,
        )

    raise ValueError(f"Unsupported transcription provider: {provider}")
