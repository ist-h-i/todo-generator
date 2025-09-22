from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/initiatives", tags=["initiatives"])


def _initiative_query(db: Session):
    return db.query(models.ImprovementInitiative).options(
        selectinload(models.ImprovementInitiative.progress_logs)
    )


@router.get("/", response_model=List[schemas.ImprovementInitiativeRead])
def list_initiatives(
    status_filter: Optional[str] = Query(default=None),
    owner: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> List[models.ImprovementInitiative]:
    query = _initiative_query(db)
    if status_filter:
        query = query.filter(models.ImprovementInitiative.status == status_filter)
    if owner:
        query = query.filter(models.ImprovementInitiative.owner == owner)
    return query.order_by(models.ImprovementInitiative.created_at.desc()).all()


@router.post(
    "/", response_model=schemas.ImprovementInitiativeRead, status_code=status.HTTP_201_CREATED
)
def create_initiative(
    payload: schemas.InitiativeCreate, db: Session = Depends(get_db)
) -> models.ImprovementInitiative:
    initiative = models.ImprovementInitiative(
        name=payload.name,
        description=payload.description,
        owner=payload.owner,
        start_date=payload.start_date,
        target_metrics=payload.target_metrics,
        status=payload.status,
        health=payload.health,
    )
    db.add(initiative)
    db.commit()
    db.refresh(initiative)
    return initiative


@router.get("/{initiative_id}", response_model=schemas.ImprovementInitiativeRead)
def get_initiative(
    initiative_id: str, db: Session = Depends(get_db)
) -> models.ImprovementInitiative:
    initiative = _initiative_query(db).filter(models.ImprovementInitiative.id == initiative_id).first()
    if not initiative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initiative not found")
    return initiative


@router.patch("/{initiative_id}", response_model=schemas.ImprovementInitiativeRead)
def update_initiative(
    initiative_id: str,
    payload: schemas.InitiativeUpdate,
    db: Session = Depends(get_db),
) -> models.ImprovementInitiative:
    initiative = _initiative_query(db).filter(models.ImprovementInitiative.id == initiative_id).first()
    if not initiative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initiative not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(initiative, key, value)

    db.add(initiative)
    db.commit()
    db.refresh(initiative)
    return initiative


@router.post(
    "/{initiative_id}/progress",
    response_model=schemas.InitiativeProgressLogRead,
    status_code=status.HTTP_201_CREATED,
)
def add_progress_log(
    initiative_id: str,
    payload: schemas.InitiativeProgressLogCreate,
    db: Session = Depends(get_db),
) -> models.InitiativeProgressLog:
    initiative = db.get(models.ImprovementInitiative, initiative_id)
    if not initiative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initiative not found")

    log = models.InitiativeProgressLog(
        initiative_id=initiative_id,
        timestamp=payload.timestamp or datetime.now(timezone.utc),
        status=payload.status,
        notes=payload.notes,
        observed_metrics=payload.observed_metrics,
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get(
    "/{initiative_id}/progress", response_model=List[schemas.InitiativeProgressLogRead]
)
def list_progress_logs(
    initiative_id: str, db: Session = Depends(get_db)
) -> List[models.InitiativeProgressLog]:
    initiative = db.get(models.ImprovementInitiative, initiative_id)
    if not initiative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initiative not found")

    return (
        db.query(models.InitiativeProgressLog)
        .filter(models.InitiativeProgressLog.initiative_id == initiative_id)
        .order_by(models.InitiativeProgressLog.timestamp)
        .all()
    )


@router.get(
    "/{initiative_id}/cards", response_model=List[schemas.CardRead]
)
def list_initiative_cards(
    initiative_id: str, db: Session = Depends(get_db)
) -> List[models.Card]:
    initiative = db.get(models.ImprovementInitiative, initiative_id)
    if not initiative:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initiative not found")

    return (
        db.query(models.Card)
        .options(
            selectinload(models.Card.labels),
            selectinload(models.Card.subtasks),
            joinedload(models.Card.status),
        )
        .filter(models.Card.initiative_id == initiative_id)
        .order_by(models.Card.created_at.desc())
        .all()
    )
