"""Redaction contracts. Backend sends original content/bytes + the spans to
redact; pii-service returns the redacted text/bytes (stateless compute)."""

from enum import StrEnum

from pydantic import BaseModel, Field


class RedactionMethod(StrEnum):
    MASK = "mask"      # text → replacement chars
    LABEL = "label"    # text → [ENTITY_TYPE]
    BLUR = "blur"      # image/video region
    BOX = "box"        # image/video solid box
    BEEP = "beep"      # audio segment
    SILENCE = "silence"  # audio segment


class RedactSpan(BaseModel):
    """A text span to redact (char offsets into the original content)."""

    start: int
    end: int
    entity_type: str = "PII"


class RedactTextRequest(BaseModel):
    content: str
    spans: list[RedactSpan] = Field(default_factory=list)
    method: RedactionMethod = RedactionMethod.MASK
    mask_char: str = "█"  # full block █


class RedactTextResponse(BaseModel):
    redacted: str
    redaction_count: int


class RedactDocumentResponse(BaseModel):
    """Reported alongside the streamed redacted PDF (in headers/JSON wrapper)."""

    redaction_count: int
