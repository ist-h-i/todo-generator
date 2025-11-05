"""Utilities for issuing and validating email verification codes."""

from __future__ import annotations

import logging
import secrets
import smtplib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from ssl import create_default_context

from sqlalchemy.orm import Session

from .. import models
from ..auth import normalize_email
from ..config import settings

_CODE_TTL = timedelta(minutes=30)
_MAX_ATTEMPTS = 3
_DEFAULT_DELIVERY_MESSAGE = "Verification code sent."


logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


@dataclass(slots=True)
class VerificationResult:
    """Represents the outcome of a verification attempt."""

    success: bool
    message: str | None = None


@dataclass(slots=True)
class VerificationDeliveryResult:
    """Represents how a verification code was delivered to the user."""

    share_via_response: bool
    message: str = _DEFAULT_DELIVERY_MESSAGE


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


def deliver_verification_code(email: str, code: str) -> VerificationDeliveryResult:
    """Deliver a verification code using the configured transport."""

    delivery_mode = settings.email_verification_delivery
    if delivery_mode == "response":
        return VerificationDeliveryResult(
            share_via_response=True,
            message="Verification code generated. Returning code in response.",
        )

    if delivery_mode != "smtp":
        logger.warning("Unsupported email verification delivery mode: %s", delivery_mode)
        return VerificationDeliveryResult(
            share_via_response=True,
            message="Verification code generated. Returning code in response.",
        )

    if not settings.smtp_host or not settings.email_verification_sender:
        logger.error(
            "SMTP delivery selected for verification codes but host or sender is missing."
        )
        return VerificationDeliveryResult(
            share_via_response=True,
            message=(
                "Verification code generated but email delivery is not configured; "
                "returning code in response."
            ),
        )

    message = EmailMessage()
    message["Subject"] = settings.email_verification_subject
    message["From"] = settings.email_verification_sender
    message["To"] = email
    message.set_content(
        settings.email_verification_body_template.format(
            code=code,
            ttl_minutes=int(_CODE_TTL.total_seconds() // 60),
        )
    )

    context = create_default_context()
    try:
        if settings.smtp_use_ssl:
            port = settings.smtp_port
            if not port or port == 587:
                port = 465
            with smtplib.SMTP_SSL(settings.smtp_host, port, context=context) as client:
                if settings.smtp_username:
                    client.login(settings.smtp_username, settings.smtp_password or "")
                client.send_message(message)
        else:
            port = settings.smtp_port or 587
            with smtplib.SMTP(settings.smtp_host, port) as client:
                client.ehlo()
                if settings.smtp_use_tls:
                    client.starttls(context=context)
                    client.ehlo()
                if settings.smtp_username:
                    client.login(settings.smtp_username, settings.smtp_password or "")
                client.send_message(message)
    except Exception:
        logger.exception("Failed to send verification code email via SMTP.")
        return VerificationDeliveryResult(
            share_via_response=True,
            message=(
                "Verification code could not be emailed; returning code in response."
            ),
        )

    return VerificationDeliveryResult(share_via_response=False)


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
    "VerificationDeliveryResult",
    "VerificationResult",
    "consume_verification_code",
    "deliver_verification_code",
    "issue_verification_code",
]
