from __future__ import annotations

from typing import Final

from sqlalchemy.orm import Session

from .. import models

DEFAULT_TEMPLATE_NAME: Final[str] = "標準テンプレート"
DEFAULT_TEMPLATE_DESCRIPTION: Final[str] = "主要フィールドを含むスターターテンプレートです。"
DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD: Final[float] = 0.6
DEFAULT_TEMPLATE_FIELD_VISIBILITY: Final[dict[str, bool]] = {
    "show_story_points": True,
    "show_due_date": False,
    "show_assignee": True,
    "show_confidence": True,
}


def default_field_visibility() -> dict[str, bool]:
    """Return a fresh copy of the default field visibility map."""

    return dict(DEFAULT_TEMPLATE_FIELD_VISIBILITY)


def ensure_default_workspace_template(db: Session, owner_id: str) -> models.WorkspaceTemplate:
    """Ensure the owner has a system-provided default workspace template."""

    template = (
        db.query(models.WorkspaceTemplate)
        .filter(
            models.WorkspaceTemplate.owner_id == owner_id,
            models.WorkspaceTemplate.is_system_default.is_(True),
        )
        .first()
    )
    if template:
        return template

    template = models.WorkspaceTemplate(
        owner_id=owner_id,
        name=DEFAULT_TEMPLATE_NAME,
        description=DEFAULT_TEMPLATE_DESCRIPTION,
        default_status_id=None,
        default_label_ids=[],
        confidence_threshold=DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD,
        field_visibility=default_field_visibility(),
        is_system_default=True,
    )
    db.add(template)
    db.flush()
    return template
