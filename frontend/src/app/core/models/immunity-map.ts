export type ImmunityMapAItemKind = 'should' | 'cannot' | 'want';
export type ImmunityMapNodeGroup = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface ImmunityMapAItem {
  readonly kind: ImmunityMapAItemKind;
  readonly text: string;
}

export interface ImmunityMapRequest {
  readonly a_items: readonly ImmunityMapAItem[];
  readonly context?: string | null;
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

export interface ImmunityMapResponse {
  readonly model: string | null;
  readonly payload: ImmunityMapPayload;
  readonly mermaid: string;
  readonly summary: string | null;
  readonly token_usage?: Readonly<Record<string, unknown>>;
}

