from __future__ import annotations

import re
from datetime import date, datetime, timedelta, timezone
from typing import Iterable, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, insert, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..utils.activity import record_activity

DAILY_CARD_CREATION_LIMIT = 25
_DAILY_CARD_LIMIT_MESSAGE = (
    f"Daily card creation limit of {DAILY_CARD_CREATION_LIMIT} reached."
)


def _reserve_daily_card_quota(db: Session, *, owner_id: str, quota_day: date) -> None:
    quota_cls = models.DailyCardQuota

    def _try_increment() -> bool:
        result = db.execute(
            update(quota_cls)
            .where(
                quota_cls.owner_id == owner_id,
                quota_cls.quota_date == quota_day,
                quota_cls.created_count < DAILY_CARD_CREATION_LIMIT,
            )
            .values(created_count=quota_cls.created_count + 1)
        )
        return bool(result.rowcount)

    if _try_increment():
        return

    dialect_name = db.bind.dialect.name if db.bind else ""
    if dialect_name == "sqlite":
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert

        insert_stmt = (
            sqlite_insert(quota_cls)
            .values(owner_id=owner_id, quota_date=quota_day, created_count=1)
            .on_conflict_do_nothing(
                index_elements=[quota_cls.owner_id, quota_cls.quota_date]
            )
        )
    elif dialect_name == "postgresql":
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        insert_stmt = (
            pg_insert(quota_cls)
            .values(owner_id=owner_id, quota_date=quota_day, created_count=1)
            .on_conflict_do_nothing(
                index_elements=[quota_cls.owner_id, quota_cls.quota_date]
            )
        )
    else:
        insert_stmt = insert(quota_cls).values(
            owner_id=owner_id,
            quota_date=quota_day,
            created_count=1,
        )

    try:
        insert_result = db.execute(insert_stmt)
    except IntegrityError:
        db.rollback()
    else:
        if insert_result.rowcount:
            return

    if _try_increment():
        return

    existing_count = db.execute(
        select(quota_cls.created_count).where(
            quota_cls.owner_id == owner_id,
            quota_cls.quota_date == quota_day,
        )
    ).scalar_one_or_none()

    if existing_count is None or existing_count < DAILY_CARD_CREATION_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to reserve daily card quota.",
        )

    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=_DAILY_CARD_LIMIT_MESSAGE,
    )


router = APIRouter(prefix="/cards", tags=["cards"])


def _card_query(db: Session, *, owner_id: Optional[str] = None):
    query = db.query(models.Card).options(
        selectinload(models.Card.subtasks),
        selectinload(models.Card.labels),
        joinedload(models.Card.status),
        joinedload(models.Card.error_category),
        joinedload(models.Card.initiative),
    )

    if owner_id:
        query = query.filter(models.Card.owner_id == owner_id)

    return query


def _ensure_owned_status(db: Session, *, status_id: str, owner_id: str) -> None:
    status = db.get(models.Status, status_id)
    if not status or status.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Status not found")


def _ensure_owned_error_category(db: Session, *, category_id: str, owner_id: str) -> None:
    category = db.get(models.ErrorCategory, category_id)
    if not category or category.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Error category not found")


def _ensure_owned_initiative(db: Session, *, initiative_id: str, owner_id: str) -> None:
    initiative = db.get(models.ImprovementInitiative, initiative_id)
    if not initiative or initiative.owner_id != owner_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Initiative not found")


def _load_owned_labels(db: Session, *, label_ids: list[str], owner_id: str) -> list[models.Label]:
    if not label_ids:
        return []

    unique_ids = list({label_id for label_id in label_ids})
    labels = (
        db.query(models.Label)
        .filter(models.Label.id.in_(unique_ids), models.Label.owner_id == owner_id)
        .all()
    )
    if len(labels) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    return labels


def _derive_created_from(time_range: str) -> Optional[datetime]:
    value = (time_range or "").strip().lower()
    if not value:
        return None

    now = datetime.now(timezone.utc)
    if value.endswith("d") and value[:-1].isdigit():
        return now - timedelta(days=int(value[:-1]))
    if value.endswith("w") and value[:-1].isdigit():
        return now - timedelta(weeks=int(value[:-1]))
    if value.endswith("h") and value[:-1].isdigit():
        return now - timedelta(hours=int(value[:-1]))
    if value in {"month", "30d"}:
        return now - timedelta(days=30)
    if value in {"quarter", "90d"}:
        return now - timedelta(days=90)
    if value in {"year", "365d", "12m"}:
        return now - timedelta(days=365)
    return None


def _normalize_words(*texts: Optional[str]) -> set[str]:
    words: set[str] = set()
    for text in texts:
        if not text:
            continue
        words.update(re.findall(r"[a-z0-9]+", text.lower()))
    return words


def _text_similarity(left: Optional[str], right: Optional[str]) -> float:
    left_words = _normalize_words(left)
    right_words = _normalize_words(right)
    if not left_words or not right_words:
        return 0.0
    intersection = left_words.intersection(right_words)
    if not intersection:
        return 0.0
    union = left_words.union(right_words)
    return len(intersection) / len(union)


def _score_card_similarity(base: models.Card, candidate: models.Card) -> float:
    if base.id == candidate.id:
        return 0.0

    label_ids_base = {label.id for label in base.labels}
    label_ids_candidate = {label.id for label in candidate.labels}
    label_similarity = 0.0
    if label_ids_base and label_ids_candidate:
        shared = label_ids_base.intersection(label_ids_candidate)
        if shared:
            label_similarity = len(shared) / len(label_ids_base.union(label_ids_candidate))

    text_similarity = max(
        _text_similarity(base.title, candidate.title),
        _text_similarity(base.summary, candidate.summary),
        _text_similarity(base.description, candidate.description),
    )

    score = 0.45 * text_similarity + 0.35 * label_similarity

    if base.status_id and base.status_id == candidate.status_id:
        score += 0.05
    if base.priority and base.priority == candidate.priority:
        score += 0.05
    if base.error_category_id and base.error_category_id == candidate.error_category_id:
        score += 0.1

    return float(min(score, 1.0))


def _score_subtask_similarity(card: models.Card, subtask: models.Subtask) -> float:
    base_text = " ".join(filter(None, [card.title, card.summary or "", card.description or ""]))
    subtask_text = " ".join(filter(None, [subtask.title, subtask.description or ""]))
    text_similarity = _text_similarity(base_text, subtask_text)
    priority_bonus = 0.05 if subtask.priority and subtask.priority == card.priority else 0.0
    return float(min(0.7 * text_similarity + priority_bonus, 1.0))


@router.get("/", response_model=List[schemas.CardRead])
def list_cards(
    status_id: Optional[str] = Query(default=None),
    label_id: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    status_ids: Optional[List[str]] = Query(default=None),
    label_ids: Optional[List[str]] = Query(default=None),
    assignees: Optional[List[str]] = Query(default=None),
    priority: Optional[str] = Query(default=None),
    priorities: Optional[List[str]] = Query(default=None),
    error_category_id: Optional[str] = Query(default=None),
    initiative_id: Optional[str] = Query(default=None),
    created_from: Optional[datetime] = Query(default=None),
    created_to: Optional[datetime] = Query(default=None),
    due_from: Optional[datetime] = Query(default=None),
    due_to: Optional[datetime] = Query(default=None),
    time_range: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.Card]:
    query = _card_query(db, owner_id=current_user.id)

    effective_status_ids = set(status_ids or [])
    if status_id:
        effective_status_ids.add(status_id)
    if effective_status_ids:
        query = query.filter(models.Card.status_id.in_(effective_status_ids))

    effective_label_ids = set(label_ids or [])
    if label_id:
        effective_label_ids.add(label_id)
    if effective_label_ids:
        query = query.join(models.Card.labels).filter(models.Label.id.in_(effective_label_ids))
        query = query.distinct()

    if priority:
        query = query.filter(models.Card.priority == priority)
    if priorities:
        query = query.filter(models.Card.priority.in_(priorities))
    if error_category_id:
        query = query.filter(models.Card.error_category_id == error_category_id)
    if initiative_id:
        query = query.filter(models.Card.initiative_id == initiative_id)

    if time_range and not created_from:
        derived_from = _derive_created_from(time_range)
        if derived_from:
            created_from = derived_from

    if created_from:
        query = query.filter(models.Card.created_at >= created_from)
    if created_to:
        query = query.filter(models.Card.created_at <= created_to)
    if due_from:
        query = query.filter(models.Card.due_date >= due_from)
    if due_to:
        query = query.filter(models.Card.due_date <= due_to)

    if search:
        like_pattern = f"%{search.lower()}%"
        query = query.outerjoin(models.Comment, models.Comment.card_id == models.Card.id)
        query = query.filter(
            or_(
                func.lower(models.Card.title).like(like_pattern),
                func.lower(models.Card.summary).like(like_pattern),
                func.lower(models.Card.description).like(like_pattern),
                func.lower(models.Card.ai_notes).like(like_pattern),
                func.lower(models.Card.analytics_notes).like(like_pattern),
                func.lower(models.Comment.content).like(like_pattern),
            )
        )
        query = query.distinct()

    cards = query.order_by(models.Card.created_at.desc()).all()

    if assignees:
        wanted = set(assignees)
        cards = [card for card in cards if wanted.intersection(set(card.assignees or []))]

    return cards


@router.post("/", response_model=schemas.CardRead, status_code=status.HTTP_201_CREATED)
def create_card(
    payload: schemas.CardCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Card:
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(days=1)

    created_count = (
        db.query(func.count(models.Card.id))
        .filter(
            models.Card.owner_id == current_user.id,
            models.Card.created_at >= window_start,
        )
        .scalar()
    ) or 0

    if created_count >= DAILY_CARD_CREATION_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_DAILY_CARD_LIMIT_MESSAGE,
        )

    if payload.status_id:
        _ensure_owned_status(db, status_id=payload.status_id, owner_id=current_user.id)
    if payload.error_category_id:
        _ensure_owned_error_category(
            db, category_id=payload.error_category_id, owner_id=current_user.id
        )
    if payload.initiative_id:
        _ensure_owned_initiative(
            db, initiative_id=payload.initiative_id, owner_id=current_user.id
        )

    labels = _load_owned_labels(
        db, label_ids=list(payload.label_ids or []), owner_id=current_user.id
    )

    card = models.Card(
        title=payload.title,
        summary=payload.summary,
        description=payload.description,
        status_id=payload.status_id,
        priority=payload.priority,
        story_points=payload.story_points,
        estimate_hours=payload.estimate_hours,
        assignees=payload.assignees,
        start_date=payload.start_date,
        due_date=payload.due_date,
        dependencies=payload.dependencies,
        ai_confidence=payload.ai_confidence,
        ai_notes=payload.ai_notes,
        custom_fields=payload.custom_fields,
        error_category_id=payload.error_category_id,
        initiative_id=payload.initiative_id,
        analytics_notes=payload.analytics_notes,
        owner=current_user,
    )

    if labels:
        card.labels = labels

    for subtask_data in payload.subtasks:
        card.subtasks.append(models.Subtask(**subtask_data.model_dump()))

    db.add(card)
    record_activity(db, action="card_created", card_id=card.id, actor_id=current_user.id)
    db.commit()
    db.refresh(card)
    return card


@router.get("/{card_id}", response_model=schemas.CardRead)
def get_card(
    card_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Card:
    card = (
        _card_query(db, owner_id=current_user.id)
        .filter(models.Card.id == card_id)
        .order_by(models.Card.created_at.desc())
        .first()
    )
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    return card


@router.put("/{card_id}", response_model=schemas.CardRead)
def update_card(
    card_id: str,
    payload: schemas.CardUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Card:
    card = _card_query(db, owner_id=current_user.id).filter(models.Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    update_data = payload.model_dump(exclude_unset=True)
    label_ids = update_data.pop("label_ids", None)

    if "status_id" in update_data and update_data["status_id"]:
        _ensure_owned_status(db, status_id=update_data["status_id"], owner_id=current_user.id)
    if "error_category_id" in update_data and update_data["error_category_id"]:
        _ensure_owned_error_category(
            db, category_id=update_data["error_category_id"], owner_id=current_user.id
        )
    if "initiative_id" in update_data and update_data["initiative_id"]:
        _ensure_owned_initiative(
            db, initiative_id=update_data["initiative_id"], owner_id=current_user.id
        )

    for key, value in update_data.items():
        setattr(card, key, value)

    if label_ids is not None:
        labels = _load_owned_labels(
            db, label_ids=list(label_ids or []), owner_id=current_user.id
        )
        card.labels = labels

    db.add(card)
    record_activity(db, action="card_updated", card_id=card.id, actor_id=current_user.id)
    db.commit()
    db.refresh(card)
    return card


@router.delete(
    "/{card_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_card(
    card_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    card = db.get(models.Card, card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    record_activity(db, action="card_deleted", card_id=card.id, actor_id=current_user.id)
    db.delete(card)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{card_id}/subtasks", response_model=List[schemas.SubtaskRead])
def list_subtasks(
    card_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> List[models.Subtask]:
    card = db.get(models.Card, card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    return db.query(models.Subtask).filter(models.Subtask.card_id == card_id).order_by(models.Subtask.created_at).all()


@router.post(
    "/{card_id}/subtasks",
    response_model=schemas.SubtaskRead,
    status_code=status.HTTP_201_CREATED,
)
def create_subtask(
    card_id: str,
    payload: schemas.SubtaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Subtask:
    card = db.get(models.Card, card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    subtask = models.Subtask(card_id=card_id, **payload.model_dump())
    db.add(subtask)
    record_activity(
        db,
        action="subtask_created",
        card_id=card_id,
        actor_id=current_user.id,
        details={"subtask_id": subtask.id},
    )
    db.commit()
    db.refresh(subtask)
    return subtask


@router.put("/{card_id}/subtasks/{subtask_id}", response_model=schemas.SubtaskRead)
def update_subtask(
    card_id: str,
    subtask_id: str,
    payload: schemas.SubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Subtask:
    card = db.get(models.Card, card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    subtask = db.get(models.Subtask, subtask_id)
    if not subtask or subtask.card_id != card_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(subtask, key, value)

    db.add(subtask)
    record_activity(
        db,
        action="subtask_updated",
        card_id=card_id,
        actor_id=current_user.id,
        details={"subtask_id": subtask.id},
    )
    db.commit()
    db.refresh(subtask)
    return subtask


@router.delete(
    "/{card_id}/subtasks/{subtask_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_subtask(
    card_id: str,
    subtask_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    card = db.get(models.Card, card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    subtask = db.get(models.Subtask, subtask_id)
    if not subtask or subtask.card_id != card_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    record_activity(
        db,
        action="subtask_deleted",
        card_id=card_id,
        actor_id=current_user.id,
        details={"subtask_id": subtask.id},
    )
    db.delete(subtask)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _build_similar_items(base_card: models.Card, candidates: Iterable[models.Card]) -> List[schemas.SimilarItem]:
    items: List[schemas.SimilarItem] = []
    for candidate in candidates:
        score = _score_card_similarity(base_card, candidate)
        if score <= 0:
            continue
        summary = candidate.summary or candidate.description
        items.append(
            schemas.SimilarItem(
                id=candidate.id,
                type="card",
                title=candidate.title,
                similarity=round(score, 4),
                labels=[label.name for label in candidate.labels],
                status=candidate.status.name if candidate.status else None,
                summary=summary,
                quick_actions=["open", "link", "duplicate"],
                related_card_id=candidate.id,
            )
        )

        for subtask in candidate.subtasks:
            sub_score = _score_subtask_similarity(base_card, subtask)
            if sub_score <= 0:
                continue
            items.append(
                schemas.SimilarItem(
                    id=subtask.id,
                    type="subtask",
                    title=subtask.title,
                    similarity=round(min(1.0, sub_score), 4),
                    labels=[label.name for label in candidate.labels],
                    status=subtask.status,
                    summary=subtask.description,
                    quick_actions=["open", "link", "promote"],
                    related_card_id=candidate.id,
                    related_subtask_id=subtask.id,
                )
            )
    items.sort(key=lambda item: item.similarity, reverse=True)
    return items


@router.get("/{card_id}/similar", response_model=schemas.SimilarItemsResponse)
def get_similar_items(
    card_id: str,
    limit: int = Query(default=8, ge=1, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.SimilarItemsResponse:
    base_card = _card_query(db, owner_id=current_user.id).filter(models.Card.id == card_id).first()
    if not base_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    candidates = (
        _card_query(db, owner_id=current_user.id)
        .filter(models.Card.id != card_id)
        .order_by(models.Card.created_at.desc())
        .all()
    )
    items = _build_similar_items(base_card, candidates)
    return schemas.SimilarItemsResponse(items=items[:limit])


@router.post(
    "/{card_id}/similar/{related_id}/feedback",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def record_similarity_feedback(
    card_id: str,
    related_id: str,
    payload: schemas.SimilarityFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    card = db.get(models.Card, card_id)
    if not card or card.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")

    if payload.related_type == "card":
        related_card = db.get(models.Card, related_id)
        if not related_card or related_card.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Related card not found")
    elif payload.related_type == "subtask":
        subtask = db.get(models.Subtask, related_id)
        if not subtask:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Related subtask not found")
        related_card = db.get(models.Card, subtask.card_id)
        if not related_card or related_card.owner_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Related subtask not found")

    feedback = models.SimilarityFeedback(
        card_id=card_id,
        related_id=related_id,
        related_type=payload.related_type,
        is_relevant=payload.is_relevant,
        notes=payload.notes,
    )
    db.add(feedback)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
