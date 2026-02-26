from enum import StrEnum
from pathlib import Path

from pydantic import field_validator
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


class AppSettings(BaseSettings):
    env: Environment = Environment.DEVELOPMENT
    debug: bool = True
    log_level: LogLevel = LogLevel.DEBUG

    model_config = SettingsConfigDict(env_prefix="APP_")

    @property
    def is_production(self) -> bool:
        return self.env == Environment.PRODUCTION


class BackendSettings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = SettingsConfigDict(env_prefix="BACKEND_")


class DatabaseSettings(BaseSettings):
    url: str = "postgresql://postgres:postgres@localhost:54322/postgres"
    pool_min: int = 2
    pool_max: int = 10

    model_config = SettingsConfigDict(env_prefix="DATABASE_")


class SupabaseSettings(BaseSettings):
    url: str = "http://localhost:54321"
    anon_key: str = ""
    service_role_key: str = ""
    jwt_secret: str = ""

    model_config = SettingsConfigDict(env_prefix="SUPABASE_")


class R2Settings(BaseSettings):
    account_id: str = ""
    access_key_id: str = ""
    secret_access_key: str = ""
    bucket_name: str = "archiva-files"
    endpoint_url: str = ""

    model_config = SettingsConfigDict(env_prefix="R2_")


class LLMSettings(BaseSettings):
    provider: str = "ollama"
    model: str = "qwen2.5:14b"
    processing_model: str = "qwen2.5:7b"
    ollama_base_url: str = "http://localhost:11434"
    vllm_base_url: str = "http://localhost:8001"

    model_config = SettingsConfigDict(env_prefix="LLM_")

    @field_validator("ollama_base_url", "vllm_base_url")
    @classmethod
    def strip_trailing_slash(cls, v: str) -> str:
        return v.rstrip("/")


class Settings(BaseSettings):
    app: AppSettings = AppSettings()
    backend: BackendSettings = BackendSettings()
    database: DatabaseSettings = DatabaseSettings()
    supabase: SupabaseSettings = SupabaseSettings()
    r2: R2Settings = R2Settings()
    llm: LLMSettings = LLMSettings()

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parent.parent.parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
