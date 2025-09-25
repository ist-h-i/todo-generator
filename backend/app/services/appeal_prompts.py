from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, ClassVar, Iterable

from jinja2 import Environment, FileSystemLoader, StrictUndefined, select_autoescape

from .. import schemas

CAUSAL_CONNECTORS = {"link": "そのため", "result": "結果として"}


@dataclass(frozen=True)
class FlowStepDetail:
    """Human friendly description of a narrative step."""

    label: str
    description: str


class AppealPromptBuilder:
    """Render prompt instructions for the appeal generation model."""

    _STEP_DESCRIPTIONS: ClassVar[dict[str, str]] = {
        "課題": "直面している問題や障壁の背景を明確化する",
        "対策": "課題に対して取った具体的な打ち手や工夫を説明する",
        "実績": "対策によって得られた成果や定量的な改善を共有する",
        "行動計画": "今後継続する施策や追加で予定している対応をまとめる",
        "所感": "得られた学びやチーム・顧客への影響を振り返る",
        "自由入力": "ユーザーが強調したい追加ポイントを補足する",
    }

    def __init__(self, template_name: str = "appeals.jinja") -> None:
        base_dir = Path(__file__).resolve().parent.parent / "prompts"
        loader = FileSystemLoader(str(base_dir))
        self._environment = Environment(
            loader=loader,
            autoescape=select_autoescape(enabled_extensions=("jinja", "jinja2")),
            trim_blocks=True,
            lstrip_blocks=True,
            undefined=StrictUndefined,
        )
        self._environment.filters.setdefault("tojson", self._tojson_filter)
        self._template = self._environment.get_template(template_name)

    def build(
        self,
        *,
        subject: str,
        subject_type: str,
        flow: Iterable[str],
        achievements: Iterable[schemas.AppealAchievement],
        formats: Iterable[schemas.AppealFormatDefinition],
        workspace_profile: dict[str, Any] | None = None,
    ) -> str:
        flow_details = [self._describe_step(step) for step in flow]
        sanitized_achievements = [
            {
                "title": achievement.title,
                "summary": achievement.summary,
            }
            for achievement in achievements
        ]
        context = {
            "subject": subject,
            "subject_type": subject_type,
            "flow": flow_details,
            "achievements": sanitized_achievements,
            "formats": list(formats),
            "required_connectors": list(CAUSAL_CONNECTORS.values()),
            "workspace_profile": workspace_profile or {},
        }
        return self._template.render(context)

    def build_response_schema(self, requested_formats: Iterable[str] | None = None) -> dict[str, Any]:
        """Return the JSON schema expected from the Responses API."""

        schema: dict[str, Any] = {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "model": {"type": "string"},
                "formats": {
                    "type": "object",
                    "additionalProperties": False,
                    "patternProperties": {
                        ".*": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "content": {"type": "string", "minLength": 1},
                                "tokens_used": {"type": ["integer", "null"]},
                            },
                            "required": ["content"],
                        }
                    },
                },
                "token_usage": {
                    "type": "object",
                    "additionalProperties": {
                        "type": ["integer", "number", "null"],
                    },
                },
            },
            "required": ["formats"],
        }

        if requested_formats:
            allowed = [fmt.strip().lower() for fmt in requested_formats if fmt.strip()]
            schema["properties"]["formats"]["propertyNames"] = {
                "type": "string",
                "enum": allowed,
            }

        return schema

    def _describe_step(self, step_label: str) -> FlowStepDetail:
        description = self._STEP_DESCRIPTIONS.get(step_label, "ステップの目的を読者に分かりやすく伝える")
        return FlowStepDetail(label=step_label, description=description)

    def _tojson_filter(self, value: Any, *, indent: int | None = None) -> str:
        import json

        return json.dumps(value, ensure_ascii=False, indent=indent)


class AppealFallbackBuilder:
    """Construct deterministic narratives when AI generation is unavailable."""

    def build(
        self,
        format_id: str,
        *,
        subject: str,
        flow: Iterable[str],
        achievements: Iterable[schemas.AppealAchievement],
    ) -> str:
        connectors = CAUSAL_CONNECTORS
        normalized_flow = [step.strip() for step in flow if step.strip()]
        sanitized_achievements = list(achievements)

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
            if sanitized_achievements:
                lines.append("## 実績ハイライト")
                for item in sanitized_achievements:
                    summary = item.summary or "価値提供につながりました。"
                    lines.append(f"- {connectors['result']}、{item.title}を達成し、{summary}")
            lines.append(f"{connectors['result']}、{subject}の強みを示すことができました。")
            return "\n".join(lines)

        if format_id == "bullet_list":
            items: list[str] = []
            for step in normalized_flow:
                items.append(f"- {connectors['link']}、{step}に取り組みました。")
            highlight = sanitized_achievements[0] if sanitized_achievements else None
            if highlight:
                summary = highlight.summary or "価値提供につながりました。"
                items.append(f"- {connectors['result']}、{highlight.title}を示し、{summary}")
            else:
                items.append(f"- {connectors['result']}、{subject}の成長を証明しました。")
            return "\n".join(items)

        if format_id == "table":
            rows = ["Step,Summary"]
            previous_step: str | None = None
            for step in normalized_flow:
                if previous_step is None:
                    summary = f"{connectors['link']}、{subject}に関する{step}の背景整理"
                else:
                    summary = f"{connectors['link']}、{previous_step}を踏まえて{step}を推進"
                rows.append(f"{step},{summary}")
                previous_step = step
            highlight = sanitized_achievements[0] if sanitized_achievements else None
            if highlight:
                summary = highlight.summary or "価値提供につながりました"
                rows.append(f"{connectors['result']},{highlight.title} - {summary}")
            else:
                rows.append(f"{connectors['result']},{subject}の成果を共有")
            return "\n".join(rows)

        # Default fallback mirrors markdown to ensure connectors are present.
        return self.build(
            "markdown",
            subject=subject,
            flow=normalized_flow,
            achievements=sanitized_achievements,
        )
