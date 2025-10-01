"""Tests for application configuration settings."""

from unittest import TestCase

from backend.app.config import Settings

assertions = TestCase()


def test_allowed_origins_strip_trailing_slash(monkeypatch):
    """Origins parsed from the environment remove trailing slashes."""

    monkeypatch.setenv(
        "ALLOWED_ORIGINS",
        "http://localhost:4200/, https://app.example.com/",
    )

    settings = Settings()

    assertions.assertTrue(
        settings.allowed_origins
        == [
            "http://localhost:4200",
            "https://app.example.com",
        ]
    )
