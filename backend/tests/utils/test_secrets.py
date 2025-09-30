import pytest

from app.config import DEFAULT_SECRET_ENCRYPTION_KEY
from app.utils.crypto import SecretCipher, SecretDecryptionError
from app.utils.secrets import SecretEncryptionKeyError, build_secret_hint, get_secret_cipher


@pytest.mark.parametrize(
    "secret,expected",
    [("", ""), ("short", "s****"), ("longersecret", "long****cret")],
)
def test_build_secret_hint_default_mask(secret: str, expected: str) -> None:
    assert build_secret_hint(secret) == expected


def test_build_secret_hint_allows_custom_mask_character() -> None:
    result = build_secret_hint("visible", mask_char="#")
    assert result.startswith("v")
    assert result.endswith("#")
    assert set(result[1:]) == {"#"}


def test_get_secret_cipher_uses_application_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.secret_encryption_key", "custom-key")

    cipher = get_secret_cipher()

    assert isinstance(cipher, SecretCipher)
    encrypted = cipher.encrypt("sensitive value")
    assert encrypted
    result = cipher.decrypt(encrypted)
    assert result.plaintext == "sensitive value"
    assert result.reencrypted_payload is None


def test_get_secret_cipher_allows_documented_fallback_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.config.settings.secret_encryption_key", DEFAULT_SECRET_ENCRYPTION_KEY)

    cipher = get_secret_cipher()

    sample = "sensitive value"
    encrypted = cipher.encrypt(sample)
    assert encrypted.startswith(SecretCipher._PREFIX)
    roundtrip = cipher.decrypt(encrypted)
    assert roundtrip.plaintext == sample
    assert roundtrip.reencrypted_payload is None


def test_get_secret_cipher_raises_when_key_is_unconfigured(monkeypatch: pytest.MonkeyPatch) -> None:
    class _StubSettings:
        def __init__(self) -> None:
            self.secret_encryption_key = DEFAULT_SECRET_ENCRYPTION_KEY
            self.model_fields_set: set[str] = set()

    monkeypatch.setattr("app.utils.secrets.settings", _StubSettings())

    with pytest.raises(SecretEncryptionKeyError):
        get_secret_cipher()


@pytest.mark.parametrize("value", ["", "   "])
def test_get_secret_cipher_requires_secret_key(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    monkeypatch.setattr("app.config.settings.secret_encryption_key", value)

    with pytest.raises(SecretEncryptionKeyError):
        get_secret_cipher()


def test_secret_cipher_reencrypts_legacy_payload() -> None:
    import base64
    import hashlib

    secret = "sensitive value"  # noqa: S105 - test secret
    digest = hashlib.sha256(DEFAULT_SECRET_ENCRYPTION_KEY.encode("utf-8")).digest()
    legacy_payload = base64.urlsafe_b64encode(
        bytes(byte ^ digest[index % len(digest)] for index, byte in enumerate(secret.encode("utf-8")))
    ).decode("ascii")

    modern_cipher = SecretCipher("new-key")
    result = modern_cipher.decrypt(legacy_payload)

    assert result.plaintext == secret
    assert result.reencrypted_payload is not None
    assert result.reencrypted_payload != legacy_payload

    rotated = modern_cipher.decrypt(result.reencrypted_payload)
    assert rotated.plaintext == secret
    assert rotated.reencrypted_payload is None


def test_secret_cipher_raises_when_payload_cannot_be_decrypted() -> None:
    original = SecretCipher("first-key").encrypt("api-key")
    cipher = SecretCipher("second-key")

    with pytest.raises(SecretDecryptionError):
        cipher.decrypt(original)
