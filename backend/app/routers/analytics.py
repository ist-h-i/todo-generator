from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..utils.dependencies import require_admin

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _snapshot_query(db: Session):
    return db.query(models.AnalyticsSnapshot)


@router.get("/snapshots", response_model=List[schemas.AnalyticsSnapshotRead])
def list_snapshots(
    period_start: Optional[datetime] = Query(default=None),
    period_end: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> List[models.AnalyticsSnapshot]:
    query = _snapshot_query(db)
    if period_start:
        query = query.filter(models.AnalyticsSnapshot.period_end >= period_start)
    if period_end:
        query = query.filter(models.AnalyticsSnapshot.period_start <= period_end)
    return query.order_by(models.AnalyticsSnapshot.period_end.desc()).all()


@router.post(
    "/snapshots",
    response_model=schemas.AnalyticsSnapshotRead,
    status_code=status.HTTP_201_CREATED,
)
def create_snapshot(
    payload: schemas.AnalyticsSnapshotCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.AnalyticsSnapshot:
    snapshot = models.AnalyticsSnapshot(
        title=payload.title,
        period_start=payload.period_start,
        period_end=payload.period_end,
        metrics=payload.metrics,
        generated_by=payload.generated_by,
        workspace_id=payload.workspace_id,
        narrative=payload.narrative,
    )
    db.add(snapshot)
    db.commit()
    db.refresh(snapshot)
    return snapshot


@router.get("/snapshots/{snapshot_id}", response_model=schemas.AnalyticsSnapshotRead)
def get_snapshot(
    snapshot_id: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.AnalyticsSnapshot:
    snapshot = db.get(models.AnalyticsSnapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    return snapshot

