export type HoverMessageSeverity = 'info' | 'success' | 'warning' | 'danger';

export type HoverMessageView = {
  readonly id: number;
  readonly text: string;
  readonly severity: HoverMessageSeverity;
};
