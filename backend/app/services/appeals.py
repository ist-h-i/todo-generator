from __future__ import annotations

import html
import logging
from collections import defaultdict
from typing import ClassVar, Iterable

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db

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

    def __init__(self, db: Session) -> None:
        self._db = db

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
        warnings = self._derive_flow_warnings(request.flow)
        generated_formats = {}
        for format_id in request.formats:
            content = self._build_fallback_content(format_id, sanitized_subject, request.flow, achievements)
            generated_formats[format_id] = schemas.AppealGeneratedFormat(content=content, tokens_used=0)

        generation = models.AppealGeneration(
            owner_id=owner.id,
            subject_type=request.subject.type,
            subject_value=sanitized_subject,
            flow=request.flow,
            formats=request.formats,
            content_json={key: value.model_dump() for key, value in generated_formats.items()},
            token_usage={key: value.tokens_used or 0 for key, value in generated_formats.items()},
            warnings=warnings,
            generation_status="fallback",
        )
        self._db.add(generation)
        self._db.commit()
        self._db.refresh(generation)

        return schemas.AppealGenerationResponse(
            generation_id=generation.id,
            subject_echo=sanitized_subject,
            flow=request.flow,
            warnings=warnings,
            formats=generated_formats,
        )

    def _sanitize_subject(self, value: str) -> str:
        sanitized = html.escape(value.strip())
        if len(sanitized) > 120:
            logger.debug("Truncating subject to 120 characters for appeal generation")
            return sanitized[:120]
        return sanitized

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
                    achievements=achievement_map.get(label.id, []),
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

    def _build_fallback_content(
        self,
        format_id: str,
        subject: str,
        flow: list[str],
        achievements: list[schemas.AppealAchievement],
    ) -> str:
        connectors = {"link": "そのため", "result": "結果として"}
        normalized_flow = [step.strip() for step in flow if step.strip()]
        if format_id == "markdown":
            lines: list[str] = [f"# {subject} のアピール"]
            previous_step: str | None = None
            for step in normalized_flow:
                lines.append(f"## {step}")
                if previous_step is None:
                    lines.append(f"{connectors['link']}、{subject}に関する{step}の背景を整理しました。")
                else:
                    lines.append(f"{connectors['link']}、{previous_step}を踏まえて{step}を推進しました。")
                previous_step = step
            if achievements:
                lines.append("## 実績ハイライト")
                for item in achievements:
                    summary = item.summary or "価値提供につながりました。"
                    lines.append(f"- {connectors['result']}、{item.title}を達成し、{summary}")
            lines.append(f"{connectors['result']}、{subject}の強みを示すことができました。")
            return "\n".join(lines)

        if format_id == "bullet_list":
            items: list[str] = []
            for step in normalized_flow:
                prefix = f"{connectors['link']}、"
                items.append(f"- {prefix}{step}に取り組みました。")
            if achievements:
                highlight = achievements[0]
                summary = highlight.summary or "価値提供につながりました。"
                items.append(f"- {connectors['result']}、{highlight.title}を示し、{summary}")
            else:
                items.append(f"- {connectors['result']}、{subject}の成長を証明しました。")
            return "\n".join(items)

        if format_id == "table":
            rows = ["Step,Summary"]
            previous_step = None
            for step in normalized_flow:
                if previous_step is None:
                    summary = f"{connectors['link']}、{subject}に関する{step}の背景整理"
                else:
                    summary = f"{connectors['link']}、{previous_step}を踏まえて{step}を推進"
                rows.append(f"{step},{summary}")
                previous_step = step
            if achievements:
                combined = achievements[0]
                summary = combined.summary or "価値提供につながりました"
                rows.append(f"{connectors['result']},{combined.title} - {summary}")
            else:
                rows.append(f"{connectors['result']},{subject}の成果を共有")
            return "\n".join(rows)

        # Default fallback mirrors markdown to ensure connectors are present.
        return self._build_fallback_content("markdown", subject, flow, achievements)


def get_appeal_service(db: Session = Depends(get_db)) -> AppealGenerationService:
    return AppealGenerationService(db)
