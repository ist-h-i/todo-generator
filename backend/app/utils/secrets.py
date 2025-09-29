"""Helper utilities for storing and presenting sensitive secrets."""

from __future__ import annotations

from ..config import DEFAULT_SECRET_ENCRYPTION_KEY, settings
from .crypto import SecretCipher

_DEFAULT_MASK_CHAR = "*"
_VISIBLE_SEGMENT_LENGTH = 4


class SecretEncryptionKeyError(RuntimeError):
    """Raised when the secret encryption key configuration is invalid."""


def get_secret_cipher() -> SecretCipher:
    """Return a cipher configured for encrypting stored secrets."""

    raw_key = getattr(settings, "secret_encryption_key", None)

    key = DEFAULT_SECRET_ENCRYPTION_KEY if raw_key is None else raw_key

    normalized_key = key.strip()
    if not normalized_key:
        raise SecretEncryptionKeyError(
            "Secret encryption key must not be empty. Update the SECRET_ENCRYPTION_KEY environment variable.",
        )

    return SecretCipher(normalized_key)


def build_secret_hint(secret: str, *, mask_char: str = _DEFAULT_MASK_CHAR) -> str:
    """Return a masked representation of a secret value.

    The default behaviour keeps the first and last four characters visible and
    masks the remaining characters. Shorter secrets remain partially hidden
    while still hinting at their boundaries.
    """

    if not secret:
        return ""

    length = len(secret)
    visible = _VISIBLE_SEGMENT_LENGTH

    if length > visible * 2:
        prefix = secret[:visible]
        suffix = secret[-visible:]
        masked_length = max(length - (visible * 2), visible)
        return prefix + (mask_char * masked_length) + suffix

    prefix_length = min(visible, max(1, length // 2))
    suffix_length = max(length - prefix_length, 1)
    prefix = secret[:prefix_length]
    suffix = secret[-suffix_length:]
    masked_length = max(length - prefix_length - suffix_length, visible)
    return prefix + (mask_char * masked_length) + suffix


__all__ = ["SecretEncryptionKeyError", "build_secret_hint", "get_secret_cipher"]
