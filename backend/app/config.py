from typing import Any, Literal

from pydantic import AliasChoices, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_SECRET_ENCRYPTION_KEY = "verbalize-yourself"  # noqa: S105 - documented fallback value
PLACEHOLDER_DATABASE_URL = "postgresql://username:password@host:5432/database"


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = Field(
        default=PLACEHOLDER_DATABASE_URL,
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )
    debug: bool = Field(
        default=False,
        validation_alias=AliasChoices("DEBUG", "debug"),
    )
    email_verification_delivery: Literal["response", "smtp"] = Field(
        default="response",
        validation_alias=AliasChoices(
            "EMAIL_VERIFICATION_DELIVERY",
            "email_verification_delivery",
        ),
    )
    smtp_host: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SMTP_HOST", "smtp_host"),
    )
    smtp_port: int = Field(
        default=587,
        validation_alias=AliasChoices("SMTP_PORT", "smtp_port"),
    )
    smtp_username: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SMTP_USERNAME", "smtp_username"),
    )
    smtp_password: str | None = Field(
        default=None,
        validation_alias=AliasChoices("SMTP_PASSWORD", "smtp_password"),
    )
    smtp_use_tls: bool = Field(
        default=True,
        validation_alias=AliasChoices("SMTP_USE_TLS", "smtp_use_tls"),
    )
    smtp_use_ssl: bool = Field(
        default=False,
        validation_alias=AliasChoices("SMTP_USE_SSL", "smtp_use_ssl"),
    )
    email_verification_sender: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "EMAIL_VERIFICATION_SENDER",
            "email_verification_sender",
            "SMTP_FROM_ADDRESS",
            "smtp_from_address",
        ),
    )
    email_verification_subject: str = Field(
        default="Your verification code",
        validation_alias=AliasChoices(
            "EMAIL_VERIFICATION_SUBJECT",
            "email_verification_subject",
        ),
    )
    email_verification_body_template: str = Field(
        default="Your verification code is {code}. It expires in 30 minutes.",
        validation_alias=AliasChoices(
            "EMAIL_VERIFICATION_BODY_TEMPLATE",
            "email_verification_body_template",
        ),
    )
    gemini_model: str = Field(
        default="models/gemini-2.0-flash",
        validation_alias=AliasChoices(
            "GEMINI_MODEL",
            "gemini_model",
        ),
    )
    gemini_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "GEMINI_API_KEY",
            "gemini_api_key",
            "GOOGLE_API_KEY",
            "google_api_key",
        ),
    )
    secret_encryption_key: str | None = Field(
        default=DEFAULT_SECRET_ENCRYPTION_KEY,
        validation_alias=AliasChoices("SECRET_ENCRYPTION_KEY", "secret_encryption_key"),
    )
    allowed_origins: str | list[str] = Field(
        default_factory=lambda: [
            "http://localhost:4200",
            "https://verbalize-yourself.vercel.app",
        ],
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

    @field_validator("database_url")
    @classmethod
    def ensure_database_url_is_configured(cls, value: str) -> str:
        """Ensure the application does not run with the placeholder database URL."""

        if value == PLACEHOLDER_DATABASE_URL:
            msg = (
                "DATABASE_URL must be configured via environment variables. "
                "Refer to the README for the Neon connection instructions."
            )
            raise ValueError(msg)

        return value

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


def get_settings() -> Settings:
    """Return application settings instance."""

    return Settings()


settings = get_settings()
