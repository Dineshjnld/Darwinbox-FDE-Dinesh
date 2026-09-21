from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", case_sensitive=False)

    app_env: str = "development"
    mongodb_uri: str = ""
    mongodb_database: str = "migration_copilot"
    require_mongodb: bool = False
    mongodb_server_selection_timeout_ms: int = Field(default=10000, ge=1000, le=120000)
    cerebras_api_key: str = ""
    llm_provider: str = "cerebras"
    llm_model: str = ""
    cerebras_base_url: str = "https://api.cerebras.ai/v1"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    llm_fallback_provider: str = "gemini"
    target_provider: str = "mock"
    mock_target_url: str = ""
    mock_failure_rate: float = Field(default=0.0, ge=0, le=1)
    mock_fail_once_id: str = "EMP005"
    darwinbox_mcp_url: str = ""
    darwinbox_api_url: str = ""
    darwinbox_api_key: str = ""
    redis_url: str = ""
    cors_origins: str = "http://localhost:5173"
    log_level: str = "INFO"
    default_tenant_id: str = "demo-tenant"
    max_upload_mb: int = Field(default=10, ge=1, le=100)

    @property
    def schema_path(self) -> str:
        candidates = [Path("/sample_data/target_schema.yaml"), Path("sample_data/target_schema.yaml"), Path("../sample_data/target_schema.yaml")]
        return str(next((path for path in candidates if path.exists()), candidates[-1]))

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
