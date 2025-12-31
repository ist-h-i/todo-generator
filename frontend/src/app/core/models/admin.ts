export type IsoDateString = string;

export type CompetencyLevel = string;

export interface CompetencyLevelDefinition {
  id: string;
  value: string;
  label: string;
  scale: number;
  description?: string | null;
  sort_order: number;
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export interface CompetencyLevelInput {
  value: string;
  label: string;
  scale: number;
  description?: string | null;
  sort_order?: number | null;
}

export interface CompetencyCriterion {
  id: string;
  title: string;
  description?: string | null;
  weight?: number | null;
  intentionality_prompt?: string | null;
  behavior_prompt?: string | null;
  is_active: boolean;
  order_index?: number | null;
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export interface CompetencyCriterionInput {
  title: string;
  description?: string | null;
  weight?: number | null;
  intentionality_prompt?: string | null;
  behavior_prompt?: string | null;
  is_active?: boolean;
  order_index?: number | null;
}

export interface Competency {
  id: string;
  name: string;
  level: CompetencyLevel;
  description?: string | null;
  rubric: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  criteria: CompetencyCriterion[];
  created_at: IsoDateString;
  updated_at: IsoDateString;
  level_definition?: CompetencyLevelDefinition | null;
}

export interface CompetencyInput {
  name: string;
  level: CompetencyLevel;
  description?: string | null;
  rubric?: Record<string, unknown>;
  sort_order?: number;
  is_active?: boolean;
  criteria: CompetencyCriterionInput[];
}

export interface CompetencySummary {
  id: string;
  name: string;
  level: CompetencyLevel;
}

export interface CompetencyEvaluationItem {
  id: string;
  criterion_id?: string | null;
  score_value: number;
  score_label: string;
  rationale?: string | null;
  attitude_actions: string[];
  behavior_actions: string[];
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export interface CompetencyEvaluation {
  id: string;
  competency_id: string;
  user_id: string;
  period_start: IsoDateString;
  period_end: IsoDateString;
  scale: number;
  score_value: number;
  score_label: string;
  rationale?: string | null;
  attitude_actions: string[];
  behavior_actions: string[];
  ai_model?: string | null;
  warnings?: string[];
  triggered_by: string;
  created_at: IsoDateString;
  updated_at: IsoDateString;
  competency?: CompetencySummary | null;
  items: CompetencyEvaluationItem[];
}

export interface EvaluationTriggerRequest {
  user_id: string;
  competency_id?: string;
  period_start?: IsoDateString | null;
  period_end?: IsoDateString | null;
  triggered_by?: 'manual' | 'auto';
}

export interface SelfEvaluationRequest {
  competency_id?: string;
  period_start?: IsoDateString | null;
  period_end?: IsoDateString | null;
}

export interface SelfEvaluationBatchRequest {
  competency_ids: string[];
  period_start?: IsoDateString | null;
  period_end?: IsoDateString | null;
}

export interface EvaluationQuotaStatus {
  daily_limit: number;
  used: number;
  remaining?: number | null;
}

export interface AdminUser {
  id: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
  card_daily_limit: number | null;
  evaluation_daily_limit: number | null;
  analysis_daily_limit: number | null;
  status_report_daily_limit: number | null;
  immunity_map_daily_limit: number | null;
  immunity_map_candidate_daily_limit: number | null;
  appeal_daily_limit: number | null;
  auto_card_daily_limit: number | null;
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export interface AdminUserUpdate {
  is_admin?: boolean;
  is_active?: boolean;
  card_daily_limit?: number | null;
  evaluation_daily_limit?: number | null;
  analysis_daily_limit?: number | null;
  status_report_daily_limit?: number | null;
  immunity_map_daily_limit?: number | null;
  immunity_map_candidate_daily_limit?: number | null;
  appeal_daily_limit?: number | null;
  auto_card_daily_limit?: number | null;
}

export interface ApiCredential {
  provider: string;
  secret_hint?: string | null;
  is_active: boolean;
  model?: string | null;
  created_at: IsoDateString;
  updated_at: IsoDateString;
}

export interface ApiCredentialUpdate {
  secret?: string;
  model?: string;
  is_active?: boolean;
}

export interface QuotaDefaults {
  card_daily_limit: number;
  evaluation_daily_limit: number;
  analysis_daily_limit: number;
  status_report_daily_limit: number;
  immunity_map_daily_limit: number;
  immunity_map_candidate_daily_limit: number;
  appeal_daily_limit: number;
  auto_card_daily_limit: number;
}

export interface QuotaDefaultsUpdate {
  card_daily_limit: number;
  evaluation_daily_limit: number;
  analysis_daily_limit: number;
  status_report_daily_limit: number;
  immunity_map_daily_limit: number;
  immunity_map_candidate_daily_limit: number;
  appeal_daily_limit: number;
  auto_card_daily_limit: number;
}
