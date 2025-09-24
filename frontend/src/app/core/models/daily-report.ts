export type DailyReportStatus = 'draft' | 'submitted' | 'processing' | 'completed' | 'failed';

export interface DailyReportSection {
  readonly title: string | null;
  readonly body: string;
}

export interface DailyReportProposalSubtask {
  readonly title: string;
  readonly description?: string | null;
  readonly status?: string;
}

export interface DailyReportProposal {
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly labels: readonly string[];
  readonly priority: string;
  readonly due_in_days: number | null;
  readonly subtasks: readonly DailyReportProposalSubtask[];
}

export interface DailyReportCardSummary {
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

export interface DailyReportEvent {
  readonly id: string;
  readonly event_type: DailyReportStatus | string;
  readonly payload: Record<string, unknown>;
  readonly created_at: string;
}

export interface DailyReportBase {
  readonly id: string;
  readonly shift_type: string | null;
  readonly tags: readonly string[];
  readonly status: DailyReportStatus;
  readonly auto_ticket_enabled: boolean;
  readonly sections: readonly DailyReportSection[];
  readonly analysis_model: string | null;
  readonly analysis_started_at: string | null;
  readonly analysis_completed_at: string | null;
  readonly failure_reason: string | null;
  readonly confidence: number | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export type DailyReportRead = DailyReportBase;

export interface DailyReportDetail extends DailyReportBase {
  readonly cards: readonly DailyReportCardSummary[];
  readonly events: readonly DailyReportEvent[];
  readonly processing_meta: Record<string, unknown>;
  readonly pending_proposals: readonly DailyReportProposal[];
}

export interface DailyReportListItem {
  readonly id: string;
  readonly status: DailyReportStatus;
  readonly shift_type: string | null;
  readonly tags: readonly string[];
  readonly auto_ticket_enabled: boolean;
  readonly created_at: string;
  readonly updated_at: string;
  readonly card_count: number;
  readonly proposal_count: number;
  readonly summary: string | null;
}

export interface DailyReportCreateRequest {
  readonly shift_type: string | null;
  readonly tags: readonly string[];
  readonly sections: readonly DailyReportSection[];
  readonly auto_ticket_enabled: boolean;
}

export interface DailyReportUpdateRequest {
  readonly shift_type?: string | null;
  readonly tags?: readonly string[];
  readonly sections?: readonly DailyReportSection[];
  readonly auto_ticket_enabled?: boolean;
}
