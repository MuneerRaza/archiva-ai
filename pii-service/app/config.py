from pathlib import Path

from pydantic import BaseModel, ConfigDict, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class AppConfig(BaseModel):
    debug: bool = True
    log_level: str = "info"
    env: str = "development"


class MLflowConfig(BaseModel):
    # `model_*` field names would collide with pydantic's protected namespace.
    model_config = ConfigDict(protected_namespaces=())

    tracking_uri: str = "http://localhost:5000"
    s3_endpoint_url: str = "http://localhost:9000"
    vision_model_name: str = "pii-vision-yolo"
    vision_model_stage: str = "Production"
    gliner_model_name: str = "pii-text-gliner"
    gliner_model_stage: str = "Production"


class VisionConfig(BaseModel):
    # COCO classes relevant to visual PII today. A custom multi-class PII YOLO
    # (face/plate/id/person) is swapped in later via the MLflow registry.
    default_classes: list[str] = ["person"]
    pretrained_weights: str = "yolov8n.pt"
    device: str = "cpu"
    conf_threshold: float = 0.25


class TextConfig(BaseModel):
    gliner_model_id: str = "knowledgator/gliner-pii-base-v1.0"
    # GLiNER labels are lowercase natural-language; Presidio uses UPPER entity names.
    gliner_labels: list[str] = [
        "person",
        "email",
        "phone number",
        "address",
        "organization",
        "date of birth",
        "credit card number",
        "social security number",
    ]
    presidio_entities: list[str] | None = None  # None = all Presidio recognizers


class Settings(BaseSettings):
    app: AppConfig = AppConfig()
    mlflow: MLflowConfig = MLflowConfig()
    vision: VisionConfig = VisionConfig()
    text: TextConfig = TextConfig()

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent / ".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
        protected_namespaces=(),
    )

    @field_validator("mlflow")
    @classmethod
    def _strip_uri(cls, v: MLflowConfig) -> MLflowConfig:
        v.tracking_uri = v.tracking_uri.rstrip("/")
        v.s3_endpoint_url = v.s3_endpoint_url.rstrip("/")
        return v


settings = Settings()
