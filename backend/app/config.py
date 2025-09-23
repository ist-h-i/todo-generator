from typing import Any

from pydantic import BaseSettings, Field, validator


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    database_url: str = Field(
        default="sqlite:///./todo.db", env="DATABASE_URL"
    )
    debug: bool = Field(default=False, env="DEBUG")
    chatgpt_model: str = Field(default="gpt-4o-mini", env="CHATGPT_MODEL")
    allowed_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:4200"], env="ALLOWED_ORIGINS"
    )

    @validator("allowed_origins", pre=True)
    def split_allowed_origins(cls, value: Any) -> list[str]:
        """Parse comma-separated origins from environment variables."""

        if value is None:
            parsed = []
        elif isinstance(value, str):
            parsed = [origin.strip() for origin in value.split(",") if origin.strip()]
        else:
            parsed = value

        if parsed and any(origin == "*" for origin in parsed):
            raise ValueError(
                "Wildcard origins are not permitted when credentials are allowed."
            )

        return parsed

    class Config:
        env_file = ".env"
        case_sensitive = False


def get_settings() -> Settings:
    """Return application settings instance."""

    return Settings()


settings = get_settings()
