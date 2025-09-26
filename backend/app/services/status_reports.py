from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable, Sequence

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from .chatgpt import ChatGPTClient, ChatGPTError

_MAX_GENERATED_CARDS = 5


@dataclass
class StatusReportProcessResult:
    """Result payload returned after submitting a status report for analysis."""

    detail: schemas.StatusReportDetail
    proposals: list[schemas.AnalysisCard]
    destroyed: bool = False
    error: str | None = None


class StatusReportService:
    """Orchestrates CRUD and analysis flows for status reports."""

    def __init__(self, db: Session, analyzer: ChatGPTClient | None = None) -> None:
        self.db = db
        self.analyzer = analyzer

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def create_report(
        self,
        *,
        owner: models.User,
        payload: schemas.StatusReportCreate,
    ) -> models.StatusReport:
        sections = self._normalize_sections(payload.sections)
        if not sections:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one section with content is required.",
            )

        report = models.StatusReport(
            owner_id=owner.id,
            shift_type=payload.shift_type,
            tags=self._normalize_tags(payload.tags),
            content=self._sections_to_content(sections),
            status=schemas.StatusReportStatus.DRAFT.value,
            auto_ticket_enabled=payload.auto_ticket_enabled,
        )
        self.db.add(report)
        self.db.flush()
        self._record_event(report, schemas.StatusReportEventType.DRAFT_CREATED)
        return report

    def update_report(
        self,
        report: models.StatusReport,
        payload: schemas.StatusReportUpdate,
    ) -> models.StatusReport:
        if payload.shift_type is not None:
            report.shift_type = payload.shift_type or None

        if payload.tags is not None:
            report.tags = self._normalize_tags(payload.tags)

        if payload.sections is not None:
            sections = self._normalize_sections(payload.sections)
            if not sections:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="At least one section with content is required.",
                )
            report.content = self._sections_to_content(sections)

        if payload.auto_ticket_enabled is not None:
            report.auto_ticket_enabled = payload.auto_ticket_enabled

        self.db.add(report)
        self.db.flush()
        self._record_event(report, schemas.StatusReportEventType.UPDATED)
        return report

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------
    def list_reports(
        self,
        *,
        owner_id: str,
        status_filter: schemas.StatusReportStatus | None = None,
    ) -> list[models.StatusReport]:
        query = (
            self.db.query(models.StatusReport)
            .options(selectinload(models.StatusReport.cards))
            .filter(models.StatusReport.owner_id == owner_id)
            .order_by(models.StatusReport.created_at.desc())
        )

        if status_filter:
            query = query.filter(models.StatusReport.status == status_filter.value)

        return query.all()

    def get_report(
        self,
        *,
        report_id: str,
        owner_id: str,
        include_details: bool = False,
    ) -> models.StatusReport:
        query = self.db.query(models.StatusReport).filter(
            models.StatusReport.id == report_id,
            models.StatusReport.owner_id == owner_id,
        )

        if include_details:
            query = query.options(
                selectinload(models.StatusReport.cards)
                .selectinload(models.StatusReportCardLink.card)
                .selectinload(models.Card.subtasks),
                selectinload(models.StatusReport.cards)
                .selectinload(models.StatusReportCardLink.card)
                .selectinload(models.Card.status),
                selectinload(models.StatusReport.events),
            )
        else:
            query = query.options(selectinload(models.StatusReport.cards))

        report = query.first()
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Status report not found",
            )
        return report

    # ------------------------------------------------------------------
    # Analysis pipeline
    # ------------------------------------------------------------------
    def submit_report(
        self,
        report: models.StatusReport,
        *,
        max_cards: int = _MAX_GENERATED_CARDS,
    ) -> StatusReportProcessResult:
        if self.analyzer is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Status report analyzer is not configured.",
            )

        if report.status not in {
            schemas.StatusReportStatus.DRAFT.value,
            schemas.StatusReportStatus.SUBMITTED.value,
            schemas.StatusReportStatus.FAILED.value,
            schemas.StatusReportStatus.COMPLETED.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Report in status '{report.status}' cannot be submitted.",
            )

        report.status = schemas.StatusReportStatus.PROCESSING.value
        report.analysis_started_at = datetime.now(timezone.utc)
        report.analysis_model = None
        report.failure_reason = None
        self._record_event(report, schemas.StatusReportEventType.SUBMITTED)
        self._record_event(report, schemas.StatusReportEventType.ANALYSIS_STARTED)
        self.db.flush()

        sections = self._sections_from_content(report)
        analysis_text = self._compose_analysis_prompt(report, sections)
        proposals: list[schemas.AnalysisCard] = []
        error_message: str | None = None

        try:
            response = self.analyzer.analyze(
                schemas.AnalysisRequest(text=analysis_text, max_cards=max_cards)
            )
        except ChatGPTError as exc:
            error_message = str(exc)
        else:
            proposals = list(response.proposals or [])
            report.analysis_model = response.model

        if error_message:
            report.status = schemas.StatusReportStatus.FAILED.value
            report.analysis_completed_at = datetime.now(timezone.utc)
            report.failure_reason = error_message
            self._update_processing_meta(report, last_error=error_message)
            self._record_event(
                report,
                schemas.StatusReportEventType.ANALYSIS_FAILED,
                {"message": error_message},
            )
            self.db.flush()
            detail = self.to_detail(report)
            return StatusReportProcessResult(detail=detail, proposals=[], destroyed=False, error=error_message)

        stored_proposals = proposals[:max_cards]
        self._update_processing_meta(
            report,
            proposals=[proposal.model_dump() for proposal in stored_proposals],
            created_card_ids=[],
            last_error=None,
        )
        report.status = schemas.StatusReportStatus.COMPLETED.value
        report.analysis_completed_at = datetime.now(timezone.utc)

        self._record_event(
            report,
            schemas.StatusReportEventType.PROPOSALS_RECORDED,
            {"proposal_count": len(stored_proposals)},
        )
        self._record_event(
            report,
            schemas.StatusReportEventType.ANALYSIS_COMPLETED,
            {"cards_created": 0, "proposals_recorded": len(stored_proposals)},
        )
        self.db.flush()
        detail = self.to_detail(report)
        self.db.delete(report)
        return StatusReportProcessResult(
            detail=detail,
            proposals=stored_proposals,
            destroyed=True,
            error=None,
        )

    # ------------------------------------------------------------------
    # Serialization helpers
    # ------------------------------------------------------------------
    def to_read(self, report: models.StatusReport) -> schemas.StatusReportRead:
        sections = self._sections_from_content(report)
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
        sections = self._sections_from_content(report)
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
        cards = [self._serialize_card_link(link) for link in report.cards or []]
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

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
    def _normalize_sections(
        self, sections: Sequence[schemas.StatusReportSection]
    ) -> list[schemas.StatusReportSection]:
        normalized: list[schemas.StatusReportSection] = []
        for section in sections:
            body = section.body.strip()
            title = section.title.strip() if section.title else None
            if not body:
                continue
            normalized.append(schemas.StatusReportSection(title=title, body=body))
        return normalized

    def _normalize_tags(self, tags: Iterable[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for tag in tags:
            value = tag.strip()
            if not value:
                continue
            if value.lower() in seen:
                continue
            seen.add(value.lower())
            cleaned.append(value)
        return cleaned

    def _sections_to_content(self, sections: Sequence[schemas.StatusReportSection]) -> dict:
        return {"sections": [section.model_dump() for section in sections]}

    def _sections_from_content(self, report: models.StatusReport) -> list[schemas.StatusReportSection]:
        content = report.content or {}
        raw_sections = content.get("sections", []) if isinstance(content, dict) else []
        sections: list[schemas.StatusReportSection] = []
        for item in raw_sections:
            if not isinstance(item, dict):
                continue
            body = str(item.get("body", "")).strip()
            if not body:
                continue
            title = item.get("title")
            sections.append(
                schemas.StatusReportSection(
                    title=str(title).strip() if title else None,
                    body=body,
                )
            )
        return sections

    def _compose_analysis_prompt(
        self, report: models.StatusReport, sections: Sequence[schemas.StatusReportSection]
    ) -> str:
        lines: list[str] = []
        if report.shift_type:
            lines.append(f"Shift Type: {report.shift_type}")
        if report.tags:
            lines.append(f"Tags: {', '.join(report.tags)}")
        lines.append("")
        for index, section in enumerate(sections, start=1):
            heading = section.title or f"Section {index}"
            lines.append(f"{heading}:")
            lines.append(section.body)
            lines.append("")
        return "\n".join(lines).strip()

    def _ensure_processing_meta(self, report: models.StatusReport) -> dict:
        if not isinstance(report.processing_meta, dict):
            report.processing_meta = {}
        return report.processing_meta

    def _update_processing_meta(self, report: models.StatusReport, **values: Any) -> dict:
        base = dict(self._ensure_processing_meta(report))
        base.update(values)
        report.processing_meta = base
        return base

    def _record_event(
        self,
        report: models.StatusReport,
        event_type: schemas.StatusReportEventType,
        payload: dict | None = None,
    ) -> models.StatusReportEvent:
        event = models.StatusReportEvent(
            report_id=report.id,
            event_type=event_type.value,
            payload=payload or {},
        )
        self.db.add(event)
        report.events.append(event)
        return event

    def _serialize_card_link(self, link: models.StatusReportCardLink) -> schemas.StatusReportCardSummary:
        card = link.card
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
                relationship=getattr(link, "link_role", "primary"),
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
            relationship=getattr(link, "link_role", "primary"),
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
            except Exception:  # pragma: no cover - defensive parsing
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

