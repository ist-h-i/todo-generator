from fastapi import APIRouter, Depends

from ..schemas import AnalysisRequest, AnalysisResponse
from ..services.chatgpt import ChatGPTClient, get_chatgpt_client

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest, chatgpt: ChatGPTClient = Depends(get_chatgpt_client)) -> AnalysisResponse:
    """Analyze free-form text and return structured card proposals."""

    return chatgpt.analyze(payload)
