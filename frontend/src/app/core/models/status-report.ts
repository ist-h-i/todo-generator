export type StatusReportStatus = 'draft' | 'submitted' | 'processing' | 'completed' | 'failed';

export interface StatusReportSection {
  readonly title: string | null;
  readonly body: string;
}

export interface StatusReportProposalSubtask {
  readonly title: string;
  readonly description?: string | null;
  readonly status?: string;
}

export interface StatusReportProposal {
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly labels: readonly string[];
  readonly priority: string;
  readonly due_in_days: number | null;
  readonly subtasks: readonly StatusReportProposalSubtask[];
}

export interface StatusReportCardSummary {
  readonly id: string;
  readonly title: string;
  readonly summary: string | null;
  readonly status_id: string | null;
  readonly status_name: string | null;
  readonly priority: string | null;
  readonly due_date: string | null;
  readonly assignees: readonly string[];
  readonly subtasks: readonly {
    readonly id: string;
    readonly title: string;
    readonly status?: string | null;
    readonly description?: string | null;
  }[];
  readonly relationship: string;
  readonly confidence: number | null;
}

export interface StatusReportEvent {
  readonly id: string;
  readonly event_type: StatusReportStatus | string;
  readonly payload: Record<string, unknown>;
  readonly created_at: string;
}

export interface StatusReportBase {
  readonly id: string;
  readonly shift_type: string | null;
  readonly tags: readonly string[];
  readonly status: StatusReportStatus;
  readonly auto_ticket_enabled: boolean;
  readonly sections: readonly StatusReportSection[];
  readonly analysis_model: string | null;
  readonly analysis_started_at: string | null;
  readonly analysis_completed_at: string | null;
  readonly failure_reason: string | null;
  readonly confidence: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export type StatusReportRead = StatusReportBase;

export interface StatusReportDetail extends StatusReportBase {
  readonly cards: readonly StatusReportCardSummary[];
  readonly events: readonly StatusReportEvent[];
  readonly processing_meta: Record<string, unknown>;
  readonly pending_proposals: readonly StatusReportProposal[];
}

export interface StatusReportListItem {
  readonly id: string;
  readonly status: StatusReportStatus;
  readonly shift_type: string | null;
  readonly tags: readonly string[];
  readonly auto_ticket_enabled: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly card_count: number;
  readonly proposal_count: number;
  readonly summary: string | null;
}

export interface StatusReportCreateRequest {
  readonly shift_type: string | null;
  readonly tags: readonly string[];
  readonly sections: readonly StatusReportSection[];
  readonly auto_ticket_enabled: boolean;
}

export interface StatusReportUpdateRequest {
  readonly shift_type?: string | null;
  readonly tags?: readonly string[];
  readonly sections?: readonly StatusReportSection[];
  readonly auto_ticket_enabled?: boolean;
}
