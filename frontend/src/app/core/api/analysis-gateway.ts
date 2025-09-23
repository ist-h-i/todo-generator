import { Injectable, ResourceRef, Signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';

import {
  AnalysisProposal,
  AnalysisRequest,
  AnalysisResult,
  Label,
  TemplatePreset,
} from '@core/models';
import { Logger } from '@core/logger/logger';
import { WorkspaceStore } from '@core/state/workspace-store';
import { createId } from '@core/utils/create-id';

const LABEL_ATTRIBUTE_LIBRARY: Record<string, readonly string[]> = {
  ai: [
    '学習データの品質課題と補強アイデアを整理する',
    'プロンプト改善案と評価指標をすり合わせる',
    'モデルのフィードバックループを設計する',
  ],
  ux: [
    '主要ユーザーシナリオと期待価値を明確にする',
    'テストで検証すべき仮説と観察項目を決める',
    'アクセシビリティ改善の優先度を評価する',
  ],
  frontend: [
    'UI コンポーネントの再利用と整合性を点検する',
    'パフォーマンス計測と最適化ポイントを洗い出す',
    'アクセシビリティ対応の漏れを洗い出す',
  ],
  backend: [
    'API スキーマ変更の影響範囲を確認する',
    'エラーハンドリングと監視の改善案をまとめる',
    'データ永続化とマイグレーションのリスクを整理する',
  ],
};

/**
 * Provides AI analysis proposals using Angular resources for lifecycle management.
 */
@Injectable({ providedIn: 'root' })
export class AnalysisGateway {
  public constructor(
    private readonly logger: Logger,
    private readonly workspace: WorkspaceStore,
  ) {}

  /**
   * Creates a resource bound to the given request signal.
   *
   * @param request - Signal emitting analyze form payloads.
   * @returns Resource producing proposal responses.
   */
  public readonly createAnalysisResource = (
    request: Signal<AnalysisRequest | null>,
  ): ResourceRef<AnalysisResult | null> =>
    rxResource<AnalysisResult | null, AnalysisRequest | null>({
      defaultValue: null,
      params: request,
      stream: ({ params, abortSignal }): Observable<AnalysisResult | null> => {
        if (!params) {
          return of(null);
        }

        return new Observable<AnalysisResult | null>((subscriber) => {
          if (abortSignal.aborted) {
            subscriber.complete();

            return undefined;
          }

          const timer = setTimeout(() => {
            try {
              const baseTitle = this.resolveBaseTitle(params);
              const settings = this.workspace.settings();
              const templates = settings.templates;
              const labels = settings.labels;
              const labelLookup = new Map(labels.map((label) => [label.id, label]));

              const buildProposal = (index: number): AnalysisProposal => ({
                id: createId(),
                title: `${baseTitle} #${index + 1}`,
                ...this.buildProposalPayload({
                  index,
                  objective: params.objective,
                  autoObjective: params.autoObjective,
                  baseStatusId: settings.defaultStatusId,
                  templates,
                  labels,
                  labelLookup,
                }),
              });

              subscriber.next({
                proposals: [buildProposal(0), buildProposal(1)],
              });
              subscriber.complete();
            } catch (error) {
              this.logger.error('analysis-gateway', error);
              subscriber.error(error);
            }
          }, 420);

          const abortHandler = (): void => {
            clearTimeout(timer);
            subscriber.complete();
          };

          abortSignal.addEventListener('abort', abortHandler);

          return (): void => {
            clearTimeout(timer);
            abortSignal.removeEventListener('abort', abortHandler);
          };
        });
      },
    });

  /**
   * Derives a proposal title baseline from request notes.
   *
   * @param request - Active analysis request payload.
   * @returns Primary title text.
   */
  private readonly resolveBaseTitle = (request: AnalysisRequest): string =>
    request.notes.split('\n')[0]?.trim() || 'ChatGPT 提案';

  private readonly buildProposalPayload = ({
    index,
    objective,
    autoObjective,
    baseStatusId,
    templates,
    labels,
    labelLookup,
  }: {
    index: number;
    objective: string;
    autoObjective: boolean;
    baseStatusId: string;
    templates: readonly TemplatePreset[];
    labels: readonly Label[];
    labelLookup: Map<string, Label>;
  }): Omit<AnalysisProposal, 'id' | 'title'> => {
    const template = this.resolveTemplateForIndex(templates, index);
    const suggestedLabelIds = this.resolveSuggestedLabelIds(template, labels, index);
    const labelSummary = this.resolveLabelSummary(suggestedLabelIds, labelLookup);
    const subtasks = this.resolveSubtasks(autoObjective, template, suggestedLabelIds, labelLookup);

    return {
      summary: this.resolveProposalSummary(objective, template, labelSummary),
      suggestedStatusId: template?.defaultStatusId ?? baseStatusId,
      suggestedLabelIds,
      subtasks,
      confidence: 0.62 + index * 0.12,
      templateId: template?.id ?? null,
    } satisfies Omit<AnalysisProposal, 'id' | 'title'>;
  };

  /**
   * Builds a consistent subtask list based on the objective strategy.
   *
   * @param autoObjective - Whether the objective was AI generated.
   * @returns Subtask description list.
   */
  private readonly resolveSubtasks = (
    autoObjective: boolean,
    template: TemplatePreset | undefined,
    labelIds: readonly string[],
    labelLookup: Map<string, Label>,
  ): readonly string[] => {
    const focusItems = this.buildLabelFocusActions(labelIds, labelLookup);

    if (focusItems.length === 0) {
      return this.buildGeneralSubtasks(autoObjective);
    }

    const labelNames = Array.from(
      new Set(
        labelIds
          .map((labelId) => labelLookup.get(labelId)?.name?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    );
    const labelSummary = labelNames.length > 0 ? labelNames.join('・') : template?.name ?? '対象領域';
    const orientation = autoObjective ? 'AIが提案したゴール' : '提供されたゴール';

    const tasks: string[] = [];
    const push = (entry: string): void => {
      if (entry.length > 0 && !tasks.includes(entry)) {
        tasks.push(entry);
      }
    };

    const closing = `${labelSummary}の成果指標と検証方法を定義する`;

    push(`${orientation}と${labelSummary}の観点を突き合わせて優先論点を整理する`);
    for (const item of focusItems) {
      push(item);
    }
    push(`${labelSummary}に関わる関係者と期待値・リスクを共有する`);
    push(closing);

    if (tasks.length > 4) {
      const limited = tasks.slice(0, 4);
      if (!limited.includes(closing)) {
        limited[limited.length - 1] = closing;
      }
      return limited;
    }

    return tasks;
  };

  private readonly buildGeneralSubtasks = (autoObjective: boolean): readonly string[] => [
    autoObjective ? 'AIが提案したゴール案を確認する' : '提供されたゴールを整理する',
    '重要な関係者と論点を共有する',
    'リスクと成功条件を定義する',
  ];

  private readonly buildLabelFocusActions = (
    labelIds: readonly string[],
    labelLookup: Map<string, Label>,
  ): readonly string[] => {
    if (labelIds.length === 0) {
      return [];
    }

    const actions: string[] = [];
    const seen = new Set<string>();

    for (const labelId of labelIds) {
      if (seen.has(labelId)) {
        continue;
      }
      seen.add(labelId);

      const label = labelLookup.get(labelId);
      const labelName = label?.name ?? labelId;
      const focusList = LABEL_ATTRIBUTE_LIBRARY[labelId] ?? [];

      if (focusList.length === 0) {
        actions.push(`${labelName}観点で優先テーマを洗い出す`);
        continue;
      }

      for (const entry of focusList) {
        const text = `${labelName}観点: ${entry}`;
        if (!actions.includes(text)) {
          actions.push(text);
        }
      }
    }

    return actions;
  };

  private readonly resolveTemplateForIndex = (
    templates: readonly TemplatePreset[],
    index: number,
  ): TemplatePreset | undefined => {
    if (templates.length === 0) {
      return undefined;
    }

    return templates[index] ?? templates[index % templates.length];
  };

  private readonly resolveSuggestedLabelIds = (
    template: TemplatePreset | undefined,
    labels: readonly Label[],
    index: number,
  ): readonly string[] => {
    if (template && template.defaultLabelIds.length > 0) {
      return [...template.defaultLabelIds];
    }

    const fallback = labels[index]?.id ?? labels[0]?.id;
    return fallback ? [fallback] : [];
  };

  private readonly resolveLabelSummary = (
    labelIds: readonly string[],
    labelLookup: Map<string, Label>,
  ): string | null => {
    const labelNames = labelIds
      .map((labelId) => labelLookup.get(labelId)?.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (labelNames.length === 0) {
      return null;
    }

    return Array.from(new Set(labelNames)).join('・');
  };

  private readonly resolveProposalSummary = (
    objective: string,
    template: TemplatePreset | undefined,
    labelSummary: string | null,
  ): string => {
    if (labelSummary) {
      return `${labelSummary}の観点で${objective}を推進するためのステップを整理しました。`;
    }

    if (template?.description) {
      return `${template.description}の方針に沿って${objective}を前進させるための案です。`;
    }

    return `${objective}を達成するためのステップを整理しました。`;
  };
}
