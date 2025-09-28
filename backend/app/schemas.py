from __future__ import annotations

import unicodedata
from datetime import date, datetime
from enum import Enum
from typing import Any, Dict, List, Literal, Mapping, Optional
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator


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

    model_config = ConfigDict(from_attributes=True)


class UserProfile(UserRead):
    nickname: Optional[str] = None
    experience_years: Optional[int] = Field(default=None, ge=0, le=50)
    roles: List[str] = Field(default_factory=list)
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def normalize_roles(cls, data: Any) -> Any:
        if isinstance(data, Mapping):
            roles = data.get("roles")
            if roles is None:
                normalized = dict(data)
                normalized["roles"] = []
                return normalized
        return data


def _normalize_email_input(value: str | EmailStr) -> str:
    normalized = unicodedata.normalize("NFKC", str(value))
    return normalized.strip()


class AuthCredentials(BaseModel):
    email: EmailStr
    password: str

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email_field(cls, value: EmailStr | str | None) -> str | EmailStr | None:
        if value is None:
            return value

        return _normalize_email_input(value)


class RegistrationRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email", mode="before")
    @classmethod
    def normalize_email_field(cls, value: EmailStr | str | None) -> str | EmailStr | None:
        if value is None:
            return value

        return _normalize_email_input(value)


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"  # noqa: S105
    user: UserProfile


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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


class WorkspaceTemplateFieldVisibility(BaseModel):
    show_story_points: bool = True
    show_due_date: bool = False
    show_assignee: bool = True
    show_confidence: bool = True


class WorkspaceTemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    default_status_id: Optional[str] = None
    default_label_ids: List[str] = Field(default_factory=list)
    confidence_threshold: float = Field(default=0.6, ge=0, le=1)
    field_visibility: WorkspaceTemplateFieldVisibility = Field(default_factory=WorkspaceTemplateFieldVisibility)


class WorkspaceTemplateCreate(WorkspaceTemplateBase):
    pass


class WorkspaceTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    default_status_id: Optional[str] = None
    default_label_ids: Optional[List[str]] = None
    confidence_threshold: Optional[float] = Field(default=None, ge=0, le=1)
    field_visibility: Optional[WorkspaceTemplateFieldVisibility] = None


class WorkspaceTemplateRead(WorkspaceTemplateBase):
    id: str
    owner_id: str
    created_at: datetime
    updated_at: datetime
    is_system_default: bool

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


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
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


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
    completed_at: Optional[datetime] = None
    labels: List[LabelRead] = Field(default_factory=list)
    subtasks: List[SubtaskRead] = Field(default_factory=list)
    status: Optional[StatusRead] = None
    error_category: Optional[ErrorCategoryRead] = None
    initiative: Optional["ImprovementInitiativeRead"] = None
    owner: Optional[UserRead] = None

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def populate_label_ids(cls, values: Any) -> Any:
        data: Dict[str, Any] | None = None
        if isinstance(values, Mapping):
            data = dict(values)

        labels = (data or {}).get("labels") if data is not None else getattr(values, "labels", None)
        label_ids_present = (data or {}).get("label_ids") if data is not None else getattr(values, "label_ids", None)

        if labels is not None and label_ids_present is None:
            label_ids: List[str] = []
            for label in labels:
                if isinstance(label, dict) and "id" in label:
                    label_ids.append(label["id"])
                else:
                    label_id = getattr(label, "id", None)
                    if label_id:
                        label_ids.append(label_id)
            if data is not None:
                data["label_ids"] = label_ids
            else:
                try:
                    setattr(values, "label_ids", label_ids)  # noqa: B010
                except Exception:  # noqa: S110
                    pass

        return data if data is not None else values


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
    pass


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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


class ImprovementInitiativeRead(InitiativeBase):
    id: str
    created_at: datetime
    updated_at: datetime
    progress_logs: List[InitiativeProgressLogRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


class BoardLayoutUpdate(UserPreferenceBase):
    pass


class CommentBase(BaseModel):
    card_id: str
    content: str
    subtask_id: Optional[str] = None


class CommentCreate(CommentBase):
    @field_validator("content")
    @classmethod
    def validate_content(cls, value: str) -> str:
        sanitized = value.strip()
        if not sanitized:
            raise ValueError("content must not be blank")
        return sanitized


class CommentUpdate(BaseModel):
    content: Optional[str] = None
    subtask_id: Optional[str] = None

    @field_validator("content")
    @classmethod
    def validate_optional_content(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        sanitized = value.strip()
        if not sanitized:
            raise ValueError("content must not be blank")
        return sanitized


class CommentRead(CommentBase):
    id: str
    author_id: Optional[str] = None
    author_nickname: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ActivityLogRead(BaseModel):
    id: str
    card_id: Optional[str] = None
    actor_id: Optional[str] = None
    action: str
    details: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


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


class StatusReportStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class StatusReportEventType(str, Enum):
    DRAFT_CREATED = "draft_created"
    UPDATED = "updated"
    SUBMITTED = "submitted"
    ANALYSIS_STARTED = "analysis_started"
    PROPOSALS_RECORDED = "proposals_recorded"
    ANALYSIS_COMPLETED = "analysis_completed"
    ANALYSIS_FAILED = "analysis_failed"
    CARDS_LINKED = "cards_linked"


class StatusReportSection(BaseModel):
    title: Optional[str] = None
    body: str

    @field_validator("body")
    @classmethod
    def ensure_non_empty_body(cls, value: str) -> str:
        text = value.strip()
        if not text:
            raise ValueError("Section body cannot be empty.")
        return text


class StatusReportBase(BaseModel):
    shift_type: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    sections: List[StatusReportSection]
    auto_ticket_enabled: bool = Field(default=False)


class StatusReportCreate(StatusReportBase):
    pass


class StatusReportUpdate(BaseModel):
    shift_type: Optional[str] = None
    tags: Optional[List[str]] = None
    sections: Optional[List[StatusReportSection]] = None
    auto_ticket_enabled: Optional[bool] = None


class StatusReportListItem(BaseModel):
    id: str
    status: StatusReportStatus
    shift_type: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    auto_ticket_enabled: bool
    created_at: datetime
    updated_at: datetime
    card_count: int = 0
    proposal_count: int = 0
    summary: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class StatusReportCardSummary(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None
    status_id: Optional[str] = None
    status_name: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    assignees: List[str] = Field(default_factory=list)
    subtasks: List["SubtaskRead"] = Field(default_factory=list)
    relationship: str = "primary"
    confidence: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class StatusReportEventRead(BaseModel):
    id: str
    event_type: StatusReportEventType
    payload: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StatusReportRead(BaseModel):
    id: str
    shift_type: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    status: StatusReportStatus
    auto_ticket_enabled: bool
    sections: List[StatusReportSection]
    analysis_model: Optional[str] = None
    analysis_started_at: Optional[datetime] = None
    analysis_completed_at: Optional[datetime] = None
    failure_reason: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StatusReportDetail(StatusReportRead):
    cards: List[StatusReportCardSummary] = Field(default_factory=list)
    events: List[StatusReportEventRead] = Field(default_factory=list)
    processing_meta: Dict[str, Any] = Field(default_factory=dict)
    pending_proposals: List[AnalysisCard] = Field(default_factory=list)


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

    model_config = ConfigDict(from_attributes=True)


class WhyWhyRequest(BaseModel):
    actor_id: Optional[str] = None
    focus_question: Optional[str] = None
    context: Dict[str, Any] = Field(default_factory=dict)

    model_config = ConfigDict(extra="allow")


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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


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

    model_config = ConfigDict(from_attributes=True)


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
    owner_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class GeneratedReportRead(BaseModel):
    id: str
    template_id: Optional[str] = None
    author_id: Optional[str] = None
    parameters: Dict[str, Any] = Field(default_factory=dict)
    content: str
    export_urls: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ReportGenerateRequest(BaseModel):
    template_id: Optional[str] = None
    author_id: Optional[str] = None
    snapshot_id: Optional[str] = None
    analysis_id: Optional[str] = None
    initiative_ids: List[str] = Field(default_factory=list)
    parameters: Dict[str, Any] = Field(default_factory=dict)


class ReportGenerateResponse(GeneratedReportRead):
    pass


# --- Competency management schemas ----------------------------------------------------------


class CompetencyCriterionBase(BaseModel):
    title: str
    description: Optional[str] = None
    weight: Optional[float] = None
    intentionality_prompt: Optional[str] = None
    behavior_prompt: Optional[str] = None
    is_active: bool = True
    order_index: Optional[int] = None


class CompetencyCriterionCreate(CompetencyCriterionBase):
    pass


class CompetencyCriterionUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    weight: Optional[float] = None
    intentionality_prompt: Optional[str] = None
    behavior_prompt: Optional[str] = None
    is_active: Optional[bool] = None
    order_index: Optional[int] = None


class CompetencyCriterionRead(CompetencyCriterionBase):
    id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompetencyBase(BaseModel):
    name: str
    level: Literal["junior", "intermediate"]
    description: Optional[str] = None
    rubric: Dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 0
    is_active: bool = True


class CompetencyCreate(CompetencyBase):
    criteria: List[CompetencyCriterionCreate] = Field(default_factory=list)


class CompetencyUpdate(BaseModel):
    name: Optional[str] = None
    level: Optional[Literal["junior", "intermediate"]] = None
    description: Optional[str] = None
    rubric: Optional[Dict[str, Any]] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None
    criteria: Optional[List[CompetencyCriterionCreate]] = None


class CompetencyRead(CompetencyBase):
    id: str
    created_at: datetime
    updated_at: datetime
    criteria: List[CompetencyCriterionRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CompetencySummary(BaseModel):
    id: str
    name: str
    level: Literal["junior", "intermediate"]

    model_config = ConfigDict(from_attributes=True)


class CompetencyEvaluationItemRead(BaseModel):
    id: str
    criterion_id: Optional[str] = None
    score_value: int
    score_label: str
    rationale: Optional[str] = None
    attitude_actions: List[str] = Field(default_factory=list)
    behavior_actions: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CompetencyEvaluationRead(BaseModel):
    id: str
    competency_id: str
    user_id: str
    period_start: date
    period_end: date
    scale: int
    score_value: int
    score_label: str
    rationale: Optional[str] = None
    attitude_actions: List[str] = Field(default_factory=list)
    behavior_actions: List[str] = Field(default_factory=list)
    ai_model: Optional[str] = None
    triggered_by: str
    created_at: datetime
    updated_at: datetime
    competency: Optional[CompetencySummary] = None
    items: List[CompetencyEvaluationItemRead] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class EvaluationTriggerRequest(BaseModel):
    user_id: str
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    triggered_by: Literal["manual", "auto"] = "manual"

    @model_validator(mode="after")
    def ensure_period(cls, values: "EvaluationTriggerRequest") -> "EvaluationTriggerRequest":
        if values.period_start and values.period_end:
            if values.period_start > values.period_end:
                raise ValueError("period_start must be on or before period_end")
        return values


class SelfEvaluationRequest(BaseModel):
    competency_id: Optional[str] = None
    period_start: Optional[date] = None
    period_end: Optional[date] = None

    @model_validator(mode="after")
    def ensure_period(cls, values: "SelfEvaluationRequest") -> "SelfEvaluationRequest":
        if values.period_start and values.period_end:
            if values.period_start > values.period_end:
                raise ValueError("period_start must be on or before period_end")
        return values


class EvaluationQuotaStatus(BaseModel):
    daily_limit: int
    used: int
    remaining: Optional[int] = None


class AdminUserRead(BaseModel):
    id: str
    email: EmailStr
    is_admin: bool
    is_active: bool
    card_daily_limit: Optional[int] = None
    evaluation_daily_limit: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminUserUpdate(BaseModel):
    is_admin: Optional[bool] = None
    is_active: Optional[bool] = None
    card_daily_limit: Optional[int] = Field(default=None, ge=0)
    evaluation_daily_limit: Optional[int] = Field(default=None, ge=0)


class ApiCredentialRead(BaseModel):
    provider: str
    secret_hint: Optional[str] = None
    is_active: bool
    model: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ApiCredentialUpdate(BaseModel):
    secret: Optional[str] = Field(default=None, min_length=1)
    model: Optional[str] = Field(default=None, min_length=1)
    is_active: Optional[bool] = None

    @field_validator("secret", "model", mode="before")
    @classmethod
    def _strip_optional_string(cls, value: Any) -> Any:
        if value is None:
            return None
        if isinstance(value, str):
            stripped = value.strip()
            return stripped or None
        raise TypeError("value must be a string")


class QuotaDefaultsRead(BaseModel):
    card_daily_limit: int
    evaluation_daily_limit: int

    model_config = ConfigDict(from_attributes=True)


class QuotaDefaultsUpdate(BaseModel):
    card_daily_limit: int = Field(ge=0)
    evaluation_daily_limit: int = Field(ge=0)


class UserQuotaRead(BaseModel):
    user_id: str
    card_daily_limit: Optional[int] = None
    evaluation_daily_limit: Optional[int] = None
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserQuotaUpdate(BaseModel):
    card_daily_limit: Optional[int] = Field(default=None, ge=0)
    evaluation_daily_limit: Optional[int] = Field(default=None, ge=0)


# --------------------------------------------------------------------------------------------
# Appeal generation schemas


class AppealSubject(BaseModel):
    type: Literal["label", "custom"]
    value: str = Field(min_length=1, max_length=256)

    @field_validator("value", mode="before")
    @classmethod
    def _normalize_value(cls, value: str) -> str:
        if isinstance(value, str):
            stripped = value.strip()
            if not stripped:
                raise ValueError("value must not be empty")
            return stripped
        raise ValueError("value must be a string")

    @model_validator(mode="after")
    def _validate_custom_length(self) -> "AppealSubject":
        if self.type == "custom" and len(self.value) > 120:
            raise ValueError("Custom subject must be 120 characters or less.")
        return self


class AppealAchievement(BaseModel):
    id: str
    title: str
    summary: Optional[str] = None


class AppealLabelConfig(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    description: Optional[str] = None
    achievements: List[AppealAchievement] = Field(default_factory=list)


class AppealFormatDefinition(BaseModel):
    id: str
    name: str
    description: str
    editor_mode: Literal["markdown", "csv"]


class AppealConfigResponse(BaseModel):
    labels: List[AppealLabelConfig]
    recommended_flow: List[str]
    formats: List[AppealFormatDefinition]


class AppealGeneratedFormat(BaseModel):
    content: str
    tokens_used: Optional[int] = None


class AppealGenerationRequest(BaseModel):
    subject: AppealSubject
    flow: List[str] = Field(min_length=1, max_length=5)
    formats: List[str] = Field(min_length=1, max_length=4)
    achievements: Optional[List[AppealAchievement]] = None

    @field_validator("flow")
    @classmethod
    def _validate_flow(cls, value: List[str]) -> List[str]:
        seen: set[str] = set()
        normalized: List[str] = []
        for step in value:
            if not isinstance(step, str):
                raise ValueError("Flow steps must be strings.")
            cleaned = step.strip()
            if not cleaned:
                raise ValueError("Flow steps must not be empty.")
            if cleaned in seen:
                raise ValueError("Flow steps must be unique.")
            seen.add(cleaned)
            normalized.append(cleaned)
        return normalized

    @field_validator("formats")
    @classmethod
    def _validate_formats(cls, value: List[str]) -> List[str]:
        seen: set[str] = set()
        normalized: List[str] = []
        for fmt in value:
            if not isinstance(fmt, str):
                raise ValueError("Formats must be strings.")
            cleaned = fmt.strip()
            if not cleaned:
                raise ValueError("Formats must not be empty.")
            lowered = cleaned.lower()
            if lowered in seen:
                raise ValueError("Formats must be unique.")
            seen.add(lowered)
            normalized.append(cleaned)
        return normalized


class AppealGenerationResponse(BaseModel):
    generation_id: str
    subject_echo: str
    flow: List[str]
    warnings: List[str] = Field(default_factory=list)
    formats: Dict[str, AppealGeneratedFormat]


# --------------------------------------------------------------------------------------------


# Resolve forward references for nested models defined later in the module.
CardRead.model_rebuild()
