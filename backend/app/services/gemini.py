from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List

from ..config import settings
from ..schemas import AnalysisCard, AnalysisRequest, AnalysisResponse, AnalysisSubtask


@dataclass
class KeywordMapping:
    keyword: str
    label: str


class GeminiClient:
    """Deterministic stub that emulates Gemini summarisation."""

    DEFAULT_LABELS: List[KeywordMapping] = [
        KeywordMapping("bug", "bug"),
        KeywordMapping("fix", "maintenance"),
        KeywordMapping("feature", "feature"),
        KeywordMapping("docs", "documentation"),
        KeywordMapping("research", "research"),
    ]

    def __init__(self, model: str | None = None) -> None:
        self.model = model or settings.gemini_model

    def analyze(self, request: AnalysisRequest) -> AnalysisResponse:
        text = request.text.strip()
        if not text:
            return AnalysisResponse(model=self.model, proposals=[])

        segments = [seg.strip() for seg in text.split("\n\n") if seg.strip()]
        proposals: List[AnalysisCard] = []

        for segment in segments[: request.max_cards]:
            proposals.append(self._segment_to_card(segment))

        if not proposals:
            proposals.append(self._segment_to_card(text))

        return AnalysisResponse(model=self.model, proposals=proposals)

    def _segment_to_card(self, segment: str) -> AnalysisCard:
        sentences = [s.strip() for s in segment.replace("\n", " ").split(".") if s.strip()]
        title = sentences[0][:80] if sentences else segment[:80]
        summary = segment[:500]
        lower = segment.lower()
        labels = self._extract_labels(lower)
        priority = self._derive_priority(lower)
        due_in = self._derive_due_in_days(lower)
        subtasks = self._create_subtasks(sentences)

        return AnalysisCard(
            title=title,
            summary=summary,
            labels=labels,
            priority=priority,
            due_in_days=due_in,
            subtasks=subtasks,
        )

    def _extract_labels(self, text: str) -> List[str]:
        labels = {mapping.label for mapping in self.DEFAULT_LABELS if mapping.keyword in text}
        if "refactor" in text:
            labels.add("refactor")
        if "test" in text:
            labels.add("testing")
        return sorted(labels)

    def _derive_priority(self, text: str) -> str:
        if any(word in text for word in ["urgent", "critical", "asap"]):
            return "high"
        if "low" in text:
            return "low"
        return "medium"

    def _derive_due_in_days(self, text: str) -> int | None:
        if "today" in text:
            return 0
        if "tomorrow" in text:
            return 1
        if "next week" in text:
            return 7
        if "this month" in text:
            return 21
        return None

    def _create_subtasks(self, sentences: Iterable[str]) -> List[AnalysisSubtask]:
        subtasks: List[AnalysisSubtask] = []
        for sentence in sentences[1:3]:
            subtasks.append(
                AnalysisSubtask(
                    title=sentence[:80] or "Review details",
                    description=sentence,
                    status="todo",
                )
            )
        if not subtasks:
            subtasks.append(
                AnalysisSubtask(
                    title="Plan execution steps",
                    description="Break the request into actionable subtasks.",
                    status="todo",
                )
            )
        return subtasks


def get_gemini_client() -> GeminiClient:
    return GeminiClient()
