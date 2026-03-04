from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path


@dataclass
class TranscriptionResult:
    text: str
    language: str | None = None
    duration_seconds: float | None = None


class TranscriptionProvider(ABC):

    @abstractmethod
    async def transcribe(self, file_path: Path) -> TranscriptionResult:
        """Transcribe an audio or video file and return the text."""
