from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        case_sensitive=False
    )

    # Database
    database_url: str
    supabase_url: str
    supabase_key: str

    # Redis (local)
    redis_url: str = "redis://localhost:6379"

    # LLM Providers
    ollama_url: str = "http://localhost:11434"
    openrouter_api_key: str = ""

    # Telegram
    telegram_bot_token: str = ""

    # Tools
    openweathermap_api_key: str = ""

    # App
    debug: bool = False
    environment: str = "development"


settings = Settings()
