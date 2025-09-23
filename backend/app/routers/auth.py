from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import (
    create_session_token,
    generate_password,
    get_current_user,
    hash_password,
    normalize_email,
    verify_password,
)
from ..database import get_db
from ..services.email import send_password_email


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/register",
    response_model=schemas.MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: schemas.RegistrationRequest,
    db: Session = Depends(get_db),
) -> schemas.MessageResponse:
    email = normalize_email(payload.email)
    existing = db.query(models.User).filter(models.User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists.",
        )

    password = generate_password()
    user = models.User(email=email, password_hash=hash_password(password))
    db.add(user)
    db.commit()
    send_password_email(email=payload.email, password=password, reason="register")
    return schemas.MessageResponse(message="初期パスワードをメールで送信しました。")


@router.post("/login", response_model=schemas.TokenResponse)
def login(
    payload: schemas.AuthCredentials,
    db: Session = Depends(get_db),
) -> schemas.TokenResponse:
    email = normalize_email(payload.email)
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    db.query(models.SessionToken).filter(models.SessionToken.user_id == user.id).delete()
    token_value = create_session_token(db, user)
    db.commit()
    return schemas.TokenResponse(access_token=token_value, user=user)


@router.post(
    "/password-reset",
    response_model=schemas.MessageResponse,
    status_code=status.HTTP_200_OK,
)
def reset_password(
    payload: schemas.PasswordResetRequest,
    db: Session = Depends(get_db),
) -> schemas.MessageResponse:
    email = normalize_email(payload.email)
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    new_password = generate_password()
    user.password_hash = hash_password(new_password)
    db.query(models.SessionToken).filter(models.SessionToken.user_id == user.id).delete()
    db.add(user)
    db.commit()
    send_password_email(email=payload.email, password=new_password, reason="reset")
    return schemas.MessageResponse(message="初期パスワードをメールで送信しました。")


@router.get("/me", response_model=schemas.UserRead)
def read_current_user(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    return current_user
