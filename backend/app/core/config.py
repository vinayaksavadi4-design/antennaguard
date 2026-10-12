from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    app_name: str = "AntennaGuard API"
    environment: str = "development"
    database_url: str = f"sqlite:///{(BASE_DIR / 'antennaguard.db').as_posix()}"
    secret_key: str = "local-development-secret-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 120
    cors_origins: str = "http://localhost:5173,http://localhost:4173,http://localhost:3000"
    model_path: str = str(BASE_DIR / "models" / "antenna_rf.pkl")

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
