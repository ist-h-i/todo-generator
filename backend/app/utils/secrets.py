"""Helper utilities for storing and presenting sensitive secrets."""

from __future__ import annotations

from ..config import settings
from .crypto import SecretCipher

_DEFAULT_MASK_CHAR = "*"
_VISIBLE_SEGMENT_LENGTH = 4


def get_secret_cipher() -> SecretCipher:
    """Return a cipher configured for encrypting stored secrets."""

    key = settings.secret_encryption_key or "verbalize-yourself"
    return SecretCipher(key)


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


__all__ = ["build_secret_hint", "get_secret_cipher"]
