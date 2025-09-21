from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, root_validator


# Shared schema components
class ChecklistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    label: str
    done: bool = False


class LabelBase(BaseModel):
    name: str
    color: Optional[str] = None
    description: Optional[str] = None
    is_system: bool = False


class LabelCreate(LabelBase):
    pass


class LabelUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None
    is_system: Optional[bool] = None


class LabelRead(LabelBase):
    id: str

    class Config:
        orm_mode = True


class StatusBase(BaseModel):
    name: str
    category: Optional[str] = None
    order: Optional[int] = None
    color: Optional[str] = None
    wip_limit: Optional[int] = Field(default=None, ge=0)


class StatusCreate(StatusBase):
    pass


class StatusUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    order: Optional[int] = None
    color: Optional[str] = None
    wip_limit: Optional[int] = Field(default=None, ge=0)


class StatusRead(StatusBase):
    id: str

    class Config:
        orm_mode = True


class SubtaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    estimate_hours: Optional[float] = None
    story_points: Optional[int] = None
    checklist: List[ChecklistItem] = Field(default_factory=list)


class SubtaskCreate(SubtaskBase):
    pass


class SubtaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    estimate_hours: Optional[float] = None
    story_points: Optional[int] = None
    checklist: Optional[List[ChecklistItem]] = None


class SubtaskRead(SubtaskBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class CardBase(BaseModel):
    title: str
    summary: Optional[str] = None
    description: Optional[str] = None
    status_id: Optional[str] = None
    priority: Optional[str] = None
    story_points: Optional[int] = None
    estimate_hours: Optional[float] = None
    assignees: List[str] = Field(default_factory=list)
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    dependencies: List[str] = Field(default_factory=list)
    ai_confidence: Optional[float] = Field(default=None, ge=0, le=1)
    ai_notes: Optional[str] = None
    custom_fields: dict[str, Any] = Field(default_factory=dict)
    label_ids: List[str] = Field(default_factory=list)


class CardCreate(CardBase):
    subtasks: List[SubtaskCreate] = Field(default_factory=list)


class CardUpdate(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    status_id: Optional[str] = None
    priority: Optional[str] = None
    story_points: Optional[int] = None
    estimate_hours: Optional[float] = None
    assignees: Optional[List[str]] = None
    start_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    dependencies: Optional[List[str]] = None
    ai_confidence: Optional[float] = Field(default=None, ge=0, le=1)
    ai_notes: Optional[str] = None
    custom_fields: Optional[dict[str, Any]] = None
    label_ids: Optional[List[str]] = None


class CardRead(CardBase):
    id: str
    created_at: datetime
    updated_at: datetime
    labels: List[LabelRead] = Field(default_factory=list)
    subtasks: List[SubtaskRead] = Field(default_factory=list)
    status: Optional[StatusRead] = None

    class Config:
        orm_mode = True

    @root_validator(pre=True)
    def populate_label_ids(cls, values: dict[str, Any]) -> dict[str, Any]:
        data = dict(values)
        labels = data.get("labels")
        if labels is not None and "label_ids" not in data:
            label_ids: List[str] = []
            for label in labels:
                if isinstance(label, dict) and "id" in label:
                    label_ids.append(label["id"])
                else:
                    label_id = getattr(label, "id", None)
                    if label_id:
                        label_ids.append(label_id)
            data["label_ids"] = label_ids
        return data


class UserPreferenceBase(BaseModel):
    board_grouping: Optional[str] = None
    board_layout: dict[str, Any] = Field(default_factory=dict)
    visible_fields: List[str] = Field(default_factory=list)
    notification_settings: dict[str, Any] = Field(default_factory=dict)
    preferred_language: Optional[str] = None


class UserPreferenceRead(UserPreferenceBase):
    user_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class BoardLayoutUpdate(UserPreferenceBase):
    user_id: str


class CommentBase(BaseModel):
    card_id: str
    content: str
    author_id: Optional[str] = None


class CommentCreate(CommentBase):
    pass


class CommentRead(CommentBase):
    id: str
    created_at: datetime

    class Config:
        orm_mode = True


class ActivityLogRead(BaseModel):
    id: str
    card_id: Optional[str] = None
    actor_id: Optional[str] = None
    action: str
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    class Config:
        orm_mode = True


class AnalysisRequest(BaseModel):
    text: str
    max_cards: int = Field(default=3, ge=1, le=10)


class AnalysisSubtask(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "todo"


class AnalysisCard(BaseModel):
    title: str
    summary: str
    status: str = "todo"
    labels: List[str] = Field(default_factory=list)
    priority: str = "medium"
    due_in_days: Optional[int] = None
    subtasks: List[AnalysisSubtask] = Field(default_factory=list)


class AnalysisResponse(BaseModel):
    model: str
    proposals: List[AnalysisCard]


class ActivityCreate(BaseModel):
    card_id: Optional[str] = None
    actor_id: Optional[str] = None
    action: str
    details: dict[str, Any] = Field(default_factory=dict)


class BulkDeleteResponse(BaseModel):
    deleted: int
