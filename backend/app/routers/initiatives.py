from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..utils.repository import (
    apply_updates,
    get_owned_resource_or_404,
    save_model,
)

router = APIRouter(prefix="/initiatives", tags=["initiatives"])


def _initiative_query(db: Session):
    return db.query(models.ImprovementInitiative).options(selectinload(models.ImprovementInitiative.progress_logs))


def _get_owned_initiative(
    db: Session,
    initiative_id: str,
    owner_id: str,
) -> models.ImprovementInitiative:
    initiative = (
        _initiative_query(db)
        .filter(
            models.ImprovementInitiative.id == initiative_id,
            models.ImprovementInitiative.owner_id == owner_id,
        )
        .first()
    )
    if not initiative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initiative not found")
    return initiative


@router.get("/", response_model=list[schemas.ImprovementInitiativeRead])
def list_initiatives(
    status_filter: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.ImprovementInitiative]:
    query = _initiative_query(db).filter(models.ImprovementInitiative.owner_id == current_user.id)
    if status_filter:
        query = query.filter(models.ImprovementInitiative.status == status_filter)
    return query.order_by(models.ImprovementInitiative.created_at.desc()).all()


@router.post("/", response_model=schemas.ImprovementInitiativeRead, status_code=status.HTTP_201_CREATED)
def create_initiative(
    payload: schemas.InitiativeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ImprovementInitiative:
    initiative = models.ImprovementInitiative(
        name=payload.name,
        description=payload.description,
        start_date=payload.start_date,
        target_metrics=payload.target_metrics,
        status=payload.status,
        health=payload.health,
        owner_id=current_user.id,
    )
    return save_model(db, initiative)


@router.get("/{initiative_id}", response_model=schemas.ImprovementInitiativeRead)
def get_initiative(
    initiative_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ImprovementInitiative:
    return _get_owned_initiative(db, initiative_id, current_user.id)


@router.patch("/{initiative_id}", response_model=schemas.ImprovementInitiativeRead)
def update_initiative(
    initiative_id: str,
    payload: schemas.InitiativeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ImprovementInitiative:
    initiative = _get_owned_initiative(db, initiative_id, current_user.id)
    update_data = payload.model_dump(exclude_unset=True)
    update_data.pop("owner", None)
    apply_updates(initiative, update_data)
    return save_model(db, initiative)


@router.post(
    "/{initiative_id}/progress",
    response_model=schemas.InitiativeProgressLogRead,
    status_code=status.HTTP_201_CREATED,
)
def add_progress_log(
    initiative_id: str,
    payload: schemas.InitiativeProgressLogCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.InitiativeProgressLog:
    get_owned_resource_or_404(
        db,
        models.ImprovementInitiative,
        initiative_id,
        owner_id=current_user.id,
        detail="Initiative not found",
    )

    log = models.InitiativeProgressLog(
        initiative_id=initiative_id,
        timestamp=payload.timestamp or datetime.now(timezone.utc),
        status=payload.status,
        notes=payload.notes,
        observed_metrics=payload.observed_metrics,
    )
    return save_model(db, log)


@router.get("/{initiative_id}/progress", response_model=list[schemas.InitiativeProgressLogRead])
def list_progress_logs(
    initiative_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.InitiativeProgressLog]:
    get_owned_resource_or_404(
        db,
        models.ImprovementInitiative,
        initiative_id,
        owner_id=current_user.id,
        detail="Initiative not found",
    )

    return (
        db.query(models.InitiativeProgressLog)
        .filter(models.InitiativeProgressLog.initiative_id == initiative_id)
        .order_by(models.InitiativeProgressLog.timestamp)
        .all()
    )


@router.get("/{initiative_id}/cards", response_model=list[schemas.CardRead])
def list_initiative_cards(
    initiative_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.Card]:
    get_owned_resource_or_404(
        db,
        models.ImprovementInitiative,
        initiative_id,
        owner_id=current_user.id,
        detail="Initiative not found",
    )

    return (
        db.query(models.Card)
        .options(
            selectinload(models.Card.labels),
            selectinload(models.Card.subtasks),
            joinedload(models.Card.status),
        )
        .filter(
            models.Card.initiative_id == initiative_id,
            models.Card.owner_id == current_user.id,
        )
        .order_by(models.Card.created_at.desc())
        .all()
    )
