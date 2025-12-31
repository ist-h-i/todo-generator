from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.requests import Request
from fastapi.responses import RedirectResponse, Response
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
from ..config import settings
from ..database import get_db
from ..services.profile import build_user_profile, normalize_nickname
from ..services.status_defaults import ensure_default_statuses
from ..services.workspace_template_defaults import ensure_default_workspace_template

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])

_LOCAL_FRONTEND_LOGIN_URL = "http://localhost:4200/login"


def _resolve_frontend_login_url(request: Request) -> str:
    hostname = request.url.hostname or ""
    if hostname in {"localhost", "127.0.0.1"}:
        return _LOCAL_FRONTEND_LOGIN_URL

    for origin in settings.allowed_origins:
        if origin.startswith(("http://localhost", "http://127.")):
            continue
        return f"{origin}/login"

    return _LOCAL_FRONTEND_LOGIN_URL


@router.get("/login", include_in_schema=False)
def login_page_redirect(request: Request) -> Response:
    """Redirect accidental browser navigations to the SPA login screen."""

    return RedirectResponse(_resolve_frontend_login_url(request))


@router.get("/", include_in_schema=False)
def auth_root_redirect(request: Request) -> Response:
    return RedirectResponse(_resolve_frontend_login_url(request))


def _find_admin_contact_email(db: Session) -> str | None:
    admin = (
        db.query(models.User)
        .filter(models.User.is_admin.is_(True))
        .order_by(models.User.created_at.asc())
        .first()
    )
    return admin.email if admin else None


@router.get("/admin-contact", response_model=schemas.AdminContactResponse)
def get_admin_contact_email(db: Session = Depends(get_db)) -> schemas.AdminContactResponse:
    return schemas.AdminContactResponse(email=_find_admin_contact_email(db))


@router.post(
    "/register",
    response_model=schemas.RegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: schemas.RegistrationRequest,
    db: Session = Depends(get_db),
) -> schemas.RegistrationResponse:
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
    remaining_fields = {
        key: value for key, value in payload_data.items() if key not in {"email", "password"}
    }
    # Validate and sanitize nickname (required)
    sanitized_nickname = normalize_nickname(remaining_fields.get("nickname"))
    remaining_fields["nickname"] = sanitized_nickname
    user_values = {
        **remaining_fields,
        "email": normalized_email,
        "password_hash": hash_password(password),
        "is_admin": is_first_user,
        "is_active": is_first_user,
    }
    user = models.User(**user_values)
    db.add(user)
    db.flush()
    ensure_default_statuses(db, owner_id=user.id)
    ensure_default_workspace_template(db, owner_id=user.id)
    # Ensure a private channel and membership for this user
    channel = models.Channel(name="My Channel", owner_user_id=user.id, is_private=True)
    db.add(channel)
    db.flush()
    member = models.ChannelMember(channel_id=channel.id, user_id=user.id, role="owner")
    db.add(member)
    db.commit()
    db.refresh(user)
    if user.is_active:
        message = "Registration completed. You can now sign in."
    else:
        message = "Registration completed. Your account is pending administrator approval."
    return schemas.RegistrationResponse(
        message=message,
        requires_approval=not user.is_active,
        admin_email=_find_admin_contact_email(db),
    )


@router.post("/login", response_model=schemas.TokenResponse)
def login(
    payload: schemas.AuthCredentials,
    request: Request,
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
        client_host = request.client.host if request.client else "unknown"
        normalized_email = normalize_email(payload.email)
        logger.warning("Login failed for %s from %s", normalized_email, client_host)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending administrator approval.",
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
