from __future__ import annotations

from dataclasses import dataclass
from typing import Final

from sqlalchemy.orm import Session

from .. import models


@dataclass(frozen=True)
class _DefaultStatusDefinition:
    key: str
    name: str
    category: str
    order: int
    color: str


_DEFAULT_STATUS_DEFINITIONS: Final[tuple[_DefaultStatusDefinition, ...]] = (
    _DefaultStatusDefinition(key="todo", name="To Do", category="todo", order=1, color="#64748b"),
    _DefaultStatusDefinition(key="doing", name="Doing", category="in-progress", order=2, color="#2563eb"),
    _DefaultStatusDefinition(key="done", name="Done", category="done", order=3, color="#16a34a"),
)

# Normalize common legacy variants so they map to the canonical defaults.
_LEGACY_KEY_ALIASES: Final[dict[str, str]] = {
    "todo": "todo",
    "backlog": "todo",
    "inprogress": "doing",
    "progress": "doing",
    "doing": "doing",
    "wip": "doing",
    "done": "done",
    "completed": "done",
    "complete": "done",
}


def _normalize_status_key(name: str | None) -> str | None:
    if not name:
        return None

    normalized = "".join(ch for ch in name.casefold() if ch.isalnum())
    return _LEGACY_KEY_ALIASES.get(normalized, normalized)


def ensure_default_statuses(db: Session, owner_id: str) -> list[models.Status]:
    """Ensure that the canonical board statuses exist for the owner."""

    statuses = (
        db.query(models.Status)
        .filter(models.Status.owner_id == owner_id)
        .order_by(models.Status.order, models.Status.name)
        .all()
    )
    existing_by_key: dict[str, models.Status] = {}

    for status in statuses:
        key = _normalize_status_key(status.name)
        if key is None:
            continue

        # Prefer already normalized names when multiple variants exist.
        if key not in existing_by_key:
            existing_by_key[key] = status
        else:
            preferred = existing_by_key[key]
            target_name = next(
                (definition.name for definition in _DEFAULT_STATUS_DEFINITIONS if definition.key == key),
                status.name,
            )
            if preferred.name != target_name and status.name == target_name:
                existing_by_key[key] = status

    created_or_updated = False

    for definition in _DEFAULT_STATUS_DEFINITIONS:
        status = existing_by_key.get(definition.key)
        if status is None:
            status = models.Status(
                owner_id=owner_id,
                name=definition.name,
                category=definition.category,
                order=definition.order,
                color=definition.color,
            )
            db.add(status)
            statuses.append(status)
            created_or_updated = True
            continue

        updates = {}
        if status.name != definition.name:
            updates["name"] = definition.name
        if status.category != definition.category:
            updates["category"] = definition.category
        if status.order != definition.order:
            updates["order"] = definition.order
        if status.color != definition.color and definition.color:
            updates["color"] = definition.color

        if updates:
            for field, value in updates.items():
                setattr(status, field, value)
            created_or_updated = True

    if created_or_updated:
        db.flush()

    return statuses


__all__ = ["ensure_default_statuses"]
