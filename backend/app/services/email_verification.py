"""Utilities for issuing and validating email verification codes."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from .. import models
from ..auth import normalize_email


_CODE_TTL = timedelta(minutes=30)
_MAX_ATTEMPTS = 3


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class VerificationResult:
    """Represents the outcome of a verification attempt."""

    success: bool
    message: str | None = None


def issue_verification_code(db: Session, email: str) -> tuple[models.EmailVerificationCode, str]:
    """Create a new verification code for the provided email address."""

    normalized_email = normalize_email(email)
    db.query(models.EmailVerificationCode).filter(
        models.EmailVerificationCode.email == normalized_email
    ).delete(synchronize_session=False)

    code_value = f"{secrets.randbelow(1_000_000):06d}"
    expires_at = _utcnow() + _CODE_TTL

    verification = models.EmailVerificationCode(
        email=normalized_email,
        code=code_value,
        expires_at=expires_at,
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)
    return verification, code_value


def consume_verification_code(db: Session, email: str, code: str) -> VerificationResult:
    """Validate the provided code and consume it when successful."""

    normalized_email = normalize_email(email)
    record = (
        db.query(models.EmailVerificationCode)
        .filter(models.EmailVerificationCode.email == normalized_email)
        .order_by(models.EmailVerificationCode.created_at.desc())
        .first()
    )

    if record is None:
        return VerificationResult(success=False, message="Verification code is invalid or expired.")

    now = _utcnow()
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now or record.failed_attempts >= _MAX_ATTEMPTS:
        db.delete(record)
        db.commit()
        return VerificationResult(success=False, message="Verification code is invalid or expired.")

    if record.code != code:
        record.failed_attempts += 1
        if record.failed_attempts >= _MAX_ATTEMPTS:
            db.delete(record)
        db.commit()
        return VerificationResult(success=False, message="Verification code is invalid or expired.")

    db.delete(record)
    db.commit()
    return VerificationResult(success=True)


__all__ = [
    "VerificationResult",
    "consume_verification_code",
    "issue_verification_code",
]
