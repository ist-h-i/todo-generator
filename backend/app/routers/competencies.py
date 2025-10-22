"""Admin endpoints for competency management."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..database import get_db
from ..services.competency_evaluator import CompetencyEvaluator
from ..utils.dependencies import require_admin
from ..utils.quotas import (
    get_evaluation_daily_limit,
    reserve_daily_quota,
)

router = APIRouter(prefix="/admin/competencies", tags=["admin", "competencies"])


@router.get("", response_model=list[schemas.CompetencyRead])
def list_competencies(
    level: Optional[str] = Query(default=None),
    is_active: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> list[models.Competency]:
    query = db.query(models.Competency).options(joinedload(models.Competency.level_definition))
    if level:
        query = query.filter(models.Competency.level == level)
    if is_active is not None:
        query = query.filter(models.Competency.is_active == is_active)

    competencies = (
        query.order_by(models.Competency.sort_order.asc(), models.Competency.created_at.asc())
        .all()
    )
    return competencies


@router.get("/{competency_id}", response_model=schemas.CompetencyRead)
def get_competency(
    competency_id: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.Competency:
    competency = db.get(models.Competency, competency_id)
    if not competency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competency not found")
    return competency


@router.post("", response_model=schemas.CompetencyRead, status_code=status.HTTP_201_CREATED)
def create_competency(
    payload: schemas.CompetencyCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.Competency:
    competency = models.Competency(
        name=payload.name,
        level=payload.level,
        description=payload.description,
        rubric=payload.rubric,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )

    for index, criterion in enumerate(payload.criteria):
        competency.criteria.append(
            models.CompetencyCriterion(
                title=criterion.title,
                description=criterion.description,
                weight=criterion.weight,
                intentionality_prompt=criterion.intentionality_prompt,
                behavior_prompt=criterion.behavior_prompt,
                is_active=criterion.is_active,
                order_index=criterion.order_index if criterion.order_index is not None else index,
            )
        )

    db.add(competency)
    db.commit()
    db.refresh(competency)
    return competency


@router.patch("/{competency_id}", response_model=schemas.CompetencyRead)
def update_competency(
    competency_id: str,
    payload: schemas.CompetencyUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.Competency:
    competency = db.get(models.Competency, competency_id)
    if not competency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competency not found")

    if payload.name is not None:
        competency.name = payload.name
    if payload.level is not None:
        competency.level = payload.level
    if payload.description is not None:
        competency.description = payload.description
    if payload.rubric is not None:
        competency.rubric = payload.rubric
    if payload.sort_order is not None:
        competency.sort_order = payload.sort_order
    if payload.is_active is not None:
        competency.is_active = payload.is_active

    if payload.criteria is not None:
        competency.criteria.clear()
        for index, criterion in enumerate(payload.criteria):
            competency.criteria.append(
                models.CompetencyCriterion(
                    title=criterion.title,
                    description=criterion.description,
                    weight=criterion.weight,
                    intentionality_prompt=criterion.intentionality_prompt,
                    behavior_prompt=criterion.behavior_prompt,
                    is_active=criterion.is_active,
                    order_index=criterion.order_index if criterion.order_index is not None else index,
                )
            )

    db.add(competency)
    db.commit()
    db.refresh(competency)
    return competency


@router.post("/{competency_id}/evaluate", response_model=schemas.CompetencyEvaluationRead)
def trigger_evaluation(
    competency_id: str,
    payload: schemas.EvaluationTriggerRequest,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> models.CompetencyEvaluation:
    competency = db.get(models.Competency, competency_id)
    if not competency:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Competency not found")

    user = db.get(models.User, payload.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    today = date.today()
    period_end = payload.period_end or today
    period_start = payload.period_start or period_end.replace(day=1)

    if period_start > period_end:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid period range")

    limit = get_evaluation_daily_limit(db, user.id)
    quota_reserved = reserve_daily_quota(
        db,
        owner_id=user.id,
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
        user_id=user.id,
        status="running",
        scope="user",
        target_period_start=period_start,
        target_period_end=period_end,
        triggered_by=payload.triggered_by,
        triggered_by_user=admin_user,
        started_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.flush()

    evaluator = CompetencyEvaluator(db)

    try:
        evaluation = evaluator.evaluate(
            user=user,
            competency=competency,
            period_start=period_start,
            period_end=period_end,
            triggered_by=payload.triggered_by,
            job=job,
        )
    except Exception as exc:  # pragma: no cover - defensive handling
        job.status = "failed"
        job.completed_at = datetime.now(timezone.utc)
        job.error_message = str(exc)
        db.add(job)
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc

    job.status = "succeeded"
    job.completed_at = datetime.now(timezone.utc)
    job.summary_stats = {"evaluations": 1}
    db.add(job)
    db.commit()
    db.refresh(evaluation)
    return evaluation


__all__ = ["router"]
