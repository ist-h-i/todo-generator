from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..database import get_db
from ..utils.activity import record_activity

router = APIRouter(prefix="/cards", tags=["cards"])


def _card_query(db: Session):
    return (
        db.query(models.Card)
        .options(
            selectinload(models.Card.subtasks),
            selectinload(models.Card.labels),
            joinedload(models.Card.status),
        )
    )


@router.get("/", response_model=List[schemas.CardRead])
def list_cards(
    status_id: Optional[str] = Query(default=None),
    label_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> List[models.Card]:
    query = _card_query(db)
    if status_id:
        query = query.filter(models.Card.status_id == status_id)
    if label_id:
        query = query.join(models.Card.labels).filter(models.Label.id == label_id)
    if search:
        like_pattern = f"%{search.lower()}%"
        query = query.filter(
            func.lower(models.Card.title).like(like_pattern)
            | func.lower(models.Card.summary).like(like_pattern)
        )
    query = query.order_by(models.Card.created_at.desc())
    if label_id:
        query = query.distinct()
    return query.all()


@router.post("/", response_model=schemas.CardRead, status_code=status.HTTP_201_CREATED)
def create_card(payload: schemas.CardCreate, db: Session = Depends(get_db)) -> models.Card:
    card = models.Card(
        title=payload.title,
        summary=payload.summary,
        description=payload.description,
        status_id=payload.status_id,
        priority=payload.priority,
        story_points=payload.story_points,
        estimate_hours=payload.estimate_hours,
        assignees=payload.assignees,
        start_date=payload.start_date,
        due_date=payload.due_date,
        dependencies=payload.dependencies,
        ai_confidence=payload.ai_confidence,
        ai_notes=payload.ai_notes,
        custom_fields=payload.custom_fields,
    )

    if payload.label_ids:
        labels = (
            db.query(models.Label)
            .filter(models.Label.id.in_(payload.label_ids))
            .all()
        )
        card.labels = labels

    for subtask_data in payload.subtasks:
        card.subtasks.append(models.Subtask(**subtask_data.dict()))

    db.add(card)
    record_activity(db, action="card_created", card_id=card.id)
    db.commit()
    db.refresh(card)
    return card


@router.get("/{card_id}", response_model=schemas.CardRead)
def get_card(card_id: str, db: Session = Depends(get_db)) -> models.Card:
    card = (
        _card_query(db)
        .filter(models.Card.id == card_id)
        .order_by(models.Card.created_at.desc())
        .first()
    )
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    return card


@router.put("/{card_id}", response_model=schemas.CardRead)
def update_card(
    card_id: str, payload: schemas.CardUpdate, db: Session = Depends(get_db)
) -> models.Card:
    card = _card_query(db).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    update_data = payload.dict(exclude_unset=True)
    label_ids = update_data.pop("label_ids", None)

    for key, value in update_data.items():
        setattr(card, key, value)

    if label_ids is not None:
        labels = db.query(models.Label).filter(models.Label.id.in_(label_ids)).all()
        card.labels = labels

    db.add(card)
    record_activity(db, action="card_updated", card_id=card.id)
    db.commit()
    db.refresh(card)
    return card


@router.delete(
    "/{card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_card(card_id: str, db: Session = Depends(get_db)) -> Response:
    card = db.get(models.Card, card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    record_activity(db, action="card_deleted", card_id=card.id)
    db.delete(card)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{card_id}/subtasks", response_model=List[schemas.SubtaskRead])
def list_subtasks(card_id: str, db: Session = Depends(get_db)) -> List[models.Subtask]:
    card = db.get(models.Card, card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    return (
        db.query(models.Subtask)
        .filter(models.Subtask.card_id == card_id)
        .order_by(models.Subtask.created_at)
        .all()
    )


@router.post(
    "/{card_id}/subtasks",
    response_model=schemas.SubtaskRead,
    status_code=status.HTTP_201_CREATED,
)
def create_subtask(
    card_id: str, payload: schemas.SubtaskCreate, db: Session = Depends(get_db)
) -> models.Subtask:
    card = db.get(models.Card, card_id)
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    subtask = models.Subtask(card_id=card_id, **payload.dict())
    db.add(subtask)
    record_activity(
        db,
        action="subtask_created",
        card_id=card_id,
        details={"subtask_id": subtask.id},
    )
    db.commit()
    db.refresh(subtask)
    return subtask


@router.put("/{card_id}/subtasks/{subtask_id}", response_model=schemas.SubtaskRead)
def update_subtask(
    card_id: str,
    subtask_id: str,
    payload: schemas.SubtaskUpdate,
    db: Session = Depends(get_db),
) -> models.Subtask:
    subtask = db.get(models.Subtask, subtask_id)
    if not subtask or subtask.card_id != card_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(subtask, key, value)

    db.add(subtask)
    record_activity(
        db,
        action="subtask_updated",
        card_id=card_id,
        details={"subtask_id": subtask.id},
    )
    db.commit()
    db.refresh(subtask)
    return subtask


@router.delete(
    "/{card_id}/subtasks/{subtask_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_subtask(
    card_id: str, subtask_id: str, db: Session = Depends(get_db)
) -> Response:
    subtask = db.get(models.Subtask, subtask_id)
    if not subtask or subtask.card_id != card_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    record_activity(
        db,
        action="subtask_deleted",
        card_id=card_id,
        details={"subtask_id": subtask.id},
    )
    db.delete(subtask)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
