from __future__ import annotations

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.status_defaults import ensure_default_statuses
from ..utils.repository import (
    apply_updates,
    delete_model,
    get_owned_resource_or_404,
    save_model,
)

router = APIRouter(prefix="/statuses", tags=["statuses"])


@router.get("/", response_model=list[schemas.StatusRead])
def list_statuses(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.Status]:
    _, created_or_updated = ensure_default_statuses(db, owner_id=current_user.id)
    if created_or_updated:
        db.commit()
    return (
        db.query(models.Status)
        .filter(models.Status.owner_id == current_user.id)
        .order_by(models.Status.order, models.Status.name)
        .all()
    )


@router.post("/", response_model=schemas.StatusRead, status_code=status.HTTP_201_CREATED)
def create_status(
    payload: schemas.StatusCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Status:
    status_model = models.Status(owner_id=current_user.id, **payload.model_dump())
    return save_model(db, status_model)


@router.put("/{status_id}", response_model=schemas.StatusRead)
def update_status(
    status_id: str,
    payload: schemas.StatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Status:
    status_model = get_owned_resource_or_404(
        db,
        models.Status,
        status_id,
        owner_id=current_user.id,
        detail="Status not found",
    )
    updates = payload.model_dump(exclude_unset=True)
    apply_updates(status_model, updates)
    return save_model(db, status_model)


@router.delete(
    "/{status_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_status(
    status_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    status_model = get_owned_resource_or_404(
        db,
        models.Status,
        status_id,
        owner_id=current_user.id,
        detail="Status not found",
    )

    templates = (
        db.query(models.WorkspaceTemplate)
        .filter(models.WorkspaceTemplate.owner_id == current_user.id)
        .filter(models.WorkspaceTemplate.default_status_id == status_id)
        .all()
    )
    for template in templates:
        template.default_status_id = None
        db.add(template)
    delete_model(db, status_model)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
