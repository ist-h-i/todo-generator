from fastapi import APIRouter, Depends

from ..schemas import AnalysisRequest, AnalysisResponse
from ..services.gemini import GeminiClient, get_gemini_client

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
def analyze(
    payload: AnalysisRequest, gemini: GeminiClient = Depends(get_gemini_client)
) -> AnalysisResponse:
    """Analyze free-form text and return structured card proposals."""

    return gemini.analyze(payload)
