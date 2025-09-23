from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/filters", tags=["filters"])


@router.get("/", response_model=List[schemas.SavedFilterRead])
def list_filters(
    owner_id: Optional[str] = Query(default=None),
    shared: Optional[bool] = Query(default=None),
    db: Session = Depends(get_db),
) -> List[models.SavedFilter]:
    query = db.query(models.SavedFilter)
    if owner_id:
        query = query.filter(models.SavedFilter.created_by == owner_id)
    if shared is not None:
        query = query.filter(models.SavedFilter.shared == shared)
    return query.order_by(models.SavedFilter.created_at.desc()).all()


@router.post("/", response_model=schemas.SavedFilterRead, status_code=status.HTTP_201_CREATED)
def create_filter(payload: schemas.SavedFilterCreate, db: Session = Depends(get_db)) -> models.SavedFilter:
    saved_filter = models.SavedFilter(
        name=payload.name,
        definition=payload.definition,
        shared=payload.shared,
        created_by=payload.created_by,
    )
    db.add(saved_filter)
    db.commit()
    db.refresh(saved_filter)
    return saved_filter


@router.get("/{filter_id}", response_model=schemas.SavedFilterRead)
def get_filter(filter_id: str, db: Session = Depends(get_db)) -> models.SavedFilter:
    saved_filter = db.get(models.SavedFilter, filter_id)
    if not saved_filter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter not found")
    return saved_filter


@router.put("/{filter_id}", response_model=schemas.SavedFilterRead)
@router.patch("/{filter_id}", response_model=schemas.SavedFilterRead)
def update_filter(
    filter_id: str,
    payload: schemas.SavedFilterUpdate,
    db: Session = Depends(get_db),
) -> models.SavedFilter:
    saved_filter = db.get(models.SavedFilter, filter_id)
    if not saved_filter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(saved_filter, key, value)

    db.add(saved_filter)
    db.commit()
    db.refresh(saved_filter)
    return saved_filter


@router.delete(
    "/{filter_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_filter(filter_id: str, db: Session = Depends(get_db)) -> Response:
    saved_filter = db.get(models.SavedFilter, filter_id)
    if not saved_filter:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Filter not found")

    db.delete(saved_filter)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
