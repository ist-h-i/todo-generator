import pytest

from app.utils.crypto import SecretCipher
from app.utils.secrets import SecretEncryptionKeyError, build_secret_hint, get_secret_cipher


@pytest.mark.parametrize(
    "secret,expected",
    [
        ("", ""),
        ("short", "sh****ort"),
        ("longersecret", "long****cret"),
    ],
)
def test_build_secret_hint_default_mask(secret: str, expected: str) -> None:
    assert build_secret_hint(secret) == expected


def test_build_secret_hint_allows_custom_mask_character() -> None:
    result = build_secret_hint("visible", mask_char="#")
    assert result.startswith("vis")
    assert result.endswith("ble")
    assert "#" in result


def test_get_secret_cipher_uses_application_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.secret_encryption_key", "custom-key")

    cipher = get_secret_cipher()

    assert isinstance(cipher, SecretCipher)
    encrypted = cipher.encrypt("sensitive value")
    assert encrypted
    assert cipher.decrypt(encrypted) == "sensitive value"


@pytest.mark.parametrize("value", [None, "", "   "])
def test_get_secret_cipher_requires_secret_key(monkeypatch: pytest.MonkeyPatch, value: str | None) -> None:
    monkeypatch.setattr("app.config.settings.secret_encryption_key", value)

    with pytest.raises(SecretEncryptionKeyError):
        get_secret_cipher()
