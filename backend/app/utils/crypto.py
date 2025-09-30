"""Utility helpers for reversible secret handling."""

from __future__ import annotations

import base64
import binascii
import hashlib
from dataclasses import dataclass
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from ..config import DEFAULT_SECRET_ENCRYPTION_KEY


class SecretDecryptionError(RuntimeError):
    """Raised when a stored payload cannot be decrypted."""


@dataclass(slots=True)
class SecretDecryptionResult:
    """Container describing the outcome of a decryption attempt."""

    plaintext: str
    reencrypted_payload: str | None = None


class SecretCipher:
    """Encrypt and decrypt stored secrets using authenticated encryption."""

    _PREFIX = "v2:"

    def __init__(self, key: str | None) -> None:
        self._legacy_key_bytes: Optional[bytes]
        self._fernet: Optional[Fernet]
        if key:
            digest = hashlib.sha256(key.encode("utf-8")).digest()
            self._legacy_key_bytes = digest
            derived = base64.urlsafe_b64encode(digest)
            self._fernet = Fernet(derived)
        else:
            self._legacy_key_bytes = None
            self._fernet = None

    def encrypt(self, value: str) -> str:
        if not value:
            return ""

        raw = value.encode("utf-8")
        if not self._fernet:
            return base64.urlsafe_b64encode(raw).decode("ascii")

        token = self._fernet.encrypt(raw)
        return f"{self._PREFIX}{token.decode('ascii')}"

    def decrypt(self, payload: str) -> SecretDecryptionResult:
        if not payload:
            return SecretDecryptionResult(plaintext="")

        if self._fernet and payload.startswith(self._PREFIX):
            token = payload[len(self._PREFIX) :]
            try:
                plaintext_bytes = self._fernet.decrypt(token.encode("ascii"))
            except InvalidToken as exc:
                raise SecretDecryptionError(
                    "Unable to decrypt stored secret. Verify the secret encryption key matches the original value."
                ) from exc

            return SecretDecryptionResult(plaintext=plaintext_bytes.decode("utf-8"))

        try:
            decoded = base64.urlsafe_b64decode(payload.encode("ascii"))
        except (ValueError, binascii.Error) as exc:  # pragma: no cover - defensive path
            raise SecretDecryptionError("Stored secret payload is not valid base64 data.") from exc

        if not self._legacy_key_bytes:
            return SecretDecryptionResult(plaintext=decoded.decode("utf-8"))

        key = self._legacy_key_bytes
        restored = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(decoded))
        try:
            plaintext = restored.decode("utf-8")
        except UnicodeDecodeError:
            plaintext = _attempt_legacy_recovery(decoded, key)
            if plaintext is None:
                raise SecretDecryptionError(
                    "Unable to decrypt stored secret. Verify the secret encryption key matches the original value."
                ) from None

            reencrypted_payload = self.encrypt(plaintext)
            if reencrypted_payload == payload:
                reencrypted_payload = None
            return SecretDecryptionResult(plaintext=plaintext, reencrypted_payload=reencrypted_payload)

        reencrypted_payload = self.encrypt(plaintext)
        if reencrypted_payload == payload:
            reencrypted_payload = None
        return SecretDecryptionResult(plaintext=plaintext, reencrypted_payload=reencrypted_payload)


def _attempt_legacy_recovery(decoded: bytes, current_key: bytes) -> str | None:
    """Attempt to recover plaintext from legacy payload formats."""

    # Legacy format stored secrets as plain UTF-8 bytes encoded with base64.
    try:
        return decoded.decode("utf-8")
    except UnicodeDecodeError:
        pass

    default_key_digest = hashlib.sha256(DEFAULT_SECRET_ENCRYPTION_KEY.encode("utf-8")).digest()
    if current_key == default_key_digest:
        return None

    transformed = bytes(
        byte ^ default_key_digest[index % len(default_key_digest)] for index, byte in enumerate(decoded)
    )
    try:
        return transformed.decode("utf-8")
    except UnicodeDecodeError:
        return None


__all__ = ["SecretCipher", "SecretDecryptionError", "SecretDecryptionResult"]
