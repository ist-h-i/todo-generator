from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..utils.repository import (
    apply_updates,
    delete_model,
    get_owned_resource_or_404,
    save_model,
)

router = APIRouter(prefix="/labels", tags=["labels"])


@router.get("/", response_model=list[schemas.LabelRead])
def list_labels(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.Label]:
    return (
        db.query(models.Label)
        .filter(models.Label.owner_id == current_user.id)
        .order_by(models.Label.name)
        .all()
    )


@router.post("/", response_model=schemas.LabelRead, status_code=status.HTTP_201_CREATED)
def create_label(
    payload: schemas.LabelCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Label:
    label = models.Label(owner_id=current_user.id, **payload.model_dump())
    return save_model(db, label)


@router.put("/{label_id}", response_model=schemas.LabelRead)
def update_label(
    label_id: str,
    payload: schemas.LabelUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Label:
    label = get_owned_resource_or_404(
        db,
        models.Label,
        label_id,
        owner_id=current_user.id,
        detail="Label not found",
    )
    updates = payload.model_dump(exclude_unset=True)
    apply_updates(label, updates)
    return save_model(db, label)


@router.delete(
    "/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_label(
    label_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    label = get_owned_resource_or_404(
        db,
        models.Label,
        label_id,
        owner_id=current_user.id,
        detail="Label not found",
    )

    templates = (
        db.query(models.WorkspaceTemplate)
        .filter(models.WorkspaceTemplate.owner_id == current_user.id)
        .all()
    )
    for template in templates:
        label_ids = list(template.default_label_ids or [])
        if label_id in label_ids:
            template.default_label_ids = [value for value in label_ids if value != label_id]
            db.add(template)
    delete_model(db, label)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
