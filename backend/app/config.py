from enum import StrEnum
from pathlib import Path

from pydantic import BaseModel, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Environment(StrEnum):
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"


class LogLevel(StrEnum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class StorageBackendType(StrEnum):
    LOCAL = "local"
    R2 = "r2"


class AppConfig(BaseModel):
    env: Environment = Environment.DEVELOPMENT
    debug: bool = True
    log_level: LogLevel = LogLevel.DEBUG
    log_file: str | None = None
    storage_backend: StorageBackendType = StorageBackendType.LOCAL
    local_storage_path: str = "storage"

    @property
    def is_production(self) -> bool:
        return self.env == Environment.PRODUCTION


class BackendConfig(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]


class DatabaseConfig(BaseModel):
    url: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    pool_min: int = 2
    pool_max: int = 20


class SupabaseConfig(BaseModel):
    url: str = "http://localhost:54321"
    secret_key: str = ""


class R2Config(BaseModel):
    account_id: str = ""
    access_key_id: str = ""
    secret_access_key: str = ""
    bucket_name: str = "archiva-files"
    endpoint_url: str = ""


class LLMConfig(BaseModel):
    provider: str = "ollama"
    model: str = "qwen2.5:14b"
    processing_model: str = "qwen2.5:7b"
    ollama_base_url: str = "http://localhost:11434"
    vllm_base_url: str = "http://localhost:8001"

    @field_validator("ollama_base_url", "vllm_base_url")
    @classmethod
    def strip_trailing_slash(cls, v: str) -> str:
        v = v.rstrip("/")
        if v.endswith("/v1"):
            v = v[:-3]
        return v


class Settings(BaseSettings):
    app: AppConfig = AppConfig()
    backend: BackendConfig = BackendConfig()
    database: DatabaseConfig = DatabaseConfig()
    supabase: SupabaseConfig = SupabaseConfig()
    r2: R2Config = R2Config()
    llm: LLMConfig = LLMConfig()

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent.parent / ".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )


settings = Settings()
