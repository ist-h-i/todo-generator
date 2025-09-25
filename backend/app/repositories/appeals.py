from __future__ import annotations

from typing import Iterable

from sqlalchemy.orm import Session

from .. import models, schemas
from ..utils.repository import save_model


class AppealGenerationRepository:
    """Persist and query :class:`~app.models.AppealGeneration` records."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def create(
        self,
        *,
        owner_id: str,
        subject_type: str,
        subject_value: str,
        flow: Iterable[str],
        formats: Iterable[str],
        formats_payload: dict[str, schemas.AppealGeneratedFormat],
        token_usage: dict[str, int],
        warnings: list[str],
        generation_status: str,
    ) -> models.AppealGeneration:
        record = models.AppealGeneration(
            owner_id=owner_id,
            subject_type=subject_type,
            subject_value=subject_value,
            flow=list(flow),
            formats=list(formats),
            content_json={key: value.model_dump() for key, value in formats_payload.items()},
            token_usage=dict(token_usage),
            warnings=list(warnings),
            generation_status=generation_status,
        )
        return save_model(self._db, record)

    def list_recent(self, owner_id: str, *, limit: int = 20) -> list[models.AppealGeneration]:
        return (
            self._db.query(models.AppealGeneration)
            .filter(models.AppealGeneration.owner_id == owner_id)
            .order_by(models.AppealGeneration.created_at.desc())
            .limit(limit)
            .all()
        )
