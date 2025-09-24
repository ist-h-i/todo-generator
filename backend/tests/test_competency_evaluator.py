from datetime import datetime, timedelta, timezone

import pytest

from app import models
from app.services.competency_evaluator import CompetencyEvaluator

from .conftest import TestingSessionLocal


@pytest.fixture()
def db_session(client):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def test_recent_completions_are_emphasized(db_session):
    now = datetime.now(timezone.utc)
    today = now.date()
    period_start = today - timedelta(days=120)

    user = models.User(email="member@example.com", password_hash="hashed")
    competency = models.Competency(name="成長テスト", level="intermediate")
    db_session.add_all([user, competency])
    db_session.flush()

    status = models.Status(name="完了", category="done", owner_id=user.id)
    db_session.add(status)
    db_session.flush()

    old_card = models.Card(title="過去カード", owner_id=user.id, status=status)
    old_card.created_at = now - timedelta(days=80)
    old_card.updated_at = now - timedelta(days=2)
    old_card.completed_at = now - timedelta(days=35)

    recent_card = models.Card(title="最近カード", owner_id=user.id, status=status)
    recent_card.created_at = now - timedelta(days=20)
    recent_card.updated_at = now - timedelta(days=1)
    recent_card.completed_at = now - timedelta(days=5)

    db_session.add_all([old_card, recent_card])

    old_subtask = models.Subtask(card=old_card, title="過去サブタスク", status="done")
    old_subtask.created_at = now - timedelta(days=80)
    old_subtask.updated_at = now - timedelta(days=2)
    old_subtask.completed_at = now - timedelta(days=35)

    recent_subtask_one = models.Subtask(card=recent_card, title="最近サブタスク1", status="done")
    recent_subtask_one.created_at = now - timedelta(days=20)
    recent_subtask_one.updated_at = now - timedelta(days=1)
    recent_subtask_one.completed_at = now - timedelta(days=5)

    recent_subtask_two = models.Subtask(card=recent_card, title="最近サブタスク2", status="done")
    recent_subtask_two.created_at = now - timedelta(days=18)
    recent_subtask_two.updated_at = now - timedelta(days=1)
    recent_subtask_two.completed_at = now - timedelta(days=3)

    db_session.add_all([old_subtask, recent_subtask_one, recent_subtask_two])
    db_session.flush()

    evaluator = CompetencyEvaluator(db_session)
    evaluation = evaluator.evaluate(
        user=user,
        competency=competency,
        period_start=period_start,
        period_end=today,
        triggered_by="test",
    )

    metrics = evaluation.context["metrics"]
    assert metrics["cards_completed"] == 2
    assert metrics["subtasks_completed"] == 3
    assert metrics["recent_cards_completed"] == 1
    assert metrics["recent_subtasks_completed"] == 2
    assert metrics["effective_completed"] == 8
    assert metrics["recent_completed_total"] == 3
    assert metrics["older_completed_total"] == 2
    assert metrics["recent_completion_window_days"] == 30

    assert evaluation.score_value == 3
    assert evaluation.score_label == "標準"
    assert "直近30日" in evaluation.rationale
    assert evaluation.items[0].rationale.count("直近30日") == 1


def test_editing_completed_work_does_not_count_as_recent(db_session):
    now = datetime.now(timezone.utc)
    today = now.date()
    period_start = today - timedelta(days=200)

    user = models.User(email="member@example.com", password_hash="hashed")
    competency = models.Competency(name="完了済みテスト", level="intermediate")
    db_session.add_all([user, competency])
    db_session.flush()

    status = models.Status(name="完了", category="done", owner_id=user.id)
    db_session.add(status)
    db_session.flush()

    card = models.Card(title="完了済みカード", owner_id=user.id, status=status)
    card.created_at = now - timedelta(days=150)
    card.updated_at = now - timedelta(days=2)
    card.completed_at = now - timedelta(days=90)

    subtask = models.Subtask(card=card, title="完了済みサブタスク", status="done")
    subtask.created_at = now - timedelta(days=150)
    subtask.updated_at = now - timedelta(days=1)
    subtask.completed_at = now - timedelta(days=90)

    db_session.add_all([card, subtask])
    db_session.flush()

    evaluator = CompetencyEvaluator(db_session)
    evaluation = evaluator.evaluate(
        user=user,
        competency=competency,
        period_start=period_start,
        period_end=today,
        triggered_by="test",
    )

    metrics = evaluation.context["metrics"]
    assert metrics["cards_completed"] == 1
    assert metrics["subtasks_completed"] == 1
    assert metrics["recent_cards_completed"] == 0
    assert metrics["recent_subtasks_completed"] == 0
    assert metrics["recent_completed_total"] == 0
    assert metrics["older_completed_total"] == 2
