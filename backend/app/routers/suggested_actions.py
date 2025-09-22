from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..utils.activity import record_activity

router = APIRouter(prefix="/suggested-actions", tags=["suggested-actions"])


@router.get("/", response_model=List[schemas.SuggestedActionRead])
def list_suggested_actions(
    analysis_id: Optional[str] = Query(default=None),
    node_id: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> List[models.SuggestedAction]:
    query = db.query(models.SuggestedAction)
    if analysis_id:
        query = query.filter(models.SuggestedAction.analysis_id == analysis_id)
    if node_id:
        query = query.filter(models.SuggestedAction.node_id == node_id)
    if status_filter:
        query = query.filter(models.SuggestedAction.status == status_filter)
    return query.order_by(models.SuggestedAction.created_at.desc()).all()


@router.get("/{action_id}", response_model=schemas.SuggestedActionRead)
def get_suggested_action(
    action_id: str, db: Session = Depends(get_db)
) -> models.SuggestedAction:
    suggestion = db.get(models.SuggestedAction, action_id)
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    return suggestion


@router.patch("/{action_id}", response_model=schemas.SuggestedActionRead)
def update_suggested_action(
    action_id: str,
    payload: schemas.SuggestedActionUpdate,
    db: Session = Depends(get_db),
) -> models.SuggestedAction:
    suggestion = db.get(models.SuggestedAction, action_id)
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(suggestion, key, value)

    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)
    return suggestion


@router.post(
    "/{action_id}/convert",
    response_model=schemas.SuggestionConversionResponse,
    status_code=status.HTTP_201_CREATED,
)
def convert_suggested_action(
    action_id: str,
    payload: schemas.SuggestionConversionRequest,
    db: Session = Depends(get_db),
) -> schemas.SuggestionConversionResponse:
    suggestion = db.get(models.SuggestedAction, action_id)
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")

    title = payload.title or suggestion.title
    if not title:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Title required")

    summary = payload.summary or suggestion.description
    description = payload.description or suggestion.description
    due_date = payload.due_date or suggestion.due_date_hint
    initiative_id = payload.initiative_id or suggestion.initiative_id

    card = models.Card(
        title=title,
        summary=summary,
        description=description,
        status_id=payload.status_id,
        priority=payload.priority,
        assignees=payload.assignees,
        due_date=due_date,
        initiative_id=initiative_id,
        error_category_id=payload.error_category_id,
        analytics_notes=f"Converted from suggestion {suggestion.id}",
    )

    if payload.label_ids:
        labels = (
            db.query(models.Label)
            .filter(models.Label.id.in_(payload.label_ids))
            .all()
        )
        card.labels = labels

    if not card.custom_fields:
        card.custom_fields = {}
    card.custom_fields["origin_suggestion_id"] = suggestion.id

    db.add(card)
    db.flush()

    suggestion.status = "converted"
    suggestion.created_card_id = card.id
    if initiative_id:
        suggestion.initiative_id = initiative_id

    db.add(suggestion)
    record_activity(
        db,
        action="suggestion_converted",
        card_id=card.id,
        details={"suggestion_id": suggestion.id},
    )
    db.commit()
    db.refresh(card)
    db.refresh(suggestion)
    return schemas.SuggestionConversionResponse(card=card, suggestion=suggestion)
