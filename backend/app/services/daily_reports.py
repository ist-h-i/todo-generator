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
class DailyReportProcessResult:
    """Result payload returned after submitting a daily report for analysis."""

    detail: schemas.DailyReportDetail
    proposals: list[schemas.AnalysisCard]
    destroyed: bool = False
    error: str | None = None


class DailyReportService:
    """Orchestrates CRUD and analysis flows for daily reports."""

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
        payload: schemas.DailyReportCreate,
    ) -> models.DailyReport:
        sections = self._normalize_sections(payload.sections)
        if not sections:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one section with content is required.",
            )

        report = models.DailyReport(
            owner_id=owner.id,
            shift_type=payload.shift_type,
            tags=self._normalize_tags(payload.tags),
            content=self._sections_to_content(sections),
            status=schemas.DailyReportStatus.DRAFT.value,
            auto_ticket_enabled=payload.auto_ticket_enabled,
        )
        self.db.add(report)
        self.db.flush()
        self._record_event(report, schemas.DailyReportEventType.DRAFT_CREATED)
        return report

    def update_report(
        self,
        report: models.DailyReport,
        payload: schemas.DailyReportUpdate,
    ) -> models.DailyReport:
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
        self._record_event(report, schemas.DailyReportEventType.UPDATED)
        return report

    # ------------------------------------------------------------------
    # Retrieval
    # ------------------------------------------------------------------
    def list_reports(
        self,
        *,
        owner_id: str,
        status_filter: schemas.DailyReportStatus | None = None,
    ) -> list[models.DailyReport]:
        query = (
            self.db.query(models.DailyReport)
            .options(selectinload(models.DailyReport.cards))
            .filter(models.DailyReport.owner_id == owner_id)
            .order_by(models.DailyReport.created_at.desc())
        )

        if status_filter:
            query = query.filter(models.DailyReport.status == status_filter.value)

        return query.all()

    def get_report(
        self,
        *,
        report_id: str,
        owner_id: str,
        include_details: bool = False,
    ) -> models.DailyReport:
        query = self.db.query(models.DailyReport).filter(
            models.DailyReport.id == report_id,
            models.DailyReport.owner_id == owner_id,
        )

        if include_details:
            query = query.options(
                selectinload(models.DailyReport.cards)
                .selectinload(models.DailyReportCardLink.card)
                .selectinload(models.Card.subtasks),
                selectinload(models.DailyReport.cards)
                .selectinload(models.DailyReportCardLink.card)
                .selectinload(models.Card.status),
                selectinload(models.DailyReport.events),
            )
        else:
            query = query.options(selectinload(models.DailyReport.cards))

        report = query.first()
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Daily or weekly report not found",
            )
        return report

    # ------------------------------------------------------------------
    # Analysis pipeline
    # ------------------------------------------------------------------
    def submit_report(
        self,
        report: models.DailyReport,
        *,
        max_cards: int = _MAX_GENERATED_CARDS,
    ) -> DailyReportProcessResult:
        if self.analyzer is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Daily or weekly report analyzer is not configured.",
            )

        if report.status not in {
            schemas.DailyReportStatus.DRAFT.value,
            schemas.DailyReportStatus.SUBMITTED.value,
            schemas.DailyReportStatus.FAILED.value,
            schemas.DailyReportStatus.COMPLETED.value,
        }:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Report in status '{report.status}' cannot be submitted.",
            )

        report.status = schemas.DailyReportStatus.PROCESSING.value
        report.analysis_started_at = datetime.now(timezone.utc)
        report.analysis_model = None
        report.failure_reason = None
        self._record_event(report, schemas.DailyReportEventType.SUBMITTED)
        self._record_event(report, schemas.DailyReportEventType.ANALYSIS_STARTED)
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
            report.status = schemas.DailyReportStatus.FAILED.value
            report.analysis_completed_at = datetime.now(timezone.utc)
            report.failure_reason = error_message
            self._update_processing_meta(report, last_error=error_message)
            self._record_event(
                report,
                schemas.DailyReportEventType.ANALYSIS_FAILED,
                {"message": error_message},
            )
            self.db.flush()
            detail = self.to_detail(report)
            return DailyReportProcessResult(detail=detail, proposals=[], destroyed=False, error=error_message)

        stored_proposals = proposals[:max_cards]
        self._update_processing_meta(
            report,
            proposals=[proposal.model_dump() for proposal in stored_proposals],
            created_card_ids=[],
            last_error=None,
        )
        report.status = schemas.DailyReportStatus.COMPLETED.value
        report.analysis_completed_at = datetime.now(timezone.utc)

        self._record_event(
            report,
            schemas.DailyReportEventType.PROPOSALS_RECORDED,
            {"proposal_count": len(stored_proposals)},
        )
        self._record_event(
            report,
            schemas.DailyReportEventType.ANALYSIS_COMPLETED,
            {"cards_created": 0, "proposals_recorded": len(stored_proposals)},
        )
        self.db.flush()
        detail = self.to_detail(report)
        self.db.delete(report)
        return DailyReportProcessResult(
            detail=detail,
            proposals=stored_proposals,
            destroyed=True,
            error=None,
        )

    # ------------------------------------------------------------------
    # Serialization helpers
    # ------------------------------------------------------------------
    def to_read(self, report: models.DailyReport) -> schemas.DailyReportRead:
        sections = self._sections_from_content(report)
        return schemas.DailyReportRead(
            id=report.id,
            shift_type=report.shift_type,
            tags=list(report.tags or []),
            status=schemas.DailyReportStatus(report.status),
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

    def to_list_item(self, report: models.DailyReport) -> schemas.DailyReportListItem:
        sections = self._sections_from_content(report)
        summary = next((section.body for section in sections if section.body), None)
        pending = self._pending_proposals(report.processing_meta)
        return schemas.DailyReportListItem(
            id=report.id,
            status=schemas.DailyReportStatus(report.status),
            shift_type=report.shift_type,
            tags=list(report.tags or []),
            auto_ticket_enabled=report.auto_ticket_enabled,
            created_at=report.created_at,
            updated_at=report.updated_at,
            card_count=len(report.cards or []),
            proposal_count=len(pending),
            summary=summary,
        )

    def to_detail(self, report: models.DailyReport) -> schemas.DailyReportDetail:
        base = self.to_read(report)
        cards = [self._serialize_card_link(link) for link in report.cards or []]
        events = [
            schemas.DailyReportEventRead(
                id=event.id,
                event_type=schemas.DailyReportEventType(event.event_type),
                payload=dict(event.payload or {}),
                created_at=self._normalize_timestamp(event.created_at),
            )
            for event in sorted(report.events or [], key=self._event_sort_key)
        ]
        pending = self._pending_proposals(report.processing_meta)
        return schemas.DailyReportDetail(
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
        self, sections: Sequence[schemas.DailyReportSection]
    ) -> list[schemas.DailyReportSection]:
        normalized: list[schemas.DailyReportSection] = []
        for section in sections:
            body = section.body.strip()
            title = section.title.strip() if section.title else None
            if not body:
                continue
            normalized.append(schemas.DailyReportSection(title=title, body=body))
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

    def _sections_to_content(self, sections: Sequence[schemas.DailyReportSection]) -> dict:
        return {"sections": [section.model_dump() for section in sections]}

    def _sections_from_content(self, report: models.DailyReport) -> list[schemas.DailyReportSection]:
        content = report.content or {}
        raw_sections = content.get("sections", []) if isinstance(content, dict) else []
        sections: list[schemas.DailyReportSection] = []
        for item in raw_sections:
            if not isinstance(item, dict):
                continue
            body = str(item.get("body", "")).strip()
            if not body:
                continue
            title = item.get("title")
            sections.append(
                schemas.DailyReportSection(
                    title=str(title).strip() if title else None,
                    body=body,
                )
            )
        return sections

    def _compose_analysis_prompt(
        self, report: models.DailyReport, sections: Sequence[schemas.DailyReportSection]
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

    def _ensure_processing_meta(self, report: models.DailyReport) -> dict:
        if not isinstance(report.processing_meta, dict):
            report.processing_meta = {}
        return report.processing_meta

    def _update_processing_meta(self, report: models.DailyReport, **values: Any) -> dict:
        base = dict(self._ensure_processing_meta(report))
        base.update(values)
        report.processing_meta = base
        return base

    def _record_event(
        self,
        report: models.DailyReport,
        event_type: schemas.DailyReportEventType,
        payload: dict | None = None,
    ) -> models.DailyReportEvent:
        event = models.DailyReportEvent(
            report_id=report.id,
            event_type=event_type.value,
            payload=payload or {},
        )
        self.db.add(event)
        report.events.append(event)
        return event

    def _serialize_card_link(self, link: models.DailyReportCardLink) -> schemas.DailyReportCardSummary:
        card = link.card
        if not card:
            return schemas.DailyReportCardSummary(
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
        return schemas.DailyReportCardSummary(
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

    def _event_sort_key(self, event: models.DailyReportEvent) -> datetime:
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

