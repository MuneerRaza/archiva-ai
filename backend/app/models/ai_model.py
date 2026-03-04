import uuid
from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel, Field


class ModelType(StrEnum):
    LLM = "llm"
    TRANSCRIPTION = "transcription"


class AIModelProvider(StrEnum):
    OLLAMA = "ollama"
    VLLM = "vllm"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"
    GROQ = "groq"


class AIModelCapability(StrEnum):
    VISION = "vision"
    THINKING = "thinking"


# ---------------------------------------------------------------------------
# API models
# ---------------------------------------------------------------------------

class AIModelCreate(BaseModel):
    label: str = Field(min_length=1, max_length=100)
    model_type: ModelType = ModelType.LLM
    provider: AIModelProvider
    model: str = Field(min_length=1, max_length=200)
    base_url: str = ""
    api_key: str | None = None
    capabilities: list[str] = Field(default_factory=list)
    context_length: int | None = None


class AIModelUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=100)
    model_type: ModelType | None = None
    provider: AIModelProvider | None = None
    model: str | None = Field(default=None, min_length=1, max_length=200)
    base_url: str | None = None
    api_key: str | None = None
    capabilities: list[str] | None = None
    context_length: int | None = None


class AIModelResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    label: str
    model_type: ModelType
    provider: AIModelProvider
    model: str
    base_url: str
    has_api_key: bool
    capabilities: list[str]
    context_length: int | None
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: object) -> "AIModelResponse":
        from asyncpg import Record

        r: Record = row  # type: ignore[assignment]
        return cls(
            id=r["id"],
            org_id=r["org_id"],
            label=r["label"],
            model_type=r["model_type"],
            provider=r["provider"],
            model=r["model"],
            base_url=r["base_url"],
            has_api_key=bool(r["api_key"]),
            capabilities=list(r["capabilities"]) if r["capabilities"] else [],
            context_length=r["context_length"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )


class AIModelTestRequest(BaseModel):
    model_type: ModelType = ModelType.LLM
    provider: AIModelProvider
    model: str
    base_url: str = ""
    api_key: str | None = None


class AIModelTestResult(BaseModel):
    success: bool
    error: str | None = None
    capabilities: list[str] = Field(default_factory=list)
