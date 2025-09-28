from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db
from ..schemas import AnalysisRequest, AnalysisResponse
from ..services.chatgpt import ChatGPTClient, ChatGPTError, get_chatgpt_client
from ..services.profile import build_user_profile

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
def analyze(
    payload: AnalysisRequest,
    chatgpt: ChatGPTClient = Depends(get_chatgpt_client),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AnalysisResponse:
    """Analyze free-form text and return structured card proposals."""

    profile = build_user_profile(current_user)
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
        response = chatgpt.analyze(payload, user_profile=profile)
    except ChatGPTError as exc:
        record.status = "failed"
        record.failure_reason = str(exc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    record.status = "completed"
    record.response_model = response.model
    record.proposals = [proposal.model_dump() for proposal in response.proposals]
    db.commit()
    return response
