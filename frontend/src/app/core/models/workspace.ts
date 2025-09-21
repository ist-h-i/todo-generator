/**
 * Workspace label definition configurable by the user.
 */
export interface Label {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

/**
 * Status entity that drives board columns and analytics metrics.
 */
export interface Status {
  readonly id: string;
  readonly name: string;
  readonly category: 'todo' | 'in-progress' | 'done';
  readonly order: number;
  readonly color: string;
}

/**
 * Template definition reused by the analyzer when proposing cards.
 */
export interface TemplatePreset {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultStatusId: string;
  readonly defaultLabelIds: readonly string[];
}

/**
 * Workspace wide configuration stored in the signal store.
 */
export interface WorkspaceSettings {
  readonly defaultStatusId: string;
  readonly defaultAssignee: string;
  readonly timezone: string;
  readonly statuses: readonly Status[];
  readonly labels: readonly Label[];
  readonly templates: readonly TemplatePreset[];
  readonly storyPointScale: readonly number[];
}
