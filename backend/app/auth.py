from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .database import get_db
from .models import SessionToken, User

_PBKDF2_ITERATIONS = 120_000
_TOKEN_TTL_HOURS = 24
_AUTH_SCHEME = HTTPBearer(auto_error=False)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    salt_bytes = secrets.token_bytes(16)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt_bytes, _PBKDF2_ITERATIONS)
    return f"{salt_bytes.hex()}${derived.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        salt_hex, digest_hex = encoded.split("$", 1)
    except ValueError:
        return False

    salt = bytes.fromhex(salt_hex)
    derived = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS).hex()
    return hmac.compare_digest(derived, digest_hex)


def create_session_token(db: Session, user: User) -> str:
    token_value = secrets.token_urlsafe(32)
    expires_at = _utcnow() + timedelta(hours=_TOKEN_TTL_HOURS)

    token = SessionToken(token=token_value, user_id=user.id, expires_at=expires_at)
    db.add(token)
    return token_value


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_AUTH_SCHEME),
    db: Session = Depends(get_db),
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided.",
        )

    raw_token = credentials.credentials
    token: SessionToken | None = db.get(SessionToken, raw_token)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
        )

    if token.expires_at:
        expires_at = token.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < _utcnow():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token.",
            )

    user = db.get(User, token.user_id)
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User is inactive or does not exist.",
        )

    return user


__all__ = [
    "create_session_token",
    "get_current_user",
    "hash_password",
    "normalize_email",
    "verify_password",
]
