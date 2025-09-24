"""Endpoints for retrieving competency evaluation history."""

from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..utils.dependencies import require_admin

router = APIRouter(tags=["competencies"])


def _evaluation_query(db: Session):
    return (
        db.query(models.CompetencyEvaluation)
        .options(
            joinedload(models.CompetencyEvaluation.competency),
            selectinload(models.CompetencyEvaluation.items),
        )
        .order_by(models.CompetencyEvaluation.created_at.desc())
    )


@router.get("/admin/evaluations", response_model=list[schemas.CompetencyEvaluationRead])
def admin_list_evaluations(
    user_id: Optional[str] = Query(default=None),
    competency_id: Optional[str] = Query(default=None),
    period_start: Optional[date] = Query(default=None),
    period_end: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> list[models.CompetencyEvaluation]:
    query = _evaluation_query(db)

    if user_id:
        query = query.filter(models.CompetencyEvaluation.user_id == user_id)
    if competency_id:
        query = query.filter(models.CompetencyEvaluation.competency_id == competency_id)
    if period_start:
        query = query.filter(models.CompetencyEvaluation.period_start >= period_start)
    if period_end:
        query = query.filter(models.CompetencyEvaluation.period_end <= period_end)

    evaluations = query.all()
    return evaluations


@router.get("/users/me/evaluations", response_model=list[schemas.CompetencyEvaluationRead])
def my_evaluations(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.CompetencyEvaluation]:
    query = _evaluation_query(db).filter(models.CompetencyEvaluation.user_id == current_user.id)
    evaluations = query.limit(limit).all()
    return evaluations


__all__ = ["router"]
