import { Card } from './card';

export type FeedbackSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FeedbackInsight {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly severity: FeedbackSeverity;
  readonly frequency: number;
  readonly changeRatio: number;
  readonly description: string;
  readonly causeHint: string;
  readonly recentExamples: readonly string[];
}

export interface SnapshotMetric {
  readonly label: string;
  readonly value: string;
  readonly delta: number;
}

export interface AnalyticsSnapshot {
  readonly id: string;
  readonly title: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly summary: string;
  readonly recurrenceRate: number;
  readonly recurrenceDelta: number;
  readonly totalFeedback: number;
  readonly severeCount: number;
  readonly metrics: readonly SnapshotMetric[];
  readonly topErrors: readonly FeedbackInsight[];
}

export type RootCauseState = 'confirmed' | 'proposed' | 'needs-review';
export type RootCauseTone = 'neutral' | 'direct';

export interface RootCauseNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly depth: number;
  readonly statement: string;
  readonly confidence: number;
  readonly state: RootCauseState;
  readonly evidence: readonly string[];
  readonly recommendedMetrics: readonly string[];
  readonly tone: RootCauseTone;
  readonly toneMessage?: string;
}

export interface RootCauseLayer {
  readonly depth: number;
  readonly nodes: readonly RootCauseNode[];
}

export type SuggestedActionStatus = 'pending' | 'in-progress' | 'converted' | 'dismissed';
export type SuggestedActionEffort = 'low' | 'medium' | 'high';

export interface SuggestedAction {
  readonly id: string;
  readonly nodeId: string;
  readonly title: string;
  readonly summary: string;
  readonly description: string;
  readonly status: SuggestedActionStatus;
  readonly effort: SuggestedActionEffort;
  readonly impactScore: number;
  readonly ownerRole: string;
  readonly dueInDays: number;
  readonly targetStatusId: string;
  readonly labelIds: readonly string[];
  readonly initiativeId?: string;
  readonly createdCardId?: string;
}

export interface RootCauseAnalysis {
  readonly id: string;
  readonly snapshotId: string | null;
  readonly focusQuestion: string;
  readonly summary: string;
  readonly nodes: readonly RootCauseNode[];
  readonly suggestions: readonly SuggestedAction[];
}

export interface InitiativeProgressEntry {
  readonly id: string;
  readonly timestamp: string;
  readonly status: string;
  readonly notes: string;
  readonly metrics: Readonly<Record<string, string | number>>;
}

export type InitiativeStatus = 'on-track' | 'at-risk' | 'completed';
export type InitiativeHealth = 'good' | 'watch' | 'poor';

export interface ImprovementInitiative {
  readonly id: string;
  readonly name: string;
  readonly owner: string;
  readonly status: InitiativeStatus;
  readonly health: InitiativeHealth;
  readonly startDate: string;
  readonly targetMetric: string;
  readonly summary: string;
  readonly progress: readonly InitiativeProgressEntry[];
}

export interface FeedbackInsightSummary extends FeedbackInsight {
  readonly share: number;
}

export interface ImprovementOverview {
  readonly recurrenceRate: number;
  readonly recurrenceDelta: number;
  readonly totalFeedback: number;
  readonly convertedActions: number;
  readonly pendingActions: number;
  readonly completedInitiatives: number;
  readonly activeInitiatives: number;
}

export interface ConvertedActionResult {
  readonly action: SuggestedAction;
  readonly card: Card;
}
