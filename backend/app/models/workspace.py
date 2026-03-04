import json
import uuid
from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field, model_validator

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------

class FileCategory(StrEnum):
    DOCUMENT = "document"
    TEXT = "text"
    SPREADSHEET = "spreadsheet"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"


class SummaryLength(StrEnum):
    SHORT = "short"
    MEDIUM = "medium"
    LONG = "long"


class LLMProviderEnum(StrEnum):
    OLLAMA = "ollama"
    VLLM = "vllm"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GEMINI = "gemini"


class ThinkingMode(StrEnum):
    NONE = "none"
    TOGGLE = "toggle"
    BUDGET = "budget"
    ALWAYS_BUDGET = "always_budget"


# ---------------------------------------------------------------------------
# Per-category ingestion settings
# ---------------------------------------------------------------------------

class DocumentSettings(BaseModel):
    summary: bool = True
    structure: bool = True
    tables: bool = True


class TextSettings(BaseModel):
    summary: bool = True


class SpreadsheetSettings(BaseModel):
    summary: bool = False


class ImageSettings(BaseModel):
    description: bool = False


class AudioSettings(BaseModel):
    transcription: bool = False
    summary: bool = False


class VideoSettings(BaseModel):
    transcription: bool = False
    description: bool = False
    summary: bool = False


# ---------------------------------------------------------------------------
# Top-level settings — model_id references into ai_models table
# ---------------------------------------------------------------------------

class IngestionSettings(BaseModel):
    auto_ingest: bool = True
    reprocess_on_update: bool = True
    summary_model_id: str | None = None
    vision_model_id: str | None = None
    transcription_model_id: str | None = None
    language: str = "en"
    summary_length: SummaryLength = SummaryLength.MEDIUM
    summary_instructions: str = ""
    generate_overview: bool = True

    document: DocumentSettings = Field(default_factory=DocumentSettings)
    text: TextSettings = Field(default_factory=TextSettings)
    spreadsheet: SpreadsheetSettings = Field(default_factory=SpreadsheetSettings)
    image: ImageSettings = Field(default_factory=ImageSettings)
    audio: AudioSettings = Field(default_factory=AudioSettings)
    video: VideoSettings = Field(default_factory=VideoSettings)

    @model_validator(mode="before")
    @classmethod
    def _strip_legacy_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data.pop("processing_llm", None)
        return data


class ThinkingCapabilities(BaseModel):
    mode: ThinkingMode = ThinkingMode.NONE
    budget_levels: list[str] | None = None


class AgentSettings(BaseModel):
    model_id: str | None = None
    custom_instructions: str = ""
    language: str = "en"
    thinking_enabled: bool = False
    thinking_budget: str = "medium"

    @model_validator(mode="before")
    @classmethod
    def _strip_legacy_fields(cls, data: Any) -> Any:
        if isinstance(data, dict):
            for key in ("llm_provider", "llm_model", "llm_base_url", "api_key"):
                data.pop(key, None)
        return data


class WorkspaceSettingsModel(BaseModel):
    ingestion: IngestionSettings = Field(default_factory=IngestionSettings)
    agent: AgentSettings = Field(default_factory=AgentSettings)


# ---------------------------------------------------------------------------
# API models
# ---------------------------------------------------------------------------

class WorkspaceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: str | None = None


class WorkspaceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = None
    settings: WorkspaceSettingsModel | None = None


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    description: str | None
    settings: WorkspaceSettingsModel
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_row(cls, row: object) -> "WorkspaceResponse":
        """Convert an asyncpg Record to a WorkspaceResponse."""
        from asyncpg import Record  # noqa: TC002 — runtime cast

        r: Record = row  # type: ignore[assignment]
        raw_settings = r["settings"]
        if isinstance(raw_settings, str):
            raw_settings = json.loads(raw_settings)
        return cls(
            id=r["id"],
            org_id=r["org_id"],
            name=r["name"],
            description=r["description"],
            settings=WorkspaceSettingsModel.model_validate(raw_settings or {}),
            created_at=r["created_at"],
            updated_at=r["updated_at"],
        )
