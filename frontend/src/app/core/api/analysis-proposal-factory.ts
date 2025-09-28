import { Injectable } from '@angular/core';

import {
  AnalysisProposal,
  AnalysisRequest,
  Label,
  TemplatePreset,
  WorkspaceSettings,
} from '@core/models';
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

interface ProposalFactoryParams {
  readonly request: AnalysisRequest;
  readonly settings: WorkspaceSettings;
}

interface ProposalContext extends ProposalFactoryParams {
  readonly index: number;
  readonly labelLookup: ReadonlyMap<string, Label>;
  readonly baseTitle: string;
}

@Injectable({ providedIn: 'root' })
export class AnalysisProposalFactory {
  public buildProposals({ request, settings }: ProposalFactoryParams): readonly AnalysisProposal[] {
    const labelLookup = this.createLabelLookup(settings.labels);
    const baseTitle = this.resolveBaseTitle(request);

    return [0, 1].map((index) =>
      this.buildProposal({
        index,
        baseTitle,
        request,
        settings,
        labelLookup,
      }),
    );
  }

  private buildProposal({
    index,
    baseTitle,
    request,
    settings,
    labelLookup,
  }: ProposalContext): AnalysisProposal {
    const template = this.resolveTemplateForIndex(settings.templates, index);
    const suggestedLabelIds = this.resolveSuggestedLabelIds(template, settings.labels, index);
    const labelSummary = this.resolveLabelSummary(suggestedLabelIds, labelLookup);
    const subtasks = this.resolveSubtasks({
      autoObjective: request.autoObjective,
      template,
      labelIds: suggestedLabelIds,
      labelLookup,
    });

    return {
      id: createId(),
      title: `${baseTitle} #${index + 1}`,
      summary: this.resolveProposalSummary(request.objective, template, labelSummary),
      suggestedStatusId: template?.defaultStatusId ?? settings.defaultStatusId,
      suggestedLabelIds,
      subtasks,
      confidence: Math.min(100, 62 + index * 12),
      templateId: template?.id ?? null,
    } satisfies AnalysisProposal;
  }

  private resolveBaseTitle(request: AnalysisRequest): string {
    return request.notes.split('\n')[0]?.trim() || 'ChatGPT 提案';
  }

  private resolveTemplateForIndex(
    templates: readonly TemplatePreset[],
    index: number,
  ): TemplatePreset | undefined {
    if (templates.length === 0) {
      return undefined;
    }

    return templates[index] ?? templates[index % templates.length];
  }

  private resolveSuggestedLabelIds(
    template: TemplatePreset | undefined,
    labels: readonly Label[],
    index: number,
  ): readonly string[] {
    if (template && template.defaultLabelIds.length > 0) {
      return [...template.defaultLabelIds];
    }

    const fallback = labels[index]?.id ?? labels[0]?.id;
    return fallback ? [fallback] : [];
  }

  private resolveLabelSummary(
    labelIds: readonly string[],
    labelLookup: ReadonlyMap<string, Label>,
  ): string | null {
    const labelNames = labelIds
      .map((labelId) => labelLookup.get(labelId)?.name?.trim())
      .filter((name): name is string => Boolean(name));

    if (labelNames.length === 0) {
      return null;
    }

    return Array.from(new Set(labelNames)).join('・');
  }

  private resolveProposalSummary(
    objective: string,
    template: TemplatePreset | undefined,
    labelSummary: string | null,
  ): string {
    if (labelSummary) {
      return `${labelSummary}の観点で${objective}を推進するためのステップを整理しました。`;
    }

    if (template?.description) {
      return `${template.description}の方針に沿って${objective}を前進させるための案です。`;
    }

    return `${objective}を達成するためのステップを整理しました。`;
  }

  private resolveSubtasks({
    autoObjective,
    template,
    labelIds,
    labelLookup,
  }: {
    autoObjective: boolean;
    template: TemplatePreset | undefined;
    labelIds: readonly string[];
    labelLookup: ReadonlyMap<string, Label>;
  }): readonly string[] {
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
    const labelSummary =
      labelNames.length > 0 ? labelNames.join('・') : (template?.name ?? '対象領域');
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
  }

  private buildGeneralSubtasks(autoObjective: boolean): readonly string[] {
    return [
      autoObjective ? 'AIが提案したゴール案を確認する' : '提供されたゴールを整理する',
      '重要な関係者と論点を共有する',
      'リスクと成功条件を定義する',
    ];
  }

  private buildLabelFocusActions(
    labelIds: readonly string[],
    labelLookup: ReadonlyMap<string, Label>,
  ): readonly string[] {
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
  }

  private createLabelLookup(labels: readonly Label[]): ReadonlyMap<string, Label> {
    const entries = labels.map((label) => [label.id, label] as const);
    return new Map(entries);
  }
}
