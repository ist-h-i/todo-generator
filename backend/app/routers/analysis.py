from fastapi import APIRouter, Depends, HTTPException, status

from ..schemas import AnalysisRequest, AnalysisResponse
from ..services.chatgpt import ChatGPTClient, ChatGPTError, get_chatgpt_client

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("", response_model=AnalysisResponse)
def analyze(payload: AnalysisRequest, chatgpt: ChatGPTClient = Depends(get_chatgpt_client)) -> AnalysisResponse:
    """Analyze free-form text and return structured card proposals."""

    try:
        return chatgpt.analyze(payload)
    except ChatGPTError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
