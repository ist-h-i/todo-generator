import { Injectable, computed, inject, signal } from '@angular/core';

import {
  AnalyticsSnapshot,
  Card,
  FeedbackInsightSummary,
  ImprovementInitiative,
  ImprovementOverview,
  InitiativeProgressEntry,
  RootCauseAnalysis,
  RootCauseLayer,
  RootCauseNode,
  SuggestedAction,
  SuggestedActionStatus,
} from '@core/models';
import { createId } from '@core/utils/create-id';
import { Logger } from '@core/logger/logger';

import {
  CONTINUOUS_IMPROVEMENT_ANALYSES,
  CONTINUOUS_IMPROVEMENT_INITIATIVES,
  CONTINUOUS_IMPROVEMENT_SNAPSHOTS,
} from './continuous-improvement-fixtures';
import { WorkspaceStore } from './workspace-store';

const DEFAULT_SNAPSHOT_ID = CONTINUOUS_IMPROVEMENT_SNAPSHOTS[0]?.id ?? '';

export type ConvertSuggestedActionResult =
  | { status: 'success'; card: Card }
  | { status: 'error'; message?: string };

@Injectable({ providedIn: 'root' })
export class ContinuousImprovementStore {
  private readonly workspace = inject(WorkspaceStore);
  private readonly logger = inject(Logger);

  private readonly snapshotsSignal = signal<readonly AnalyticsSnapshot[]>(
    CONTINUOUS_IMPROVEMENT_SNAPSHOTS,
  );
  private readonly analysesSignal = signal<readonly RootCauseAnalysis[]>(
    CONTINUOUS_IMPROVEMENT_ANALYSES,
  );
  private readonly initiativesSignal = signal<readonly ImprovementInitiative[]>(
    CONTINUOUS_IMPROVEMENT_INITIATIVES,
  );
  private readonly selectedSnapshotIdSignal = signal<string>(DEFAULT_SNAPSHOT_ID);
  private readonly reportInstructionSignal = signal<string>(
    '役員向けに最新の指摘と改善状況をまとめてください。',
  );
  private readonly reportPreviewSignal = signal<string>('');

  public readonly snapshots = computed(() => this.snapshotsSignal());

  public readonly activeSnapshot = computed<AnalyticsSnapshot | null>(() => {
    const snapshotId = this.selectedSnapshotIdSignal();
    return (
      this.snapshotsSignal().find((snapshot) => snapshot.id === snapshotId) ||
      this.snapshotsSignal()[0] ||
      null
    );
  });

  public readonly activeAnalysis = computed<RootCauseAnalysis | null>(() => {
    const snapshot = this.activeSnapshot();
    if (!snapshot) {
      return this.analysesSignal()[0] || null;
    }

    return (
      this.analysesSignal().find((analysis) => analysis.snapshotId === snapshot.id) ||
      this.analysesSignal()[0] ||
      null
    );
  });

  public readonly topIssueSummary = computed<FeedbackInsightSummary[]>(() => {
    const snapshot = this.activeSnapshot();
    if (!snapshot) {
      return [];
    }

    const total = snapshot.topErrors.reduce((sum, issue) => sum + issue.frequency, 0) || 1;

    return snapshot.topErrors.map((issue) => ({
      ...issue,
      share: Math.round((issue.frequency / total) * 100),
    }));
  });

  public readonly causeLayers = computed<RootCauseLayer[]>(() => {
    const analysis = this.activeAnalysis();
    if (!analysis) {
      return [];
    }

    const groups = new Map<number, RootCauseNode[]>();
    analysis.nodes.forEach((node) => {
      const current = groups.get(node.depth) || [];
      current.push(node);
      groups.set(node.depth, current);
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([depth, nodes]) => ({
        depth,
        nodes: nodes.slice().sort((a, b) => b.confidence - a.confidence),
      }));
  });

  public readonly actionPlan = computed<readonly SuggestedAction[]>(() =>
    this.sortSuggestions(this.activeAnalysis()),
  );

  public readonly improvementOverview = computed<ImprovementOverview>(() => {
    const snapshot = this.activeSnapshot();
    const analysis = this.activeAnalysis();
    const suggestions = analysis?.suggestions ?? [];
    const converted = suggestions.filter((action) => action.status === 'converted').length;
    const pending = suggestions.filter((action) => action.status === 'pending').length;
    const initiatives = this.initiativesSignal();
    const completedInitiatives = initiatives.filter(
      (initiative) => initiative.status === 'completed',
    ).length;

    return {
      recurrenceRate: snapshot?.recurrenceRate ?? 0,
      recurrenceDelta: snapshot?.recurrenceDelta ?? 0,
      totalFeedback: snapshot?.totalFeedback ?? 0,
      convertedActions: converted,
      pendingActions: pending,
      completedInitiatives,
      activeInitiatives: initiatives.length - completedInitiatives,
    };
  });

  public readonly initiatives = computed(() => this.initiativesSignal());

  public readonly reportInstruction = computed(() => this.reportInstructionSignal());

  public readonly reportPreview = computed(() => {
    const current = this.reportPreviewSignal();
    return current || this.composeReport(this.reportInstructionSignal());
  });

  public constructor() {
    this.reportPreviewSignal.set(this.composeReport(this.reportInstructionSignal()));
  }

  public readonly selectSnapshot = (snapshotId: string): void => {
    this.selectedSnapshotIdSignal.set(snapshotId);
    this.reportPreviewSignal.set(this.composeReport(this.reportInstructionSignal()));
  };

  public readonly convertSuggestedAction = async (
    actionId: string,
  ): Promise<ConvertSuggestedActionResult> => {
    const analysis = this.activeAnalysis();
    if (!analysis) {
      return {
        status: 'error',
        message: 'アクティブな分析が見つかりません。',
      };
    }

    const target = analysis.suggestions.find((suggestion) => suggestion.id === actionId);
    if (!target || target.status === 'converted') {
      return {
        status: 'error',
        message: '対象の提案が見つからないか、既にタスク化されています。',
      };
    }

    const dueDate = this.computeDueDate(target.dueInDays);
    try {
      const card = await this.workspace.createCardFromSuggestion({
        title: target.title,
        summary: target.summary,
        statusId: target.targetStatusId,
        labelIds: target.labelIds,
        priority: target.impactScore >= 4 ? 'high' : 'medium',
        dueDate,
        originSuggestionId: target.id,
        initiativeId: target.initiativeId,
      });

      this.analysesSignal.update((analyses) =>
        analyses.map((entry) =>
          entry.id === analysis.id
            ? {
                ...entry,
                suggestions: entry.suggestions.map((suggestion) =>
                  suggestion.id === actionId
                    ? { ...suggestion, status: 'converted', createdCardId: card.id }
                    : suggestion,
                ),
              }
            : entry,
        ),
      );

      if (target.initiativeId) {
        this.initiativesSignal.update((initiatives) =>
          initiatives.map((initiative) =>
            initiative.id === target.initiativeId
              ? {
                  ...initiative,
                  progress: [
                    ...initiative.progress,
                    this.buildProgressEntry(
                      'タスク起票',
                      `${target.title} をカード化 (${card.id})`,
                      {
                        impactScore: target.impactScore,
                      },
                    ),
                  ],
                }
              : initiative,
          ),
        );
      }

      this.reportPreviewSignal.set(this.composeReport(this.reportInstructionSignal()));
      return {
        status: 'success',
        card,
      };
    } catch (error) {
      this.logger.error('ContinuousImprovementStore', error);
      return {
        status: 'error',
        message: 'カードの作成に失敗しました。',
      };
    }
  };

  public readonly updateReportInstruction = (value: string): void => {
    this.reportInstructionSignal.set(value);
  };

  public readonly generateReportPreview = (): void => {
    this.reportPreviewSignal.set(this.composeReport(this.reportInstructionSignal()));
  };

  private readonly sortSuggestions = (
    analysis: RootCauseAnalysis | null,
  ): readonly SuggestedAction[] => {
    if (!analysis) {
      return [];
    }

    const order = (status: SuggestedActionStatus): number => {
      switch (status) {
        case 'pending':
          return 0;
        case 'in-progress':
          return 1;
        case 'converted':
          return 2;
        case 'dismissed':
          return 3;
        default:
          return 4;
      }
    };

    return analysis.suggestions.slice().sort((a, b) => {
      const statusDiff = order(a.status) - order(b.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }

      return b.impactScore - a.impactScore;
    });
  };

  private readonly computeDueDate = (days: number): string | undefined => {
    if (!Number.isFinite(days) || days <= 0) {
      return undefined;
    }

    const due = new Date();
    due.setDate(due.getDate() + Math.round(days));
    return due.toISOString();
  };

  private readonly buildProgressEntry = (
    status: string,
    notes: string,
    metrics: Record<string, string | number>,
  ): InitiativeProgressEntry => ({
    id: createId(),
    timestamp: new Date().toISOString(),
    status,
    notes,
    metrics,
  });

  private readonly composeReport = (instruction: string): string => {
    const snapshot = this.activeSnapshot();
    const issues = this.topIssueSummary();
    const layers = this.causeLayers();
    const actions = this.actionPlan();
    const initiatives = this.initiatives();
    const overview = this.improvementOverview();
    const heading = this.resolveReportHeading(instruction);
    const tone = this.resolveToneLabel(instruction);

    const issueLines = issues.map(
      (issue) =>
        `- ${issue.title} (${issue.category}) 頻度 ${issue.frequency}件 / 比率 ${issue.share}% / 変化 ${this.formatDelta(issue.changeRatio)}`,
    );

    const causeLines = layers
      .filter((layer) => layer.depth > 0)
      .flatMap((layer) =>
        layer.nodes.map(
          (node) =>
            `- 第${layer.depth}階層: ${node.statement} (確信度 ${Math.round(
              node.confidence * 100,
            )}%, 状態 ${node.state}${node.tone === 'direct' ? ' ※率直な指摘' : ''})`,
        ),
      );

    const actionLines = actions.map((action) => {
      const statusLabel =
        action.status === 'converted'
          ? 'タスク化済'
          : action.status === 'in-progress'
            ? '実行中'
            : '提案中';

      return `- ${action.title}【${statusLabel}】 影響度 ${action.impactScore} / 努力 ${action.effort} / 期限 ${
        action.dueInDays
      }日`;
    });

    const initiativeLines = initiatives.map((initiative) => {
      const latest = initiative.progress[initiative.progress.length - 1];
      const latestNote = latest ? `${latest.status} - ${latest.notes}` : '進捗未登録';
      return `- ${initiative.name} (${initiative.status}, 健康度 ${initiative.health}) ${latestNote}`;
    });

    const snapshotSummary = snapshot
      ? [
          `${snapshot.title} (${snapshot.periodStart}〜${snapshot.periodEnd})`,
          snapshot.summary,
          `総フィードバック ${snapshot.totalFeedback}件 / 再発率 ${Math.round(
            snapshot.recurrenceRate * 100,
          )}% (${this.formatDelta(snapshot.recurrenceDelta)})`,
        ]
      : ['スナップショットが選択されていません。'];

    const content = [
      `# ${heading}`,
      ...snapshotSummary,
      '',
      `指示トーン: ${tone}`,
      '',
      '■ 指摘ハイライト',
      ...(issueLines.length > 0 ? issueLines : ['- 指摘データが不足しています。']),
      '',
      '■ なぜなぜ分析で掘り下げた原因',
      ...(causeLines.length > 0 ? causeLines : ['- 根本原因の記録がまだありません。']),
      '',
      '■ ネクストアクション',
      ...(actionLines.length > 0 ? actionLines : ['- 提案されたアクションは未登録です。']),
      '',
      '■ 改善活動の実績',
      ...(initiativeLines.length > 0
        ? initiativeLines
        : ['- イニシアチブの記録がまだありません。']),
      '',
      '■ KPI サマリー',
      `- 再発率: ${Math.round(overview.recurrenceRate * 100)}% (${this.formatDelta(
        overview.recurrenceDelta,
      )})`,
      `- フィードバック件数: ${overview.totalFeedback}件`,
      `- タスク化済み提案: ${overview.convertedActions}/${
        overview.convertedActions + overview.pendingActions
      }件`,
      `- イニシアチブ: 完了 ${overview.completedInitiatives} / 進行中 ${overview.activeInitiatives}`,
      '',
      '■ 追加指示',
      instruction.trim() || '特記事項なし',
    ];

    return content.join('\n').trim();
  };

  private readonly resolveReportHeading = (instruction: string): string => {
    const lower = instruction.toLowerCase();
    if (
      lower.includes('exec') ||
      instruction.includes('役員') ||
      instruction.includes('エグゼクティブ')
    ) {
      return 'エグゼクティブサマリー';
    }

    if (instruction.includes('監査') || instruction.includes('詳細') || lower.includes('detail')) {
      return '詳細レポート';
    }

    if (instruction.includes('概要') || lower.includes('highlight')) {
      return 'ハイライトレポート';
    }

    return '改善活動レポート';
  };

  private readonly resolveToneLabel = (instruction: string): string => {
    const lower = instruction.toLowerCase();
    if (
      lower.includes('celebrate') ||
      instruction.includes('ポジティブ') ||
      instruction.includes('称賛')
    ) {
      return 'ポジティブ';
    }

    if (
      lower.includes('exec') ||
      instruction.includes('役員') ||
      instruction.includes('エグゼクティブ')
    ) {
      return 'エグゼクティブ向け';
    }

    if (instruction.includes('詳細') || lower.includes('detail')) {
      return '詳細重視';
    }

    return '中立';
  };

  private readonly formatDelta = (value: number): string => {
    const percentage = Math.round(value * 100);
    if (percentage === 0) {
      return '±0%';
    }

    return `${percentage > 0 ? '+' : ''}${percentage}%`;
  };
}
