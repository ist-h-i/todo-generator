from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    create_session_token,
    get_current_user,
    get_email_lookup_candidates,
    normalize_email,
    hash_password,
    normalize_email,
    verify_password,
)
from ..database import get_db

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
        payload.model_dump()
        if hasattr(payload, "model_dump")
        else payload.dict()  # type: ignore[attr-defined]
    )
    raw_email = str(payload_data.get("email", payload.email))
    email_candidates = get_email_lookup_candidates(raw_email)
    existing = (
        db.query(models.User)
        .filter(models.User.email.in_(email_candidates))
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists.",
        )

    password = payload_data.get("password", payload.password)
    normalized_email = normalize_email(raw_email)
    remaining_fields = {
        key: value
        for key, value in payload_data.items()
        if key not in {"email", "password"}
    }
    user_values = {
        **remaining_fields,
        "email": normalized_email,
        "password_hash": hash_password(password),
        "is_admin": False,
    }
    user = models.User(**user_values)
    db.add(user)
    db.flush()
    token_value = create_session_token(db, user)
    db.commit()
    db.refresh(user)
    return schemas.TokenResponse(access_token=token_value, user=user)


@router.post("/login", response_model=schemas.TokenResponse)
def login(
    payload: schemas.AuthCredentials,
    db: Session = Depends(get_db),
) -> schemas.TokenResponse:
    email_candidates = get_email_lookup_candidates(payload.email)
    user: models.User | None = None
    for candidate in email_candidates:
        candidate_user = (
            db.query(models.User).filter(models.User.email == candidate).first()
        )
        if candidate_user and verify_password(
            payload.password, candidate_user.password_hash
        ):
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
    return schemas.TokenResponse(access_token=token_value, user=user)


@router.get("/me", response_model=schemas.UserRead)
def read_current_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    return current_user
