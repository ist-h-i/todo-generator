from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import json
from typing import Any, Iterable

from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import models, schemas
from .status_report_content import StatusReportContentService

DEFAULT_IMMUNITY_MAP_WINDOW_DAYS = 28

_MAX_STATUS_REPORTS = 10
_MAX_CARD_EXCERPTS = 8
_MAX_SECTION_CHARS = 240
_MAX_CARD_CHARS = 200
_MAX_SNAPSHOT_CHARS = 240
_MAX_METRIC_KEYS = 8


@dataclass(frozen=True)
class ImmunityMapContext:
    prompt: str
    summary: str
    used_sources: dict[str, int]


def build_immunity_map_context(
    db: Session,
    *,
    user: models.User,
    window_days: int = DEFAULT_IMMUNITY_MAP_WINDOW_DAYS,
    include_status_reports: bool = True,
    include_cards: bool = True,
    include_profile: bool = True,
    include_snapshots: bool = False,
    target: schemas.ImmunityMapTarget | None = None,
) -> ImmunityMapContext:
    cutoff = _build_cutoff(window_days)
    used_sources: dict[str, int] = {
        "status_reports": 0,
        "cards": 0,
        "snapshots": 0,
    }
    context_payload: dict[str, Any] = {}
    summary_parts: list[str] = []

    profile = _build_profile_context(user) if include_profile else None
    if profile:
        context_payload["profile"] = profile
        summary_parts.append("profile")

    if include_status_reports:
        report_entries = _collect_status_report_entries(db, owner_id=user.id, cutoff=cutoff)
        if report_entries:
            context_payload["status_reports"] = report_entries
            used_sources["status_reports"] = len(report_entries)
            summary_parts.append(f"status_reports={len(report_entries)}")

    if include_cards:
        card_entries, metrics = _collect_card_context(db, owner_id=user.id, cutoff=cutoff)
        if card_entries:
            context_payload["card_metrics"] = metrics
            context_payload["notable_cards"] = card_entries
            used_sources["cards"] = len(card_entries)
            summary_parts.append(f"cards={len(card_entries)}")

    snapshot_entry = _resolve_snapshot_context(db, include_snapshots, target, user)
    if snapshot_entry:
        context_payload["snapshot"] = snapshot_entry
        used_sources["snapshots"] = 1
        summary_parts.append("snapshots=1")

    target_entry = _resolve_target_context(db, target, user)
    if target_entry:
        context_payload["target"] = target_entry

    summary = _build_summary(summary_parts, window_days)
    prompt = json.dumps(context_payload, ensure_ascii=False, indent=2)
    return ImmunityMapContext(prompt=prompt, summary=summary, used_sources=used_sources)


def _build_cutoff(window_days: int) -> datetime | None:
    if window_days <= 0:
        return None
    return datetime.now(timezone.utc) - timedelta(days=window_days)


def _build_profile_context(user: models.User) -> dict[str, Any]:
    payload: dict[str, Any] = {}
    if user.nickname:
        payload["nickname"] = user.nickname
    if user.experience_years is not None:
        payload["experience_years"] = user.experience_years
    if user.roles:
        payload["roles"] = list(user.roles)
    if user.bio:
        payload["bio"] = user.bio
    return payload


def _collect_status_report_entries(
    db: Session,
    *,
    owner_id: str,
    cutoff: datetime | None,
) -> list[dict[str, Any]]:
    query = db.query(models.StatusReport).filter(models.StatusReport.owner_id == owner_id)
    if cutoff is not None:
        query = query.filter(models.StatusReport.created_at >= cutoff)
    reports = query.order_by(models.StatusReport.created_at.desc()).limit(_MAX_STATUS_REPORTS).all()
    content_service = StatusReportContentService()

    entries: list[dict[str, Any]] = []
    for report in reports:
        sections = content_service.extract_sections(report)
        excerpt = _summarize_sections(sections)
        if not excerpt:
            continue
        entries.append(
            {
                "id": report.id,
                "created_at": _to_iso(report.created_at),
                "status": report.status,
                "tags": list(report.tags or []),
                "excerpt": excerpt,
            }
        )
    return entries


def _summarize_sections(sections: Iterable[schemas.StatusReportSection]) -> str | None:
    segments: list[str] = []
    for section in sections:
        if len(segments) >= 2:
            break
        title = (section.title or "Section").strip()
        body = _truncate(section.body, _MAX_SECTION_CHARS)
        if not body:
            continue
        segments.append(f"{title}: {body}")
    if not segments:
        return None
    return " / ".join(segments)


def _collect_card_context(
    db: Session,
    *,
    owner_id: str,
    cutoff: datetime | None,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    status_index = _load_status_index(db, owner_id)
    query = db.query(models.Card).filter(models.Card.owner_id == owner_id)
    if cutoff is not None:
        query = query.filter(
            or_(models.Card.updated_at >= cutoff, models.Card.completed_at >= cutoff)
        )
    cards = query.order_by(models.Card.updated_at.desc()).limit(_MAX_CARD_EXCERPTS).all()
    metrics = _build_card_metrics(cards, status_index)
    entries = [_serialize_card(card, status_index) for card in cards]
    return entries, metrics


def _load_status_index(db: Session, owner_id: str) -> dict[str, str]:
    statuses = db.query(models.Status).filter(models.Status.owner_id == owner_id).all()
    index: dict[str, str] = {}
    for status in statuses:
        if status.id:
            value = (status.category or status.name or "").strip()
            index[status.id] = value
    return index


def _build_card_metrics(cards: Iterable[models.Card], status_index: dict[str, str]) -> dict[str, Any]:
    materialized = list(cards)
    done = 0
    in_progress = 0
    todo = 0
    overdue = 0
    now = datetime.now(timezone.utc)

    for card in materialized:
        category = (status_index.get(card.status_id or "") or "").strip().lower()
        completed = card.completed_at is not None or category == "done"
        if completed:
            done += 1
        elif category == "in-progress":
            in_progress += 1
        elif category == "todo":
            todo += 1

        due_date = _to_utc_datetime(card.due_date)
        if due_date and due_date < now and not completed:
            overdue += 1

    return {
        "total": len(materialized),
        "done": done,
        "in_progress": in_progress,
        "todo": todo,
        "overdue": overdue,
    }


def _to_utc_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _serialize_card(card: models.Card, status_index: dict[str, str]) -> dict[str, Any]:
    label_names = [label.name for label in card.labels or [] if label.name]
    return {
        "id": card.id,
        "title": _truncate(card.title, _MAX_CARD_CHARS),
        "summary": _truncate(card.summary or card.description or "", _MAX_CARD_CHARS) or None,
        "status": status_index.get(card.status_id or "") or None,
        "labels": label_names,
        "due_date": _to_iso(card.due_date),
        "completed_at": _to_iso(card.completed_at),
    }


def _resolve_snapshot_context(
    db: Session,
    include_snapshots: bool,
    target: schemas.ImmunityMapTarget | None,
    user: models.User,
) -> dict[str, Any] | None:
    if not include_snapshots:
        return None
    if not user.is_admin:
        return None
    snapshot = None
    if target and target.type == "snapshot":
        snapshot = db.get(models.AnalyticsSnapshot, target.id)
    if snapshot is None:
        snapshot = (
            db.query(models.AnalyticsSnapshot)
            .order_by(models.AnalyticsSnapshot.period_end.desc())
            .first()
        )
    if not snapshot:
        return None
    metrics = snapshot.metrics if isinstance(snapshot.metrics, dict) else {}
    trimmed_metrics = dict(sorted(metrics.items())[:_MAX_METRIC_KEYS])
    return {
        "id": snapshot.id,
        "title": snapshot.title,
        "period_start": _to_iso(snapshot.period_start),
        "period_end": _to_iso(snapshot.period_end),
        "metrics": trimmed_metrics,
        "narrative": _truncate(snapshot.narrative or "", _MAX_SNAPSHOT_CHARS) or None,
    }


def _resolve_target_context(
    db: Session,
    target: schemas.ImmunityMapTarget | None,
    user: models.User,
) -> dict[str, Any] | None:
    if not target:
        return None
    if target.type == "card":
        card = (
            db.query(models.Card)
            .filter(
                models.Card.id == target.id,
                models.Card.owner_id == user.id,
            )
            .first()
        )
        if not card:
            return None
        return {
            "type": "card",
            "id": card.id,
            "title": _truncate(card.title, _MAX_CARD_CHARS),
            "summary": _truncate(card.summary or card.description or "", _MAX_CARD_CHARS) or None,
            "due_date": _to_iso(card.due_date),
            "completed_at": _to_iso(card.completed_at),
        }
    if target.type == "snapshot" and user.is_admin:
        snapshot = db.get(models.AnalyticsSnapshot, target.id)
        if snapshot:
            return {
                "type": "snapshot",
                "id": snapshot.id,
                "title": snapshot.title,
            }
    return None


def _build_summary(parts: list[str], window_days: int) -> str:
    if not parts:
        return "No context sources were available."
    suffix = f" (last {window_days} days)" if window_days > 0 else ""
    return f"Context sources{suffix}: " + ", ".join(parts)


def _truncate(value: str, max_length: int) -> str:
    text = " ".join(value.split()).strip()
    if not text:
        return ""
    if len(text) <= max_length:
        return text
    return text[: max(1, max_length - 3)].rstrip() + "..."


def _to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc).isoformat()
    return value.isoformat()


__all__ = ["DEFAULT_IMMUNITY_MAP_WINDOW_DAYS", "ImmunityMapContext", "build_immunity_map_context"]
