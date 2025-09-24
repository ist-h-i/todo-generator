"""Reusable FastAPI dependency utilities."""

from __future__ import annotations

from fastapi import Depends, HTTPException, status

from ..auth import get_current_user
from ..models import User


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required.",
        )
    return current_user


__all__ = ["require_admin"]
