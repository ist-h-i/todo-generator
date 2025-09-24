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

router = APIRouter(prefix="/error-categories", tags=["error-categories"])


@router.get("/", response_model=list[schemas.ErrorCategoryRead])
def list_error_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.ErrorCategory]:
    return (
        db.query(models.ErrorCategory)
        .filter(models.ErrorCategory.owner_id == current_user.id)
        .order_by(models.ErrorCategory.name)
        .all()
    )


@router.post("/", response_model=schemas.ErrorCategoryRead, status_code=status.HTTP_201_CREATED)
def create_error_category(
    payload: schemas.ErrorCategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ErrorCategory:
    category = models.ErrorCategory(
        name=payload.name,
        description=payload.description,
        severity_level=payload.severity_level,
        owner_id=current_user.id,
    )
    return save_model(db, category)


@router.get("/{category_id}", response_model=schemas.ErrorCategoryRead)
def get_error_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ErrorCategory:
    return get_owned_resource_or_404(
        db,
        models.ErrorCategory,
        category_id,
        owner_id=current_user.id,
        detail="Category not found",
    )


@router.patch("/{category_id}", response_model=schemas.ErrorCategoryRead)
def update_error_category(
    category_id: str,
    payload: schemas.ErrorCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ErrorCategory:
    category = get_owned_resource_or_404(
        db,
        models.ErrorCategory,
        category_id,
        owner_id=current_user.id,
        detail="Category not found",
    )
    updates = payload.model_dump(exclude_unset=True)
    apply_updates(category, updates)
    return save_model(db, category)


@router.delete(
    "/{category_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_error_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    category = get_owned_resource_or_404(
        db,
        models.ErrorCategory,
        category_id,
        owner_id=current_user.id,
        detail="Category not found",
    )
    delete_model(db, category)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
