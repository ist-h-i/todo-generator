from __future__ import annotations

from collections.abc import Mapping
from typing import Iterable

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..auth import get_current_user
from ..database import get_db
from ..services.workspace_template_defaults import default_field_visibility
from ..utils.repository import (
    apply_updates,
    delete_model,
    ensure_optional_owned_resource,
    get_owned_resource_or_404,
    save_model,
)

router = APIRouter(prefix="/workspace/templates", tags=["workspace"])


def _clamp_confidence_threshold(value: float | None) -> float:
    if value is None:
        return 0.6
    return max(0.0, min(1.0, float(value)))


def _normalize_name(value: str) -> str:
    sanitized = value.strip()
    if not sanitized:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Template name must not be blank.",
        )
    return sanitized


def _deduplicate_label_ids(label_ids: Iterable[str]) -> list[str]:
    unique: list[str] = []
    seen = set()
    for label_id in label_ids:
        if label_id not in seen:
            seen.add(label_id)
            unique.append(label_id)
    return unique


def _validate_label_ids(db: Session, owner_id: str, label_ids: Iterable[str]) -> list[str]:
    ids = _deduplicate_label_ids(label_ids)
    if not ids:
        return []

    labels = db.query(models.Label).filter(models.Label.id.in_(ids), models.Label.owner_id == owner_id).all()
    if len(labels) != len(ids):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
    return ids


def _serialize_field_visibility(
    payload: schemas.WorkspaceTemplateFieldVisibility | Mapping[str, object] | None,
    existing: dict[str, bool] | None,
) -> dict[str, bool]:
    state = dict(existing or default_field_visibility())
    if not payload:
        return state

    if isinstance(payload, schemas.WorkspaceTemplateFieldVisibility):
        visibility_data = payload.model_dump()
    else:
        visibility_data = dict(payload)

    for key in state:
        if key in visibility_data:
            state[key] = bool(visibility_data[key])
    return state


def _get_owned_template(
    db: Session,
    *,
    owner_id: str,
    template_id: str,
) -> models.WorkspaceTemplate:
    return get_owned_resource_or_404(
        db,
        models.WorkspaceTemplate,
        template_id,
        owner_id=owner_id,
        detail="Template not found",
    )


@router.get("/", response_model=list[schemas.WorkspaceTemplateRead])
def list_templates(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> list[models.WorkspaceTemplate]:
    return (
        db.query(models.WorkspaceTemplate)
        .filter(models.WorkspaceTemplate.owner_id == current_user.id)
        .order_by(models.WorkspaceTemplate.created_at.desc())
        .all()
    )


@router.post("/", response_model=schemas.WorkspaceTemplateRead, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: schemas.WorkspaceTemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.WorkspaceTemplate:
    status_id = payload.default_status_id
    ensure_optional_owned_resource(
        db,
        models.Status,
        status_id,
        owner_id=current_user.id,
        detail="Status not found",
    )

    label_ids = _validate_label_ids(db, current_user.id, payload.default_label_ids)
    template = models.WorkspaceTemplate(
        owner_id=current_user.id,
        name=_normalize_name(payload.name),
        description=(payload.description or "").strip(),
        default_status_id=status_id,
        default_label_ids=label_ids,
        confidence_threshold=_clamp_confidence_threshold(payload.confidence_threshold),
        field_visibility=_serialize_field_visibility(payload.field_visibility, None),
    )
    return save_model(db, template)


@router.patch("/{template_id}", response_model=schemas.WorkspaceTemplateRead)
def update_template(
    template_id: str,
    payload: schemas.WorkspaceTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> models.WorkspaceTemplate:
    template = _get_owned_template(db, owner_id=current_user.id, template_id=template_id)
    updates = payload.model_dump(exclude_unset=True)

    if "name" in updates:
        updates["name"] = _normalize_name(str(updates["name"]))
    if "description" in updates:
        description = updates.get("description")
        updates["description"] = (description or "").strip()
    if "default_status_id" in updates:
        status_id = updates.get("default_status_id")
        ensure_optional_owned_resource(
            db,
            models.Status,
            status_id,
            owner_id=current_user.id,
            detail="Status not found",
        )
    if "default_label_ids" in updates:
        label_ids = updates.get("default_label_ids") or []
        updates["default_label_ids"] = _validate_label_ids(db, current_user.id, label_ids)
    if "confidence_threshold" in updates:
        updates["confidence_threshold"] = _clamp_confidence_threshold(updates.get("confidence_threshold"))
    if "field_visibility" in updates:
        updates["field_visibility"] = _serialize_field_visibility(
            updates.get("field_visibility"),
            template.field_visibility,
        )

    apply_updates(template, updates)
    return save_model(db, template)


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
) -> Response:
    template = _get_owned_template(db, owner_id=current_user.id, template_id=template_id)
    delete_model(db, template)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
