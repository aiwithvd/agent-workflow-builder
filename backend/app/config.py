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
    supabase_url: str = ""   # unused in code — kept for future Supabase Auth/Storage use
    supabase_key: str = ""   # unused in code — kept for future Supabase Auth/Storage use

    # Redis (local)
    redis_url: str = "redis://localhost:6379"

    # LLM Providers
    ollama_url: str = "http://localhost:11434"
    openrouter_api_key: str = ""
    openai_api_key: str = ""
    anthropic_api_key: str = ""
    google_api_key: str = ""

    # Z.ai / GLM-5.1 (Cloud API)
    z_ai_api_key: str = ""
    z_ai_base_url: str = "https://api.z.ai/v1"

    # GLM-5.1 (Local Inference)
    glm51_local_url: str = ""

    # Telegram
    telegram_bot_token: str = ""

    # Tools
    openweathermap_api_key: str = ""

    # Langfuse (LLM observability)
    langfuse_host: str = "http://langfuse:3000"
    langfuse_public_key: str = "lf-pub-local"
    langfuse_secret_key: str = "lf-sec-local"

    # Security
    internal_api_secret: str = ""  # shared secret with Next.js proxy (leave empty to disable)
    frontend_url: str = ""         # exact Vercel URL used in CORS allow_origins

    # App
    debug: bool = False
    environment: str = "development"


settings = Settings()
