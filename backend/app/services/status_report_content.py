from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Sequence

from .. import models, schemas


@dataclass(slots=True)
class StatusReportContentService:
    """Provide helpers for normalizing and serializing report content."""

    def normalize_sections(self, sections: Sequence[schemas.StatusReportSection]) -> list[schemas.StatusReportSection]:
        normalized: list[schemas.StatusReportSection] = []
        for section in sections:
            body = section.body.strip()
            title = section.title.strip() if section.title else None
            if not body:
                continue
            normalized.append(schemas.StatusReportSection(title=title, body=body))
        return normalized

    def normalize_tags(self, tags: Iterable[str]) -> list[str]:
        cleaned: list[str] = []
        seen: set[str] = set()
        for tag in tags:
            value = tag.strip()
            if not value:
                continue
            canonical = value.casefold()
            if canonical in seen:
                continue
            seen.add(canonical)
            cleaned.append(value)
        return cleaned

    def sections_to_content(self, sections: Sequence[schemas.StatusReportSection]) -> dict[str, list[dict[str, str]]]:
        return {"sections": [section.model_dump() for section in sections]}

    def extract_sections(self, report: models.StatusReport) -> list[schemas.StatusReportSection]:
        content = report.content or {}
        raw_sections = content.get("sections", []) if isinstance(content, dict) else []
        sections: list[schemas.StatusReportSection] = []
        for item in raw_sections:
            if not isinstance(item, dict):
                continue
            body = str(item.get("body", "")).strip()
            if not body:
                continue
            title = item.get("title")
            sections.append(
                schemas.StatusReportSection(
                    title=str(title).strip() if title else None,
                    body=body,
                )
            )
        return sections

    def compose_analysis_prompt(
        self,
        report: models.StatusReport,
        sections: Sequence[schemas.StatusReportSection],
    ) -> str:
        lines: list[str] = []
        if report.shift_type:
            lines.append(f"Shift Type: {report.shift_type}")
        if report.tags:
            lines.append(f"Tags: {', '.join(report.tags)}")
        lines.append("")
        for index, section in enumerate(sections, start=1):
            heading = section.title or f"Section {index}"
            lines.append(f"{heading}:")
            lines.append(section.body)
            lines.append("")
        return "\n".join(lines).strip()


__all__ = ["StatusReportContentService"]
