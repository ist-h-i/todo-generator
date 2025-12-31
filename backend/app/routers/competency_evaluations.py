"""Endpoints for retrieving competency evaluation history."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from typing import Any, Mapping, Optional

from sqlalchemy import func

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.competency_evaluator import CompetencyEvaluator
from ..services.gemini import (
    GeminiClient,
    GeminiError,
    GeminiRateLimitError,
    get_optional_gemini_client,
)
from ..utils.dependencies import require_admin
from ..utils.quotas import (
    get_daily_usage,
    get_evaluation_daily_limit,
    reserve_daily_quota,
)

router = APIRouter(tags=["competencies"])
logger = logging.getLogger(__name__)

_COMPETENCY_BATCH_SYSTEM_PROMPT = (
    "You are Verbalize Yourself's competency evaluation assistant."
    " Evaluate the user's competencies for the given period based on the provided activity metrics and competency definitions."
    " Respond strictly with a JSON object that matches the provided schema."
    " Write narrative fields (score_label, rationale, actions) in natural Japanese."
    " Do not include any extra keys or any prose outside JSON."
)

_COMPETENCY_BATCH_RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "evaluations": {
            "type": "array",
            "minItems": 1,
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": [
                    "competency_id",
                    "score_value",
                    "score_label",
                    "rationale",
                    "attitude_actions",
                    "behavior_actions",
                ],
                "properties": {
                    "competency_id": {"type": "string"},
                    "score_value": {"type": "integer"},
                    "score_label": {"type": "string"},
                    "rationale": {"type": "string"},
                    "attitude_actions": {"type": "array", "items": {"type": "string"}},
                    "behavior_actions": {"type": "array", "items": {"type": "string"}},
                },
            },
        },
    },
    "required": ["evaluations"],
}


def _safe_list(value: Any) -> list[Any]:
    if isinstance(value, list):
        return value
    return []


def _to_mapping(value: Any) -> Mapping[str, Any] | None:
    if isinstance(value, Mapping):
        return value
    return None


def _to_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, str) and not value.strip():
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _string_list(value: Any) -> list[str]:
    items = _safe_list(value)
    results: list[str] = []
    for item in items:
        text = str(item).strip() if item is not None else ""
        if text:
            results.append(text)
    return results


def _extract_ai_warnings(context: Any) -> list[str]:
    if not isinstance(context, Mapping):
        return []
    raw = context.get("ai_warnings")
    if raw is None:
        return []
    if isinstance(raw, list):
        return [text for text in (str(item or "").strip() for item in raw) if text]
    text = str(raw).strip()
    return [text] if text else []


def _attach_evaluation_warnings(evaluation: models.CompetencyEvaluation) -> None:
    warnings = _extract_ai_warnings(getattr(evaluation, "context", None))
    setattr(evaluation, "warnings", warnings)


def _resolve_scale(db: Session, competency: models.Competency) -> int:
    level_value = (competency.level or "").strip()
    if not level_value:
        return 5

    level = (
        db.query(models.CompetencyLevel)
        .filter(func.lower(models.CompetencyLevel.value) == level_value.lower())
        .one_or_none()
    )
    if level:
        return level.scale

    return 3 if level_value.lower() == "junior" else 5


def _default_score_label(*, scale: int, score_value: int) -> str:
    if scale == 3:
        return {1: "未達", 2: "一部達成", 3: "達成"}.get(score_value, "達成")

    return {1: "未達", 2: "要改善", 3: "標準", 4: "良好", 5: "卓越"}.get(score_value, "標準")


def _normalize_score_value(*, scale: int, value: int | None) -> int:
    if scale <= 0:
        return 0
    if value is None:
        return max(1, min(scale, 3 if scale >= 3 else scale))
    return max(1, min(scale, int(value)))


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


def _resolve_competencies(db: Session, competency_ids: list[str]) -> list[models.Competency]:
    query = db.query(models.Competency).filter(models.Competency.is_active.is_(True))
    competencies = query.filter(models.Competency.id.in_(competency_ids)).all()
    by_id = {competency.id: competency for competency in competencies}

    missing = [competency_id for competency_id in competency_ids if competency_id not in by_id]
    if missing:
        detail = "Competency not found"
        if len(missing) == 1:
            detail = f"Competency not found: {missing[0]}"
        else:
            detail = f"Competencies not found: {', '.join(missing)}"
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)

    return [by_id[competency_id] for competency_id in competency_ids]


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
    for evaluation in evaluations:
        _attach_evaluation_warnings(evaluation)
    return evaluations


@router.get("/users/me/evaluations", response_model=list[schemas.CompetencyEvaluationRead])
def my_evaluations(
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.CompetencyEvaluation]:
    query = _evaluation_query(db).filter(models.CompetencyEvaluation.user_id == current_user.id)
    evaluations = query.limit(limit).all()
    for evaluation in evaluations:
        _attach_evaluation_warnings(evaluation)
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
    gemini: GeminiClient | None = Depends(get_optional_gemini_client),
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
    used_fallback = False
    ai_warnings: list[str] = []

    try:
        if gemini is None:
            used_fallback = True
            ai_warnings.append("AI が未設定のため、ルールベース評価にフォールバックしました。")
            evaluation = evaluator.evaluate(
                user=current_user,
                competency=competency,
                period_start=period_start,
                period_end=period_end,
                triggered_by="manual",
                job=job,
            )
        else:
            start_dt, end_dt = evaluator._to_datetime_range(period_start, period_end)
            metrics = evaluator._collect_metrics(user=current_user, start=start_dt, end=end_dt)
            scale = _resolve_scale(db, competency)

            competency_payload = [
                {
                    "id": competency.id,
                    "name": competency.name,
                    "level": competency.level,
                    "scale": scale,
                    "description": competency.description,
                    "rubric": competency.rubric or {},
                    "criteria": [
                        {
                            "id": criterion.id,
                            "title": criterion.title,
                            "description": criterion.description,
                            "weight": criterion.weight,
                        }
                        for criterion in competency.criteria
                        if getattr(criterion, "is_active", True)
                    ],
                }
            ]

            prompt_parts = [
                "Evaluate the user's competencies for the given period.",
                f"Period: {period_start} to {period_end}",
                "",
                "Activity metrics (JSON):",
                json.dumps(metrics, ensure_ascii=False),
                "",
                "Competencies (JSON):",
                json.dumps(competency_payload, ensure_ascii=False),
                "",
                "Output rules:",
                "- Return exactly one evaluation per competency_id listed in the input.",
                "- score_value must be an integer between 1 and scale for each competency.",
                "- score_label should match the score_value and scale (3-scale: 譛ｪ驕・荳驛ｨ驕疲・/驕疲・, 5-scale: 譛ｪ驕・隕∵隼蝟・讓呎ｺ・濶ｯ螂ｽ/蜊楢ｶ・.",
                "- Provide 2-3 short attitude_actions and 2-3 short behavior_actions in Japanese.",
            ]
            prompt = "\n".join(prompt_parts).strip()

            generated = gemini.generate_structured(
                prompt=prompt,
                response_schema=_COMPETENCY_BATCH_RESPONSE_SCHEMA,
                system_prompt=_COMPETENCY_BATCH_SYSTEM_PROMPT,
            )
            ai_warnings = _string_list(generated.get("warnings"))

            raw_evaluations = _safe_list(generated.get("evaluations"))
            raw: Mapping[str, Any] | None = None
            for raw_item in raw_evaluations:
                item = _to_mapping(raw_item)
                if not item:
                    continue
                competency_id = str(item.get("competency_id") or "").strip()
                if competency_id == competency.id:
                    raw = item
                    break

            ai_model = str(generated.get("model") or "").strip() or None

            if not raw:
                used_fallback = True
                ai_warnings.append("Gemini の応答が不完全だったため、ルールベース評価にフォールバックしました。")
                evaluation = evaluator.evaluate(
                    user=current_user,
                    competency=competency,
                    period_start=period_start,
                    period_end=period_end,
                    triggered_by="manual",
                    job=job,
                )
            else:
                score_value = _normalize_score_value(
                    scale=scale,
                    value=_to_optional_int(raw.get("score_value")),
                )
                score_label = str(raw.get("score_label") or "").strip() or _default_score_label(
                    scale=scale,
                    score_value=score_value,
                )
                rationale = str(raw.get("rationale") or "").strip() or None
                attitude_actions = _string_list(raw.get("attitude_actions"))[:5]
                behavior_actions = _string_list(raw.get("behavior_actions"))[:5]

                evaluation = models.CompetencyEvaluation(
                    competency=competency,
                    user=current_user,
                    period_start=period_start,
                    period_end=period_end,
                    scale=scale,
                    score_value=score_value,
                    score_label=score_label,
                    rationale=rationale,
                    attitude_actions=attitude_actions,
                    behavior_actions=behavior_actions,
                    ai_model=ai_model or "gemini",
                    triggered_by="manual",
                    job=job,
                    context={
                        "metrics": metrics,
                        "ai_requested_model": getattr(gemini, "requested_model", None),
                        "ai_used_model": ai_model or "gemini",
                        "ai_warnings": ai_warnings,
                    },
                )

                db.add(evaluation)
                db.flush()

                criteria = list(competency.criteria) or [None]
                for criterion in criteria:
                    db.add(
                        models.CompetencyEvaluationItem(
                            evaluation=evaluation,
                            criterion=criterion,
                            score_value=score_value,
                            score_label=score_label,
                            rationale=rationale,
                            attitude_actions=attitude_actions,
                            behavior_actions=behavior_actions,
                        )
                    )

                db.flush()
    except (GeminiRateLimitError, GeminiError):
        used_fallback = True
        ai_warnings.append("Gemini の呼び出しに失敗したため、ルールベース評価にフォールバックしました。")
        logger.warning(
            "Gemini evaluation failed; falling back to rule-based evaluator.",
            exc_info=True,
        )
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

    evaluation.context = {
        **(evaluation.context or {}),
        "ai_requested_model": getattr(gemini, "requested_model", None) if gemini is not None else None,
        "ai_used_model": evaluation.ai_model,
        "ai_warnings": ai_warnings,
    }
    _attach_evaluation_warnings(evaluation)

    job.status = "succeeded"
    job.completed_at = datetime.now(timezone.utc)
    summary_stats: dict[str, Any] = {"evaluations": 1}
    if used_fallback:
        summary_stats["gemini_fallback"] = True
    job.summary_stats = summary_stats
    db.add(job)
    db.commit()
    db.refresh(evaluation)
    return evaluation


@router.post("/users/me/evaluations/batch", response_model=list[schemas.CompetencyEvaluationRead])
def create_my_evaluations_batch(
    payload: schemas.SelfEvaluationBatchRequest,
    gemini: GeminiClient | None = Depends(get_optional_gemini_client),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.CompetencyEvaluation]:
    competency_ids = list(dict.fromkeys(payload.competency_ids))
    competencies = _resolve_competencies(db, competency_ids)
    period_start, period_end = _normalize_period(payload.period_start, payload.period_end)

    today = date.today()
    limit = get_evaluation_daily_limit(db, current_user.id)
    if limit > 0:
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
    evaluations: list[models.CompetencyEvaluation] = []
    used_fallback = False
    batch_ai_warnings: list[str] = []

    try:
        if gemini is None:
            used_fallback = True
            for competency in competencies:
                evaluation = evaluator.evaluate(
                    user=current_user,
                    competency=competency,
                    period_start=period_start,
                    period_end=period_end,
                    triggered_by="manual",
                    job=job,
                )
                evaluation.context = {
                    **(evaluation.context or {}),
                    "ai_requested_model": None,
                    "ai_used_model": evaluation.ai_model,
                    "ai_warnings": ["AI が未設定のため、ルールベース評価にフォールバックしました。"],
                }
                _attach_evaluation_warnings(evaluation)
                evaluations.append(evaluation)
        else:
            start_dt, end_dt = evaluator._to_datetime_range(period_start, period_end)
            metrics = evaluator._collect_metrics(user=current_user, start=start_dt, end=end_dt)

            competency_payload: list[dict[str, Any]] = []
            scale_by_id: dict[str, int] = {}
            for competency in competencies:
                scale = _resolve_scale(db, competency)
                scale_by_id[competency.id] = scale
                competency_payload.append(
                    {
                        "id": competency.id,
                        "name": competency.name,
                        "level": competency.level,
                        "scale": scale,
                        "description": competency.description,
                        "rubric": competency.rubric or {},
                        "criteria": [
                            {
                                "id": criterion.id,
                                "title": criterion.title,
                                "description": criterion.description,
                                "weight": criterion.weight,
                            }
                            for criterion in competency.criteria
                            if getattr(criterion, "is_active", True)
                        ],
                    }
                )

            prompt_parts = [
                "Evaluate the user's competencies for the given period.",
                f"Period: {period_start} to {period_end}",
                "",
                "Activity metrics (JSON):",
                json.dumps(metrics, ensure_ascii=False),
                "",
                "Competencies (JSON):",
                json.dumps(competency_payload, ensure_ascii=False),
                "",
                "Output rules:",
                "- Return exactly one evaluation per competency_id listed in the input.",
                "- score_value must be an integer between 1 and scale for each competency.",
                "- score_label should match the score_value and scale (3-scale: 未達/一部達成/達成, 5-scale: 未達/要改善/標準/良好/卓越).",
                "- Provide 2-3 short attitude_actions and 2-3 short behavior_actions in Japanese.",
            ]
            prompt = "\n".join(prompt_parts).strip()

            generated = gemini.generate_structured(
                prompt=prompt,
                response_schema=_COMPETENCY_BATCH_RESPONSE_SCHEMA,
                system_prompt=_COMPETENCY_BATCH_SYSTEM_PROMPT,
            )
            batch_ai_warnings = _string_list(generated.get("warnings"))

            raw_evaluations = _safe_list(generated.get("evaluations"))
            by_competency_id: dict[str, Mapping[str, Any]] = {}
            allowed_ids = {competency.id for competency in competencies}
            for raw in raw_evaluations:
                item = _to_mapping(raw)
                if not item:
                    continue
                competency_id = str(item.get("competency_id") or "").strip()
                if not competency_id or competency_id not in allowed_ids:
                    continue
                by_competency_id[competency_id] = item

            ai_model = str(generated.get("model") or "").strip() or None

            for competency in competencies:
                raw = by_competency_id.get(competency.id)
                if not raw:
                    used_fallback = True
                    evaluation = evaluator.evaluate(
                        user=current_user,
                        competency=competency,
                        period_start=period_start,
                        period_end=period_end,
                        triggered_by="manual",
                        job=job,
                    )
                    evaluation.context = {
                        **(evaluation.context or {}),
                        "ai_requested_model": getattr(gemini, "requested_model", None),
                        "ai_used_model": evaluation.ai_model,
                        "ai_warnings": [
                            *batch_ai_warnings,
                            "Gemini の応答が不完全だったため、ルールベース評価にフォールバックしました。",
                        ],
                    }
                    _attach_evaluation_warnings(evaluation)
                    evaluations.append(evaluation)
                    continue

                scale = scale_by_id.get(competency.id) or _resolve_scale(db, competency)
                score_value = _normalize_score_value(scale=scale, value=_to_optional_int(raw.get("score_value")))
                score_label = str(raw.get("score_label") or "").strip() or _default_score_label(
                    scale=scale,
                    score_value=score_value,
                )
                rationale = str(raw.get("rationale") or "").strip() or None
                attitude_actions = _string_list(raw.get("attitude_actions"))[:5]
                behavior_actions = _string_list(raw.get("behavior_actions"))[:5]

                evaluation = models.CompetencyEvaluation(
                    competency=competency,
                    user=current_user,
                    period_start=period_start,
                    period_end=period_end,
                    scale=scale,
                    score_value=score_value,
                    score_label=score_label,
                    rationale=rationale,
                    attitude_actions=attitude_actions,
                    behavior_actions=behavior_actions,
                    ai_model=ai_model or "gemini",
                    triggered_by="manual",
                    job=job,
                    context={
                        "metrics": metrics,
                        "ai_requested_model": getattr(gemini, "requested_model", None),
                        "ai_used_model": ai_model or "gemini",
                        "ai_warnings": batch_ai_warnings,
                    },
                )

                db.add(evaluation)
                db.flush()

                criteria = list(competency.criteria) or [None]
                for criterion in criteria:
                    db.add(
                        models.CompetencyEvaluationItem(
                            evaluation=evaluation,
                            criterion=criterion,
                            score_value=score_value,
                            score_label=score_label,
                            rationale=rationale,
                            attitude_actions=attitude_actions,
                            behavior_actions=behavior_actions,
                        )
                    )

                db.flush()
                _attach_evaluation_warnings(evaluation)
                evaluations.append(evaluation)
    except (GeminiRateLimitError, GeminiError):
        used_fallback = True
        fallback_warning = "Gemini の呼び出しに失敗したため、ルールベース評価にフォールバックしました。"
        logger.warning(
            "Gemini batch evaluation failed; falling back to rule-based evaluator.",
            exc_info=True,
        )
        existing_ids = {evaluation.competency_id for evaluation in evaluations}
        for competency in competencies:
            if competency.id in existing_ids:
                continue
            evaluation = evaluator.evaluate(
                user=current_user,
                competency=competency,
                period_start=period_start,
                period_end=period_end,
                triggered_by="manual",
                job=job,
            )
            evaluation.context = {
                **(evaluation.context or {}),
                "ai_requested_model": getattr(gemini, "requested_model", None) if gemini is not None else None,
                "ai_used_model": evaluation.ai_model,
                "ai_warnings": [fallback_warning],
            }
            _attach_evaluation_warnings(evaluation)
            evaluations.append(evaluation)
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
    summary_stats: dict[str, Any] = {"evaluations": len(evaluations)}
    if used_fallback:
        summary_stats["gemini_fallback"] = True
    job.summary_stats = summary_stats
    db.add(job)
    db.commit()

    for evaluation in evaluations:
        db.refresh(evaluation)
        _attach_evaluation_warnings(evaluation)

    return evaluations


@router.get("/users/me/competencies", response_model=list[schemas.CompetencySummary])
def list_my_competencies(
    db: Session = Depends(get_db),
    _: models.User = Depends(get_current_user),
) -> list[models.Competency]:
    competencies = (
        db.query(models.Competency)
        .filter(models.Competency.is_active.is_(True))
        .order_by(models.Competency.sort_order.asc(), models.Competency.created_at.asc())
        .all()
    )
    return competencies


__all__ = ["router"]
