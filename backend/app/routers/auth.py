from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    create_session_token,
    get_current_user,
    get_email_lookup_candidates,
    hash_password,
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
    email_candidates = get_email_lookup_candidates(payload.email)
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

    email = email_candidates[0]
    user = models.User(email=email, password_hash=hash_password(payload.password))
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
