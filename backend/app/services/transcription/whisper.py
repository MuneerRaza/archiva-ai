"""OpenAI-compatible Whisper transcription provider.

Works with OpenAI, Groq, and any service exposing /audio/transcriptions.
"""

from pathlib import Path

import httpx

from app.logging import get_logger
from app.services.transcription.base import TranscriptionProvider, TranscriptionResult

logger = get_logger(__name__)

# 25 MB — hard limit for Whisper API
MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

_PROVIDER_URLS: dict[str, str] = {
    "openai": "https://api.openai.com/v1",
    "groq": "https://api.groq.com/openai/v1",
}


class WhisperProvider(TranscriptionProvider):

    def __init__(self, provider: str, model: str, api_key: str, base_url: str = "") -> None:
        self._provider = provider
        self._model = model
        self._api_key = api_key
        self._base_url = (base_url or _PROVIDER_URLS.get(provider, "")).rstrip("/")

    async def transcribe(self, file_path: Path) -> TranscriptionResult:
        file_size = file_path.stat().st_size
        if file_size > MAX_FILE_SIZE_BYTES:
            raise ValueError(
                f"File size ({file_size / 1024 / 1024:.1f} MB) exceeds "
                f"Whisper API limit of {MAX_FILE_SIZE_BYTES / 1024 / 1024:.0f} MB"
            )

        url = f"{self._base_url}/audio/transcriptions"
        headers = {"Authorization": f"Bearer {self._api_key}"}

        async with httpx.AsyncClient(timeout=300) as client:
            with file_path.open("rb") as f:
                response = await client.post(
                    url,
                    headers=headers,
                    files={"file": (file_path.name, f, "application/octet-stream")},
                    data={
                        "model": self._model,
                        "response_format": "verbose_json",
                    },
                )
            response.raise_for_status()
            data = response.json()

        text = data.get("text", "").strip()
        language = data.get("language")
        duration = data.get("duration")

        logger.info(
            "transcription_complete",
            file=file_path.name,
            language=language,
            duration=duration,
            text_length=len(text),
        )

        return TranscriptionResult(
            text=text,
            language=language,
            duration_seconds=float(duration) if duration is not None else None,
        )
