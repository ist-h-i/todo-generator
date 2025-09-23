from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Table,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


card_labels = Table(
    "card_labels",
    Base.metadata,
    Column("card_id", String, ForeignKey("cards.id", ondelete="CASCADE"), primary_key=True),
    Column("label_id", String, ForeignKey("labels.id", ondelete="CASCADE"), primary_key=True),
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    cards: Mapped[list["Card"]] = relationship(
        "Card", back_populates="owner", cascade="all, delete-orphan"
    )
    tokens: Mapped[list["SessionToken"]] = relationship(
        "SessionToken", back_populates="user", cascade="all, delete-orphan"
    )
    daily_card_quotas: Mapped[list["DailyCardQuota"]] = relationship(
        "DailyCardQuota", back_populates="owner", cascade="all, delete-orphan"
    )


class SessionToken(Base, TimestampMixin):
    __tablename__ = "session_tokens"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship("User", back_populates="tokens")


class Card(Base, TimestampMixin):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    status_id: Mapped[str | None] = mapped_column(String, ForeignKey("statuses.id"))
    priority: Mapped[str | None] = mapped_column(String)
    story_points: Mapped[int | None] = mapped_column(Integer)
    estimate_hours: Mapped[float | None] = mapped_column(Float)
    assignees: Mapped[list[str]] = mapped_column(JSON, default=list)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dependencies: Mapped[list[str]] = mapped_column(JSON, default=list)
    ai_confidence: Mapped[float | None] = mapped_column(Float)
    ai_notes: Mapped[str | None] = mapped_column(Text)
    custom_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    error_category_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("error_categories.id", ondelete="SET NULL"), nullable=True
    )
    initiative_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("improvement_initiatives.id", ondelete="SET NULL"), nullable=True
    )
    ai_similarity_vector_id: Mapped[str | None] = mapped_column(String)
    analytics_notes: Mapped[str | None] = mapped_column(Text)
    owner_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    labels: Mapped[list[Label]] = relationship(
        "Label",
        secondary=card_labels,
        back_populates="cards",
        lazy="joined",
    )
    subtasks: Mapped[list[Subtask]] = relationship(
        "Subtask", back_populates="card", cascade="all, delete-orphan"
    )
    status: Mapped[Status | None] = relationship("Status", back_populates="cards")
    error_category: Mapped[Optional["ErrorCategory"]] = relationship(
        "ErrorCategory", back_populates="cards"
    )
    initiative: Mapped[Optional["ImprovementInitiative"]] = relationship(
        "ImprovementInitiative", back_populates="cards"
    )
    comments: Mapped[list[Comment]] = relationship(
        "Comment", back_populates="card", cascade="all, delete-orphan"
    )
    activity_logs: Mapped[list[ActivityLog]] = relationship(
        "ActivityLog", back_populates="card", cascade="all, delete-orphan"
    )
    originating_suggestion: Mapped[Optional["SuggestedAction"]] = relationship(
        "SuggestedAction", back_populates="created_card", uselist=False
    )
    owner: Mapped[User] = relationship("User", back_populates="cards")


class DailyCardQuota(Base):
    __tablename__ = "daily_card_quotas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    quota_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    owner: Mapped[User] = relationship("User", back_populates="daily_card_quotas")

    __table_args__ = (
        UniqueConstraint("owner_id", "quota_date", name="uq_daily_card_quota_owner_date"),
    )


class Subtask(Base, TimestampMixin):
    __tablename__ = "subtasks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str] = mapped_column(String, ForeignKey("cards.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str | None] = mapped_column(String)
    priority: Mapped[str | None] = mapped_column(String)
    assignee: Mapped[str | None] = mapped_column(String)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    estimate_hours: Mapped[float | None] = mapped_column(Float)
    story_points: Mapped[int | None] = mapped_column(Integer)
    checklist: Mapped[list[dict]] = mapped_column(JSON, default=list)
    ai_similarity_vector_id: Mapped[str | None] = mapped_column(String)
    root_cause_node_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("root_cause_nodes.id", ondelete="SET NULL"), nullable=True
    )

    card: Mapped[Card] = relationship("Card", back_populates="subtasks")
    root_cause_node: Mapped[Optional["RootCauseNode"]] = relationship(
        "RootCauseNode", back_populates="subtasks"
    )


class Label(Base):
    __tablename__ = "labels"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    color: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)

    cards: Mapped[list[Card]] = relationship(
        "Card", secondary=card_labels, back_populates="labels"
    )


class Status(Base):
    __tablename__ = "statuses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    category: Mapped[str | None] = mapped_column(String)
    order: Mapped[int | None] = mapped_column(Integer)
    color: Mapped[str | None] = mapped_column(String)
    wip_limit: Mapped[int | None] = mapped_column(Integer)

    cards: Mapped[list[Card]] = relationship("Card", back_populates="status")


class UserPreference(Base, TimestampMixin):
    __tablename__ = "user_preferences"

    user_id: Mapped[str] = mapped_column(String, primary_key=True)
    board_grouping: Mapped[str | None] = mapped_column(String)
    board_layout: Mapped[dict] = mapped_column(JSON, default=dict)
    visible_fields: Mapped[list[str]] = mapped_column(JSON, default=list)
    notification_settings: Mapped[dict] = mapped_column(JSON, default=dict)
    preferred_language: Mapped[str | None] = mapped_column(String)


class Comment(Base):
    __tablename__ = "comments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str] = mapped_column(String, ForeignKey("cards.id", ondelete="CASCADE"))
    author_id: Mapped[str | None] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

    card: Mapped[Card] = relationship("Card", back_populates="comments")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (UniqueConstraint("id", name="uq_activity_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("cards.id", ondelete="CASCADE"), nullable=True
    )
    actor_id: Mapped[str | None] = mapped_column(String)
    action: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow
    )

    card: Mapped[Card | None] = relationship("Card", back_populates="activity_logs")


class ErrorCategory(Base, TimestampMixin):
    __tablename__ = "error_categories"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    severity_level: Mapped[str | None] = mapped_column(String)

    cards: Mapped[list[Card]] = relationship("Card", back_populates="error_category")


class ImprovementInitiative(Base, TimestampMixin):
    __tablename__ = "improvement_initiatives"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    owner: Mapped[str | None] = mapped_column(String)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    target_metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str | None] = mapped_column(String)
    health: Mapped[str | None] = mapped_column(String)

    cards: Mapped[list[Card]] = relationship("Card", back_populates="initiative")
    progress_logs: Mapped[list["InitiativeProgressLog"]] = relationship(
        "InitiativeProgressLog",
        back_populates="initiative",
        cascade="all, delete-orphan",
        order_by="InitiativeProgressLog.timestamp",
    )
    suggested_actions: Mapped[list["SuggestedAction"]] = relationship(
        "SuggestedAction", back_populates="initiative"
    )


class InitiativeProgressLog(Base, TimestampMixin):
    __tablename__ = "initiative_progress_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    initiative_id: Mapped[str] = mapped_column(
        String, ForeignKey("improvement_initiatives.id", ondelete="CASCADE")
    )
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    status: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)
    observed_metrics: Mapped[dict] = mapped_column(JSON, default=dict)

    initiative: Mapped[ImprovementInitiative] = relationship(
        "ImprovementInitiative", back_populates="progress_logs"
    )


class AnalyticsSnapshot(Base, TimestampMixin):
    __tablename__ = "analytics_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str | None] = mapped_column(String)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    generated_by: Mapped[str | None] = mapped_column(String)
    workspace_id: Mapped[str | None] = mapped_column(String)
    narrative: Mapped[str | None] = mapped_column(Text)

    analyses: Mapped[list["RootCauseAnalysis"]] = relationship(
        "RootCauseAnalysis", back_populates="snapshot", cascade="all, delete-orphan"
    )


class RootCauseAnalysis(Base, TimestampMixin):
    __tablename__ = "root_cause_analyses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    snapshot_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("analytics_snapshots.id", ondelete="SET NULL"), nullable=True
    )
    target_type: Mapped[str] = mapped_column(String, default="snapshot")
    target_id: Mapped[str | None] = mapped_column(String)
    created_by: Mapped[str | None] = mapped_column(String)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String, default="pending")
    model_version: Mapped[str | None] = mapped_column(String)
    summary: Mapped[str | None] = mapped_column(Text)

    snapshot: Mapped[AnalyticsSnapshot | None] = relationship(
        "AnalyticsSnapshot", back_populates="analyses"
    )
    nodes: Mapped[list["RootCauseNode"]] = relationship(
        "RootCauseNode", back_populates="analysis", cascade="all, delete-orphan"
    )
    suggestions: Mapped[list["SuggestedAction"]] = relationship(
        "SuggestedAction", back_populates="analysis", cascade="all, delete-orphan"
    )


class RootCauseNode(Base, TimestampMixin):
    __tablename__ = "root_cause_nodes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    analysis_id: Mapped[str] = mapped_column(
        String, ForeignKey("root_cause_analyses.id", ondelete="CASCADE")
    )
    depth: Mapped[int] = mapped_column(Integer, default=0)
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float)
    evidence_refs: Mapped[list[str]] = mapped_column(JSON, default=list)
    recommended_metrics: Mapped[list[str]] = mapped_column(JSON, default=list)
    parent_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("root_cause_nodes.id", ondelete="SET NULL"), nullable=True
    )
    state: Mapped[str] = mapped_column(String, default="proposed")

    analysis: Mapped[RootCauseAnalysis] = relationship(
        "RootCauseAnalysis", back_populates="nodes", foreign_keys=[analysis_id]
    )
    parent: Mapped[Optional["RootCauseNode"]] = relationship(
        "RootCauseNode",
        remote_side="RootCauseNode.id",
        back_populates="children",
    )
    children: Mapped[list["RootCauseNode"]] = relationship(
        "RootCauseNode", back_populates="parent", cascade="all, delete-orphan"
    )
    suggestions: Mapped[list["SuggestedAction"]] = relationship(
        "SuggestedAction", back_populates="node", cascade="all, delete-orphan"
    )
    subtasks: Mapped[list[Subtask]] = relationship(
        "Subtask", back_populates="root_cause_node"
    )


class SuggestedAction(Base, TimestampMixin):
    __tablename__ = "suggested_actions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    analysis_id: Mapped[str] = mapped_column(
        String, ForeignKey("root_cause_analyses.id", ondelete="CASCADE")
    )
    node_id: Mapped[str] = mapped_column(
        String, ForeignKey("root_cause_nodes.id", ondelete="CASCADE")
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    effort_estimate: Mapped[str | None] = mapped_column(String)
    impact_score: Mapped[int | None] = mapped_column(Integer)
    owner_role: Mapped[str | None] = mapped_column(String)
    due_date_hint: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(String, default="pending")
    initiative_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("improvement_initiatives.id", ondelete="SET NULL"), nullable=True
    )
    created_card_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("cards.id", ondelete="SET NULL"), nullable=True
    )

    analysis: Mapped[RootCauseAnalysis] = relationship(
        "RootCauseAnalysis", back_populates="suggestions"
    )
    node: Mapped[RootCauseNode] = relationship("RootCauseNode", back_populates="suggestions")
    initiative: Mapped[Optional[ImprovementInitiative]] = relationship(
        "ImprovementInitiative", back_populates="suggested_actions"
    )
    created_card: Mapped[Optional[Card]] = relationship(
        "Card", back_populates="originating_suggestion"
    )


class ReportTemplate(Base, TimestampMixin):
    __tablename__ = "report_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    audience: Mapped[str | None] = mapped_column(String)
    sections_json: Mapped[list[dict] | list[str]] = mapped_column(JSON, default=list)
    branding: Mapped[dict] = mapped_column(JSON, default=dict)

    reports: Mapped[list["GeneratedReport"]] = relationship(
        "GeneratedReport", back_populates="template"
    )

    @property
    def sections(self) -> list:
        return list(self.sections_json or [])

    @sections.setter
    def sections(self, value: list) -> None:
        self.sections_json = value or []


class GeneratedReport(Base, TimestampMixin):
    __tablename__ = "generated_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    template_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("report_templates.id", ondelete="SET NULL"), nullable=True
    )
    author_id: Mapped[str | None] = mapped_column(String)
    parameters_json: Mapped[dict] = mapped_column(JSON, default=dict)
    content: Mapped[str] = mapped_column(Text)
    export_urls: Mapped[list[str]] = mapped_column(JSON, default=list)

    template: Mapped[ReportTemplate | None] = relationship(
        "ReportTemplate", back_populates="reports"
    )

    @property
    def parameters(self) -> dict:
        return dict(self.parameters_json or {})

    @parameters.setter
    def parameters(self, value: dict) -> None:
        self.parameters_json = value or {}


class SavedFilter(Base, TimestampMixin):
    __tablename__ = "saved_filters"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    definition: Mapped[dict] = mapped_column(JSON, default=dict)
    created_by: Mapped[str | None] = mapped_column(String)
    shared: Mapped[bool] = mapped_column(Boolean, default=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SimilarityFeedback(Base, TimestampMixin):
    __tablename__ = "similarity_feedback"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str] = mapped_column(String, ForeignKey("cards.id", ondelete="CASCADE"))
    related_id: Mapped[str] = mapped_column(String)
    related_type: Mapped[str] = mapped_column(String)
    is_relevant: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text)

    card: Mapped[Card] = relationship("Card")
