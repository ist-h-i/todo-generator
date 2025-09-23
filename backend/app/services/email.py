from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import List

import logging


logger = logging.getLogger(__name__)


@dataclass(slots=True)
class PasswordEmail:
    to: str
    subject: str
    body: str
    password: str
    reason: str
    created_at: datetime


EMAIL_OUTBOX: List[PasswordEmail] = []


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def send_password_email(*, email: str, password: str, reason: str) -> None:
    """Record a password delivery event.

    In a production environment this would enqueue an email. For the
    reference implementation we capture the intent in an in-memory outbox so
    tests can assert on the generated password.
    """

    subject = "Todo Generator パスワード通知"
    if reason == "reset":
        subject = "Todo Generator パスワード再発行"

    body = (
        "Todo Generator へのアクセスに使用する初期パスワードを発行しました。\n"
        "セキュリティのため、ログイン後は必ずパスワードの更新を行ってください。\n\n"
        f"一時パスワード: {password}\n"
    )

    EMAIL_OUTBOX.append(
        PasswordEmail(
            to=email,
            subject=subject,
            body=body,
            password=password,
            reason=reason,
            created_at=_utcnow(),
        )
    )
    logger.info("Queued %s password email for %s", reason, email)


def clear_outbox() -> None:
    EMAIL_OUTBOX.clear()


__all__ = ["EMAIL_OUTBOX", "PasswordEmail", "clear_outbox", "send_password_email"]
