from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db
from ..utils.dependencies import require_admin

router = APIRouter(prefix="/reports", tags=["reports"])


def _template_query(db: Session, owner_id: str):
    return db.query(models.ReportTemplate).filter(models.ReportTemplate.owner_id == owner_id)


def _report_query(db: Session):
    return db.query(models.GeneratedReport)


def _format_metrics(snapshot: models.AnalyticsSnapshot | None) -> str:
    if not snapshot:
        return "No analytics snapshot selected."
    metrics = snapshot.metrics or {}
    lines: List[str] = []
    top_errors = metrics.get("top_errors")
    if isinstance(top_errors, list) and top_errors:
        lines.append("Top recurring issues:")
        for error in top_errors[:5]:
            if isinstance(error, dict):
                lines.append(
                    f"- {error.get('name', 'Issue')} • {error.get('count', '?')} occurrences "
                    f"(severity {error.get('severity', 'n/a')})"
                )
            else:
                lines.append(f"- {error}")
    trend = metrics.get("trend")
    if trend:
        lines.append(f"Trend insight: {trend}")
    summary = metrics.get("summary")
    if summary:
        lines.append(str(summary))
    if not lines:
        lines.append("Analytics capture is available but no notable changes were detected.")
    return "\n".join(lines)


def _format_immunity_map(immunity_map_id: str | None) -> str:
    if not immunity_map_id:
        return "No immunity map selected."
    return "Immunity map detail is not stored yet. Generate Mermaid via /analysis/immunity-map and paste it here."


def _format_initiatives(initiatives: List[models.ImprovementInitiative]) -> str:
    if not initiatives:
        return "No improvement initiatives linked to this report."
    lines = ["Initiative progress summary:"]
    for initiative in initiatives:
        lines.append(
            f"- {initiative.name} ({initiative.status or 'status unknown'}, health {initiative.health or 'n/a'})"
        )
        if initiative.progress_logs:
            latest = sorted(initiative.progress_logs, key=lambda log: log.timestamp)[-1]
            lines.append(f"  Latest update: {latest.status or 'n/a'} — {latest.notes or 'no notes'}")
    return "\n".join(lines)


@router.get("/templates", response_model=List[schemas.ReportTemplateRead])
def list_templates(
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_admin),
) -> List[models.ReportTemplate]:
    templates = (
        _template_query(db, current_admin.id)
        .order_by(models.ReportTemplate.created_at.desc())
        .all()
    )
    for template in templates:
        template.sections = template.sections
    return templates


@router.post(
    "/templates",
    response_model=schemas.ReportTemplateRead,
    status_code=status.HTTP_201_CREATED,
)
def create_template(
    payload: schemas.ReportTemplateCreate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_admin),
) -> models.ReportTemplate:
    template = models.ReportTemplate(
        name=payload.name,
        audience=payload.audience,
        sections_json=payload.sections,
        branding=payload.branding,
        owner_id=current_admin.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    template.sections = template.sections
    return template


@router.get("/templates/{template_id}", response_model=schemas.ReportTemplateRead)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_admin),
) -> models.ReportTemplate:
    template = (
        _template_query(db, current_admin.id)
        .filter(models.ReportTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    template.sections = template.sections
    return template


@router.patch("/templates/{template_id}", response_model=schemas.ReportTemplateRead)
def update_template(
    template_id: str,
    payload: schemas.ReportTemplateUpdate,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_admin),
) -> models.ReportTemplate:
    template = (
        _template_query(db, current_admin.id)
        .filter(models.ReportTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    update_data = payload.model_dump(exclude_unset=True)
    sections = update_data.pop("sections", None)
    for key, value in update_data.items():
        setattr(template, key, value)
    if sections is not None:
        template.sections = sections

    db.add(template)
    db.commit()
    db.refresh(template)
    template.sections = template.sections
    return template


@router.get("/", response_model=List[schemas.GeneratedReportRead])
def list_reports(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> List[models.GeneratedReport]:
    reports = (
        _report_query(db)
        .options(selectinload(models.GeneratedReport.template))
        .order_by(models.GeneratedReport.created_at.desc())
        .all()
    )
    for report in reports:
        report.parameters = report.parameters
    return reports


@router.get("/{report_id}", response_model=schemas.GeneratedReportRead)
def get_report(
    report_id: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.GeneratedReport:
    report = _report_query(db).filter(models.GeneratedReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    report.parameters = report.parameters
    return report


@router.post(
    "/generate",
    response_model=schemas.ReportGenerateResponse,
    status_code=status.HTTP_201_CREATED,
)
def generate_report(
    payload: schemas.ReportGenerateRequest,
    db: Session = Depends(get_db),
    current_admin: models.User = Depends(require_admin),
) -> models.GeneratedReport:
    template = None
    if payload.template_id:
        template = (
            _template_query(db, current_admin.id)
            .filter(models.ReportTemplate.id == payload.template_id)
            .first()
        )
        if not template:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    snapshot = db.get(models.AnalyticsSnapshot, payload.snapshot_id) if payload.snapshot_id else None
    initiatives: List[models.ImprovementInitiative] = []
    if payload.initiative_ids:
        initiatives = (
            db.query(models.ImprovementInitiative)
            .options(selectinload(models.ImprovementInitiative.progress_logs))
            .filter(models.ImprovementInitiative.id.in_(payload.initiative_ids))
            .all()
        )

    section_source = payload.parameters.get("sections") if payload.parameters else None
    if section_source is None and template:
        section_source = template.sections
    sections = section_source or ["Overview", "Analytics", "Immunity Map", "Next Steps"]

    content_blocks: List[str] = []
    title = payload.parameters.get("title") if payload.parameters else None
    if not title and template:
        title = template.name
    if title:
        content_blocks.append(f"# {title}")

    analytics_summary = _format_metrics(snapshot)
    immunity_map_summary = _format_immunity_map(payload.immunity_map_id)
    initiatives_summary = _format_initiatives(initiatives)

    for raw_section in sections:
        if isinstance(raw_section, dict):
            heading = raw_section.get("title", "Section")
        else:
            heading = str(raw_section)
        key = heading.lower()
        if "analytic" in key or "metric" in key:
            body = analytics_summary
        elif "immunity" in key or "map" in key:
            body = immunity_map_summary
        elif "initiative" in key or "program" in key:
            body = initiatives_summary
        elif "action" in key or "next" in key:
            body = payload.parameters.get("notes", "") if payload.parameters else ""
        else:
            body = payload.parameters.get("notes", "") if payload.parameters else ""
        content_blocks.append(f"## {heading}\n{body.strip() or 'No content available.'}")

    report = models.GeneratedReport(
        template_id=payload.template_id,
        author_id=current_admin.id,
        parameters_json=payload.parameters,
        content="\n\n".join(content_blocks),
    )

    db.add(report)
    db.commit()
    db.refresh(report)
    report.parameters = report.parameters
    return report
