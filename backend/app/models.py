from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
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
    comments: Mapped[list[Comment]] = relationship(
        "Comment", back_populates="card", cascade="all, delete-orphan"
    )
    activity_logs: Mapped[list[ActivityLog]] = relationship(
        "ActivityLog", back_populates="card", cascade="all, delete-orphan"
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

    card: Mapped[Card] = relationship("Card", back_populates="subtasks")


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
