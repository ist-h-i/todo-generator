from __future__ import annotations

import logging
from types import SimpleNamespace
from unittest import TestCase

import pytest

from app.services.recommendation_scoring import RecommendationScoringService

assertions = TestCase()


def test_score_card_emits_debug_log(caplog: pytest.LogCaptureFixture) -> None:
    service = RecommendationScoringService(label_weight=2.0, profile_weight=1.0)
    profile = SimpleNamespace(roles=["backend engineer"], bio="Build APIs", nickname=None)

    with caplog.at_level(logging.DEBUG, logger="app.services.recommendation_scoring"):
        result = service.score_card(
            title="Backend API alignment",
            summary="Ensure services stay consistent",
            description="",
            labels=["backend"],
            profile=profile,
        )

    record = next(
        log for log in caplog.records if log.levelno == logging.DEBUG and log.msg == "Recommendation scoring completed"
    )

    assertions.assertTrue(record.elapsed_ms >= 0)
    assertions.assertTrue(record.label_weight == pytest.approx(service._label_weight))
    assertions.assertTrue(record.profile_weight == pytest.approx(service._profile_weight))
    assertions.assertTrue(record.label_score == pytest.approx(result.label_correlation))
    assertions.assertTrue(record.profile_score == pytest.approx(result.profile_alignment))
    assertions.assertTrue(record.score == result.score)


def test_score_card_logs_debug_on_failure(caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch) -> None:
    service = RecommendationScoringService()
    profile = SimpleNamespace(roles=[], bio=None, nickname=None)

    def boom(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(service, "_compose_text", boom)

    with caplog.at_level(logging.DEBUG, logger="app.services.recommendation_scoring"):
        result = service.score_card(
            title="Any title",
            summary=None,
            description=None,
            labels=[],
            profile=profile,
        )

    assertions.assertTrue(result.failure_reason == "scoring_error")

    record = next(
        log
        for log in caplog.records
        if log.levelno == logging.DEBUG and log.msg == "Recommendation scoring failed; returning fallback"
    )

    assertions.assertTrue(record.elapsed_ms >= 0)
    assertions.assertTrue(record.label_weight == pytest.approx(service._label_weight))
    assertions.assertTrue(record.profile_weight == pytest.approx(service._profile_weight))
    assertions.assertTrue(record.label_score is None)
    assertions.assertTrue(record.profile_score is None)
    assertions.assertTrue(record.score == 0)
