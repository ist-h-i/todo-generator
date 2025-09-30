from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Sequence

from .. import models, schemas
from .status_report_content import StatusReportContentService


@dataclass(slots=True)
class StatusReportPresenter:
    """Serialize status report models into API schemas."""

    content_service: StatusReportContentService

    def __init__(self, content_service: StatusReportContentService | None = None) -> None:
        self.content_service = content_service or StatusReportContentService()

    def to_read(self, report: models.StatusReport) -> schemas.StatusReportRead:
        sections = self.content_service.extract_sections(report)
        return schemas.StatusReportRead(
            id=report.id,
            shift_type=report.shift_type,
            tags=list(report.tags or []),
            status=schemas.StatusReportStatus(report.status),
            auto_ticket_enabled=report.auto_ticket_enabled,
            sections=sections,
            analysis_model=report.analysis_model,
            analysis_started_at=report.analysis_started_at,
            analysis_completed_at=report.analysis_completed_at,
            failure_reason=report.failure_reason,
            confidence=report.confidence,
            created_at=report.created_at,
            updated_at=report.updated_at,
        )

    def to_list_item(self, report: models.StatusReport) -> schemas.StatusReportListItem:
        sections = self.content_service.extract_sections(report)
        summary = next((section.body for section in sections if section.body), None)
        pending = self._pending_proposals(report.processing_meta)
        return schemas.StatusReportListItem(
            id=report.id,
            status=schemas.StatusReportStatus(report.status),
            shift_type=report.shift_type,
            tags=list(report.tags or []),
            auto_ticket_enabled=report.auto_ticket_enabled,
            created_at=report.created_at,
            updated_at=report.updated_at,
            card_count=len(report.cards or []),
            proposal_count=len(pending),
            summary=summary,
        )

    def to_detail(self, report: models.StatusReport) -> schemas.StatusReportDetail:
        base = self.to_read(report)
        cards = [self.serialize_card_link(link) for link in report.cards or []]
        events = [
            schemas.StatusReportEventRead(
                id=event.id,
                event_type=schemas.StatusReportEventType(event.event_type),
                payload=dict(event.payload or {}),
                created_at=self._normalize_timestamp(event.created_at),
            )
            for event in sorted(report.events or [], key=self._event_sort_key)
        ]
        pending = self._pending_proposals(report.processing_meta)
        return schemas.StatusReportDetail(
            **base.model_dump(),
            cards=cards,
            events=events,
            processing_meta=dict(report.processing_meta or {}),
            pending_proposals=pending,
        )

    def serialize_card_link(self, link: models.StatusReportCardLink) -> schemas.StatusReportCardSummary:
        card = link.card
        relationship = getattr(link, "link_role", None) or "primary"

        if not card:
            return schemas.StatusReportCardSummary(
                id=link.card_id,
                title="(deleted card)",
                summary=None,
                status_id=None,
                status_name=None,
                priority=None,
                due_date=None,
                assignees=[],
                subtasks=[],
                relationship=relationship,
                confidence=link.confidence,
            )

        status_obj = card.status
        return schemas.StatusReportCardSummary(
            id=card.id,
            title=card.title,
            summary=card.summary,
            status_id=status_obj.id if status_obj else None,
            status_name=status_obj.name if status_obj else None,
            priority=card.priority,
            due_date=card.due_date,
            assignees=list(card.assignees or []),
            subtasks=[schemas.SubtaskRead.model_validate(sub) for sub in card.subtasks],
            relationship=relationship,
            confidence=link.confidence,
        )

    def _pending_proposals(self, processing_meta: dict | None) -> list[schemas.AnalysisCard]:
        if not isinstance(processing_meta, dict):
            return []
        proposals_data = processing_meta.get("proposals")
        if not isinstance(proposals_data, Sequence):
            return []
        results: list[schemas.AnalysisCard] = []
        for item in proposals_data:
            if not isinstance(item, dict):
                continue
            try:
                results.append(schemas.AnalysisCard.model_validate(item))
            except Exception:  # pragma: no cover - defensive parsing  # noqa: S112
                continue
        return results

    def _event_sort_key(self, event: models.StatusReportEvent) -> datetime:
        normalized = self._normalize_timestamp(event.created_at)
        if normalized is None:
            return datetime.min.replace(tzinfo=timezone.utc)
        return normalized

    def _normalize_timestamp(self, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value


__all__ = ["StatusReportPresenter"]
