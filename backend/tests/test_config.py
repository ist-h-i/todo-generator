"""Tests for application configuration settings."""

from backend.app.config import Settings


def test_allowed_origins_strip_trailing_slash(monkeypatch):
    """Origins parsed from the environment remove trailing slashes."""

    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        "http://localhost:4200/, https://app.example.com/",
    )

    settings = Settings()

    assert settings.allowed_origins == [
        "http://localhost:4200",
        "https://app.example.com",
    ]
