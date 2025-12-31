"""Helper utilities for daily quota management."""

from __future__ import annotations

from datetime import date

from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models

DEFAULT_CARD_DAILY_LIMIT = 25
DEFAULT_EVALUATION_DAILY_LIMIT = 3
DEFAULT_ANALYSIS_DAILY_LIMIT = 10
DEFAULT_STATUS_REPORT_DAILY_LIMIT = 5
DEFAULT_IMMUNITY_MAP_DAILY_LIMIT = 5
DEFAULT_IMMUNITY_MAP_CANDIDATE_DAILY_LIMIT = 10
DEFAULT_APPEAL_DAILY_LIMIT = 5
DEFAULT_AUTO_CARD_DAILY_LIMIT = DEFAULT_CARD_DAILY_LIMIT

AI_QUOTA_ANALYSIS = "analysis"
AI_QUOTA_STATUS_REPORT = "status_report_analysis"
AI_QUOTA_IMMUNITY_MAP = "immunity_map"
AI_QUOTA_IMMUNITY_MAP_CANDIDATES = "immunity_map_candidates"
AI_QUOTA_APPEAL = "appeal_generation"
AI_QUOTA_AUTO_CARD = "auto_card"


def _coerce_limit(limit: int) -> int:
    """Return the provided limit clamped to a non-negative integer."""

    return max(int(limit), 0)


def _normalize_override_value(limit: int | None) -> int | None:
    """Normalize an override limit by coercing positive values and preserving None."""

    if limit is None:
        return None

    return _coerce_limit(limit)


def _resolve_limit(
    db: Session,
    user_id: str,
    *,
    override_field: str,
    default_field: str,
    default_fallback: int,
) -> int:
    """Resolve the effective limit for the given user and quota field."""

    override = db.query(models.UserQuotaOverride).filter_by(user_id=user_id).one_or_none()
    if override is not None:
        override_value = getattr(override, override_field)
        if override_value is not None:
            return _coerce_limit(override_value)

    defaults = _ensure_defaults(db)
    default_value = getattr(defaults, default_field)
    if default_value is None:
        default_value = default_fallback
    return _coerce_limit(default_value)


def _ensure_defaults(db: Session) -> models.QuotaDefaults:
    defaults = (
        db.query(models.QuotaDefaults).order_by(models.QuotaDefaults.id.asc()).first()
    )
    if defaults:
        return defaults

    defaults = models.QuotaDefaults(
        card_daily_limit=DEFAULT_CARD_DAILY_LIMIT,
        evaluation_daily_limit=DEFAULT_EVALUATION_DAILY_LIMIT,
        analysis_daily_limit=DEFAULT_ANALYSIS_DAILY_LIMIT,
        status_report_daily_limit=DEFAULT_STATUS_REPORT_DAILY_LIMIT,
        immunity_map_daily_limit=DEFAULT_IMMUNITY_MAP_DAILY_LIMIT,
        immunity_map_candidate_daily_limit=DEFAULT_IMMUNITY_MAP_CANDIDATE_DAILY_LIMIT,
        appeal_daily_limit=DEFAULT_APPEAL_DAILY_LIMIT,
        auto_card_daily_limit=DEFAULT_AUTO_CARD_DAILY_LIMIT,
    )
    db.add(defaults)
    db.flush()
    return defaults


def get_card_daily_limit(db: Session, user_id: str) -> int:
    return _resolve_limit(
        db,
        user_id,
        override_field="card_daily_limit",
        default_field="card_daily_limit",
        default_fallback=DEFAULT_CARD_DAILY_LIMIT,
    )


def get_evaluation_daily_limit(db: Session, user_id: str) -> int:
    return _resolve_limit(
        db,
        user_id,
        override_field="evaluation_daily_limit",
        default_field="evaluation_daily_limit",
        default_fallback=DEFAULT_EVALUATION_DAILY_LIMIT,
    )


def get_analysis_daily_limit(db: Session, user_id: str) -> int:
    return _resolve_limit(
        db,
        user_id,
        override_field="analysis_daily_limit",
        default_field="analysis_daily_limit",
        default_fallback=DEFAULT_ANALYSIS_DAILY_LIMIT,
    )


def get_status_report_daily_limit(db: Session, user_id: str) -> int:
    return _resolve_limit(
        db,
        user_id,
        override_field="status_report_daily_limit",
        default_field="status_report_daily_limit",
        default_fallback=DEFAULT_STATUS_REPORT_DAILY_LIMIT,
    )


def get_immunity_map_daily_limit(db: Session, user_id: str) -> int:
    return _resolve_limit(
        db,
        user_id,
        override_field="immunity_map_daily_limit",
        default_field="immunity_map_daily_limit",
        default_fallback=DEFAULT_IMMUNITY_MAP_DAILY_LIMIT,
    )


def get_immunity_map_candidate_daily_limit(db: Session, user_id: str) -> int:
    return _resolve_limit(
        db,
        user_id,
        override_field="immunity_map_candidate_daily_limit",
        default_field="immunity_map_candidate_daily_limit",
        default_fallback=DEFAULT_IMMUNITY_MAP_CANDIDATE_DAILY_LIMIT,
    )


def get_appeal_daily_limit(db: Session, user_id: str) -> int:
    return _resolve_limit(
        db,
        user_id,
        override_field="appeal_daily_limit",
        default_field="appeal_daily_limit",
        default_fallback=DEFAULT_APPEAL_DAILY_LIMIT,
    )


def get_auto_card_daily_limit(db: Session, user_id: str) -> int:
    return _resolve_limit(
        db,
        user_id,
        override_field="auto_card_daily_limit",
        default_field="auto_card_daily_limit",
        default_fallback=DEFAULT_AUTO_CARD_DAILY_LIMIT,
    )


def reserve_daily_quota(
    db: Session,
    *,
    owner_id: str,
    quota_day: date,
    limit: int,
    quota_model: type[models.DailyCardQuota] | type[models.DailyEvaluationQuota],
    counter_field: str,
) -> bool:
    """Attempt to reserve quota entry for the provided owner."""

    if limit <= 0:
        return True

    counter_column = getattr(quota_model, counter_field)

    def _attempt_increment() -> bool:
        result = db.execute(
            update(quota_model)
            .where(
                quota_model.owner_id == owner_id,
                quota_model.quota_date == quota_day,
                counter_column < limit,
            )
            .values({counter_field: counter_column + 1})
        )
        return bool(result.rowcount)

    if _attempt_increment():
        return True

    insert_stmt = insert(quota_model).values(
        owner_id=owner_id,
        quota_date=quota_day,
        **{counter_field: 1},
    )

    try:
        insert_result = db.execute(insert_stmt)
    except IntegrityError:
        db.rollback()
    else:
        if insert_result.rowcount:
            return True

    return _attempt_increment()


def reserve_ai_quota(
    db: Session,
    *,
    owner_id: str,
    quota_day: date,
    limit: int,
    quota_key: str,
) -> bool:
    """Reserve one slot from the user's daily AI quota."""

    if limit <= 0:
        return True

    def _attempt_increment() -> bool:
        result = db.execute(
            update(models.DailyAiQuota)
            .where(
                models.DailyAiQuota.owner_id == owner_id,
                models.DailyAiQuota.quota_date == quota_day,
                models.DailyAiQuota.quota_key == quota_key,
                models.DailyAiQuota.used_count < limit,
            )
            .values(used_count=models.DailyAiQuota.used_count + 1)
        )
        return bool(result.rowcount)

    if _attempt_increment():
        return True

    insert_stmt = insert(models.DailyAiQuota).values(
        owner_id=owner_id,
        quota_date=quota_day,
        quota_key=quota_key,
        used_count=1,
    )

    try:
        insert_result = db.execute(insert_stmt)
    except IntegrityError:
        db.rollback()
    else:
        if insert_result.rowcount:
            return True

    return _attempt_increment()


def reset_daily_quota(
    db: Session,
    *,
    owner_id: str,
    quota_day: date,
    quota_model: type[models.DailyCardQuota] | type[models.DailyEvaluationQuota],
    counter_field: str,
) -> None:
    db.execute(
        update(quota_model)
        .where(quota_model.owner_id == owner_id, quota_model.quota_date == quota_day)
        .values({counter_field: 0})
    )


def get_quota_defaults(db: Session) -> models.QuotaDefaults:
    return _ensure_defaults(db)


def set_quota_defaults(
    db: Session,
    *,
    card_limit: int,
    evaluation_limit: int,
    analysis_limit: int,
    status_report_limit: int,
    immunity_map_limit: int,
    immunity_map_candidate_limit: int,
    appeal_limit: int,
    auto_card_limit: int,
) -> models.QuotaDefaults:
    defaults = _ensure_defaults(db)
    defaults.card_daily_limit = _coerce_limit(card_limit)
    defaults.evaluation_daily_limit = _coerce_limit(evaluation_limit)
    defaults.analysis_daily_limit = _coerce_limit(analysis_limit)
    defaults.status_report_daily_limit = _coerce_limit(status_report_limit)
    defaults.immunity_map_daily_limit = _coerce_limit(immunity_map_limit)
    defaults.immunity_map_candidate_daily_limit = _coerce_limit(immunity_map_candidate_limit)
    defaults.appeal_daily_limit = _coerce_limit(appeal_limit)
    defaults.auto_card_daily_limit = _coerce_limit(auto_card_limit)
    db.add(defaults)
    return defaults


def upsert_user_quota(
    db: Session,
    *,
    user_id: str,
    card_limit: int | None,
    evaluation_limit: int | None,
    analysis_limit: int | None,
    status_report_limit: int | None,
    immunity_map_limit: int | None,
    immunity_map_candidate_limit: int | None,
    appeal_limit: int | None,
    auto_card_limit: int | None,
    updated_by: str | None,
) -> models.UserQuotaOverride:
    override = db.query(models.UserQuotaOverride).filter_by(user_id=user_id).one_or_none()
    if override is None:
        override = models.UserQuotaOverride(
            user_id=user_id,
            card_daily_limit=_normalize_override_value(card_limit),
            evaluation_daily_limit=_normalize_override_value(evaluation_limit),
            analysis_daily_limit=_normalize_override_value(analysis_limit),
            status_report_daily_limit=_normalize_override_value(status_report_limit),
            immunity_map_daily_limit=_normalize_override_value(immunity_map_limit),
            immunity_map_candidate_daily_limit=_normalize_override_value(immunity_map_candidate_limit),
            appeal_daily_limit=_normalize_override_value(appeal_limit),
            auto_card_daily_limit=_normalize_override_value(auto_card_limit),
            updated_by=updated_by,
        )
        db.add(override)
        return override

    override.card_daily_limit = _normalize_override_value(card_limit)
    override.evaluation_daily_limit = _normalize_override_value(evaluation_limit)
    override.analysis_daily_limit = _normalize_override_value(analysis_limit)
    override.status_report_daily_limit = _normalize_override_value(status_report_limit)
    override.immunity_map_daily_limit = _normalize_override_value(immunity_map_limit)
    override.immunity_map_candidate_daily_limit = _normalize_override_value(immunity_map_candidate_limit)
    override.appeal_daily_limit = _normalize_override_value(appeal_limit)
    override.auto_card_daily_limit = _normalize_override_value(auto_card_limit)
    override.updated_by = updated_by
    db.add(override)
    return override


def get_user_quota(db: Session, user_id: str) -> models.UserQuotaOverride | None:
    return db.query(models.UserQuotaOverride).filter_by(user_id=user_id).one_or_none()


def get_daily_usage(
    db: Session,
    *,
    quota_model: type[models.DailyCardQuota] | type[models.DailyEvaluationQuota],
    owner_id: str,
    quota_day: date,
) -> int:
    result = db.execute(
        select(getattr(quota_model, "created_count", getattr(quota_model, "executed_count", 0))).where(
            quota_model.owner_id == owner_id,
            quota_model.quota_date == quota_day,
        )
    ).scalar_one_or_none()
    if result is None:
        return 0
    return int(result)


__all__ = [
    "AI_QUOTA_ANALYSIS",
    "AI_QUOTA_APPEAL",
    "AI_QUOTA_AUTO_CARD",
    "AI_QUOTA_IMMUNITY_MAP",
    "AI_QUOTA_IMMUNITY_MAP_CANDIDATES",
    "AI_QUOTA_STATUS_REPORT",
    "DEFAULT_ANALYSIS_DAILY_LIMIT",
    "DEFAULT_APPEAL_DAILY_LIMIT",
    "DEFAULT_AUTO_CARD_DAILY_LIMIT",
    "DEFAULT_CARD_DAILY_LIMIT",
    "DEFAULT_EVALUATION_DAILY_LIMIT",
    "DEFAULT_IMMUNITY_MAP_CANDIDATE_DAILY_LIMIT",
    "DEFAULT_IMMUNITY_MAP_DAILY_LIMIT",
    "DEFAULT_STATUS_REPORT_DAILY_LIMIT",
    "get_analysis_daily_limit",
    "get_appeal_daily_limit",
    "get_auto_card_daily_limit",
    "get_card_daily_limit",
    "get_daily_usage",
    "get_evaluation_daily_limit",
    "get_immunity_map_candidate_daily_limit",
    "get_immunity_map_daily_limit",
    "get_quota_defaults",
    "get_status_report_daily_limit",
    "get_user_quota",
    "reserve_ai_quota",
    "reserve_daily_quota",
    "reset_daily_quota",
    "set_quota_defaults",
    "upsert_user_quota",
]
