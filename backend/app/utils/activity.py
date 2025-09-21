from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from .. import models


def record_activity(
    db: Session,
    *,
    action: str,
    card_id: Optional[str] = None,
    actor_id: Optional[str] = "system",
    details: Optional[dict[str, Any]] = None,
) -> models.ActivityLog:
    """Persist an activity log entry."""

    log = models.ActivityLog(
        card_id=card_id,
        actor_id=actor_id,
        action=action,
        details=details or {},
    )
    db.add(log)
    return log
