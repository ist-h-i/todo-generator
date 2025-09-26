from __future__ import annotations

from typing import List, Optional, Sequence, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import asc
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..utils.activity import record_activity

router = APIRouter(prefix="/comments", tags=["comments"])


def _serialize_comment(
    comment: models.Comment,
    author_nickname: Optional[str],
    author_email: Optional[str] = None,
) -> schemas.CommentRead:
    display_name = author_nickname or author_email
    return schemas.CommentRead(
        id=comment.id,
        card_id=comment.card_id,
        subtask_id=comment.subtask_id,
        content=comment.content,
        author_id=comment.author_id,
        author_nickname=display_name,
        created_at=comment.created_at,
        updated_at=comment.updated_at,
    )


@router.get("/", response_model=List[schemas.CommentRead])
def list_comments(
    card_id: Optional[str] = Query(default=None),
    subtask_id: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[schemas.CommentRead]:
    query = (
        db.query(models.Comment, models.User.nickname, models.User.email)
        .join(models.Card, models.Comment.card_id == models.Card.id)
        .outerjoin(models.User, models.Comment.author_id == models.User.id)
        .filter(models.Card.owner_id == current_user.id)
    )
    if card_id:
        query = query.filter(models.Comment.card_id == card_id)
    if subtask_id:
        query = query.filter(models.Comment.subtask_id == subtask_id)
    rows: Sequence[Tuple[models.Comment, Optional[str], Optional[str]]] = query.order_by(
        asc(models.Comment.created_at)
    ).all()
    return [_serialize_comment(comment, nickname, email) for comment, nickname, email in rows]


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
    nickname = current_user.nickname or current_user.email
    return _serialize_comment(comment, nickname, current_user.email)


@router.put("/{comment_id}", response_model=schemas.CommentRead)
def update_comment(
    comment_id: str,
    payload: schemas.CommentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.CommentRead:
    comment = db.get(models.Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    card = db.get(models.Card, comment.card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")

    if "content" in payload.model_fields_set and payload.content is not None:
        comment.content = payload.content

    if "subtask_id" in payload.model_fields_set:
        subtask_identifier = payload.subtask_id
        if subtask_identifier is None:
            comment.subtask_id = None
        else:
            subtask = db.get(models.Subtask, subtask_identifier)
            if not subtask or subtask.card_id != card.id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Subtask not found",
                )
            comment.subtask_id = subtask_identifier

    record_activity(
        db,
        action="comment_updated",
        card_id=comment.card_id,
        actor_id=current_user.id,
        details={"comment_id": comment.id, "subtask_id": comment.subtask_id},
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)

    author = db.get(models.User, comment.author_id) if comment.author_id else None
    nickname = author.nickname if author and author.nickname else None
    email = author.email if author else current_user.email
    if not nickname and not email:
        email = current_user.email

    return _serialize_comment(comment, nickname, email)


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
