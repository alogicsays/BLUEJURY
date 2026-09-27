from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    database_url: str = "postgresql+psycopg://bluejury:bluejury@localhost:5432/bluejury"
    api_host: str = "127.0.0.1"
    api_port: int = 8000
    web_origin: str = "http://localhost:3000"
    capacitor_origin: str = "https://localhost"
    protected_planet_api_token: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
