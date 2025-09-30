import re
from typing import Iterable

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db
from ..schemas import AnalysisCard, AnalysisRequest, AnalysisResponse
from ..services.gemini import (
    GeminiClient,
    GeminiError,
    build_workspace_analysis_options,
    get_gemini_client,
)
from ..services.profile import build_user_profile

router = APIRouter(prefix="/analysis", tags=["analysis"])


_LABEL_ID_PATTERN = re.compile(r"\b(?:id|label_id|label)\s*[:=]\s*([A-Za-z0-9_-]+)", re.IGNORECASE)


def _normalize_label_name(value: str) -> str | None:
    """Return a trimmed label candidate without trailing metadata."""

    text = " ".join(value.strip().split())
    if not text:
        return None

    prefix_match = re.match(r"^(?:label|labels)\s*[:=]\s*(.+)$", text, flags=re.IGNORECASE)
    if prefix_match:
        text = prefix_match.group(1).strip()

    text = re.sub(r"\s*\([^()]*?(?:id|label)[^()]*\)\s*$", "", text).strip()
    text = text.strip("'\"")
    if not text:
        return None

    return text[:100]


def _tokenize_label(value: str) -> set[str]:
    tokens: set[str] = set()
    normalized = value.strip()
    if normalized:
        tokens.add(normalized)

    for match in _LABEL_ID_PATTERN.finditer(value):
        candidate = match.group(1).strip()
        if candidate:
            tokens.add(candidate)

    for part in re.split(r"[\s,;、/|()[\]{}]+", value):
        candidate = part.strip()
        if candidate:
            tokens.add(candidate)

    return tokens


def _ensure_labels_registered(
    db: Session,
    *,
    owner_id: str,
    proposals: Iterable[AnalysisCard],
    workspace_labels: Iterable[tuple[str, str]],
) -> None:
    known_ids: dict[str, str] = {}
    known_names: dict[str, str] = {}

    for label_id, label_name in workspace_labels:
        known_ids[label_id.casefold()] = label_id
        if label_name:
            known_names[label_name.casefold()] = label_id

    for proposal in proposals:
        resolved_label_ids: list[str] = []
        for raw_label in list(proposal.labels):
            tokens = _tokenize_label(raw_label)
            match_id: str | None = None
            for token in tokens:
                existing = known_ids.get(token.casefold())
                if existing:
                    match_id = existing
                    break

            if match_id is None:
                candidate_name = None
                for token in tokens:
                    candidate = known_names.get(token.casefold())
                    if candidate:
                        match_id = candidate
                        break
                if match_id is None:
                    candidate_name = _normalize_label_name(raw_label)
                    if candidate_name:
                        lookup_key = candidate_name.casefold()
                        match_id = known_names.get(lookup_key)
                        if match_id is None:
                            label = models.Label(
                                name=candidate_name,
                                owner_id=owner_id,
                            )
                            db.add(label)
                            db.flush()
                            match_id = label.id
                            known_ids[match_id.casefold()] = match_id
                            known_names[lookup_key] = match_id

            if match_id:
                resolved_label_ids.append(match_id)

        proposal.labels = resolved_label_ids


@router.post("", response_model=AnalysisResponse)
def analyze(
    payload: AnalysisRequest,
    gemini: GeminiClient = Depends(get_gemini_client),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResponse:
    """Analyze free-form text and return structured card proposals."""

    profile = build_user_profile(current_user)
    workspace_options = build_workspace_analysis_options(db, owner_id=current_user.id)
    raw_notes = payload.notes if payload.notes is not None else payload.text
    notes = raw_notes.strip() if raw_notes else None
    objective = payload.objective.strip() if payload.objective else None
    record = models.AnalysisSession(
        user_id=current_user.id,
        request_text=payload.text,
        notes=notes,
        objective=objective,
        auto_objective=bool(payload.auto_objective),
        max_cards=payload.max_cards,
    )
    db.add(record)
    db.flush()
    try:
        response = gemini.analyze(
            payload,
            user_profile=profile,
            workspace_options=workspace_options,
        )
    except GeminiError as exc:
        record.status = "failed"
        record.failure_reason = str(exc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    _ensure_labels_registered(
        db,
        owner_id=current_user.id,
        proposals=response.proposals,
        workspace_labels=((label.id, label.name) for label in workspace_options.labels),
    )

    record.status = "completed"
    record.response_model = response.model
    record.proposals = [proposal.model_dump() for proposal in response.proposals]
    db.commit()
    return response
