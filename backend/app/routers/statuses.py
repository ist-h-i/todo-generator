from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/statuses", tags=["statuses"])


@router.get("/", response_model=List[schemas.StatusRead])
def list_statuses(db: Session = Depends(get_db)) -> List[models.Status]:
    return db.query(models.Status).order_by(models.Status.order, models.Status.name).all()


@router.post("/", response_model=schemas.StatusRead, status_code=status.HTTP_201_CREATED)
def create_status(payload: schemas.StatusCreate, db: Session = Depends(get_db)) -> models.Status:
    status_model = models.Status(**payload.model_dump())
    db.add(status_model)
    db.commit()
    db.refresh(status_model)
    return status_model


@router.put("/{status_id}", response_model=schemas.StatusRead)
def update_status(status_id: str, payload: schemas.StatusUpdate, db: Session = Depends(get_db)) -> models.Status:
    status_model = db.get(models.Status, status_id)
    if not status_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(status_model, key, value)

    db.add(status_model)
    db.commit()
    db.refresh(status_model)
    return status_model


@router.delete(
    "/{status_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_status(status_id: str, db: Session = Depends(get_db)) -> Response:
    status_model = db.get(models.Status, status_id)
    if not status_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")

    db.delete(status_model)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
