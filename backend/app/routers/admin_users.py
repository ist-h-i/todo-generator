"""Administrative endpoints for managing users."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..utils.dependencies import require_admin
from ..utils.quotas import (
    get_card_daily_limit,
    get_evaluation_daily_limit,
    get_user_quota,
    upsert_user_quota,
)

router = APIRouter(prefix="/admin/users", tags=["admin", "users"])


@router.get("", response_model=list[schemas.AdminUserRead])
def list_users(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> list[schemas.AdminUserRead]:
    users = db.query(models.User).order_by(models.User.created_at.asc()).all()

    response: list[schemas.AdminUserRead] = []
    for user in users:
        response.append(
            schemas.AdminUserRead(
                id=user.id,
                email=user.email,
                is_admin=user.is_admin,
                is_active=user.is_active,
                card_daily_limit=get_card_daily_limit(db, user.id),
                evaluation_daily_limit=get_evaluation_daily_limit(db, user.id),
                created_at=user.created_at,
                updated_at=user.updated_at,
            )
        )
    return response


@router.patch("/{user_id}", response_model=schemas.AdminUserRead)
def update_user(
    user_id: str,
    payload: schemas.AdminUserUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> schemas.AdminUserRead:
    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    data = payload.model_dump(exclude_unset=True)

    if "is_admin" in data:
        user.is_admin = bool(data["is_admin"])
    if "is_active" in data:
        user.is_active = bool(data["is_active"])

    if "card_daily_limit" in data or "evaluation_daily_limit" in data:
        override = get_user_quota(db, user.id)
        card_limit = (
            data.get("card_daily_limit")
            if "card_daily_limit" in data
            else (override.card_daily_limit if override else None)
        )
        evaluation_limit = (
            data.get("evaluation_daily_limit")
            if "evaluation_daily_limit" in data
            else (override.evaluation_daily_limit if override else None)
        )
        upsert_user_quota(
            db,
            user_id=user.id,
            card_limit=card_limit,
            evaluation_limit=evaluation_limit,
            updated_by=admin_user.id,
        )

    db.add(user)
    db.commit()
    db.refresh(user)

    return schemas.AdminUserRead(
        id=user.id,
        email=user.email,
        is_admin=user.is_admin,
        is_active=user.is_active,
        card_daily_limit=get_card_daily_limit(db, user.id),
        evaluation_daily_limit=get_evaluation_daily_limit(db, user.id),
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> Response:
    if admin_user.id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account.",
        )

    user = db.get(models.User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    db.delete(user)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
