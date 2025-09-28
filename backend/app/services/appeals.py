from __future__ import annotations

import html
import logging
import re
from collections import defaultdict
from typing import ClassVar, Iterable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..repositories.appeals import AppealGenerationRepository
from ..services.appeal_prompts import (
    CAUSAL_CONNECTORS,
    AppealFallbackBuilder,
    AppealPromptBuilder,
)
from ..services.gemini import GeminiClient, get_optional_gemini_client
from ..services.llm_shared import LLMError

logger = logging.getLogger(__name__)


class AppealGenerationService:
    """Provides helper methods for configuring and generating appeal narratives."""

    _RECOMMENDED_FLOW: ClassVar[list[str]] = ["課題", "対策", "実績", "所感"]
    _AVAILABLE_FORMATS: ClassVar[list[schemas.AppealFormatDefinition]] = [
        schemas.AppealFormatDefinition(
            id="markdown",
            name="Markdown",
            description="見出しと箇条書きで構成された Markdown ドキュメント",
            editor_mode="markdown",
        ),
        schemas.AppealFormatDefinition(
            id="bullet_list",
            name="Bullet List",
            description="主要なアピールポイントを箇条書きで整理",
            editor_mode="markdown",
        ),
        schemas.AppealFormatDefinition(
            id="table",
            name="CSV Table",
            description="ステップと要約を 2 列で表現した CSV 形式",
            editor_mode="csv",
        ),
    ]

    def __init__(self, db: Session, llm_client: GeminiClient | None = None) -> None:
        self._db = db
        self._llm = llm_client
        self._prompt_builder_error: RuntimeError | None = None
        try:
            self._prompt_builder = AppealPromptBuilder()
        except RuntimeError as exc:  # pragma: no cover - depends on optional dependency availability
            logger.warning(
                "Appeal prompt templates are unavailable; generation will fall back to deterministic content. %s",
                exc,
            )
            self._prompt_builder = None
            self._prompt_builder_error = exc
        self._fallback_builder = AppealFallbackBuilder()
        self._repository = AppealGenerationRepository(db)

    def load_configuration(self, *, owner: models.User) -> schemas.AppealConfigResponse:
        labels = self._load_labels_with_achievements(owner_id=owner.id)
        return schemas.AppealConfigResponse(
            labels=labels,
            recommended_flow=list(self._RECOMMENDED_FLOW),
            formats=list(self._AVAILABLE_FORMATS),
        )

    def generate(
        self,
        *,
        owner: models.User,
        request: schemas.AppealGenerationRequest,
    ) -> schemas.AppealGenerationResponse:
        subject_label_id: str | None = None
        if request.subject.type == "label":
            subject_label_id = request.subject.value
            label = (
                self._db.query(models.Label)
                .filter(
                    models.Label.id == request.subject.value,
                    models.Label.owner_id == owner.id,
                )
                .first()
            )
            if not label:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Label not found")
            subject_text = label.name
        else:
            subject_text = request.subject.value

        sanitized_subject = self._sanitize_subject(subject_text)
        achievements = self._resolve_achievements(owner_id=owner.id, label_id=subject_label_id, request=request)
        sanitized_achievements = self._sanitize_achievements(achievements)
        warnings = self._derive_flow_warnings(request.flow)

        fallback_formats = self._build_fallback_formats(
            request.formats,
            subject=sanitized_subject,
            flow=request.flow,
            achievements=sanitized_achievements,
        )

        generated_formats = dict(fallback_formats)
        token_usage = {fmt: payload.tokens_used or 0 for fmt, payload in fallback_formats.items()}
        generation_status = "fallback"

        if self._llm is not None and self._prompt_builder is not None:
            try:
                prompt = self._prompt_builder.build(
                    subject=sanitized_subject,
                    subject_type=request.subject.type,
                    flow=request.flow,
                    achievements=sanitized_achievements,
                    formats=[
                        self._format_definitions[fmt] for fmt in request.formats if fmt in self._format_definitions
                    ],
                    workspace_profile=self._build_workspace_profile(owner),
                )
                response_schema = self._prompt_builder.build_response_schema(request.formats)
                payload = self._llm.generate_appeal(prompt=prompt, response_schema=response_schema)
                generated_formats, token_usage, generation_status = self._merge_ai_payload(
                    requested_formats=request.formats,
                    payload=payload,
                    fallback_formats=fallback_formats,
                    subject=sanitized_subject,
                )
            except LLMError:
                logger.warning("Appeal generation via LLM failed; using fallback content", exc_info=True)
        elif self._llm is not None and self._prompt_builder is None:
            logger.info(
                "Skipping LLM appeal generation because the prompt templates could not be loaded: %s",
                self._prompt_builder_error,
            )

        record = self._repository.create(
            owner_id=owner.id,
            subject_type=request.subject.type,
            subject_value=sanitized_subject,
            flow=request.flow,
            formats=request.formats,
            formats_payload=generated_formats,
            token_usage=token_usage,
            warnings=warnings,
            generation_status=generation_status,
        )

        return schemas.AppealGenerationResponse(
            generation_id=record.id,
            subject_echo=sanitized_subject,
            flow=request.flow,
            warnings=warnings,
            formats=generated_formats,
        )

    @property
    def _format_definitions(self) -> dict[str, schemas.AppealFormatDefinition]:
        return {item.id: item for item in self._AVAILABLE_FORMATS}

    def _sanitize_subject(self, value: str) -> str:
        masked = self._mask_sensitive_text(value.strip())
        sanitized = html.escape(masked)
        if len(sanitized) > 120:
            logger.debug("Truncating subject to 120 characters for appeal generation")
            return sanitized[:120]
        return sanitized

    def _sanitize_achievements(
        self, achievements: Iterable[schemas.AppealAchievement]
    ) -> list[schemas.AppealAchievement]:
        sanitized: list[schemas.AppealAchievement] = []
        for achievement in achievements:
            title = html.escape(self._mask_sensitive_text(achievement.title))
            summary = html.escape(self._mask_sensitive_text(achievement.summary)) if achievement.summary else None
            sanitized.append(
                schemas.AppealAchievement(
                    id=achievement.id,
                    title=title,
                    summary=summary,
                )
            )
        return sanitized

    def _mask_sensitive_text(self, value: str | None) -> str:
        if not value:
            return ""
        text = value
        text = re.sub(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+", "[redacted-email]", text)
        text = re.sub(r"\d{3}-\d{4}-\d{4}", "[redacted-phone]", text)
        text = re.sub(r"\d{4,}", "[redacted-number]", text)
        return text

    def _resolve_achievements(
        self,
        *,
        owner_id: str,
        label_id: str | None,
        request: schemas.AppealGenerationRequest,
    ) -> list[schemas.AppealAchievement]:
        achievements: list[schemas.AppealAchievement] = []
        if label_id:
            label_achievements = self._load_label_achievements(owner_id=owner_id, label_ids=[label_id])
            achievements.extend(label_achievements.get(label_id, []))
        if request.achievements:
            for item in request.achievements:
                if all(existing.id != item.id for existing in achievements):
                    achievements.append(item)
        return achievements

    def _load_labels_with_achievements(self, *, owner_id: str) -> list[schemas.AppealLabelConfig]:
        label_records = (
            self._db.query(models.Label)
            .filter(models.Label.owner_id == owner_id)
            .order_by(models.Label.name.asc())
            .all()
        )
        label_ids = [label.id for label in label_records]
        achievement_map = self._load_label_achievements(owner_id=owner_id, label_ids=label_ids)
        results: list[schemas.AppealLabelConfig] = []
        for label in label_records:
            results.append(
                schemas.AppealLabelConfig(
                    id=label.id,
                    name=label.name,
                    color=label.color,
                    description=label.description,
                    achievements=self._sanitize_achievements(achievement_map.get(label.id, [])),
                )
            )
        return results

    def _load_label_achievements(
        self,
        *,
        owner_id: str,
        label_ids: Iterable[str],
        limit_per_label: int = 5,
    ) -> dict[str, list[schemas.AppealAchievement]]:
        label_id_list = list(label_ids)
        if not label_id_list:
            return {}
        query = (
            self._db.query(models.Card, models.card_labels.c.label_id)
            .join(models.card_labels, models.Card.id == models.card_labels.c.card_id)
            .filter(models.card_labels.c.label_id.in_(label_id_list), models.Card.owner_id == owner_id)
            .order_by(models.Card.completed_at.desc().nullslast(), models.Card.updated_at.desc())
        )
        grouped: dict[str, list[schemas.AppealAchievement]] = defaultdict(list)
        for card, label_id in query:
            bucket = grouped[label_id]
            if len(bucket) >= limit_per_label:
                continue
            summary = card.summary or (card.description[:120] if card.description else None)
            bucket.append(
                schemas.AppealAchievement(
                    id=card.id,
                    title=card.title,
                    summary=summary,
                )
            )
        return grouped

    def _derive_flow_warnings(self, flow: list[str]) -> list[str]:
        normalized = [step.strip() for step in flow if step.strip()]
        warnings: list[str] = []
        if any(step.startswith("実績") for step in normalized) and not any(
            step.startswith("課題") for step in normalized
        ):
            warnings.append("課題ステップが設定されていないため、因果関係が伝わりづらくなる可能性があります。")
        return warnings

    def _build_workspace_profile(self, owner: models.User) -> dict[str, object]:
        profile: dict[str, object] = {
            "workspace_id": owner.id,
        }
        if owner.roles:
            profile["roles"] = owner.roles
        if owner.experience_years is not None:
            profile["experience_years"] = owner.experience_years
        if owner.nickname:
            profile["display_name"] = owner.nickname
        return profile

    def _build_fallback_formats(
        self,
        format_ids: Iterable[str],
        *,
        subject: str,
        flow: list[str],
        achievements: Iterable[schemas.AppealAchievement],
    ) -> dict[str, schemas.AppealGeneratedFormat]:
        results: dict[str, schemas.AppealGeneratedFormat] = {}
        for format_id in format_ids:
            content = self._fallback_builder.build(
                format_id,
                subject=subject,
                flow=flow,
                achievements=achievements,
            )
            results[format_id] = schemas.AppealGeneratedFormat(content=content, tokens_used=0)
        return results

    def _merge_ai_payload(
        self,
        *,
        requested_formats: list[str],
        payload: dict[str, object],
        fallback_formats: dict[str, schemas.AppealGeneratedFormat],
        subject: str,
    ) -> tuple[dict[str, schemas.AppealGeneratedFormat], dict[str, int], str]:
        raw_formats = payload.get("formats", {})
        if not isinstance(raw_formats, dict):
            raw_formats = {}

        usage_info = payload.get("token_usage")
        usage_map: dict[str, int] = {}
        if isinstance(usage_info, dict):
            for key, value in usage_info.items():
                coerced = self._coerce_int(value)
                if coerced is not None:
                    usage_map[str(key)] = coerced

        generated: dict[str, schemas.AppealGeneratedFormat] = {}
        tokens: dict[str, int] = {}
        used_ai = False
        used_fallback = False

        for format_id in requested_formats:
            entry = raw_formats.get(format_id)
            if isinstance(entry, dict) and entry.get("content"):
                content = str(entry["content"]).strip()
                if not content:
                    generated_format = fallback_formats[format_id]
                    used_fallback = True
                else:
                    normalized = self._ensure_connectors(format_id, content, subject)
                    tokens_used = self._coerce_int(entry.get("tokens_used") if isinstance(entry, dict) else None)
                    if tokens_used is None:
                        tokens_used = usage_map.get(format_id) or usage_map.get("total_tokens") or 0
                    generated_format = schemas.AppealGeneratedFormat(
                        content=normalized,
                        tokens_used=tokens_used,
                    )
                    tokens[format_id] = tokens_used
                    used_ai = True
            else:
                generated_format = fallback_formats[format_id]
                used_fallback = True

            generated.setdefault(format_id, generated_format)
            tokens.setdefault(format_id, generated_format.tokens_used or 0)

        if not used_ai:
            status = "fallback"
        elif used_fallback:
            status = "partial"
        else:
            status = "success"
        if "total_tokens" in usage_map:
            tokens.setdefault("total_tokens", usage_map["total_tokens"])
        return generated, tokens, status

    def _coerce_int(self, value: object) -> int | None:
        if value is None:
            return None
        if isinstance(value, bool):
            return int(value)
        if isinstance(value, (int, float)):
            return int(value)
        if isinstance(value, str) and value.strip():
            try:
                return int(float(value))
            except ValueError:
                return None
        return None

    def _ensure_connectors(self, format_id: str, content: str, subject: str) -> str:
        link = CAUSAL_CONNECTORS["link"]
        result = CAUSAL_CONNECTORS["result"]
        normalized = content
        if link not in normalized:
            if format_id == "table":
                rows = normalized.splitlines()
                if rows:
                    if rows[0].lower().startswith("step"):
                        rows.insert(1, f"{link},{subject}に関する背景整理")
                    else:
                        rows.insert(0, f"{link},{subject}に関する背景整理")
                normalized = "\n".join(rows)
            elif format_id == "bullet_list":
                normalized = f"- {link}、{subject}に関する取り組みを整理しました。\n" + normalized
            else:
                normalized = f"{link}、{subject}に関する背景を整理しました。\n{normalized}"
        if result not in normalized:
            if format_id == "table":
                normalized = normalized.rstrip("\n") + f"\n{result},{subject}の価値を示しました。"
            elif format_id == "bullet_list":
                normalized = normalized.rstrip("\n") + f"\n- {result}、{subject}の価値を示しました。"
            else:
                normalized = normalized.rstrip("\n") + f"\n{result}、{subject}の価値を示しました。"
        return normalized


def get_appeal_service(
    db: Session = Depends(get_db),
    llm_client: GeminiClient | None = Depends(get_optional_gemini_client),
) -> AppealGenerationService:
    return AppealGenerationService(db, llm_client)
