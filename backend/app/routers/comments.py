from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import asc
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..utils.activity import record_activity

router = APIRouter(prefix="/comments", tags=["comments"])


@router.get("/", response_model=List[schemas.CommentRead])
def list_comments(
    card_id: Optional[str] = Query(default=None),
    subtask_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.Comment]:
    query = (
        db.query(models.Comment)
        .join(models.Card, models.Comment.card_id == models.Card.id)
        .filter(models.Card.owner_id == current_user.id)
    )
    if card_id:
        query = query.filter(models.Comment.card_id == card_id)
    if subtask_id:
        query = query.filter(models.Comment.subtask_id == subtask_id)
    return query.order_by(asc(models.Comment.created_at)).all()


@router.post("/", response_model=schemas.CommentRead, status_code=status.HTTP_201_CREATED)
def create_comment(
    payload: schemas.CommentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Comment:
    card = db.get(models.Card, payload.card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    subtask_id = payload.subtask_id
    if subtask_id:
        subtask = db.get(models.Subtask, subtask_id)
        if not subtask or subtask.card_id != card.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subtask not found",
            )

    comment = models.Comment(
        card_id=payload.card_id,
        subtask_id=subtask_id,
        content=payload.content,
        author_id=current_user.id,
    )
    db.add(comment)
    record_activity(
        db,
        action="comment_created",
        card_id=payload.card_id,
        actor_id=current_user.id,
        details={"comment_id": comment.id, "subtask_id": subtask_id},
    )
    db.commit()
    db.refresh(comment)
    return comment


@router.delete(
    "/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_comment(
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    comment = db.get(models.Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    card = db.get(models.Card, comment.card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    record_activity(
        db,
        action="comment_deleted",
        card_id=comment.card_id,
        actor_id=current_user.id,
        details={"comment_id": comment.id, "subtask_id": comment.subtask_id},
    )
    db.delete(comment)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
