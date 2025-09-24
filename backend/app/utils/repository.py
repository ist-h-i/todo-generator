"""Helpers for common SQLAlchemy patterns across the application."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

T = TypeVar("T")


def save_model(db: Session, instance: T, *, refresh: bool = True) -> T:
    """Persist *instance* and optionally refresh it from the database."""

    db.add(instance)
    db.commit()
    if refresh:
        db.refresh(instance)
    return instance


def apply_updates(instance: T, updates: Mapping[str, Any]) -> T:
    """Apply attribute updates to an arbitrary SQLAlchemy model instance."""

    for field, value in updates.items():
        setattr(instance, field, value)
    return instance


def get_resource_or_404(
    db: Session,
    model: type[T],
    resource_id: str,
    *,
    detail: str = "Resource not found",
) -> T:
    """Return a model instance or raise an HTTP 404 if it does not exist."""

    instance = db.get(model, resource_id)
    if not instance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return instance


def get_owned_resource_or_404(
    db: Session,
    model: type[T],
    resource_id: str,
    *,
    owner_id: str,
    detail: str,
    owner_field: str = "owner_id",
) -> T:
    """Return a model owned by a specific user or raise HTTP 404."""

    instance = get_resource_or_404(db, model, resource_id, detail=detail)
    if getattr(instance, owner_field, None) != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    return instance


def ensure_optional_owned_resource(
    db: Session,
    model: type[T],
    resource_id: str | None,
    *,
    owner_id: str,
    detail: str,
    owner_field: str = "owner_id",
) -> T | None:
    """Validate ownership when an optional foreign key is supplied."""

    if resource_id is None:
        return None
    return get_owned_resource_or_404(
        db,
        model,
        resource_id,
        owner_id=owner_id,
        detail=detail,
        owner_field=owner_field,
    )


def delete_model(db: Session, instance: T) -> None:
    """Delete *instance* and commit the transaction."""

    db.delete(instance)
    db.commit()


__all__ = [
    "apply_updates",
    "delete_model",
    "ensure_optional_owned_resource",
    "get_owned_resource_or_404",
    "get_resource_or_404",
    "save_model",
]
