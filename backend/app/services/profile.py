from __future__ import annotations

import base64
import io
import json
from typing import TYPE_CHECKING, Any, NamedTuple

from fastapi import HTTPException, UploadFile, status

from .. import models, schemas

_MAX_NICKNAME_LENGTH = 30
_MAX_BIO_LENGTH = 500
_MAX_ROLES = 5
_MAX_ROLE_LENGTH = 32
_MAX_EXPERIENCE_YEARS = 50
_MAX_AVATAR_DIMENSION = 320
_MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024
_ALLOWED_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}


if TYPE_CHECKING:  # pragma: no cover - imported for type checking only
    from PIL import Image as PILImage


class _PillowModules(NamedTuple):
    Image: Any
    ImageFile: Any
    UnidentifiedImageError: type[Exception]


_MISSING_PILLOW_MESSAGE = "画像処理ライブラリ(Pillow)がインストールされていません。管理者にお問い合わせください。"


def build_user_profile(user: models.User) -> schemas.UserProfile:
    profile = schemas.UserProfile.model_validate(user)

    if user.avatar_image and user.avatar_mime_type:
        encoded = base64.b64encode(user.avatar_image).decode()
        profile.avatar_url = f"data:{user.avatar_mime_type};base64,{encoded}"
    else:
        profile.avatar_url = None

    return profile


def _import_pillow() -> _PillowModules:
    try:
        from PIL import Image, ImageFile, UnidentifiedImageError  # type: ignore[import-not-found]
    except ModuleNotFoundError as exc:  # pragma: no cover - exercised via integration test
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=_MISSING_PILLOW_MESSAGE,
        ) from exc

    return _PillowModules(Image=Image, ImageFile=ImageFile, UnidentifiedImageError=UnidentifiedImageError)


def normalize_nickname(value: str | None) -> str:
    if value is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ニックネームを入力してください。",
        )

    nickname = value.strip()
    if not nickname:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="ニックネームを入力してください。",
        )

    if len(nickname) > _MAX_NICKNAME_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"ニックネームは{_MAX_NICKNAME_LENGTH}文字以内で入力してください。",
        )

    return nickname


def parse_experience_years(value: str | None) -> int | None:
    if value is None or value == "":
        return None

    try:
        years = int(value)
    except (TypeError, ValueError) as exc:  # pragma: no cover - kept for completeness
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="経験年数は整数で入力してください。",
        ) from exc

    if years < 0 or years > _MAX_EXPERIENCE_YEARS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"経験年数は0から{_MAX_EXPERIENCE_YEARS}の範囲で入力してください。",
        )

    return years


def _sanitize_optional_text(value: str | None, max_length: int) -> str | None:
    if value is None:
        return None

    text = value.strip()
    if not text:
        return None

    if len(text) > max_length:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"{max_length}文字以内で入力してください。",
        )

    return text


def sanitize_bio(value: str | None) -> str | None:
    return _sanitize_optional_text(value, _MAX_BIO_LENGTH)


def parse_roles(value: str | None) -> list[str]:
    if value is None or value == "":
        return []

    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="業務内容の形式が正しくありません。",
        ) from exc

    if not isinstance(parsed, list):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="業務内容は配列形式で送信してください。",
        )

    normalized: list[str] = []
    seen: set[str] = set()
    for item in parsed:
        if not isinstance(item, str):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="業務内容には文字列を指定してください。",
            )

        role = item.strip()
        if not role:
            continue

        if len(role) > _MAX_ROLE_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"業務内容は1項目あたり{_MAX_ROLE_LENGTH}文字以内で入力してください。",
            )

        canonical = role.casefold()
        if canonical in seen:
            continue

        seen.add(canonical)
        normalized.append(role)

        if len(normalized) > _MAX_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"業務内容は最大{_MAX_ROLES}件まで選択できます。",
            )

    return normalized


def should_remove_avatar(value: str | None) -> bool:
    if value is None:
        return False

    normalized = value.strip().lower()
    return normalized in {"1", "true", "yes", "on"}


async def process_avatar_upload(upload: UploadFile) -> tuple[bytes, str]:
    if upload.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="対応していない画像形式です。png、jpeg、webpをご利用ください。",
        )

    raw_bytes = await upload.read()
    if len(raw_bytes) > _MAX_AVATAR_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="アイコン画像のサイズは5MB以内にしてください。",
        )

    pillow = _import_pillow()

    try:
        image = pillow.Image.open(io.BytesIO(raw_bytes))
    except pillow.UnidentifiedImageError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="画像を読み込めませんでした。ファイルを確認してください。",
        ) from exc

    image = _convert_image_to_rgba(image, raw_bytes, pillow)
    side = min(image.width, image.height)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    cropped = image.crop((left, top, left + side, top + side))

    if side > _MAX_AVATAR_DIMENSION:
        resampling = getattr(pillow.Image, "Resampling", pillow.Image)
        cropped = cropped.resize(
            (
                _MAX_AVATAR_DIMENSION,
                _MAX_AVATAR_DIMENSION,
            ),
            resampling.LANCZOS,
        )

    buffer = io.BytesIO()
    cropped.save(buffer, format="WEBP", quality=85, method=6)
    return buffer.getvalue(), "image/webp"


def _convert_image_to_rgba(
    image: "PILImage.Image",
    raw_bytes: bytes,
    pillow: _PillowModules,
) -> "PILImage.Image":
    try:
        return image.convert("RGBA")
    except OSError:
        pass

    original_setting = pillow.ImageFile.LOAD_TRUNCATED_IMAGES
    pillow.ImageFile.LOAD_TRUNCATED_IMAGES = True
    try:
        retry_image = pillow.Image.open(io.BytesIO(raw_bytes))
        retry_image.load()
        return retry_image.convert("RGBA")
    except (pillow.UnidentifiedImageError, OSError) as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="画像を読み込めませんでした。ファイルを確認してください。",
        ) from exc
    finally:
        pillow.ImageFile.LOAD_TRUNCATED_IMAGES = original_setting


__all__ = [
    "build_user_profile",
    "normalize_nickname",
    "parse_experience_years",
    "parse_roles",
    "process_avatar_upload",
    "sanitize_bio",
    "should_remove_avatar",
]
