from __future__ import annotations

import logging
import math
import re
from collections import Counter
from dataclasses import dataclass
from time import perf_counter
from typing import Iterable, Sequence

from ..config import settings
from ..schemas import UserProfile

logger = logging.getLogger(__name__)

_TOKEN_PATTERN = re.compile(r"[A-Za-z0-9ぁ-んァ-ン一-龥ー々〆〤]+")


@dataclass(slots=True)
class RecommendationScore:
    """Container describing the outcome of a recommendation score calculation."""

    score: int
    label_correlation: float
    profile_alignment: float
    explanation: str
    failure_reason: str | None = None


class RecommendationScoringService:
    """Derive an AI-backed recommendation score using lightweight heuristics.

    The production system integrates an LLM-powered engine, but for the local
    environment and tests we approximate the behaviour with deterministic
    token-based similarity so that downstream components can rely on the same
    contract (0-100 range, explanation text, and failure fallbacks).
    """

    def __init__(
        self,
        *,
        label_weight: float | None = None,
        profile_weight: float | None = None,
    ) -> None:
        configured_label_weight = settings.recommendation_label_weight if label_weight is None else label_weight
        configured_profile_weight = settings.recommendation_profile_weight if profile_weight is None else profile_weight

        if configured_label_weight < 0 or configured_profile_weight < 0:
            raise ValueError("Recommendation weights must be non-negative.")

        weight_sum = configured_label_weight + configured_profile_weight
        if math.isclose(weight_sum, 0.0):
            # Maintain a sane default when the configuration disables every input.
            configured_label_weight, configured_profile_weight = 1.0, 0.0

        self._label_weight = configured_label_weight
        self._profile_weight = configured_profile_weight

    def score_card(
        self,
        *,
        title: str,
        summary: str | None,
        description: str | None,
        labels: Sequence[str],
        profile: UserProfile,
    ) -> RecommendationScore:
        """Calculate a recommendation score for a prospective card."""

        start_time = perf_counter()
        try:
            text = self._compose_text(title, summary, description)
            tokens = self._tokenize(text)
            label_tokens = [self._tokenize(label) for label in labels if label]
            profile_tokens = self._extract_profile_tokens(profile)

            label_score = self._calculate_label_correlation(tokens, label_tokens)
            profile_score = self._calculate_profile_alignment(tokens, profile_tokens)
            score = self._combine_scores(label_score, profile_score)
            explanation = self._build_explanation(
                score,
                label_score,
                profile_score,
                has_labels=bool(label_tokens),
                has_profile=bool(profile_tokens),
            )

            elapsed_ms = (perf_counter() - start_time) * 1000
            logger.debug(
                "Recommendation scoring completed",
                extra={
                    "elapsed_ms": elapsed_ms,
                    "label_weight": self._label_weight,
                    "profile_weight": self._profile_weight,
                    "label_score": label_score,
                    "profile_score": profile_score,
                    "score": score,
                },
            )

            return RecommendationScore(
                score=score,
                label_correlation=label_score,
                profile_alignment=profile_score,
                explanation=explanation,
            )
        except Exception:  # pragma: no cover - defensive safeguard
            logger.exception("Failed to compute recommendation score.")
            elapsed_ms = (perf_counter() - start_time) * 1000
            logger.debug(
                "Recommendation scoring failed; returning fallback",
                extra={
                    "elapsed_ms": elapsed_ms,
                    "label_weight": self._label_weight,
                    "profile_weight": self._profile_weight,
                    "label_score": None,
                    "profile_score": None,
                    "score": 0,
                },
            )
            fallback_message = "AIスコアリングが利用できなかったため、おすすめ度を0として登録しました。"
            return RecommendationScore(
                score=0,
                label_correlation=0.0,
                profile_alignment=0.0,
                explanation=fallback_message,
                failure_reason="scoring_error",
            )

    @staticmethod
    def _compose_text(title: str, summary: str | None, description: str | None) -> str:
        segments = [title.strip()]
        if summary:
            segments.append(summary.strip())
        if description:
            segments.append(description.strip())
        return "\n".join(segment for segment in segments if segment)

    @staticmethod
    def _tokenize(value: str) -> list[str]:
        if not value:
            return []
        lower = value.lower()
        return _TOKEN_PATTERN.findall(lower)

    @staticmethod
    def _extract_profile_tokens(profile: UserProfile) -> list[str]:
        tokens: list[str] = []

        for role in profile.roles:
            tokens.extend(RecommendationScoringService._tokenize(role))

        if profile.bio:
            tokens.extend(RecommendationScoringService._tokenize(profile.bio))

        if profile.nickname:
            tokens.extend(RecommendationScoringService._tokenize(profile.nickname))

        return tokens

    def _calculate_label_correlation(
        self,
        card_tokens: list[str],
        label_tokens: Iterable[list[str]],
    ) -> float:
        best_similarity = 0.0

        card_counter = Counter(card_tokens)
        if not card_counter:
            return 0.0

        for tokens in label_tokens:
            label_counter = Counter(tokens)
            if not label_counter:
                continue

            similarity = self._cosine_similarity(card_counter, label_counter)
            if similarity > best_similarity:
                best_similarity = similarity

        return round(best_similarity * 100, 2)

    def _calculate_profile_alignment(
        self,
        card_tokens: list[str],
        profile_tokens: list[str],
    ) -> float:
        if not card_tokens or not profile_tokens:
            return 0.0

        card_counter = Counter(card_tokens)
        profile_counter = Counter(profile_tokens)

        similarity = self._cosine_similarity(card_counter, profile_counter)
        return round(similarity * 100, 2)

    def _combine_scores(self, label_score: float, profile_score: float) -> int:
        weight_sum = self._label_weight + self._profile_weight
        if weight_sum <= 0:
            return 0

        weighted = (label_score * self._label_weight + profile_score * self._profile_weight) / weight_sum
        clamped = max(0.0, min(100.0, weighted))
        return round(clamped)

    @staticmethod
    def _build_explanation(
        score: int,
        label_score: float,
        profile_score: float,
        *,
        has_labels: bool,
        has_profile: bool,
    ) -> str:
        label_section = f"ラベル相関度 {label_score:.0f}/100"
        profile_section = f"プロフィール適合度 {profile_score:.0f}/100"
        summary = f"おすすめ度を {score}/100 と評価しました。"

        details: list[str] = [label_section, profile_section, summary]

        if not has_labels:
            details.append("ラベルが未設定のため、相関度は0として計算しています。")
        if not has_profile:
            details.append("プロフィール情報が不足しているため、適合度は0として評価しました。")

        return "\n".join(details)

    @staticmethod
    def _cosine_similarity(left: Counter[str], right: Counter[str]) -> float:
        intersection = set(left.keys()) & set(right.keys())
        dot_product = sum(left[token] * right[token] for token in intersection)
        left_norm = math.sqrt(sum(value * value for value in left.values()))
        right_norm = math.sqrt(sum(value * value for value in right.values()))

        if left_norm == 0.0 or right_norm == 0.0:
            return 0.0

        return dot_product / (left_norm * right_norm)


__all__ = ["RecommendationScore", "RecommendationScoringService"]
