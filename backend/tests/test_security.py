import pytest
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings, settings
from app.main import app


def test_cors_configuration_disallows_wildcard_credentials() -> None:
    cors_middleware = next(
        (middleware for middleware in app.user_middleware if middleware.cls is CORSMiddleware),
        None,
    )
    assert cors_middleware is not None, "CORS middleware should be registered"

    allow_origins = cors_middleware.kwargs.get("allow_origins")
    assert isinstance(allow_origins, (list, tuple))
    assert "*" not in allow_origins
    assert allow_origins == settings.allowed_origins
    assert cors_middleware.kwargs.get("allow_all_origins") in (None, False)


def test_settings_reject_wildcard_origins() -> None:
    with pytest.raises(ValueError):
        Settings(allowed_origins="*")


def test_settings_split_comma_separated_origins() -> None:
    custom_settings = Settings(allowed_origins="http://a.example,http://b.example")
    assert custom_settings.allowed_origins == [
        "http://a.example",
        "http://b.example",
    ]
