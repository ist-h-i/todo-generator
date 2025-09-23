from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/labels", tags=["labels"])


@router.get("/", response_model=List[schemas.LabelRead])
def list_labels(db: Session = Depends(get_db)) -> List[models.Label]:
    return db.query(models.Label).order_by(models.Label.name).all()


@router.post("/", response_model=schemas.LabelRead, status_code=status.HTTP_201_CREATED)
def create_label(payload: schemas.LabelCreate, db: Session = Depends(get_db)) -> models.Label:
    label = models.Label(**payload.model_dump())
    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.put("/{label_id}", response_model=schemas.LabelRead)
def update_label(label_id: str, payload: schemas.LabelUpdate, db: Session = Depends(get_db)) -> models.Label:
    label = db.get(models.Label, label_id)
    if not label:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(label, key, value)

    db.add(label)
    db.commit()
    db.refresh(label)
    return label


@router.delete(
    "/{label_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_label(label_id: str, db: Session = Depends(get_db)) -> Response:
    label = db.get(models.Label, label_id)
    if not label:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")

    db.delete(label)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
