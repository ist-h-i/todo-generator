export type ImmunityMapAItemKind = 'should' | 'cannot' | 'want';
export type ImmunityMapNodeGroup = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type ImmunityMapEvidenceType = 'status_report' | 'card' | 'snapshot' | 'other';
export type ImmunityMapContextPolicy = 'auto' | 'manual' | 'auto+manual';
export type ImmunityMapReadoutKind =
  | 'observation'
  | 'hypothesis'
  | 'barrier'
  | 'need'
  | 'assumption'
  | 'next_step';

export interface ImmunityMapEvidence {
  readonly type: ImmunityMapEvidenceType;
  readonly id?: string | null;
  readonly snippet?: string | null;
  readonly timestamp?: string | null;
}

export interface ImmunityMapAItem {
  readonly kind: ImmunityMapAItemKind;
  readonly text: string;
}

export interface ImmunityMapReadoutCard {
  readonly title: string;
  readonly kind: ImmunityMapReadoutKind;
  readonly body: string;
  readonly evidence?: readonly ImmunityMapEvidence[];
}

export interface ImmunityMapTarget {
  readonly type: 'snapshot' | 'card';
  readonly id: string;
}

export interface ImmunityMapCandidate {
  readonly id: string;
  readonly a_item: ImmunityMapAItem;
  readonly rationale: string;
  readonly confidence?: number | null;
  readonly questions?: readonly string[];
  readonly evidence?: readonly ImmunityMapEvidence[];
}

export interface ImmunityMapCandidateInclude {
  readonly status_reports?: boolean;
  readonly cards?: boolean;
  readonly profile?: boolean;
  readonly snapshots?: boolean;
}

export interface ImmunityMapCandidateRequest {
  readonly window_days?: number;
  readonly max_candidates?: number;
  readonly include?: ImmunityMapCandidateInclude;
}

export interface ImmunityMapCandidateResponse {
  readonly candidates: readonly ImmunityMapCandidate[];
  readonly context_summary?: string | null;
  readonly used_sources?: Readonly<Record<string, number>>;
  readonly model?: string | null;
  readonly token_usage?: Readonly<Record<string, unknown>>;
  readonly warnings?: readonly string[];
}

export interface ImmunityMapRequest {
  readonly a_items: readonly ImmunityMapAItem[];
  readonly context?: string | null;
  readonly context_policy?: ImmunityMapContextPolicy;
  readonly target?: ImmunityMapTarget | null;
}

export interface ImmunityMapNode {
  readonly id: string;
  readonly group: ImmunityMapNodeGroup;
  readonly label: string;
  readonly kind?: ImmunityMapAItemKind;
}

export interface ImmunityMapEdge {
  readonly from: string;
  readonly to: string;
}

export interface ImmunityMapPayload {
  readonly nodes: readonly ImmunityMapNode[];
  readonly edges: readonly ImmunityMapEdge[];
}

export interface ImmunityMapSummary {
  readonly current_analysis: string;
  readonly one_line_advice: string;
}

export interface ImmunityMapCoreInsight {
  readonly text: string;
  readonly related_node_id: string;
}

export interface ImmunityMapResponse {
  readonly model: string | null;
  readonly payload: ImmunityMapPayload;
  readonly mermaid: string;
  readonly summary: ImmunityMapSummary | null;
  readonly core_insight?: ImmunityMapCoreInsight | null;
  readonly readout_cards?: readonly ImmunityMapReadoutCard[];
  readonly token_usage?: Readonly<Record<string, unknown>>;
  readonly warnings?: readonly string[];
}
