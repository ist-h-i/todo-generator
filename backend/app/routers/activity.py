from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, or_
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..utils.activity import record_activity

router = APIRouter(prefix="/activity-log", tags=["activity"])


@router.get("/", response_model=List[schemas.ActivityLogRead])
def list_activity(
    card_id: Optional[str] = Query(default=None),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.ActivityLog]:
    query = (
        db.query(models.ActivityLog)
        .outerjoin(models.Card, models.ActivityLog.card_id == models.Card.id)
        .filter(
            or_(
                models.ActivityLog.actor_id == current_user.id,
                models.Card.owner_id == current_user.id,
            )
        )
    )
    if card_id:
        card = db.get(models.Card, card_id)
        if not card or card.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
        query = query.filter(models.ActivityLog.card_id == card_id)
    return query.order_by(desc(models.ActivityLog.created_at)).limit(limit).all()


@router.post("/", response_model=schemas.ActivityLogRead, status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: schemas.ActivityCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ActivityLog:
    if payload.card_id:
        card = db.get(models.Card, payload.card_id)
        if not card or card.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    log = record_activity(
        db,
        action=payload.action,
        card_id=payload.card_id,
        actor_id=current_user.id,
        details=payload.details,
    )
    db.commit()
    db.refresh(log)
    return log
