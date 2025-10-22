"""Endpoints for retrieving competency evaluation history."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.competency_evaluator import CompetencyEvaluator
from ..utils.dependencies import require_admin
from ..utils.quotas import (
    get_daily_usage,
    get_evaluation_daily_limit,
    reserve_daily_quota,
)

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


def _resolve_competency(db: Session, competency_id: str | None) -> models.Competency:
    query = db.query(models.Competency).filter(models.Competency.is_active.is_(True))

    if competency_id:
        competency = query.filter(models.Competency.id == competency_id).one_or_none()
    else:
        competency = query.order_by(models.Competency.sort_order.asc(), models.Competency.created_at.asc()).first()

    if not competency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competency not found")

    return competency


def _normalize_period(period_start: date | None, period_end: date | None) -> tuple[date, date]:
    today = date.today()
    resolved_end = period_end or today
    resolved_start = period_start or resolved_end.replace(day=1)

    if resolved_start > resolved_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid period range")

    return resolved_start, resolved_end


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


@router.get("/users/me/evaluations/quota", response_model=schemas.EvaluationQuotaStatus)
def my_evaluation_quota(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.EvaluationQuotaStatus:
    today = date.today()
    limit = get_evaluation_daily_limit(db, current_user.id)
    used = get_daily_usage(
        db,
        quota_model=models.DailyEvaluationQuota,
        owner_id=current_user.id,
        quota_day=today,
    )
    remaining: int | None
    if limit > 0:
        remaining = max(limit - used, 0)
    else:
        remaining = None

    return schemas.EvaluationQuotaStatus(daily_limit=limit, used=used, remaining=remaining)


@router.post("/users/me/evaluations", response_model=schemas.CompetencyEvaluationRead)
def create_my_evaluation(
    payload: schemas.SelfEvaluationRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.CompetencyEvaluation:
    competency = _resolve_competency(db, payload.competency_id)
    period_start, period_end = _normalize_period(payload.period_start, payload.period_end)

    today = date.today()
    limit = get_evaluation_daily_limit(db, current_user.id)
    quota_reserved = reserve_daily_quota(
        db,
        owner_id=current_user.id,
        quota_day=today,
        limit=limit,
        quota_model=models.DailyEvaluationQuota,
        counter_field="executed_count",
    )
    if not quota_reserved:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily competency evaluation limit of {limit} reached.",
        )

    job = models.CompetencyEvaluationJob(
        competency=competency,
        user_id=current_user.id,
        status="running",
        scope="user",
        target_period_start=period_start,
        target_period_end=period_end,
        triggered_by="manual",
        triggered_by_user=current_user,
        started_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.flush()

    evaluator = CompetencyEvaluator(db)

    try:
        evaluation = evaluator.evaluate(
            user=current_user,
            competency=competency,
            period_start=period_start,
            period_end=period_end,
            triggered_by="manual",
            job=job,
        )
    except Exception as exc:  # pragma: no cover - defensive handling
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = str(exc)
        db.add(job)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    job.status = "succeeded"
    job.completed_at = datetime.now(timezone.utc)
    job.summary_stats = {"evaluations": 1}
    db.add(job)
    db.commit()
    db.refresh(evaluation)
    return evaluation


__all__ = ["router"]
