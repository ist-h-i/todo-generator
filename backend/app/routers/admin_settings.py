"""Administrative endpoints for configuration management."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..config import settings
from ..database import get_db
from ..utils.crypto import SecretCipher
from ..utils.dependencies import require_admin
from ..utils.quotas import (
    get_quota_defaults,
    get_user_quota,
    set_quota_defaults,
    upsert_user_quota,
)

router = APIRouter(prefix="/admin", tags=["admin", "settings"])


def _cipher() -> SecretCipher:
    key = settings.secret_encryption_key or settings.chatgpt_api_key or "todo-generator"
    return SecretCipher(key)


@router.get("/api-credentials/{provider}", response_model=schemas.ApiCredentialRead)
def get_api_credential(
    provider: str,
    db: Session = Depends(get_db),
    _: models.User = Depends(require_admin),
) -> models.ApiCredential:
    credential = (
        db.query(models.ApiCredential)
        .filter(models.ApiCredential.provider == provider)
        .first()
    )
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
    credential = (
        db.query(models.ApiCredential)
        .filter(models.ApiCredential.provider == provider)
        .first()
    )

    cipher = _cipher()
    encrypted_secret = cipher.encrypt(payload.secret)
    secret_hint = payload.secret[-4:] if payload.secret else None

    if credential is None:
        credential = models.ApiCredential(
            provider=provider,
            encrypted_secret=encrypted_secret,
            secret_hint=secret_hint,
            is_active=True if payload.is_active is None else payload.is_active,
            created_by_user=admin_user,
        )
    else:
        credential.encrypted_secret = encrypted_secret
        credential.secret_hint = secret_hint
        if payload.is_active is not None:
            credential.is_active = payload.is_active
        credential.created_by_user = credential.created_by_user or admin_user

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
    credential = (
        db.query(models.ApiCredential)
        .filter(models.ApiCredential.provider == provider)
        .first()
    )
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
