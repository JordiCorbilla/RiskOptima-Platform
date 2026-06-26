from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "RiskOptima Platform API"
    api_prefix: str = "/api"
    database_path: Path = Path("backend/riskoptima_platform.db")
    riskoptima_path: Path = Path("../portfolio_risk_kit")
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    model_config = SettingsConfigDict(env_prefix="RISKOPTIMA_PLATFORM_", env_file=".env")


@lru_cache
def get_settings() -> Settings:
    return Settings()
