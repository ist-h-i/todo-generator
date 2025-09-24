from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.profile import (
    build_user_profile,
    normalize_nickname,
    parse_experience_years,
    parse_roles,
    process_avatar_upload,
    sanitize_bio,
    should_remove_avatar,
)

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("/me", response_model=schemas.UserProfile)
async def read_profile(
    current_user: models.User = Depends(get_current_user),
) -> schemas.UserProfile:
    return build_user_profile(current_user)


@router.put("/me", response_model=schemas.UserProfile)
async def update_profile(
    nickname: str = Form(...),
    experience_years: str | None = Form(default=None),
    roles: str | None = Form(default=None),
    bio: str | None = Form(default=None),
    remove_avatar: str | None = Form(default=None),
    avatar: UploadFile | None = File(default=None),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> schemas.UserProfile:
    sanitized_nickname = normalize_nickname(nickname)
    sanitized_experience = parse_experience_years(experience_years)
    sanitized_roles = parse_roles(roles)
    sanitized_bio = sanitize_bio(bio)
    remove_current_avatar = should_remove_avatar(remove_avatar)

    avatar_bytes: bytes | None = None
    avatar_mime_type: str | None = None

    if avatar is not None:
        avatar_bytes, avatar_mime_type = await process_avatar_upload(avatar)
    elif remove_current_avatar:
        avatar_bytes, avatar_mime_type = None, None

    current_user.nickname = sanitized_nickname
    current_user.experience_years = sanitized_experience
    current_user.roles = sanitized_roles
    current_user.bio = sanitized_bio

    if avatar is not None or remove_current_avatar:
        current_user.avatar_image = avatar_bytes
        current_user.avatar_mime_type = avatar_mime_type

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return build_user_profile(current_user)
