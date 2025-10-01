from unittest import TestCase

import pytest

from app.config import DEFAULT_SECRET_ENCRYPTION_KEY
from app.utils.crypto import SecretCipher, SecretDecryptionError
from app.utils.secrets import SecretEncryptionKeyError, build_secret_hint, get_secret_cipher

assertions = TestCase()


@pytest.mark.parametrize(
    "secret,expected",
    [("", ""), ("short", "s****"), ("longersecret", "long****cret")],
)
def test_build_secret_hint_default_mask(secret: str, expected: str) -> None:
    assertions.assertTrue(build_secret_hint(secret) == expected)


def test_build_secret_hint_allows_custom_mask_character() -> None:
    result = build_secret_hint("visible", mask_char="#")
    assertions.assertTrue(result.startswith("v"))
    assertions.assertTrue(result.endswith("#"))
    assertions.assertTrue(set(result[1:]) == {"#"})


def test_get_secret_cipher_uses_application_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.config.settings.secret_encryption_key", "custom-key")

    cipher = get_secret_cipher()

    assertions.assertTrue(isinstance(cipher, SecretCipher))
    encrypted = cipher.encrypt("sensitive value")
    assertions.assertTrue(encrypted)
    result = cipher.decrypt(encrypted)
    assertions.assertTrue(result.plaintext == "sensitive value")
    assertions.assertTrue(result.reencrypted_payload is None)


def test_get_secret_cipher_allows_documented_fallback_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr("app.config.settings.secret_encryption_key", DEFAULT_SECRET_ENCRYPTION_KEY)

    cipher = get_secret_cipher()

    sample = "sensitive value"
    encrypted = cipher.encrypt(sample)
    assertions.assertTrue(encrypted.startswith(SecretCipher._PREFIX))
    roundtrip = cipher.decrypt(encrypted)
    assertions.assertTrue(roundtrip.plaintext == sample)
    assertions.assertTrue(roundtrip.reencrypted_payload is None)


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

    assertions.assertTrue(result.plaintext == secret)
    assertions.assertTrue(result.reencrypted_payload is not None)
    assertions.assertTrue(result.reencrypted_payload != legacy_payload)

    rotated = modern_cipher.decrypt(result.reencrypted_payload)
    assertions.assertTrue(rotated.plaintext == secret)
    assertions.assertTrue(rotated.reencrypted_payload is None)


def test_secret_cipher_raises_when_payload_cannot_be_decrypted() -> None:
    original = SecretCipher("first-key").encrypt("api-key")
    cipher = SecretCipher("second-key")

    with pytest.raises(SecretDecryptionError):
        cipher.decrypt(original)


def test_secret_cipher_returns_empty_payload_result() -> None:
    cipher = SecretCipher("any-key")

    result = cipher.decrypt("")

    assertions.assertTrue(result.plaintext == "")
    assertions.assertTrue(result.reencrypted_payload is None)


def test_secret_cipher_roundtrips_base64_payload_without_key() -> None:
    import base64

    cipher = SecretCipher(None)
    payload = base64.urlsafe_b64encode(b"stored-secret").decode("ascii")

    result = cipher.decrypt(payload)

    assertions.assertTrue(result.plaintext == "stored-secret")
    assertions.assertTrue(result.reencrypted_payload is None)


def test_secret_cipher_recovers_plain_legacy_payload() -> None:
    import base64

    legacy_secret = "legacy secret"  # noqa: S105
    payload = base64.urlsafe_b64encode(legacy_secret.encode("utf-8")).decode("ascii")

    cipher = SecretCipher("modern-key")
    result = cipher.decrypt(payload)

    assertions.assertTrue(result.plaintext == legacy_secret)
    assertions.assertTrue(result.reencrypted_payload is not None)
    assertions.assertTrue(result.reencrypted_payload.startswith(SecretCipher._PREFIX))


def test_secret_cipher_raises_when_legacy_payload_from_other_key_and_default_key() -> None:
    import base64
    import hashlib

    original_secret = "migrated secret"  # noqa: S105
    previous_key_digest = hashlib.sha256(b"previous-key").digest()
    legacy_bytes = bytes(
        byte ^ previous_key_digest[index % len(previous_key_digest)]
        for index, byte in enumerate(original_secret.encode("utf-8"))
    )

    # Ensure the payload cannot be decoded directly to UTF-8 to exercise the recovery path.
    with pytest.raises(UnicodeDecodeError):
        legacy_bytes.decode("utf-8")

    payload = base64.urlsafe_b64encode(legacy_bytes).decode("ascii")
    cipher = SecretCipher(DEFAULT_SECRET_ENCRYPTION_KEY)

    with pytest.raises(SecretDecryptionError):
        cipher.decrypt(payload)
