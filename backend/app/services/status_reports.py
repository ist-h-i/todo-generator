from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from .gemini import (
    GeminiClient,
    GeminiError,
    build_workspace_analysis_options,
)
from .status_report_content import StatusReportContentService
from .status_report_presenter import StatusReportPresenter

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

    def __init__(
        self,
        db: Session,
        analyzer: GeminiClient | None = None,
        *,
        content_service: StatusReportContentService | None = None,
        presenter: StatusReportPresenter | None = None,
    ) -> None:
        self.db = db
        self.analyzer = analyzer
        self.content_service = content_service or StatusReportContentService()
        self.presenter = presenter or StatusReportPresenter(self.content_service)

    # ------------------------------------------------------------------
    # Persistence helpers
    # ------------------------------------------------------------------
    def create_report(
        self,
        *,
        owner: models.User,
        payload: schemas.StatusReportCreate,
    ) -> models.StatusReport:
        sections = self.content_service.normalize_sections(payload.sections)
        if not sections:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="At least one section with content is required.",
            )

        report = models.StatusReport(
            owner_id=owner.id,
            shift_type=payload.shift_type,
            tags=self.content_service.normalize_tags(payload.tags),
            content=self.content_service.sections_to_content(sections),
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
            report.tags = self.content_service.normalize_tags(payload.tags)

        if payload.sections is not None:
            sections = self.content_service.normalize_sections(payload.sections)
            if not sections:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="At least one section with content is required.",
                )
            report.content = self.content_service.sections_to_content(sections)

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

        sections = self.content_service.extract_sections(report)
        analysis_text = self.content_service.compose_analysis_prompt(report, sections)
        proposals: list[schemas.AnalysisCard] = []
        error_message: str | None = None

        workspace_options = build_workspace_analysis_options(self.db, owner_id=report.owner_id)

        try:
            response = self.analyzer.analyze(
                schemas.AnalysisRequest(text=analysis_text, max_cards=max_cards),
                workspace_options=workspace_options,
            )
        except GeminiError as exc:
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
        return StatusReportProcessResult(
            detail=detail,
            proposals=stored_proposals,
            destroyed=False,
            error=None,
        )

    # ------------------------------------------------------------------
    # Serialization helpers
    # ------------------------------------------------------------------
    def to_read(self, report: models.StatusReport) -> schemas.StatusReportRead:
        return self.presenter.to_read(report)

    def to_list_item(self, report: models.StatusReport) -> schemas.StatusReportListItem:
        return self.presenter.to_list_item(report)

    def to_detail(self, report: models.StatusReport) -> schemas.StatusReportDetail:
        return self.presenter.to_detail(report)

    def _serialize_card_link(self, link: models.StatusReportCardLink) -> schemas.StatusReportCardSummary:
        return self.presenter.serialize_card_link(link)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------
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
