"""Service responsible for competency evaluations."""

from __future__ import annotations

from datetime import date, datetime, time, timezone, timedelta
from typing import Iterable

from sqlalchemy.orm import Session

from .. import models


RECENT_COMPLETION_WINDOW_DAYS = 30
RECENT_COMPLETION_WEIGHT = 2.0


class CompetencyEvaluator:
    """Encapsulates the competency evaluation workflow."""

    def __init__(self, db: Session) -> None:
        self._db = db

    def evaluate(
        self,
        *,
        user: models.User,
        competency: models.Competency,
        period_start: date,
        period_end: date,
        triggered_by: str,
        job: models.CompetencyEvaluationJob | None = None,
    ) -> models.CompetencyEvaluation:
        start_dt, end_dt = self._to_datetime_range(period_start, period_end)
        metrics = self._collect_metrics(user=user, start=start_dt, end=end_dt)
        scale = 3 if competency.level.lower() == "junior" else 5
        score_value, score_label = self._determine_score(scale=scale, metrics=metrics)

        evaluation = models.CompetencyEvaluation(
            competency=competency,
            user=user,
            period_start=period_start,
            period_end=period_end,
            scale=scale,
            score_value=score_value,
            score_label=score_label,
            rationale=self._build_rationale(competency, metrics, score_label),
            attitude_actions=self._build_actions(competency, metrics, focus="attitude"),
            behavior_actions=self._build_actions(competency, metrics, focus="behavior"),
            ai_model="rule-based",
            triggered_by=triggered_by,
            job=job,
            context={"metrics": metrics},
        )

        self._db.add(evaluation)
        self._db.flush()

        criteria = list(competency.criteria)
        if not criteria:
            criteria = []

        for criterion in criteria or [None]:
            item = models.CompetencyEvaluationItem(
                evaluation=evaluation,
                criterion=criterion,
                score_value=score_value,
                score_label=score_label,
                rationale=self._build_criterion_rationale(criterion, metrics, score_label),
                attitude_actions=self._build_actions(competency, metrics, focus="attitude"),
                behavior_actions=self._build_actions(competency, metrics, focus="behavior"),
            )
            self._db.add(item)

        self._db.flush()
        return evaluation

    def _collect_metrics(
        self,
        *,
        user: models.User,
        start: datetime,
        end: datetime,
    ) -> dict[str, int]:
        cards = (
            self._db.query(models.Card)
            .filter(
                models.Card.owner_id == user.id,
                models.Card.created_at >= start,
                models.Card.created_at <= end,
            )
            .all()
        )

        subtasks = (
            self._db.query(models.Subtask)
            .join(models.Card, models.Subtask.card_id == models.Card.id)
            .filter(
                models.Card.owner_id == user.id,
                models.Subtask.created_at >= start,
                models.Subtask.created_at <= end,
            )
            .all()
        )

        recent_cutoff = max(start, end - timedelta(days=RECENT_COMPLETION_WINDOW_DAYS))

        completed_cards = sum(1 for card in cards if self._is_done(card.status_id, card.status))
        completed_subtasks = sum(
            1 for subtask in subtasks if self._is_status_done(subtask.status)
        )

        recent_cards_completed = sum(
            1
            for card in cards
            if self._is_done(card.status_id, card.status)
            and (
                (completion_ts := self._completion_timestamp(card)) is not None
                and recent_cutoff <= completion_ts <= end
            )
        )
        recent_subtasks_completed = sum(
            1
            for subtask in subtasks
            if self._is_status_done(subtask.status)
            and (
                (completion_ts := self._completion_timestamp(subtask)) is not None
                and recent_cutoff <= completion_ts <= end
            )
        )

        return {
            "cards_created": len(cards),
            "cards_completed": completed_cards,
            "subtasks_created": len(subtasks),
            "subtasks_completed": completed_subtasks,
            "recent_cards_completed": recent_cards_completed,
            "recent_subtasks_completed": recent_subtasks_completed,
            "recent_completion_window_days": RECENT_COMPLETION_WINDOW_DAYS,
        }

    def _determine_score(
        self,
        *,
        scale: int,
        metrics: dict[str, int],
    ) -> tuple[int, str]:
        total_completed = metrics.get("cards_completed", 0) + metrics.get(
            "subtasks_completed",
            0,
        )
        recent_completed = metrics.get("recent_cards_completed", 0) + metrics.get(
            "recent_subtasks_completed",
            0,
        )
        older_completed = max(total_completed - recent_completed, 0)
        effective_completed = int(
            recent_completed * RECENT_COMPLETION_WEIGHT + older_completed
        )

        metrics["recent_completed_total"] = recent_completed
        metrics["older_completed_total"] = older_completed
        metrics["effective_completed"] = effective_completed
        metrics["recent_completion_weight"] = RECENT_COMPLETION_WEIGHT

        if scale == 3:
            if effective_completed >= 12:
                return 3, "達成"
            if effective_completed >= 5:
                return 2, "部分達成"
            return 1, "未達"

        # Five-point scale for intermediate level
        if effective_completed >= 20:
            return 5, "卓越"
        if effective_completed >= 12:
            return 4, "良好"
        if effective_completed >= 6:
            return 3, "標準"
        if effective_completed >= 3:
            return 2, "要改善"
        return 1, "未達"

    def _build_rationale(
        self,
        competency: models.Competency,
        metrics: dict[str, int],
        score_label: str,
    ) -> str:
        return (
            f"{competency.name}に対する今月の評価は『{score_label}』です。"
            f"カード完了数は{metrics.get('cards_completed', 0)}件、"
            f"サブタスク完了数は{metrics.get('subtasks_completed', 0)}件でした。"
            f"直近{metrics.get('recent_completion_window_days', RECENT_COMPLETION_WINDOW_DAYS)}日では"
            f"カード{metrics.get('recent_cards_completed', 0)}件、"
            f"サブタスク{metrics.get('recent_subtasks_completed', 0)}件を完了しています。"
        )

    def _build_criterion_rationale(
        self,
        criterion: models.CompetencyCriterion | None,
        metrics: dict[str, int],
        score_label: str,
    ) -> str:
        if criterion is None:
            return (
                f"全体評価は『{score_label}』です。"
                f"カード{metrics.get('cards_completed', 0)}件、"
                f"サブタスク{metrics.get('subtasks_completed', 0)}件を完了しました。"
                f"直近{metrics.get('recent_completion_window_days', RECENT_COMPLETION_WINDOW_DAYS)}日では"
                f"カード{metrics.get('recent_cards_completed', 0)}件、"
                f"サブタスク{metrics.get('recent_subtasks_completed', 0)}件の完了が確認できています。"
            )

        base = f"評価項目『{criterion.title}』では『{score_label}』と判定しました。"
        return (
            base
            + f"対象期間中の成果はカード完了{metrics.get('cards_completed', 0)}件、"
            f"サブタスク完了{metrics.get('subtasks_completed', 0)}件です。"
            f"直近{metrics.get('recent_completion_window_days', RECENT_COMPLETION_WINDOW_DAYS)}日で"
            f"カード{metrics.get('recent_cards_completed', 0)}件、"
            f"サブタスク{metrics.get('recent_subtasks_completed', 0)}件を完了しています。"
        )

    def _build_actions(
        self,
        competency: models.Competency,
        metrics: dict[str, int],
        *,
        focus: str,
    ) -> list[str]:
        remaining = max(metrics.get("cards_created", 0) - metrics.get("cards_completed", 0), 0)
        if focus == "attitude":
            return [
                f"{competency.name}に沿って完了までやり切る姿勢を維持しましょう。残タスクは{remaining}件です。",
                "週次で成果を振り返り、改善ポイントを共有しましょう。",
            ]

        return [
            "未完了タスクに着手する前に優先順位を再確認してください。",
            "サブタスクを細分化し、1日単位で進捗を可視化しましょう。",
        ]

    def _is_done(self, status_id: str | None, status: models.Status | None) -> bool:
        if status is None:
            return False
        if getattr(status, "category", "") == "done":
            return True
        name = (status.name or "").strip().lower()
        return name in {"done", "completed", "完了"}

    def _is_status_done(self, value: str | None) -> bool:
        if not value:
            return False
        normalized = value.strip().lower()
        return normalized in {"done", "completed", "完了"}

    def _to_datetime_range(self, start: date, end: date) -> tuple[datetime, datetime]:
        start_dt = datetime.combine(start, time.min).replace(tzinfo=timezone.utc)
        end_dt = datetime.combine(end, time.max).replace(tzinfo=timezone.utc)
        return start_dt, end_dt

    def _completion_timestamp(self, obj: models.Card | models.Subtask) -> datetime | None:
        completed = self._normalize_datetime(getattr(obj, "completed_at", None))
        if completed:
            return completed

        return self._normalize_datetime(getattr(obj, "created_at", None))

    @staticmethod
    def _normalize_datetime(value: datetime | None) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)


__all__: Iterable[str] = ["CompetencyEvaluator"]
