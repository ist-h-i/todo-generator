from __future__ import annotations

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import insert, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .. import models

DAILY_CARD_CREATION_LIMIT = 25


def reserve_daily_card_quota(*, db: Session, owner_id: str, quota_day: date) -> None:
    """Reserve one slot from the user's daily card quota."""

    quota_cls = models.DailyCardQuota

    def _try_increment() -> bool:
        result = db.execute(
            update(quota_cls)
            .where(
                quota_cls.owner_id == owner_id,
                quota_cls.quota_date == quota_day,
                quota_cls.created_count < DAILY_CARD_CREATION_LIMIT,
            )
            .values(created_count=quota_cls.created_count + 1)
        )
        return bool(result.rowcount)

    if _try_increment():
        return

    dialect_name = db.bind.dialect.name if db.bind else ""
    if dialect_name == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        insert_stmt = (
            sqlite_insert(quota_cls)
            .values(owner_id=owner_id, quota_date=quota_day, created_count=1)
            .on_conflict_do_nothing(index_elements=[quota_cls.owner_id, quota_cls.quota_date])
        )
    elif dialect_name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        insert_stmt = (
            pg_insert(quota_cls)
            .values(owner_id=owner_id, quota_date=quota_day, created_count=1)
            .on_conflict_do_nothing(index_elements=[quota_cls.owner_id, quota_cls.quota_date])
        )
    else:
        insert_stmt = insert(quota_cls).values(
            owner_id=owner_id,
            quota_date=quota_day,
            created_count=1,
        )

    try:
        insert_result = db.execute(insert_stmt)
    except IntegrityError:
        db.rollback()
    else:
        if insert_result.rowcount:
            return

    if _try_increment():
        return

    existing_count = db.execute(
        select(quota_cls.created_count).where(
            quota_cls.owner_id == owner_id,
            quota_cls.quota_date == quota_day,
        )
    ).scalar_one_or_none()

    if existing_count is None or existing_count < DAILY_CARD_CREATION_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reserve daily card quota.",
        )

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Daily card creation limit of {DAILY_CARD_CREATION_LIMIT} reached.",
    )
