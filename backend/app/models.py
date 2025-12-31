from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any, Optional
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
    LargeBinary,
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    nickname: Mapped[str | None] = mapped_column(String(64), nullable=True)
    experience_years: Mapped[int | None] = mapped_column(Integer, nullable=True)
    roles: Mapped[list[str]] = mapped_column(JSON, default=list)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    avatar_image: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    avatar_mime_type: Mapped[str | None] = mapped_column(String(64), nullable=True)

    cards: Mapped[list["Card"]] = relationship("Card", back_populates="owner", cascade="all, delete-orphan")
    tokens: Mapped[list["SessionToken"]] = relationship(
        "SessionToken", back_populates="user", cascade="all, delete-orphan"
    )
    daily_card_quotas: Mapped[list["DailyCardQuota"]] = relationship(
        "DailyCardQuota", back_populates="owner", cascade="all, delete-orphan"
    )
    daily_ai_quotas: Mapped[list["DailyAiQuota"]] = relationship(
        "DailyAiQuota", back_populates="owner", cascade="all, delete-orphan"
    )
    labels: Mapped[list["Label"]] = relationship("Label", back_populates="owner", cascade="all, delete-orphan")
    statuses: Mapped[list["Status"]] = relationship("Status", back_populates="owner", cascade="all, delete-orphan")
    error_categories: Mapped[list["ErrorCategory"]] = relationship(
        "ErrorCategory", back_populates="owner", cascade="all, delete-orphan"
    )
    initiatives: Mapped[list["ImprovementInitiative"]] = relationship(
        "ImprovementInitiative", back_populates="owner_user", cascade="all, delete-orphan"
    )
    saved_filters: Mapped[list["SavedFilter"]] = relationship(
        "SavedFilter", back_populates="owner", cascade="all, delete-orphan"
    )
    status_reports: Mapped[list["StatusReport"]] = relationship(
        "StatusReport", back_populates="owner", cascade="all, delete-orphan"
    )
    daily_evaluation_quotas: Mapped[list["DailyEvaluationQuota"]] = relationship(
        "DailyEvaluationQuota", back_populates="owner", cascade="all, delete-orphan"
    )
    appeal_generations: Mapped[list["AppealGeneration"]] = relationship(
        "AppealGeneration", back_populates="owner", cascade="all, delete-orphan"
    )
    report_templates: Mapped[list["ReportTemplate"]] = relationship(
        "ReportTemplate", back_populates="owner", cascade="all, delete-orphan"
    )
    workspace_templates: Mapped[list["WorkspaceTemplate"]] = relationship(
        "WorkspaceTemplate", back_populates="owner", cascade="all, delete-orphan"
    )
    analysis_sessions: Mapped[list["AnalysisSession"]] = relationship(
        "AnalysisSession", back_populates="user", cascade="all, delete-orphan"
    )
    competency_evaluations: Mapped[list["CompetencyEvaluation"]] = relationship(
        "CompetencyEvaluation", back_populates="user", cascade="all, delete-orphan"
    )
    quota_override: Mapped[Optional["UserQuotaOverride"]] = relationship(
        "UserQuotaOverride", back_populates="user", cascade="all, delete-orphan", uselist=False
    )
    api_credentials: Mapped[list["ApiCredential"]] = relationship(
        "ApiCredential", back_populates="created_by_user", cascade="all, delete-orphan"
    )


class SessionToken(Base, TimestampMixin):
    __tablename__ = "session_tokens"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship("User", back_populates="tokens")


class Card(Base, TimestampMixin):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    title: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    description: Mapped[str | None] = mapped_column(Text)
    status_id: Mapped[str | None] = mapped_column(String, ForeignKey("statuses.id"))
    channel_id: Mapped[str | None] = mapped_column(String, ForeignKey("channels.id", ondelete="SET NULL"))
    priority: Mapped[str | None] = mapped_column(String)
    story_points: Mapped[int | None] = mapped_column(Integer)
    estimate_hours: Mapped[float | None] = mapped_column(Float)
    assignees: Mapped[list[str]] = mapped_column(JSON, default=list)
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    due_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    dependencies: Mapped[list[str]] = mapped_column(JSON, default=list)
    ai_confidence: Mapped[float | None] = mapped_column(Float)
    ai_notes: Mapped[str | None] = mapped_column(Text)
    ai_failure_reason: Mapped[str | None] = mapped_column(Text)
    custom_fields: Mapped[dict] = mapped_column(JSON, default=dict)
    error_category_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("error_categories.id", ondelete="SET NULL"), nullable=True
    )
    initiative_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("improvement_initiatives.id", ondelete="SET NULL"), nullable=True
    )
    ai_similarity_vector_id: Mapped[str | None] = mapped_column(String)
    analytics_notes: Mapped[str | None] = mapped_column(Text)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    labels: Mapped[list[Label]] = relationship(
        "Label",
        secondary=card_labels,
        back_populates="cards",
        lazy="joined",
    )
    subtasks: Mapped[list[Subtask]] = relationship("Subtask", back_populates="card", cascade="all, delete-orphan")
    status: Mapped[Status | None] = relationship("Status", back_populates="cards")
    error_category: Mapped[Optional["ErrorCategory"]] = relationship("ErrorCategory", back_populates="cards")
    initiative: Mapped[Optional["ImprovementInitiative"]] = relationship(
        "ImprovementInitiative", back_populates="cards"
    )
    comments: Mapped[list[Comment]] = relationship("Comment", back_populates="card", cascade="all, delete-orphan")
    activity_logs: Mapped[list[ActivityLog]] = relationship(
        "ActivityLog", back_populates="card", cascade="all, delete-orphan"
    )
    owner: Mapped[User] = relationship("User", back_populates="cards")
    channel: Mapped[Optional["Channel"]] = relationship("Channel", back_populates="cards")
    status_report_links: Mapped[list["StatusReportCardLink"]] = relationship(
        "StatusReportCardLink", back_populates="card", cascade="all, delete-orphan"
    )


class DailyCardQuota(Base):
    __tablename__ = "daily_card_quotas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quota_date: Mapped[date] = mapped_column(Date, nullable=False)
    created_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    owner: Mapped[User] = relationship("User", back_populates="daily_card_quotas")

    __table_args__ = (UniqueConstraint("owner_id", "quota_date", name="uq_daily_card_quota_owner_date"),)


class DailyAiQuota(Base):
    __tablename__ = "daily_ai_quotas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quota_date: Mapped[date] = mapped_column(Date, nullable=False)
    quota_key: Mapped[str] = mapped_column(String(64), nullable=False)
    used_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    owner: Mapped[User] = relationship("User", back_populates="daily_ai_quotas")

    __table_args__ = (
        UniqueConstraint("owner_id", "quota_date", "quota_key", name="uq_daily_ai_quota_owner_date_key"),
    )


class WorkspaceTemplate(Base, TimestampMixin):
    __tablename__ = "workspace_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    default_status_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("statuses.id", ondelete="SET NULL"), nullable=True
    )
    default_label_ids: Mapped[list[str]] = mapped_column(JSON, default=list)
    confidence_threshold: Mapped[float] = mapped_column(Float, default=60.0)
    field_visibility: Mapped[dict[str, bool]] = mapped_column(
        JSON,
        default=lambda: {
            "show_story_points": True,
            "show_due_date": False,
            "show_assignee": True,
            "show_confidence": True,
        },
    )
    is_system_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    owner: Mapped["User"] = relationship("User", back_populates="workspace_templates")


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
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    card: Mapped[Card] = relationship("Card", back_populates="subtasks")
    comments: Mapped[list["Comment"]] = relationship(
        "Comment",
        back_populates="subtask",
        cascade="all, delete-orphan",
    )


class Label(Base):
    __tablename__ = "labels"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_label_owner_name"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    cards: Mapped[list[Card]] = relationship("Card", secondary=card_labels, back_populates="labels")
    owner: Mapped[User] = relationship("User", back_populates="labels")


class Channel(Base, TimestampMixin):
    __tablename__ = "channels"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    owner_user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_private: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    owner_user: Mapped[User] = relationship("User")
    members: Mapped[list["ChannelMember"]] = relationship(
        "ChannelMember", back_populates="channel", cascade="all, delete-orphan"
    )
    cards: Mapped[list[Card]] = relationship("Card", back_populates="channel")


class ChannelMember(Base, TimestampMixin):
    __tablename__ = "channel_members"
    __table_args__ = (UniqueConstraint("channel_id", "user_id", name="uq_channel_user"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    channel_id: Mapped[str] = mapped_column(String, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String, default="member")

    channel: Mapped[Channel] = relationship("Channel", back_populates="members")
    user: Mapped[User] = relationship("User")


class Status(Base):
    __tablename__ = "statuses"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_status_owner_name"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String)
    order: Mapped[int | None] = mapped_column(Integer)
    color: Mapped[str | None] = mapped_column(String)
    wip_limit: Mapped[int | None] = mapped_column(Integer)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    cards: Mapped[list[Card]] = relationship("Card", back_populates="status")
    owner: Mapped[User] = relationship("User", back_populates="statuses")


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
    subtask_id: Mapped[str | None] = mapped_column(String, ForeignKey("subtasks.id", ondelete="CASCADE"), nullable=True)
    author_id: Mapped[str | None] = mapped_column(String)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    card: Mapped[Card] = relationship("Card", back_populates="comments")
    subtask: Mapped[Optional[Subtask]] = relationship("Subtask", back_populates="comments")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = (UniqueConstraint("id", name="uq_activity_id"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str | None] = mapped_column(String, ForeignKey("cards.id", ondelete="CASCADE"), nullable=True)
    actor_id: Mapped[str | None] = mapped_column(String)
    action: Mapped[str] = mapped_column(String, nullable=False)
    details: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    card: Mapped[Card | None] = relationship("Card", back_populates="activity_logs")


class ErrorCategory(Base, TimestampMixin):
    __tablename__ = "error_categories"
    __table_args__ = (UniqueConstraint("owner_id", "name", name="uq_error_category_owner_name"),)

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    severity_level: Mapped[str | None] = mapped_column(String)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    cards: Mapped[list[Card]] = relationship("Card", back_populates="error_category")
    owner: Mapped[User] = relationship("User", back_populates="error_categories")


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
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    cards: Mapped[list[Card]] = relationship("Card", back_populates="initiative")
    progress_logs: Mapped[list["InitiativeProgressLog"]] = relationship(
        "InitiativeProgressLog",
        back_populates="initiative",
        cascade="all, delete-orphan",
        order_by="InitiativeProgressLog.timestamp",
    )
    owner_user: Mapped[User] = relationship("User", back_populates="initiatives")


class InitiativeProgressLog(Base, TimestampMixin):
    __tablename__ = "initiative_progress_logs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    initiative_id: Mapped[str] = mapped_column(String, ForeignKey("improvement_initiatives.id", ondelete="CASCADE"))
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    status: Mapped[str | None] = mapped_column(String)
    notes: Mapped[str | None] = mapped_column(Text)
    observed_metrics: Mapped[dict] = mapped_column(JSON, default=dict)

    initiative: Mapped[ImprovementInitiative] = relationship("ImprovementInitiative", back_populates="progress_logs")


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


class StatusReport(Base, TimestampMixin):
    __tablename__ = "status_reports"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shift_type: Mapped[str | None] = mapped_column(String)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    content: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String, nullable=False, default="draft")
    auto_ticket_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    analysis_model: Mapped[str | None] = mapped_column(String)
    analysis_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    analysis_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confidence: Mapped[float | None] = mapped_column(Float)
    failure_reason: Mapped[str | None] = mapped_column(Text)
    processing_meta: Mapped[dict] = mapped_column(JSON, default=dict)

    owner: Mapped[User] = relationship("User", back_populates="status_reports")
    cards: Mapped[list["StatusReportCardLink"]] = relationship(
        "StatusReportCardLink", back_populates="report", cascade="all, delete-orphan"
    )
    events: Mapped[list["StatusReportEvent"]] = relationship(
        "StatusReportEvent", back_populates="report", cascade="all, delete-orphan"
    )


class StatusReportCardLink(Base, TimestampMixin):
    __tablename__ = "status_report_cards"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    report_id: Mapped[str] = mapped_column(String, ForeignKey("status_reports.id", ondelete="CASCADE"), nullable=False)
    card_id: Mapped[str] = mapped_column(String, ForeignKey("cards.id", ondelete="CASCADE"), nullable=False)
    link_role: Mapped[str] = mapped_column(String, default="primary")
    confidence: Mapped[float | None] = mapped_column(Float)

    report: Mapped[StatusReport] = relationship("StatusReport", back_populates="cards")
    card: Mapped[Card] = relationship("Card", back_populates="status_report_links")


class StatusReportEvent(Base, TimestampMixin):
    __tablename__ = "status_report_events"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    report_id: Mapped[str] = mapped_column(String, ForeignKey("status_reports.id", ondelete="CASCADE"), nullable=False)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

    report: Mapped[StatusReport] = relationship("StatusReport", back_populates="events")


class ReportTemplate(Base, TimestampMixin):
    __tablename__ = "report_templates"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    audience: Mapped[str | None] = mapped_column(String)
    sections_json: Mapped[list[dict] | list[str]] = mapped_column(JSON, default=list)
    branding: Mapped[dict] = mapped_column(JSON, default=dict)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    reports: Mapped[list["GeneratedReport"]] = relationship("GeneratedReport", back_populates="template")
    owner: Mapped[User] = relationship("User", back_populates="report_templates")

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

    template: Mapped[ReportTemplate | None] = relationship("ReportTemplate", back_populates="reports")

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
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    shared: Mapped[bool] = mapped_column(Boolean, default=False)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    owner: Mapped[User] = relationship("User", back_populates="saved_filters")


class SimilarityFeedback(Base, TimestampMixin):
    __tablename__ = "similarity_feedback"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    card_id: Mapped[str] = mapped_column(String, ForeignKey("cards.id", ondelete="CASCADE"))
    related_id: Mapped[str] = mapped_column(String)
    related_type: Mapped[str] = mapped_column(String)
    is_relevant: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text)

    card: Mapped[Card] = relationship("Card")


class CompetencyLevel(Base, TimestampMixin):
    __tablename__ = "competency_levels"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    value: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    scale: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    description: Mapped[str | None] = mapped_column(Text)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    competencies: Mapped[list["Competency"]] = relationship(
        "Competency",
        primaryjoin="foreign(Competency.level) == CompetencyLevel.value",
        viewonly=True,
    )


class Competency(Base, TimestampMixin):
    __tablename__ = "competencies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    level: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    rubric: Mapped[dict] = mapped_column(JSON, default=dict)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    level_definition: Mapped[CompetencyLevel | None] = relationship(
        "CompetencyLevel",
        primaryjoin="foreign(Competency.level) == CompetencyLevel.value",
        viewonly=True,
    )

    criteria: Mapped[list["CompetencyCriterion"]] = relationship(
        "CompetencyCriterion",
        back_populates="competency",
        cascade="all, delete-orphan",
        order_by="CompetencyCriterion.order_index",
    )
    evaluations: Mapped[list["CompetencyEvaluation"]] = relationship(
        "CompetencyEvaluation", back_populates="competency", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["CompetencyEvaluationJob"]] = relationship(
        "CompetencyEvaluationJob", back_populates="competency", cascade="all, delete-orphan"
    )


class CompetencyCriterion(Base, TimestampMixin):
    __tablename__ = "competency_criteria"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    competency_id: Mapped[str] = mapped_column(
        String, ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    weight: Mapped[float | None] = mapped_column(Float)
    intentionality_prompt: Mapped[str | None] = mapped_column(Text)
    behavior_prompt: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    competency: Mapped[Competency] = relationship("Competency", back_populates="criteria")
    evaluation_items: Mapped[list["CompetencyEvaluationItem"]] = relationship(
        "CompetencyEvaluationItem", back_populates="criterion", cascade="all, delete-orphan"
    )


class CompetencyEvaluation(Base, TimestampMixin):
    __tablename__ = "competency_evaluations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    competency_id: Mapped[str] = mapped_column(
        String, ForeignKey("competencies.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    scale: Mapped[int] = mapped_column(Integer, nullable=False)
    score_value: Mapped[int] = mapped_column(Integer, nullable=False)
    score_label: Mapped[str] = mapped_column(String, nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text)
    attitude_actions: Mapped[list[str]] = mapped_column(JSON, default=list)
    behavior_actions: Mapped[list[str]] = mapped_column(JSON, default=list)
    ai_model: Mapped[str | None] = mapped_column(String)
    triggered_by: Mapped[str] = mapped_column(String, default="manual")
    job_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("competency_evaluation_jobs.id", ondelete="SET NULL"), nullable=True
    )
    context: Mapped[dict] = mapped_column(JSON, default=dict)

    competency: Mapped[Competency] = relationship("Competency", back_populates="evaluations")
    user: Mapped[User] = relationship("User", back_populates="competency_evaluations")
    job: Mapped[Optional["CompetencyEvaluationJob"]] = relationship(
        "CompetencyEvaluationJob", back_populates="evaluations"
    )
    items: Mapped[list["CompetencyEvaluationItem"]] = relationship(
        "CompetencyEvaluationItem", back_populates="evaluation", cascade="all, delete-orphan"
    )


class CompetencyEvaluationItem(Base, TimestampMixin):
    __tablename__ = "competency_evaluation_items"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    evaluation_id: Mapped[str] = mapped_column(
        String, ForeignKey("competency_evaluations.id", ondelete="CASCADE"), nullable=False
    )
    criterion_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("competency_criteria.id", ondelete="SET NULL"), nullable=True
    )
    score_value: Mapped[int] = mapped_column(Integer, nullable=False)
    score_label: Mapped[str] = mapped_column(String, nullable=False)
    rationale: Mapped[str | None] = mapped_column(Text)
    attitude_actions: Mapped[list[str]] = mapped_column(JSON, default=list)
    behavior_actions: Mapped[list[str]] = mapped_column(JSON, default=list)

    evaluation: Mapped[CompetencyEvaluation] = relationship("CompetencyEvaluation", back_populates="items")
    criterion: Mapped[Optional[CompetencyCriterion]] = relationship(
        "CompetencyCriterion", back_populates="evaluation_items"
    )


class CompetencyEvaluationJob(Base, TimestampMixin):
    __tablename__ = "competency_evaluation_jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    competency_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("competencies.id", ondelete="SET NULL"), nullable=True
    )
    user_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"))
    status: Mapped[str] = mapped_column(String, default="pending")
    scope: Mapped[str] = mapped_column(String, default="user")
    target_period_start: Mapped[date | None] = mapped_column(Date)
    target_period_end: Mapped[date | None] = mapped_column(Date)
    triggered_by: Mapped[str] = mapped_column(String, default="manual")
    triggered_by_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error_message: Mapped[str | None] = mapped_column(Text)
    summary_stats: Mapped[dict] = mapped_column(JSON, default=dict)

    competency: Mapped[Optional[Competency]] = relationship("Competency", back_populates="jobs")
    triggered_by_user: Mapped[Optional[User]] = relationship("User", foreign_keys=[triggered_by_id])
    target_user: Mapped[Optional[User]] = relationship("User", foreign_keys=[user_id])
    evaluations: Mapped[list[CompetencyEvaluation]] = relationship(
        "CompetencyEvaluation", back_populates="job", cascade="all, delete-orphan"
    )


class DailyEvaluationQuota(Base):
    __tablename__ = "daily_evaluation_quotas"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    quota_date: Mapped[date] = mapped_column(Date, nullable=False)
    executed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    owner: Mapped[User] = relationship("User", back_populates="daily_evaluation_quotas")

    __table_args__ = (UniqueConstraint("owner_id", "quota_date", name="uq_daily_evaluation_quota_owner_date"),)


class QuotaDefaults(Base, TimestampMixin):
    __tablename__ = "quota_defaults"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    card_daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=25)
    evaluation_daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    analysis_daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    status_report_daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    immunity_map_daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    immunity_map_candidate_daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=10)
    appeal_daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=5)
    auto_card_daily_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=25)


class UserQuotaOverride(Base, TimestampMixin):
    __tablename__ = "user_quota_overrides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    card_daily_limit: Mapped[int | None] = mapped_column(Integer)
    evaluation_daily_limit: Mapped[int | None] = mapped_column(Integer)
    analysis_daily_limit: Mapped[int | None] = mapped_column(Integer)
    status_report_daily_limit: Mapped[int | None] = mapped_column(Integer)
    immunity_map_daily_limit: Mapped[int | None] = mapped_column(Integer)
    immunity_map_candidate_daily_limit: Mapped[int | None] = mapped_column(Integer)
    appeal_daily_limit: Mapped[int | None] = mapped_column(Integer)
    auto_card_daily_limit: Mapped[int | None] = mapped_column(Integer)
    updated_by: Mapped[str | None] = mapped_column(String)

    user: Mapped[User] = relationship("User", back_populates="quota_override")


class AnalysisSession(Base, TimestampMixin):
    __tablename__ = "analysis_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    request_text: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    auto_objective: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    max_cards: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    response_model: Mapped[str | None] = mapped_column(String)
    proposals: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    failure_reason: Mapped[str | None] = mapped_column(Text)

    user: Mapped[User] = relationship("User", back_populates="analysis_sessions")


class AppealGeneration(Base, TimestampMixin):
    __tablename__ = "appeal_generations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    owner_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    subject_type: Mapped[str] = mapped_column(String(32), nullable=False)
    subject_value: Mapped[str] = mapped_column(String(255), nullable=False)
    flow: Mapped[list[str]] = mapped_column(JSON, default=list)
    formats: Mapped[list[str]] = mapped_column(JSON, default=list)
    content_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    token_usage: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    warnings: Mapped[list[str]] = mapped_column(JSON, default=list)
    generation_status: Mapped[str] = mapped_column(String(32), default="success", nullable=False)

    owner: Mapped[User] = relationship("User", back_populates="appeal_generations")


class ApiCredential(Base, TimestampMixin):
    __tablename__ = "api_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    encrypted_secret: Mapped[str] = mapped_column(Text, nullable=False)
    secret_hint: Mapped[str | None] = mapped_column(String)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    model: Mapped[str | None] = mapped_column(String)
    created_by_id: Mapped[str | None] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"))

    created_by_user: Mapped[Optional[User]] = relationship("User", back_populates="api_credentials")
