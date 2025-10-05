export type HoverMessageSeverity =
  | 'system'
  | 'notification'
  | 'warning'
  | 'error'
  | 'loading';

export type HoverMessageView = {
  readonly id: number;
  readonly text: string;
  readonly severity: HoverMessageSeverity;
  readonly dismissing: boolean;
};
