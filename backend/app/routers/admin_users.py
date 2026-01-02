"""Administrative endpoints for managing users."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..utils.dependencies import require_admin
from ..utils.quotas import (
    get_analysis_daily_limit,
    get_appeal_daily_limit,
    get_auto_card_daily_limit,
    get_card_daily_limit,
    get_evaluation_daily_limit,
    get_immunity_map_candidate_daily_limit,
    get_immunity_map_daily_limit,
    get_status_report_daily_limit,
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
                nickname=user.nickname,
                is_admin=user.is_admin,
                is_active=user.is_active,
                card_daily_limit=get_card_daily_limit(db, user.id),
                evaluation_daily_limit=get_evaluation_daily_limit(db, user.id),
                analysis_daily_limit=get_analysis_daily_limit(db, user.id),
                status_report_daily_limit=get_status_report_daily_limit(db, user.id),
                immunity_map_daily_limit=get_immunity_map_daily_limit(db, user.id),
                immunity_map_candidate_daily_limit=get_immunity_map_candidate_daily_limit(db, user.id),
                appeal_daily_limit=get_appeal_daily_limit(db, user.id),
                auto_card_daily_limit=get_auto_card_daily_limit(db, user.id),
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

    quota_fields = {
        "card_daily_limit": "card_limit",
        "evaluation_daily_limit": "evaluation_limit",
        "analysis_daily_limit": "analysis_limit",
        "status_report_daily_limit": "status_report_limit",
        "immunity_map_daily_limit": "immunity_map_limit",
        "immunity_map_candidate_daily_limit": "immunity_map_candidate_limit",
        "appeal_daily_limit": "appeal_limit",
        "auto_card_daily_limit": "auto_card_limit",
    }
    if any(field in data for field in quota_fields):
        override = get_user_quota(db, user.id)
        resolved: dict[str, int | None] = {}
        for field, param in quota_fields.items():
            if field in data:
                resolved[param] = data.get(field)
            else:
                resolved[param] = getattr(override, field, None) if override else None
        upsert_user_quota(
            db,
            user_id=user.id,
            card_limit=resolved["card_limit"],
            evaluation_limit=resolved["evaluation_limit"],
            analysis_limit=resolved["analysis_limit"],
            status_report_limit=resolved["status_report_limit"],
            immunity_map_limit=resolved["immunity_map_limit"],
            immunity_map_candidate_limit=resolved["immunity_map_candidate_limit"],
            appeal_limit=resolved["appeal_limit"],
            auto_card_limit=resolved["auto_card_limit"],
            updated_by=admin_user.id,
        )

    db.add(user)
    db.commit()
    db.refresh(user)

    return schemas.AdminUserRead(
        id=user.id,
        email=user.email,
        nickname=user.nickname,
        is_admin=user.is_admin,
        is_active=user.is_active,
        card_daily_limit=get_card_daily_limit(db, user.id),
        evaluation_daily_limit=get_evaluation_daily_limit(db, user.id),
        analysis_daily_limit=get_analysis_daily_limit(db, user.id),
        status_report_daily_limit=get_status_report_daily_limit(db, user.id),
        immunity_map_daily_limit=get_immunity_map_daily_limit(db, user.id),
        immunity_map_candidate_daily_limit=get_immunity_map_candidate_daily_limit(db, user.id),
        appeal_daily_limit=get_appeal_daily_limit(db, user.id),
        auto_card_daily_limit=get_auto_card_daily_limit(db, user.id),
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

    db.query(models.ApiCredential).filter(models.ApiCredential.created_by_id == user_id).update(
        {models.ApiCredential.created_by_id: None}, synchronize_session=False
    )
    db.query(models.CompetencyEvaluationJob).filter(models.CompetencyEvaluationJob.triggered_by_id == user_id).update(
        {models.CompetencyEvaluationJob.triggered_by_id: None}, synchronize_session=False
    )
    db.query(models.CompetencyEvaluationJob).filter(models.CompetencyEvaluationJob.user_id == user_id).update(
        {models.CompetencyEvaluationJob.user_id: None}, synchronize_session=False
    )

    db.delete(user)
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


__all__ = ["router"]
