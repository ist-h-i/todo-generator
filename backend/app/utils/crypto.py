"""Utility helpers for reversible secret handling."""

from __future__ import annotations

import base64
import hashlib
from typing import Optional


class SecretCipher:
    """Simple XOR-based cipher for at-rest secret obfuscation."""

    def __init__(self, key: str | None) -> None:
        self._key_bytes: Optional[bytes]
        if key:
            digest = hashlib.sha256(key.encode("utf-8")).digest()
            self._key_bytes = digest
        else:
            self._key_bytes = None

    def encrypt(self, value: str) -> str:
        if not value:
            return ""

        raw = value.encode("utf-8")
        if not self._key_bytes:
            return base64.urlsafe_b64encode(raw).decode("ascii")

        key = self._key_bytes
        transformed = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(raw))
        return base64.urlsafe_b64encode(transformed).decode("ascii")

    def decrypt(self, payload: str) -> str:
        if not payload:
            return ""

        decoded = base64.urlsafe_b64decode(payload.encode("ascii"))
        if not self._key_bytes:
            return decoded.decode("utf-8")

        key = self._key_bytes
        restored = bytes(byte ^ key[index % len(key)] for index, byte in enumerate(decoded))
        return restored.decode("utf-8")


__all__ = ["SecretCipher"]
