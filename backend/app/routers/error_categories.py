from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db

router = APIRouter(prefix="/error-categories", tags=["error-categories"])


@router.get("/", response_model=List[schemas.ErrorCategoryRead])
def list_error_categories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.ErrorCategory]:
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
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("/{category_id}", response_model=schemas.ErrorCategoryRead)
def get_error_category(
    category_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ErrorCategory:
    category = db.get(models.ErrorCategory, category_id)
    if not category or category.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")
    return category


@router.patch("/{category_id}", response_model=schemas.ErrorCategoryRead)
def update_error_category(
    category_id: str,
    payload: schemas.ErrorCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.ErrorCategory:
    category = db.get(models.ErrorCategory, category_id)
    if not category or category.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(category, key, value)

    db.add(category)
    db.commit()
    db.refresh(category)
    return category


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
    category = db.get(models.ErrorCategory, category_id)
    if not category or category.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Category not found")

    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
