from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.gemini import GeminiClient, get_gemini_client
from ..services.status_reports import StatusReportService

router = APIRouter(prefix="/status-reports", tags=["status-reports"])


@router.post("", response_model=schemas.StatusReportRead, status_code=status.HTTP_201_CREATED)
def create_status_report(
    payload: schemas.StatusReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.StatusReportRead:
    service = StatusReportService(db)
    report = service.create_report(owner=current_user, payload=payload)
    db.commit()
    refreshed = service.get_report(report_id=report.id, owner_id=current_user.id)
    return service.to_read(refreshed)


@router.get("", response_model=list[schemas.StatusReportListItem])
def list_status_reports(
    status_filter: Optional[schemas.StatusReportStatus] = Query(default=None, alias="status"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.StatusReportListItem]:
    service = StatusReportService(db)
    reports = service.list_reports(
        owner_id=current_user.id,
        status_filter=status_filter,
    )
    return [service.to_list_item(report) for report in reports]


@router.get("/{report_id}", response_model=schemas.StatusReportDetail)
def get_status_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.StatusReportDetail:
    service = StatusReportService(db)
    report = service.get_report(report_id=report_id, owner_id=current_user.id, include_details=True)
    return service.to_detail(report)


@router.put("/{report_id}", response_model=schemas.StatusReportRead)
def update_status_report(
    report_id: str,
    payload: schemas.StatusReportUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.StatusReportRead:
    service = StatusReportService(db)
    report = service.get_report(report_id=report_id, owner_id=current_user.id)
    if report.status not in {schemas.StatusReportStatus.DRAFT.value, schemas.StatusReportStatus.FAILED.value}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft or failed reports can be updated.",
        )
    service.update_report(report, payload)
    db.commit()
    refreshed = service.get_report(report_id=report.id, owner_id=current_user.id)
    return service.to_read(refreshed)


@router.post("/{report_id}/submit", response_model=schemas.StatusReportDetail)
def submit_status_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    analyzer: GeminiClient = Depends(get_gemini_client),
) -> schemas.StatusReportDetail:
    service = StatusReportService(db, analyzer=analyzer)
    report = service.get_report(report_id=report_id, owner_id=current_user.id, include_details=True)
    if report.status == schemas.StatusReportStatus.PROCESSING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report is already processing.")
    result = service.submit_report(report)
    db.commit()
    return result.detail


@router.post("/{report_id}/retry", response_model=schemas.StatusReportDetail)
def retry_status_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    analyzer: GeminiClient = Depends(get_gemini_client),
) -> schemas.StatusReportDetail:
    service = StatusReportService(db, analyzer=analyzer)
    report = service.get_report(report_id=report_id, owner_id=current_user.id, include_details=True)
    if report.status != schemas.StatusReportStatus.FAILED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Retry is only available for failed reports.",
        )
    result = service.submit_report(report)
    db.commit()
    return result.detail

