from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    database_url: str = Field(
        default="sqlite:///./todo.db", env="DATABASE_URL"
    )
    debug: bool = Field(default=False, env="DEBUG")
    chatgpt_model: str = Field(default="gpt-4o-mini", env="CHATGPT_MODEL")

    class Config:
        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    """Return application settings instance."""

    return Settings()


settings = get_settings()
