from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _snapshot_query(db: Session):
    return db.query(models.AnalyticsSnapshot)


def _analysis_query(db: Session):
    return db.query(models.RootCauseAnalysis).options(
        selectinload(models.RootCauseAnalysis.nodes),
        selectinload(models.RootCauseAnalysis.suggestions),
    )


@router.get("/snapshots", response_model=List[schemas.AnalyticsSnapshotRead])
def list_snapshots(
    period_start: Optional[datetime] = Query(default=None),
    period_end: Optional[datetime] = Query(default=None),
    db: Session = Depends(get_db),
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
    payload: schemas.AnalyticsSnapshotCreate, db: Session = Depends(get_db)
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
def get_snapshot(snapshot_id: str, db: Session = Depends(get_db)) -> models.AnalyticsSnapshot:
    snapshot = db.get(models.AnalyticsSnapshot, snapshot_id)
    if not snapshot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Snapshot not found")
    return snapshot


def _resolve_target(
    db: Session, target_id: str
) -> tuple[str, Optional[models.AnalyticsSnapshot], Optional[models.Card]]:
    snapshot = db.get(models.AnalyticsSnapshot, target_id)
    if snapshot:
        return "snapshot", snapshot, None
    card = db.get(models.Card, target_id)
    if card:
        return "card", None, card
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target not found")


def _next_version(db: Session, target_type: str, target_id: Optional[str]) -> int:
    query = db.query(models.RootCauseAnalysis.version).filter(models.RootCauseAnalysis.target_type == target_type)
    if target_id:
        query = query.filter(models.RootCauseAnalysis.target_id == target_id)
    latest = query.order_by(models.RootCauseAnalysis.version.desc()).first()
    if not latest:
        return 1
    return int(latest[0]) + 1


def _safe_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if value is None:
        return []
    return [value]


def _suggestions_from_metric(
    analysis: models.RootCauseAnalysis,
    node: models.RootCauseNode,
    metric: dict,
) -> List[models.SuggestedAction]:
    actions: List[models.SuggestedAction] = []
    title = metric.get("remediation") or metric.get("next_step")
    if not title:
        title = f"Mitigate {metric.get('name', 'issue')} drivers"
    description = metric.get("recommendation") or metric.get("summary")
    if not description:
        description = (
            f"Coordinate with the owning team to reduce {metric.get('name', 'the issue')} "
            "frequency and capture lessons learned."
        )
    effort = metric.get("effort") or metric.get("effort_estimate") or "medium"
    owner = metric.get("owner") or metric.get("owner_role") or "initiative-owner"
    impact_raw = metric.get("impact_score") or metric.get("impact") or 3
    try:
        impact = int(impact_raw)
    except (TypeError, ValueError):
        impact = 3

    actions.append(
        models.SuggestedAction(
            analysis_id=analysis.id,
            node_id=node.id,
            title=title,
            description=description,
            effort_estimate=str(effort),
            impact_score=impact,
            owner_role=str(owner),
            status="pending",
        )
    )

    extra_actions = _safe_list(metric.get("next_actions"))
    for extra in extra_actions[:2]:
        if isinstance(extra, str):
            actions.append(
                models.SuggestedAction(
                    analysis_id=analysis.id,
                    node_id=node.id,
                    title=extra,
                    description=description,
                    effort_estimate=str(effort),
                    impact_score=impact,
                    owner_role=str(owner),
                    status="pending",
                )
            )
        elif isinstance(extra, dict) and extra.get("title"):
            actions.append(
                models.SuggestedAction(
                    analysis_id=analysis.id,
                    node_id=node.id,
                    title=str(extra.get("title")),
                    description=str(extra.get("description") or description),
                    effort_estimate=str(extra.get("effort") or effort),
                    impact_score=impact,
                    owner_role=str(extra.get("owner") or owner),
                    status=str(extra.get("status") or "pending"),
                )
            )
    return actions


def _hydrate_from_snapshot(
    db: Session,
    analysis: models.RootCauseAnalysis,
    snapshot: models.AnalyticsSnapshot,
    payload: schemas.WhyWhyRequest,
) -> None:
    context_metrics = snapshot.metrics or {}
    top_errors = _safe_list(context_metrics.get("top_errors"))

    root_statement = (
        payload.focus_question
        or snapshot.narrative
        or (f"Why are issues recurring between {snapshot.period_start:%Y-%m-%d} and {snapshot.period_end:%Y-%m-%d}?")
    )
    root_node = models.RootCauseNode(
        analysis_id=analysis.id,
        depth=0,
        statement=root_statement,
        confidence=0.7,
        recommended_metrics=context_metrics.get("kpis") or [],
        state="confirmed",
    )
    db.add(root_node)
    db.flush()

    created_children = 0
    for error in top_errors[:5]:
        if not isinstance(error, dict):
            continue
        statement = (
            error.get("why")
            or error.get("statement")
            or f"{error.get('name', 'Issue')} persists due to {error.get('driver', 'underlying causes')}"
        )
        confidence = error.get("confidence") or error.get("score") or 0.6
        try:
            confidence_value = float(confidence)
        except (TypeError, ValueError):
            confidence_value = 0.6
        node = models.RootCauseNode(
            analysis_id=analysis.id,
            depth=1,
            parent_id=root_node.id,
            statement=statement,
            confidence=confidence_value,
            evidence_refs=_safe_list(error.get("examples") or error.get("evidence")),
            recommended_metrics=_safe_list(error.get("metrics")),
            state=str(error.get("state") or "proposed"),
        )
        db.add(node)
        db.flush()
        created_children += 1

        for suggestion in _suggestions_from_metric(analysis, node, error):
            db.add(suggestion)

    if created_children == 0:
        fallback = models.RootCauseNode(
            analysis_id=analysis.id,
            depth=1,
            parent_id=root_node.id,
            statement="Insufficient data captured to isolate dominant causes.",
            confidence=0.4,
            state="needs-review",
            recommended_metrics=["capture_root_cause_notes"],
        )
        db.add(fallback)
        db.flush()
        db.add(
            models.SuggestedAction(
                analysis_id=analysis.id,
                node_id=fallback.id,
                title="Capture structured root cause notes",
                description="Enhance incident intake forms to include impact, trigger, and containment actions.",
                effort_estimate="medium",
                impact_score=3,
                owner_role="process-owner",
                status="pending",
            )
        )

    analysis.summary = f"Identified {created_children or 1} contributing causes for snapshot {snapshot.id}."


def _hydrate_from_card(
    db: Session,
    analysis: models.RootCauseAnalysis,
    card: models.Card,
    payload: schemas.WhyWhyRequest,
) -> None:
    root_statement = payload.focus_question or (f"Why does '{card.title}' continue to surface as an issue?")
    root_node = models.RootCauseNode(
        analysis_id=analysis.id,
        depth=0,
        statement=root_statement,
        confidence=0.65,
        evidence_refs=[card.id],
        state="needs-review",
    )
    db.add(root_node)
    db.flush()

    summary_sentences = []
    if card.summary:
        summary_sentences = [sentence.strip() for sentence in card.summary.split(".") if sentence.strip()]
    if not summary_sentences and card.description:
        summary_sentences = [sentence.strip() for sentence in card.description.split(".") if sentence.strip()]

    context = payload.context or {}
    related_tasks = _safe_list(context.get("recent_tasks"))

    child_sources: List[str] = summary_sentences[:3]
    for task in related_tasks[:3]:
        if isinstance(task, dict) and task.get("title"):
            child_sources.append(f"Related work '{task['title']}' indicates {task.get('summary') or 'follow-up gaps'}")

    if not child_sources:
        child_sources = ["Root cause unknown - schedule dedicated discovery session with stakeholders."]

    for source in child_sources:
        node = models.RootCauseNode(
            analysis_id=analysis.id,
            depth=1,
            parent_id=root_node.id,
            statement=source,
            confidence=0.55,
            evidence_refs=[card.id],
            state="proposed",
        )
        db.add(node)
        db.flush()

        description = "Partner with the owning team to validate the cause and capture measurable success criteria."
        db.add(
            models.SuggestedAction(
                analysis_id=analysis.id,
                node_id=node.id,
                title=f"Validate cause: {card.title[:50]}",
                description=description,
                effort_estimate="medium",
                impact_score=4,
                owner_role="feature-owner",
                status="pending",
                initiative_id=card.initiative_id,
            )
        )

    analysis.summary = f"Generated hypotheses for '{card.title}' with {len(child_sources)} follow-up recommendations."


@router.post(
    "/{target_id}/why-why",
    response_model=schemas.WhyWhyTriggerResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def trigger_why_why(
    target_id: str,
    payload: schemas.WhyWhyRequest,
    db: Session = Depends(get_db),
) -> schemas.WhyWhyTriggerResponse:
    target_type, snapshot, card = _resolve_target(db, target_id)
    target_reference = snapshot.id if snapshot else card.id if card else None
    version = _next_version(db, target_type, target_reference)

    analysis = models.RootCauseAnalysis(
        snapshot_id=snapshot.id if snapshot else None,
        target_type=target_type,
        target_id=target_reference,
        created_by=payload.actor_id,
        version=version,
        status="in-progress",
        model_version="heuristic-v1",
    )
    db.add(analysis)
    db.flush()

    if snapshot:
        _hydrate_from_snapshot(db, analysis, snapshot, payload)
    elif card:
        _hydrate_from_card(db, analysis, card, payload)

    analysis.status = "ready"
    db.add(analysis)
    db.commit()
    return schemas.WhyWhyTriggerResponse(analysis_id=analysis.id, status=analysis.status)


@router.get("/why-why/{analysis_id}", response_model=schemas.RootCauseAnalysisRead)
def get_why_why(analysis_id: str, db: Session = Depends(get_db)) -> models.RootCauseAnalysis:
    analysis = _analysis_query(db).filter(models.RootCauseAnalysis.id == analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")

    analysis.nodes.sort(key=lambda node: (node.depth, node.created_at))
    analysis.suggestions.sort(key=lambda suggestion: suggestion.created_at)
    return analysis
