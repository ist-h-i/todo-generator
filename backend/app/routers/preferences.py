from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/board-layouts", tags=["board-layouts"])


@router.get("/", response_model=schemas.UserPreferenceRead)
def get_board_layout(
    user_id: str = Query(..., description="Identifier of the requesting user"),
    db: Session = Depends(get_db),
) -> models.UserPreference:
    preference = db.get(models.UserPreference, user_id)
    if preference:
        return preference

    preference = models.UserPreference(user_id=user_id)
    db.add(preference)
    db.commit()
    db.refresh(preference)
    return preference


@router.put("/", response_model=schemas.UserPreferenceRead)
def update_board_layout(payload: schemas.BoardLayoutUpdate, db: Session = Depends(get_db)) -> models.UserPreference:
    preference = db.get(models.UserPreference, payload.user_id)
    if not preference:
        preference = models.UserPreference(user_id=payload.user_id)

    update_data = payload.dict(exclude={"user_id"}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(preference, key, value)

    db.add(preference)
    db.commit()
    db.refresh(preference)
    return preference
