from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/board-layouts", tags=["board-layouts"])


@router.get("/", response_model=schemas.UserPreferenceRead)
def get_board_layout(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.UserPreference:
    preference = db.get(models.UserPreference, current_user.id)
    if preference:
        return preference

    preference = models.UserPreference(user_id=current_user.id)
    db.add(preference)
    db.commit()
    db.refresh(preference)
    return preference


@router.put("/", response_model=schemas.UserPreferenceRead)
def update_board_layout(
    payload: schemas.BoardLayoutUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.UserPreference:
    preference = db.get(models.UserPreference, current_user.id)
    if not preference:
        preference = models.UserPreference(user_id=current_user.id)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(preference, key, value)

    db.add(preference)
    db.commit()
    db.refresh(preference)
    return preference
