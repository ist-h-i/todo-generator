from __future__ import annotations

from fastapi import APIRouter, Depends

from .. import models, schemas
from ..auth import get_current_user
from ..services.appeals import AppealGenerationService, get_appeal_service

router = APIRouter(prefix="/appeals", tags=["appeals"])


@router.get("/config", response_model=schemas.AppealConfigResponse)
def get_appeal_config(
    current_user: models.User = Depends(get_current_user),
    service: AppealGenerationService = Depends(get_appeal_service),
) -> schemas.AppealConfigResponse:
    """Return available subjects, flows and formats for appeal generation."""

    return service.load_configuration(owner=current_user)


@router.post("/generate", response_model=schemas.AppealGenerationResponse)
def generate_appeal(
    payload: schemas.AppealGenerationRequest,
    current_user: models.User = Depends(get_current_user),
    service: AppealGenerationService = Depends(get_appeal_service),
) -> schemas.AppealGenerationResponse:
    """Generate appeal narratives for the requested formats."""

    return service.generate(owner=current_user, request=payload)
