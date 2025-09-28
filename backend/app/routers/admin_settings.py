"""Administrative endpoints for configuration management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
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
    "gemini": ("gemini", "openai"),
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
    for candidate in (normalized, *_PROVIDER_ALIASES.get(normalized, ())):
        if candidate not in candidates:
            candidates.append(candidate)
    return candidates


def _get_existing_credential(db: Session, provider: str) -> models.ApiCredential | None:
    """Fetch an API credential using canonical provider aliases."""

    for candidate in _provider_candidates(provider):
        credential = (
            db.query(models.ApiCredential)
            .filter(models.ApiCredential.provider == candidate)
            .first()
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
    return credential


@router.put("/api-credentials/{provider}", response_model=schemas.ApiCredentialRead)
def upsert_api_credential(
    provider: str,
    payload: schemas.ApiCredentialUpdate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(require_admin),
) -> models.ApiCredential:
    credential = _get_existing_credential(db, provider)
    normalized_provider = _normalize_provider(provider)

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
        credential = models.ApiCredential(
            provider=normalized_provider,
            encrypted_secret=encrypted_secret,
            secret_hint=secret_hint,
            is_active=True if payload.is_active is None else payload.is_active,
            model=model_name or settings.gemini_model,
            created_by_user=admin_user,
        )
    else:
        if secret:
            credential.encrypted_secret = cipher.encrypt(secret)
            credential.secret_hint = build_secret_hint(secret)
        if model_name is not None:
            credential.model = model_name or settings.gemini_model
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
