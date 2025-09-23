from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..utils.activity import record_activity

router = APIRouter(prefix="/activity-log", tags=["activity"])


@router.get("/", response_model=List[schemas.ActivityLogRead])
def list_activity(
    card_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
) -> List[models.ActivityLog]:
    query = db.query(models.ActivityLog)
    if card_id:
        query = query.filter(models.ActivityLog.card_id == card_id)
    return query.order_by(desc(models.ActivityLog.created_at)).limit(limit).all()


@router.post("/", response_model=schemas.ActivityLogRead, status_code=status.HTTP_201_CREATED)
def create_activity(payload: schemas.ActivityCreate, db: Session = Depends(get_db)) -> models.ActivityLog:
    log = record_activity(
        db,
        action=payload.action,
        card_id=payload.card_id,
        actor_id=payload.actor_id,
        details=payload.details,
    )
    db.commit()
    db.refresh(log)
    return log
