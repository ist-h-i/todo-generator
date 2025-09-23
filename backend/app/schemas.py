from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, EmailStr, Field, root_validator


# Shared schema components
class ChecklistItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    label: str
    done: bool = False


class UserRead(BaseModel):
    id: str
    email: EmailStr
    is_admin: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class AuthCredentials(BaseModel):
    email: EmailStr
    password: str


class RegistrationRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserRead


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


class ErrorCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    severity_level: Optional[str] = None


class ErrorCategoryCreate(ErrorCategoryBase):
    pass


class ErrorCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    severity_level: Optional[str] = None


class ErrorCategoryRead(ErrorCategoryBase):
    id: str
    created_at: datetime
    updated_at: datetime

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
    ai_similarity_vector_id: Optional[str] = None
    root_cause_node_id: Optional[str] = None


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
    ai_similarity_vector_id: Optional[str] = None
    root_cause_node_id: Optional[str] = None


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
    error_category_id: Optional[str] = None
    initiative_id: Optional[str] = None
    analytics_notes: Optional[str] = None


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
    error_category_id: Optional[str] = None
    initiative_id: Optional[str] = None
    analytics_notes: Optional[str] = None


class CardRead(CardBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
    labels: List[LabelRead] = Field(default_factory=list)
    subtasks: List[SubtaskRead] = Field(default_factory=list)
    status: Optional[StatusRead] = None
    error_category: Optional[ErrorCategoryRead] = None
    initiative: Optional["ImprovementInitiativeRead"] = None
    owner: Optional[UserRead] = None

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


class SimilarItem(BaseModel):
    id: str
    type: Literal["card", "subtask"]
    title: str
    similarity: float = Field(ge=0.0, le=1.0)
    labels: List[str] = Field(default_factory=list)
    status: Optional[str] = None
    summary: Optional[str] = None
    quick_actions: List[str] = Field(default_factory=list)
    related_card_id: Optional[str] = None
    related_subtask_id: Optional[str] = None


class SimilarItemsResponse(BaseModel):
    items: List[SimilarItem]


class SimilarityFeedbackRequest(BaseModel):
    related_type: Literal["card", "subtask"]
    is_relevant: bool
    notes: Optional[str] = None


class SavedFilterBase(BaseModel):
    name: str
    definition: Dict[str, Any] = Field(default_factory=dict)
    shared: bool = False


class SavedFilterCreate(SavedFilterBase):
    created_by: Optional[str] = None


class SavedFilterUpdate(BaseModel):
    name: Optional[str] = None
    definition: Optional[Dict[str, Any]] = None
    shared: Optional[bool] = None
    last_used_at: Optional[datetime] = None


class SavedFilterRead(SavedFilterBase):
    id: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_used_at: Optional[datetime] = None

    class Config:
        orm_mode = True


class InitiativeBase(BaseModel):
    name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[datetime] = None
    target_metrics: Dict[str, Any] = Field(default_factory=dict)
    status: Optional[str] = None
    health: Optional[str] = None


class InitiativeCreate(InitiativeBase):
    pass


class InitiativeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    start_date: Optional[datetime] = None
    target_metrics: Optional[Dict[str, Any]] = None
    status: Optional[str] = None
    health: Optional[str] = None


class InitiativeProgressLogCreate(BaseModel):
    timestamp: Optional[datetime] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    observed_metrics: Dict[str, Any] = Field(default_factory=dict)


class InitiativeProgressLogRead(InitiativeProgressLogCreate):
    id: str
    timestamp: datetime

    class Config:
        orm_mode = True


class ImprovementInitiativeRead(InitiativeBase):
    id: str
    created_at: datetime
    updated_at: datetime
    progress_logs: List[InitiativeProgressLogRead] = Field(default_factory=list)

    class Config:
        orm_mode = True


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
    updated_at: datetime

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


class AnalyticsSnapshotBase(BaseModel):
    title: Optional[str] = None
    period_start: datetime
    period_end: datetime
    metrics: Dict[str, Any] = Field(default_factory=dict)
    generated_by: Optional[str] = None
    workspace_id: Optional[str] = None
    narrative: Optional[str] = None


class AnalyticsSnapshotCreate(AnalyticsSnapshotBase):
    pass


class AnalyticsSnapshotRead(AnalyticsSnapshotBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class WhyWhyRequest(BaseModel):
    actor_id: Optional[str] = None
    focus_question: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)

    class Config:
        extra = "allow"


class WhyWhyTriggerResponse(BaseModel):
    analysis_id: str
    status: str


class RootCauseNodeRead(BaseModel):
    id: str
    analysis_id: str
    depth: int
    statement: str
    confidence: Optional[float] = None
    evidence_refs: List[str] = Field(default_factory=list)
    recommended_metrics: List[str] = Field(default_factory=list)
    parent_id: Optional[str] = None
    state: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class SuggestedActionBase(BaseModel):
    title: str
    description: Optional[str] = None
    effort_estimate: Optional[str] = None
    impact_score: Optional[int] = None
    owner_role: Optional[str] = None
    due_date_hint: Optional[datetime] = None
    initiative_id: Optional[str] = None
    status: Optional[str] = None


class SuggestedActionCreate(SuggestedActionBase):
    node_id: str
    analysis_id: str


class SuggestedActionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    effort_estimate: Optional[str] = None
    impact_score: Optional[int] = None
    owner_role: Optional[str] = None
    due_date_hint: Optional[datetime] = None
    initiative_id: Optional[str] = None
    status: Optional[str] = None


class SuggestedActionRead(SuggestedActionBase):
    id: str
    analysis_id: str
    node_id: str
    created_card_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class RootCauseAnalysisRead(BaseModel):
    id: str
    snapshot_id: Optional[str] = None
    target_type: str
    target_id: Optional[str] = None
    created_by: Optional[str] = None
    version: int
    status: str
    model_version: Optional[str] = None
    summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    nodes: List[RootCauseNodeRead] = Field(default_factory=list)
    suggestions: List[SuggestedActionRead] = Field(default_factory=list)

    class Config:
        orm_mode = True


class SuggestionConversionRequest(BaseModel):
    title: Optional[str] = None
    summary: Optional[str] = None
    description: Optional[str] = None
    status_id: Optional[str] = None
    priority: Optional[str] = None
    assignees: List[str] = Field(default_factory=list)
    label_ids: List[str] = Field(default_factory=list)
    initiative_id: Optional[str] = None
    error_category_id: Optional[str] = None
    due_date: Optional[datetime] = None


class SuggestionConversionResponse(BaseModel):
    card: CardRead
    suggestion: SuggestedActionRead


class ReportTemplateBase(BaseModel):
    name: str
    audience: Optional[str] = None
    sections: List[Any] = Field(default_factory=list)
    branding: Dict[str, Any] = Field(default_factory=dict)


class ReportTemplateCreate(ReportTemplateBase):
    pass


class ReportTemplateUpdate(BaseModel):
    name: Optional[str] = None
    audience: Optional[str] = None
    sections: Optional[List[Any]] = None
    branding: Optional[Dict[str, Any]] = None


class ReportTemplateRead(ReportTemplateBase):
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class GeneratedReportRead(BaseModel):
    id: str
    template_id: Optional[str] = None
    author_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    content: str
    export_urls: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ReportGenerateRequest(BaseModel):
    template_id: Optional[str] = None
    author_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    analysis_id: Optional[str] = None
    initiative_ids: List[str] = Field(default_factory=list)
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ReportGenerateResponse(GeneratedReportRead):
    pass


# Resolve forward references for nested models defined later in the module.
CardRead.update_forward_refs(ImprovementInitiativeRead=ImprovementInitiativeRead)
