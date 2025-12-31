"""Administrative endpoints for configuration management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..services.gemini import (
    GeminiClient,
    GeminiConfigurationError,
    GeminiError,
    list_gemini_generate_content_models,
)
from ..utils.dependencies import require_admin
from ..utils.quotas import (
    get_quota_defaults,
    get_user_quota,
    set_quota_defaults,
    upsert_user_quota,
)
from ..utils.secrets import SecretEncryptionKeyError, build_secret_hint, get_secret_cipher

router = APIRouter(prefix="/admin", tags=["admin", "settings"])

_PROVIDER_ALIASES: dict[str, tuple[str, ...]] = {
    "gemini": ("gemini",),
}


def _normalize_provider(provider: str) -> str:
    """Return the canonical provider name for AI credentials."""

    lowered = provider.lower()
    for canonical, aliases in _PROVIDER_ALIASES.items():
        if lowered == canonical or lowered in aliases:
            return canonical
    return lowered


def _provider_candidates(provider: str) -> list[str]:
    """Yield provider identifiers to check when resolving stored credentials."""

    normalized = _normalize_provider(provider)
    candidates: list[str] = []
    for candidate in (normalized, provider, *_PROVIDER_ALIASES.get(normalized, ())):
        lowered_candidate = candidate.lower()
        if lowered_candidate not in candidates:
            candidates.append(lowered_candidate)
    return candidates


def _get_existing_credential(db: Session, provider: str) -> models.ApiCredential | None:
    """Fetch an API credential using canonical provider aliases."""

    for candidate in _provider_candidates(provider):
        credential = (
            db.query(models.ApiCredential).filter(func.lower(models.ApiCredential.provider) == candidate).first()
        )
        if credential:
            return credential
    return None


@router.get("/api-credentials/{provider}", response_model=schemas.ApiCredentialRead)
def get_api_credential(
    provider: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.ApiCredential:
    credential = _get_existing_credential(db, provider)
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")
    if credential.model:
        default_model = GeminiClient.normalize_model_name(settings.gemini_model)
        normalized_model = GeminiClient.normalize_model_name(credential.model)
        sanitized_model = GeminiClient.sanitize_model_name(normalized_model, fallback=default_model)
        target_model = sanitized_model
        if credential.model != target_model:
            credential.model = target_model
            db.add(credential)
            db.commit()
            db.refresh(credential)
    return credential


@router.get("/api-credentials/{provider}/models", response_model=list[str])
def list_api_credential_models(
    provider: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> list[str]:
    normalized_provider = _normalize_provider(provider)
    if normalized_provider != "gemini":
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not supported")

    try:
        return list_gemini_generate_content_models(db, provider=normalized_provider)
    except GeminiConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except GeminiError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


@router.put("/api-credentials/{provider}", response_model=schemas.ApiCredentialRead)
def upsert_api_credential(
    provider: str,
    payload: schemas.ApiCredentialUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> models.ApiCredential:
    credential = _get_existing_credential(db, provider)
    normalized_provider = _normalize_provider(provider)
    default_model = GeminiClient.normalize_model_name(settings.gemini_model)

    try:
        cipher = get_secret_cipher()
    except SecretEncryptionKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    secret = payload.secret
    model_name = payload.model

    if credential is None:
        if not secret:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API トークンを入力してください。")

        encrypted_secret = cipher.encrypt(secret)
        secret_hint = build_secret_hint(secret)
        resolved_model = GeminiClient.normalize_model_name(model_name or default_model)
        resolved_model = GeminiClient.sanitize_model_name(resolved_model, fallback=default_model)
        credential = models.ApiCredential(
            provider=normalized_provider,
            encrypted_secret=encrypted_secret,
            secret_hint=secret_hint,
            is_active=True if payload.is_active is None else payload.is_active,
            model=resolved_model,
            created_by_user=admin_user,
        )
    else:
        if secret:
            credential.encrypted_secret = cipher.encrypt(secret)
            credential.secret_hint = build_secret_hint(secret)
        if model_name is not None:
            resolved_model = GeminiClient.normalize_model_name(model_name or default_model)
            credential.model = GeminiClient.sanitize_model_name(resolved_model, fallback=default_model)
        if payload.is_active is not None:
            credential.is_active = payload.is_active
        credential.created_by_user = credential.created_by_user or admin_user
        if credential.provider != normalized_provider:
            credential.provider = normalized_provider

    db.add(credential)
    db.commit()
    db.refresh(credential)
    return credential


@router.delete("/api-credentials/{provider}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_api_credential(
    provider: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> Response:
    credential = _get_existing_credential(db, provider)
    if not credential:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Credential not found")

    credential.is_active = False
    db.add(credential)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/competency-levels", response_model=list[schemas.CompetencyLevelRead])
def list_competency_levels(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> list[models.CompetencyLevel]:
    levels = (
        db.query(models.CompetencyLevel)
        .order_by(models.CompetencyLevel.sort_order.asc(), models.CompetencyLevel.created_at.asc())
        .all()
    )
    return levels


@router.post(
    "/competency-levels",
    response_model=schemas.CompetencyLevelRead,
    status_code=status.HTTP_201_CREATED,
)
def create_competency_level(
    payload: schemas.CompetencyLevelCreate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.CompetencyLevel:
    value = payload.value.strip().lower()
    if not value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="レベル識別子を入力してください。")

    label = payload.label.strip()
    if not label:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="レベル名を入力してください。")

    existing = (
        db.query(models.CompetencyLevel)
        .filter(func.lower(models.CompetencyLevel.value) == value)
        .one_or_none()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="同じ識別子のコンピテンシーレベルが既に存在します。",
        )

    level = models.CompetencyLevel(
        value=value,
        label=label,
        scale=payload.scale,
        description=payload.description.strip() if payload.description else None,
        sort_order=payload.sort_order,
    )

    db.add(level)
    db.commit()
    db.refresh(level)
    return level


@router.get("/quotas/defaults", response_model=schemas.QuotaDefaultsRead)
def get_defaults(
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.QuotaDefaults:
    defaults = get_quota_defaults(db)
    return defaults


@router.put("/quotas/defaults", response_model=schemas.QuotaDefaultsRead)
def update_defaults(
    payload: schemas.QuotaDefaultsUpdate,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.QuotaDefaults:
    defaults = set_quota_defaults(
        db,
        card_limit=payload.card_daily_limit,
        evaluation_limit=payload.evaluation_daily_limit,
    )
    db.add(defaults)
    db.commit()
    db.refresh(defaults)
    return defaults


@router.get("/quotas/{user_id}", response_model=schemas.UserQuotaRead)
def get_user_quota_override(
    user_id: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.UserQuotaOverride:
    override = get_user_quota(db, user_id)
    if not override:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quota override not found")
    return override


@router.put("/quotas/{user_id}", response_model=schemas.UserQuotaRead)
def update_user_quota_override(
    user_id: str,
    payload: schemas.UserQuotaUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> models.UserQuotaOverride:
    override = upsert_user_quota(
        db,
        user_id=user_id,
        card_limit=payload.card_daily_limit,
        evaluation_limit=payload.evaluation_daily_limit,
        updated_by=admin_user.id,
    )
    db.add(override)
    db.commit()
    db.refresh(override)
    return override


__all__ = ["router"]
