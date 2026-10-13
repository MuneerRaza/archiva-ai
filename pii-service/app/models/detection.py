"""Canonical PII detection contracts. The backend mirrors these in
backend/app/models/pii.py — keep the two in sync."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Modality(StrEnum):
    TEXT = "text"
    DOCUMENT = "document"
    SPREADSHEET = "spreadsheet"
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"


class LocationType(StrEnum):
    CHAR_SPAN = "char_span"
    BBOX = "bbox"
    TIME_RANGE = "time_range"


class DetectionSource(StrEnum):
    PRESIDIO = "presidio"
    GLINER = "gliner"
    REGEX = "regex"
    YOLO = "yolo"


class StorageRef(BaseModel):
    storage_key: str
    download_url: str | None = None
    mime_type: str | None = None


class DetectRequest(BaseModel):
    modality: Modality = Modality.TEXT
    content: str | None = None        # inline text/transcript
    storage_ref: StorageRef | None = None  # binary modalities (image/audio/video)
    classes: list[str] | None = None  # entity types / YOLO classes (None = config default)
    custom_regex: list[str] = Field(default_factory=list)
    language: str = "en"

    @model_validator(mode="after")
    def _need_input(self) -> "DetectRequest":
        if self.content is None and self.storage_ref is None:
            raise ValueError("one of 'content' or 'storage_ref' is required")
        return self


# Location payloads (serialized to `location: dict` on Detection for JSONB round-trip)
class CharSpan(BaseModel):
    start: int
    end: int


class BBox(BaseModel):
    x: float
    y: float
    w: float
    h: float
    frame: int | None = None


class TimeRange(BaseModel):
    start_s: float
    end_s: float


class Detection(BaseModel):
    entity_type: str
    value: str | None = None
    score: float
    source: DetectionSource
    location_type: LocationType
    location: dict


class ModelInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    vision: dict | None = None  # {name, version, stage, source}
    text: dict | None = None    # {presidio, gliner}


class DetectResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    modality: Modality
    detections: list[Detection] = Field(default_factory=list)
    model_info: ModelInfo = Field(default_factory=ModelInfo)
