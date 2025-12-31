export interface AppealAchievement {
  readonly id: string;
  readonly title: string;
  readonly summary?: string | null;
}

export interface AppealLabelConfig {
  readonly id: string;
  readonly name: string;
  readonly color?: string | null;
  readonly description?: string | null;
  readonly achievements: readonly AppealAchievement[];
}

export interface AppealFormatDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly editor_mode: 'markdown' | 'csv';
}

export interface AppealConfigResponse {
  readonly labels: readonly AppealLabelConfig[];
  readonly recommended_flow: readonly string[];
  readonly formats: readonly AppealFormatDefinition[];
}

export interface AppealSubject {
  readonly type: 'label' | 'custom';
  readonly value: string;
}

export interface AppealGenerationRequest {
  readonly subject: AppealSubject;
  readonly flow: readonly string[];
  readonly formats: readonly string[];
  readonly achievements?: readonly AppealAchievement[] | null;
}

export interface AppealGeneratedFormat {
  readonly content: string;
  readonly tokens_used?: number | null;
}

export interface AppealGenerationResponse {
  readonly generation_id: string;
  readonly subject_echo: string;
  readonly flow: readonly string[];
  readonly warnings: readonly string[];
  readonly formats: Readonly<Record<string, AppealGeneratedFormat>>;
}
