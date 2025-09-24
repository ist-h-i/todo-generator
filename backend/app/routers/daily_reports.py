from __future__ import annotations

from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.chatgpt import ChatGPTClient, get_chatgpt_client
from ..services.daily_reports import DailyReportService

router = APIRouter(prefix="/daily-reports", tags=["daily-reports"])


@router.post("", response_model=schemas.DailyReportRead, status_code=status.HTTP_201_CREATED)
def create_daily_report(
    payload: schemas.DailyReportCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.DailyReportRead:
    service = DailyReportService(db)
    report = service.create_report(owner=current_user, payload=payload)
    db.commit()
    refreshed = service.get_report(report_id=report.id, owner_id=current_user.id)
    return service.to_read(refreshed)


@router.get("", response_model=list[schemas.DailyReportListItem])
def list_daily_reports(
    status_filter: Optional[schemas.DailyReportStatus] = Query(default=None, alias="status"),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[schemas.DailyReportListItem]:
    service = DailyReportService(db)
    reports = service.list_reports(
        owner_id=current_user.id,
        status_filter=status_filter,
        start_date=start_date,
        end_date=end_date,
    )
    return [service.to_list_item(report) for report in reports]


@router.get("/{report_id}", response_model=schemas.DailyReportDetail)
def get_daily_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.DailyReportDetail:
    service = DailyReportService(db)
    report = service.get_report(report_id=report_id, owner_id=current_user.id, include_details=True)
    return service.to_detail(report)


@router.put("/{report_id}", response_model=schemas.DailyReportRead)
def update_daily_report(
    report_id: str,
    payload: schemas.DailyReportUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> schemas.DailyReportRead:
    service = DailyReportService(db)
    report = service.get_report(report_id=report_id, owner_id=current_user.id)
    if report.status not in {schemas.DailyReportStatus.DRAFT.value, schemas.DailyReportStatus.FAILED.value}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft or failed reports can be updated.",
        )
    service.update_report(report, payload)
    db.commit()
    refreshed = service.get_report(report_id=report.id, owner_id=current_user.id)
    return service.to_read(refreshed)


@router.post("/{report_id}/submit", response_model=schemas.DailyReportDetail)
def submit_daily_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    analyzer: ChatGPTClient = Depends(get_chatgpt_client),
) -> schemas.DailyReportDetail:
    service = DailyReportService(db, analyzer=analyzer)
    report = service.get_report(report_id=report_id, owner_id=current_user.id, include_details=True)
    if report.status == schemas.DailyReportStatus.PROCESSING.value:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Report is already processing.")
    service.submit_report(report)
    db.commit()
    refreshed = service.get_report(report_id=report.id, owner_id=current_user.id, include_details=True)
    return service.to_detail(refreshed)


@router.post("/{report_id}/retry", response_model=schemas.DailyReportDetail)
def retry_daily_report(
    report_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    analyzer: ChatGPTClient = Depends(get_chatgpt_client),
) -> schemas.DailyReportDetail:
    service = DailyReportService(db, analyzer=analyzer)
    report = service.get_report(report_id=report_id, owner_id=current_user.id, include_details=True)
    if report.status not in {
        schemas.DailyReportStatus.FAILED.value,
        schemas.DailyReportStatus.COMPLETED.value,
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Retry is only available for failed or completed reports.",
        )
    service.submit_report(report)
    db.commit()
    refreshed = service.get_report(report_id=report.id, owner_id=current_user.id, include_details=True)
    return service.to_detail(refreshed)

