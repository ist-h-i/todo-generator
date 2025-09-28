from typing import Any

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    database_url: str = Field(
        default="sqlite:///./todo.db",
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    debug: bool = Field(
        default=False,
        validation_alias=AliasChoices("DEBUG", "debug"),
    )
    chatgpt_model: str = Field(
        default="gpt-4o-mini",
        validation_alias=AliasChoices("CHATGPT_MODEL", "chatgpt_model"),
    )
    chatgpt_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "CHATGPT_API_KEY",
            "chatgpt_api_key",
            "OPENAI_API_KEY",
            "openai_api_key",
        ),
    )
    gemini_model: str = Field(
        default="models/gemini-1.5-flash",
        validation_alias=AliasChoices("GEMINI_MODEL", "gemini_model"),
    )
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("GEMINI_API_KEY", "gemini_api_key"),
    )
    secret_encryption_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SECRET_ENCRYPTION_KEY", "secret_encryption_key"),
    )
    allowed_origins: str | list[str] = Field(
        default_factory=lambda: ["http://localhost:4200"],
        validation_alias=AliasChoices("ALLOWED_ORIGINS", "allowed_origins"),
    )
    recommendation_label_weight: float = Field(
        default=0.6,
        ge=0,
        validation_alias=AliasChoices(
            "RECOMMENDATION_WEIGHT_LABEL",
            "recommendation_label_weight",
        ),
    )
    recommendation_profile_weight: float = Field(
        default=0.4,
        ge=0,
        validation_alias=AliasChoices(
            "RECOMMENDATION_WEIGHT_PROFILE",
            "recommendation_profile_weight",
        ),
    )

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def split_allowed_origins(cls, value: Any) -> list[str]:
        """Parse comma-separated origins from environment variables."""

        if value is None:
            parsed: list[str] = []
        elif isinstance(value, str):
            parsed = []
            for origin in value.split(","):
                normalized = cls._normalize_origin(origin)
                if normalized:
                    parsed.append(normalized)
        else:
            parsed = []
            for origin in value:
                if isinstance(origin, str):
                    normalized = cls._normalize_origin(origin)
                    if normalized:
                        parsed.append(normalized)
                elif origin:
                    parsed.append(origin)

        if parsed and any(origin == "*" for origin in parsed):
            raise ValueError("Wildcard origins are not permitted when credentials are allowed.")

        return parsed

    @staticmethod
    def _normalize_origin(origin: str) -> str:
        """Trim whitespace and trailing slashes from a CORS origin string."""

        stripped = origin.strip()
        return stripped.rstrip("/") if stripped else ""

    @model_validator(mode="after")
    def _apply_legacy_fallbacks(self) -> "Settings":
        """Populate Gemini settings from legacy ChatGPT values when absent."""

        if self.gemini_api_key is None and self.chatgpt_api_key:
            object.__setattr__(self, "gemini_api_key", self.chatgpt_api_key)

        if (
            ("gemini_model" not in self.model_fields_set or not self.gemini_model)
            and self.chatgpt_model
        ):
            object.__setattr__(self, "gemini_model", self.chatgpt_model)

        return self


def get_settings() -> Settings:
    """Return application settings instance."""

    return Settings()


settings = get_settings()
