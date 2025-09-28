from fastapi import APIRouter, Depends, HTTPException, status

from .. import models
from ..auth import get_current_user
from ..schemas import AnalysisRequest, AnalysisResponse
from ..services.gemini import GeminiClient, get_gemini_client
from ..services.llm_shared import LLMError
from ..services.profile import build_user_profile

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
def analyze(
    payload: AnalysisRequest,
    analyzer: GeminiClient = Depends(get_gemini_client),
    current_user: models.User = Depends(get_current_user),
) -> AnalysisResponse:
    """Analyze free-form text and return structured card proposals."""

    profile = build_user_profile(current_user)
    try:
        return analyzer.analyze(payload, user_profile=profile)
    except LLMError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
