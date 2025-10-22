from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Iterable, Mapping

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload, selectinload

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.card_limits import reserve_daily_card_quota
from ..services.profile import build_user_profile
from ..services.recommendation_scoring import (
    RecommendationScore,
    RecommendationScoringService,
)
from ..utils.activity import record_activity
from ..utils.quotas import get_card_daily_limit
from ..utils.repository import (
    apply_updates,
    delete_model,
    ensure_optional_owned_resource,
    get_owned_resource_or_404,
    get_resource_or_404,
)

router = APIRouter(prefix="/cards", tags=["cards"])

_scoring_service = RecommendationScoringService()


_FALLBACK_LABEL_COLOURS = [
    "#38bdf8",
    "#a855f7",
    "#ec4899",
    "#f97316",
    "#14b8a6",
    "#eab308",
    "#6366f1",
]


def _next_label_colour(index: int) -> str:
    if not _FALLBACK_LABEL_COLOURS:
        return "#38bdf8"
    return _FALLBACK_LABEL_COLOURS[index % len(_FALLBACK_LABEL_COLOURS)]


def _normalize_token(value: str | None) -> str:
    return (value or "").strip().lower()


def _canonicalize_assignees(db: Session, inputs: Iterable[str | None]) -> list[str]:
    """Map incoming assignee labels (email/nickname/id) to stable user IDs.

    - If a value equals an existing `users.id`, keep that id.
    - Else if it matches a user's email (case-insensitive), map to that id.
    - Else if it matches a user's nickname (case-insensitive) and the nickname is unique, map to that id.
    - Otherwise, preserve the original non-empty value.
    """
    raw_values = [v for v in (s.strip() if isinstance(s, str) else None for s in inputs) if v]
    if not raw_values:
        return []

    unique_values = list(dict.fromkeys(raw_values))

    # 1) Match by id
    id_matches = {
        user.id: user.id
        for user in db.query(models.User).filter(models.User.id.in_(unique_values)).all()
    }

    # 2) Match by email (normalized)
    normalized = {_normalize_token(v) for v in unique_values}
    email_candidates = (
        db.query(models.User)
        .filter(func.lower(func.trim(models.User.email)).in_(normalized))
        .all()
    )
    email_lookup: dict[str, str] = {
        _normalize_token(user.email): user.id for user in email_candidates
    }

    # 3) Match by nickname (normalized) — only when unique
    nickname_candidates = (
        db.query(models.User)
        .filter(models.User.nickname.is_not(None))
        .filter(func.lower(func.trim(models.User.nickname)).in_(normalized))
        .all()
    )
    nickname_buckets: dict[str, set[str]] = {}
    for user in nickname_candidates:
        key = _normalize_token(user.nickname)
        nickname_buckets.setdefault(key, set()).add(user.id)
    nickname_lookup: dict[str, str] = {
        key: next(iter(ids)) for key, ids in nickname_buckets.items() if len(ids) == 1
    }

    results: list[str] = []
    for value in raw_values:
        if value in id_matches:
            results.append(id_matches[value])
            continue
        normalized_value = _normalize_token(value)
        if normalized_value in email_lookup:
            results.append(email_lookup[normalized_value])
            continue
        if normalized_value in nickname_lookup:
            results.append(nickname_lookup[normalized_value])
            continue
        results.append(value)

    return results


def _canonicalize_single_assignee(db: Session, value: str | None) -> str | None:
    mapped = _canonicalize_assignees(db, [value] if value else [])
    return mapped[0] if mapped else None


def _resolve_display_names(db: Session, user_ids: Iterable[str]) -> Mapping[str, str]:
    """Return map of user_id -> display label (nickname preferred, else email)."""
    unique_ids = list({uid for uid in user_ids if isinstance(uid, str) and uid.strip()})
    if not unique_ids:
        return {}
    users = db.query(models.User).filter(models.User.id.in_(unique_ids)).all()
    display: dict[str, str] = {}
    for user in users:
        nickname = (user.nickname or "").strip()
        display[user.id] = nickname if nickname else (user.email or "").strip()
    return display


def _card_read_with_display(card: models.Card, display_map: Mapping[str, str]) -> schemas.CardRead:
    base = schemas.CardRead.model_validate(card)
    display_assignees = [display_map.get(a, a) for a in list(card.assignees or [])]
    display_subtasks = [
        schemas.SubtaskRead.model_validate(sub).model_copy(
            update={"assignee": display_map.get(sub.assignee, sub.assignee)}
        )
        for sub in card.subtasks
    ]
    return base.model_copy(update={"assignees": display_assignees, "subtasks": display_subtasks})


def _member_channel_ids(db: Session, *, user_id: str) -> list[str]:
    return [
        row[0]
        for row in db.query(models.ChannelMember.channel_id)
        .filter(models.ChannelMember.user_id == user_id)
        .all()
    ]


def _card_query(db: Session, *, owner_id: str | None = None, member_user_id: str | None = None):
    query = db.query(models.Card).options(
        selectinload(models.Card.subtasks),
        selectinload(models.Card.labels),
        joinedload(models.Card.status),
        joinedload(models.Card.error_category),
        joinedload(models.Card.initiative),
    )

    if member_user_id:
        channel_ids = _member_channel_ids(db, user_id=member_user_id)
        if channel_ids:
            query = query.filter(models.Card.channel_id.in_(channel_ids))
        else:
            # No memberships: return empty set by filtering impossible condition
            query = query.filter(models.Card.id == "__none__")
    elif owner_id:
        query = query.filter(models.Card.owner_id == owner_id)

    return query


_DONE_STATUS_TOKENS = {"done", "completed", "完了"}


def _status_is_done(status: models.Status | None) -> bool:
    if status is None:
        return False

    category = (status.category or "").strip().lower()
    if category == "done":
        return True

    name = (status.name or "").strip().lower()
    return name in _DONE_STATUS_TOKENS


def _subtask_status_is_done(value: str | None) -> bool:
    if not value:
        return False

    return value.strip().lower() in _DONE_STATUS_TOKENS


def _sanitize_label_inputs(values: Iterable[str | None]) -> list[str]:
    cleaned: list[str] = []
    for raw in values:
        if raw is None:
            continue
        candidate = raw.strip()
        if candidate:
            cleaned.append(candidate)
    return list(dict.fromkeys(cleaned))


def _resolve_card_labels(
    db: Session,
    *,
    label_inputs: Iterable[str | None],
    owner: models.User,
) -> list[models.Label]:
    unique_inputs = _sanitize_label_inputs(label_inputs)
    if not unique_inputs:
        return []

    labels = db.query(models.Label).filter(models.Label.id.in_(unique_inputs), models.Label.owner_id == owner.id).all()
    resolved: dict[str, models.Label] = {label.id: label for label in labels}

    missing = [value for value in unique_inputs if value not in resolved]
    if missing:
        normalized_lookup: dict[str, list[str]] = {}
        for value in missing:
            key = value.strip().lower()
            normalized_lookup.setdefault(key, []).append(value)
        existing_by_name = (
            db.query(models.Label)
            .filter(
                models.Label.owner_id == owner.id,
                func.lower(func.trim(models.Label.name)).in_(list(normalized_lookup.keys())),
            )
            .all()
        )
        for label in existing_by_name:
            key = (label.name or "").strip().lower()
            originals = normalized_lookup.pop(key, [])
            for original in originals:
                resolved[original] = label

    remaining = [value for value in unique_inputs if value not in resolved]
    if remaining:
        normalized_remaining: dict[str, list[str]] = {}
        for value in remaining:
            key = value.strip().lower()
            normalized_remaining.setdefault(key, []).append(value)

        existing_count = db.query(func.count(models.Label.id)).filter(models.Label.owner_id == owner.id).scalar() or 0
        for offset, variants in enumerate(normalized_remaining.values()):
            base_value = variants[0]
            colour = _next_label_colour(existing_count + offset)
            label = models.Label(name=base_value, color=colour, owner=owner)
            db.add(label)
            for variant in variants:
                resolved[variant] = label

    ordered_labels: list[models.Label] = []
    seen_labels: set[int] = set()
    for value in unique_inputs:
        label = resolved[value]
        marker = id(label)
        if marker in seen_labels:
            continue
        seen_labels.add(marker)
        ordered_labels.append(label)

    return ordered_labels


def _load_owned_labels(db: Session, *, label_ids: list[str], owner_id: str) -> list[models.Label]:
    unique_ids = _sanitize_label_inputs(label_ids)
    if not unique_ids:
        return []

    labels = db.query(models.Label).filter(models.Label.id.in_(unique_ids), models.Label.owner_id == owner_id).all()
    if len(labels) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")

    lookup = {label.id: label for label in labels}
    return [lookup[label_id] for label_id in unique_ids]


def _compose_label_texts(labels: Iterable[models.Label]) -> list[str]:
    label_texts: list[str] = []
    for label in labels:
        parts = [label.name or "", label.description or ""]
        text = " ".join(part.strip() for part in parts if part)
        if text:
            label_texts.append(text)
    return label_texts


def _score_card_from_payload(
    *,
    title: str,
    summary: str | None,
    description: str | None,
    labels: Iterable[models.Label],
    profile: schemas.UserProfile,
) -> RecommendationScore:
    result = _scoring_service.score_card(
        title=title,
        summary=summary,
        description=description,
        labels=_compose_label_texts(labels),
        profile=profile,
    )
    return result


def _score_card_model(card: models.Card, profile: schemas.UserProfile) -> RecommendationScore:
    return _score_card_from_payload(
        title=card.title,
        summary=card.summary,
        description=card.description,
        labels=card.labels,
        profile=profile,
    )


def _validate_related_entities(
    db: Session,
    *,
    owner_id: str,
    status_id: str | None = None,
    error_category_id: str | None = None,
    initiative_id: str | None = None,
) -> None:
    ensure_optional_owned_resource(
        db,
        models.Status,
        status_id,
        owner_id=owner_id,
        detail="Status not found",
    )
    ensure_optional_owned_resource(
        db,
        models.ErrorCategory,
        error_category_id,
        owner_id=owner_id,
        detail="Error category not found",
    )
    ensure_optional_owned_resource(
        db,
        models.ImprovementInitiative,
        initiative_id,
        owner_id=owner_id,
        detail="Initiative not found",
    )


def _get_accessible_card(db: Session, *, user_id: str, card_id: str) -> models.Card:
    card = (
        _card_query(db, member_user_id=user_id)
        .filter(models.Card.id == card_id)
        .order_by(models.Card.created_at.desc())
        .first()
    )
    if not card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found")
    return card


def _derive_created_from(time_range: str) -> datetime | None:
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


def _normalize_words(*texts: str | None) -> set[str]:
    words: set[str] = set()
    for text in texts:
        if not text:
            continue
        words.update(re.findall(r"[a-z0-9]+", text.lower()))
    return words


def _text_similarity(left: str | None, right: str | None) -> float:
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


@router.get("/", response_model=list[schemas.CardRead])
def list_cards(
    status_id: str | None = Query(default=None),
    label_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    status_ids: list[str] | None = Query(default=None),
    label_ids: list[str] | None = Query(default=None),
    assignees: list[str] | None = Query(default=None),
    priority: str | None = Query(default=None),
    priorities: list[str] | None = Query(default=None),
    error_category_id: str | None = Query(default=None),
    initiative_id: str | None = Query(default=None),
    created_from: datetime | None = Query(default=None),
    created_to: datetime | None = Query(default=None),
    due_from: datetime | None = Query(default=None),
    due_to: datetime | None = Query(default=None),
    time_range: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.Card]:
    query = _card_query(db, member_user_id=current_user.id)

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

    # Resolve userIds -> nickname for display in response
    user_ids: set[str] = set()
    for card in cards:
        user_ids.update([v for v in (card.assignees or []) if v])
        for sub in card.subtasks:
            if sub.assignee:
                user_ids.add(sub.assignee)
    display_map = _resolve_display_names(db, user_ids)
    return [_card_read_with_display(card, display_map) for card in cards]


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

    card_limit = get_card_daily_limit(db, current_user.id)
    if card_limit > 0 and created_count >= card_limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Daily card creation limit of {card_limit} reached.",
        )

    reserve_daily_card_quota(
        db=db,
        owner_id=current_user.id,
        quota_day=now.date(),
        limit=card_limit,
    )

    _validate_related_entities(
        db,
        owner_id=current_user.id,
        status_id=payload.status_id,
        error_category_id=payload.error_category_id,
        initiative_id=payload.initiative_id,
    )

    status_obj = db.get(models.Status, payload.status_id) if payload.status_id else None
    labels = _resolve_card_labels(
        db,
        label_inputs=list(payload.label_ids or []),
        owner=current_user,
    )

    profile = build_user_profile(current_user)
    score = _score_card_from_payload(
        title=payload.title,
        summary=payload.summary,
        description=payload.description,
        labels=labels,
        profile=profile,
    )

    # Determine channel
    channel_id = payload.channel_id
    if channel_id:
        # Validate membership in specified channel
        member_channels = set(_member_channel_ids(db, user_id=current_user.id))
        if channel_id not in member_channels:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a member of channel")
    else:
        # Default to user's private channel
        private = (
            db.query(models.Channel)
            .filter(models.Channel.owner_user_id == current_user.id, models.Channel.is_private.is_(True))
            .first()
        )
        channel_id = private.id if private else None

    card = models.Card(
        title=payload.title,
        summary=payload.summary,
        description=payload.description,
        status_id=payload.status_id,
        channel_id=channel_id,
        priority=payload.priority,
        story_points=payload.story_points,
        estimate_hours=payload.estimate_hours,
        assignees=_canonicalize_assignees(db, payload.assignees or []),
        start_date=payload.start_date,
        due_date=payload.due_date,
        dependencies=payload.dependencies,
        ai_confidence=score.score,
        ai_notes=score.explanation,
        ai_failure_reason=score.failure_reason,
        custom_fields=payload.custom_fields,
        error_category_id=payload.error_category_id,
        initiative_id=payload.initiative_id,
        analytics_notes=payload.analytics_notes,
        owner=current_user,
    )

    if status_obj:
        card.status = status_obj
        if _status_is_done(status_obj):
            card.completed_at = datetime.now(timezone.utc)

    if labels:
        card.labels = labels

    for subtask_data in payload.subtasks:
        subtask_payload = subtask_data.model_dump()
        subtask_payload["assignee"] = _canonicalize_single_assignee(db, subtask_payload.get("assignee"))
        subtask = models.Subtask(**subtask_payload)
        if _subtask_status_is_done(subtask.status):
            subtask.completed_at = datetime.now(timezone.utc)
        card.subtasks.append(subtask)

    db.add(card)
    record_activity(db, action="card_created", card_id=card.id, actor_id=current_user.id)
    db.commit()
    db.refresh(card)
    # Resolve display names in response
    user_ids = set(card.assignees or [])
    for sub in card.subtasks:
        if sub.assignee:
            user_ids.add(sub.assignee)
    display_map = _resolve_display_names(db, user_ids)
    return _card_read_with_display(card, display_map)


@router.get("/{card_id}", response_model=schemas.CardRead)
def get_card(
    card_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.CardRead:
    card = _get_accessible_card(db, user_id=current_user.id, card_id=card_id)
    user_ids = set(card.assignees or [])
    for sub in card.subtasks:
        if sub.assignee:
            user_ids.add(sub.assignee)
    display_map = _resolve_display_names(db, user_ids)
    return _card_read_with_display(card, display_map)


@router.put("/{card_id}", response_model=schemas.CardRead)
def update_card(
    card_id: str,
    payload: schemas.CardUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.CardRead:
    card = _get_accessible_card(db, user_id=current_user.id, card_id=card_id)

    update_data = payload.model_dump(exclude_unset=True)
    # Block channel changes for MVP to avoid unauthorized moves
    if "channel_id" in update_data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Changing channel is not supported",
        )
    label_ids = update_data.pop("label_ids", None)
    update_data.pop("ai_confidence", None)
    update_data.pop("ai_notes", None)
    update_data.pop("ai_failure_reason", None)

    should_rescore = label_ids is not None or any(field in update_data for field in ("title", "summary", "description"))

    previous_status = card.status
    status_was_done = _status_is_done(previous_status)

    _validate_related_entities(
        db,
        owner_id=card.owner_id,
        status_id=update_data.get("status_id"),
        error_category_id=update_data.get("error_category_id"),
        initiative_id=update_data.get("initiative_id"),
    )

    new_status = previous_status
    if "status_id" in update_data:
        status_id = update_data.get("status_id")
        new_status = db.get(models.Status, status_id) if status_id else None

    # Canonicalize assignees on update if provided
    if "assignees" in update_data and update_data.get("assignees") is not None:
        update_data["assignees"] = _canonicalize_assignees(db, update_data.get("assignees") or [])

    apply_updates(card, update_data)

    if label_ids is not None:
        labels = _load_owned_labels(db, label_ids=list(label_ids or []), owner_id=card.owner_id)
        card.labels = labels

    if "status_id" in update_data:
        card.status = new_status

    status_is_done = _status_is_done(card.status)
    if status_is_done and not status_was_done and card.completed_at is None:
        card.completed_at = datetime.now(timezone.utc)
    elif not status_is_done and status_was_done:
        card.completed_at = None

    if should_rescore:
        profile = build_user_profile(current_user)
        score = _score_card_model(card, profile)
        card.ai_confidence = score.score
        card.ai_notes = score.explanation
        card.ai_failure_reason = score.failure_reason

    db.add(card)
    record_activity(db, action="card_updated", card_id=card.id, actor_id=current_user.id)
    db.commit()
    db.refresh(card)
    user_ids = set(card.assignees or [])
    for sub in card.subtasks:
        if sub.assignee:
            user_ids.add(sub.assignee)
    display_map = _resolve_display_names(db, user_ids)
    return _card_read_with_display(card, display_map)


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
    card = _get_accessible_card(db, user_id=current_user.id, card_id=card_id)

    record_activity(db, action="card_deleted", card_id=card.id, actor_id=current_user.id)
    delete_model(db, card)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{card_id}/subtasks", response_model=list[schemas.SubtaskRead])
def list_subtasks(
    card_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.SubtaskRead]:
    _get_accessible_card(db, user_id=current_user.id, card_id=card_id)

    items = (
        db.query(models.Subtask)
        .filter(models.Subtask.card_id == card_id)
        .order_by(models.Subtask.created_at)
        .all()
    )
    user_ids = {sub.assignee for sub in items if sub.assignee}
    display_map = _resolve_display_names(db, user_ids)
    return [
        schemas.SubtaskRead.model_validate(sub).model_copy(
            update={"assignee": display_map.get(sub.assignee, sub.assignee)}
        )
        for sub in items
    ]


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
) -> schemas.SubtaskRead:
    _get_accessible_card(db, user_id=current_user.id, card_id=card_id)

    data = payload.model_dump()
    data["assignee"] = _canonicalize_single_assignee(db, data.get("assignee"))
    subtask = models.Subtask(card_id=card_id, **data)
    if _subtask_status_is_done(subtask.status):
        subtask.completed_at = datetime.now(timezone.utc)
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
    display_map = _resolve_display_names(db, [subtask.assignee] if subtask.assignee else [])
    return schemas.SubtaskRead.model_validate(subtask).model_copy(
        update={"assignee": display_map.get(subtask.assignee, subtask.assignee)}
    )


@router.put("/{card_id}/subtasks/{subtask_id}", response_model=schemas.SubtaskRead)
def update_subtask(
    card_id: str,
    subtask_id: str,
    payload: schemas.SubtaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.Subtask:
    # Allow updates if the user has access to the card via channel membership
    _get_accessible_card(db, user_id=current_user.id, card_id=card_id)

    subtask = get_resource_or_404(
        db,
        models.Subtask,
        subtask_id,
        detail="Subtask not found",
    )
    if subtask.card_id != card.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    previous_status = subtask.status
    status_was_done = _subtask_status_is_done(previous_status)

    updates = payload.model_dump(exclude_unset=True)
    if "assignee" in updates and updates.get("assignee") is not None:
        updates["assignee"] = _canonicalize_single_assignee(db, updates.get("assignee"))
    apply_updates(subtask, updates)

    status_is_done = _subtask_status_is_done(subtask.status)
    if status_is_done and not status_was_done and subtask.completed_at is None:
        subtask.completed_at = datetime.now(timezone.utc)
    elif not status_is_done and status_was_done:
        subtask.completed_at = None

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
    display_map = _resolve_display_names(db, [subtask.assignee] if subtask.assignee else [])
    return schemas.SubtaskRead.model_validate(subtask).model_copy(
        update={"assignee": display_map.get(subtask.assignee, subtask.assignee)}
    )


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
    # Allow deletes if the user has access to the card via channel membership
    _get_accessible_card(db, user_id=current_user.id, card_id=card_id)

    subtask = get_resource_or_404(
        db,
        models.Subtask,
        subtask_id,
        detail="Subtask not found",
    )
    if subtask.card_id != card.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Subtask not found")

    record_activity(
        db,
        action="subtask_deleted",
        card_id=card_id,
        actor_id=current_user.id,
        details={"subtask_id": subtask.id},
    )
    delete_model(db, subtask)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _build_similar_items(base_card: models.Card, candidates: Iterable[models.Card]) -> list[schemas.SimilarItem]:
    items: list[schemas.SimilarItem] = []
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
    base_card = _get_accessible_card(db, user_id=current_user.id, card_id=card_id)

    candidates = (
        _card_query(db, member_user_id=current_user.id)
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
    _get_accessible_card(db, user_id=current_user.id, card_id=card_id)

    if payload.related_type == "card":
        _get_accessible_card(db, user_id=current_user.id, card_id=related_id)
    elif payload.related_type == "subtask":
        subtask = get_resource_or_404(
            db,
            models.Subtask,
            related_id,
            detail="Related subtask not found",
        )
        _get_accessible_card(db, user_id=current_user.id, card_id=subtask.card_id)

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
