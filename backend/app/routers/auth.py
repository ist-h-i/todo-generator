from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    create_session_token,
    get_current_user,
    get_email_lookup_candidates,
    hash_password,
    normalize_email,
    verify_password,
)
from ..database import get_db
from ..services.profile import build_user_profile
from ..services.status_defaults import ensure_default_statuses
from ..services.workspace_template_defaults import ensure_default_workspace_template

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=schemas.TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: schemas.RegistrationRequest,
    db: Session = Depends(get_db),
) -> schemas.TokenResponse:
    payload_data = (
        payload.model_dump() if hasattr(payload, "model_dump") else payload.dict()  # type: ignore[attr-defined]
    )
    raw_email = str(payload_data.get("email", payload.email))
    email_candidates = get_email_lookup_candidates(raw_email)
    existing = db.query(models.User).filter(models.User.email.in_(email_candidates)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists.",
        )

    is_first_user = db.query(models.User).count() == 0
    password = payload_data.get("password", payload.password)
    normalized_email = normalize_email(raw_email)
    remaining_fields = {key: value for key, value in payload_data.items() if key not in {"email", "password"}}
    user_values = {
        **remaining_fields,
        "email": normalized_email,
        "password_hash": hash_password(password),
        "is_admin": is_first_user,
    }
    user = models.User(**user_values)
    db.add(user)
    db.flush()
    ensure_default_statuses(db, owner_id=user.id)
    ensure_default_workspace_template(db, owner_id=user.id)
    token_value = create_session_token(db, user)
    db.commit()
    db.refresh(user)
    profile = build_user_profile(user)
    return schemas.TokenResponse(access_token=token_value, user=profile)


@router.post("/login", response_model=schemas.TokenResponse)
def login(
    payload: schemas.AuthCredentials,
    db: Session = Depends(get_db),
) -> schemas.TokenResponse:
    email_candidates = get_email_lookup_candidates(payload.email)
    user: models.User | None = None
    for candidate in email_candidates:
        candidate_user = db.query(models.User).filter(models.User.email == candidate).first()
        if candidate_user and verify_password(payload.password, candidate_user.password_hash):
            user = candidate_user
            break

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    db.query(models.SessionToken).filter(models.SessionToken.user_id == user.id).delete()
    token_value = create_session_token(db, user)
    db.commit()
    profile = build_user_profile(user)
    return schemas.TokenResponse(access_token=token_value, user=profile)


@router.get("/me", response_model=schemas.UserProfile)
def read_current_user(
    current_user: models.User = Depends(get_current_user),
) -> schemas.UserProfile:
    return build_user_profile(current_user)
