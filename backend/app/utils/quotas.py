"""Helper utilities for daily quota management."""

from __future__ import annotations

from datetime import date

from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models

DEFAULT_CARD_DAILY_LIMIT = 25
DEFAULT_EVALUATION_DAILY_LIMIT = 3


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
    default_value = getattr(defaults, default_field) or default_fallback
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


def set_quota_defaults(db: Session, *, card_limit: int, evaluation_limit: int) -> models.QuotaDefaults:
    defaults = _ensure_defaults(db)
    defaults.card_daily_limit = _coerce_limit(card_limit)
    defaults.evaluation_daily_limit = _coerce_limit(evaluation_limit)
    db.add(defaults)
    return defaults


def upsert_user_quota(
    db: Session,
    *,
    user_id: str,
    card_limit: int | None,
    evaluation_limit: int | None,
    updated_by: str | None,
) -> models.UserQuotaOverride:
    override = db.query(models.UserQuotaOverride).filter_by(user_id=user_id).one_or_none()
    if override is None:
        override = models.UserQuotaOverride(
            user_id=user_id,
            card_daily_limit=_normalize_override_value(card_limit),
            evaluation_daily_limit=_normalize_override_value(evaluation_limit),
            updated_by=updated_by,
        )
        db.add(override)
        return override

    override.card_daily_limit = _normalize_override_value(card_limit)
    override.evaluation_daily_limit = _normalize_override_value(evaluation_limit)
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
    "DEFAULT_CARD_DAILY_LIMIT",
    "DEFAULT_EVALUATION_DAILY_LIMIT",
    "get_card_daily_limit",
    "get_evaluation_daily_limit",
    "get_quota_defaults",
    "reserve_daily_quota",
    "reset_daily_quota",
    "set_quota_defaults",
    "upsert_user_quota",
    "get_user_quota",
    "get_daily_usage",
]
