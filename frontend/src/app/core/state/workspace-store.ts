import { Injectable, computed, signal } from '@angular/core';

import {
  AnalysisProposal,
  BoardColumnView,
  BoardFilters,
  BoardGrouping,
  Card,
  Label,
  Status,
  Subtask,
  TemplatePreset,
  WorkspaceSettings,
  WorkspaceSummary,
} from '@core/models';
import { createId } from '@core/utils/create-id';

const DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD = 0.5;

const INITIAL_LABELS: Label[] = [
  { id: 'frontend', name: 'フロントエンド', color: '#38bdf8' },
  { id: 'backend', name: 'バックエンド', color: '#a855f7' },
  { id: 'ux', name: 'UX', color: '#ec4899' },
  { id: 'ai', name: 'AI', color: '#f97316' },
];

const INITIAL_STATUSES: Status[] = [
  { id: 'todo', name: 'To Do', category: 'todo', order: 1, color: '#64748b' },
  { id: 'in-progress', name: 'In Progress', category: 'in-progress', order: 2, color: '#2563eb' },
  { id: 'review', name: 'Review', category: 'in-progress', order: 3, color: '#9333ea' },
  { id: 'done', name: 'Done', category: 'done', order: 4, color: '#16a34a' },
];

const INITIAL_TEMPLATES: TemplatePreset[] = [
  {
    id: 'ai-template',
    name: 'AI 改善サイクル',
    description: 'ChatGPT 改修用のチェックリストテンプレート',
    defaultStatusId: 'todo',
    defaultLabelIds: ['ai'],
    confidenceThreshold: 0.6,
  },
  {
    id: 'ux-template',
    name: 'UX 検証',
    description: 'プロトタイプ検証とユーザーテスト',
    defaultStatusId: 'in-progress',
    defaultLabelIds: ['ux'],
    confidenceThreshold: 0.7,
  },
];

const buildSubtasks = (titles: readonly string[]): Subtask[] =>
  titles.map((title, index) => ({
    id: createId(),
    title,
    status: index === 0 ? 'in-progress' : 'todo',
    assignee: index === 0 ? '田中太郎' : undefined,
    estimateHours: 3,
  }));

const INITIAL_CARDS: Card[] = [
  {
    id: createId(),
    title: 'ChatGPT プロンプトの改善',
    summary: '分析精度向上のための新しいプロンプト設計を検証します。',
    statusId: 'in-progress',
    labelIds: ['ai'],
    priority: 'high',
    storyPoints: 5,
    assignee: '田中太郎',
    confidence: 0.74,
    subtasks: buildSubtasks(['事例収集', '評価実験', 'レビュー共有']).map((subtask, index, list) =>
      index === list.length - 1 ? { ...subtask, status: 'non-issue' } : subtask,
    ),
    comments: [],
    activities: [],
  },
  {
    id: createId(),
    title: 'ボードのアクセシビリティ監査',
    summary: 'キーボード操作とスクリーンリーダー読み上げを改善します。',
    statusId: 'review',
    labelIds: ['ux'],
    priority: 'medium',
    storyPoints: 3,
    assignee: '佐藤花子',
    subtasks: buildSubtasks(['想定シナリオ整理', 'VoiceOver テスト']),
    comments: [],
    activities: [],
  },
  {
    id: createId(),
    title: 'GraphQL API の準備',
    summary: 'カード取得と更新 API を GraphQL で再設計します。',
    statusId: 'todo',
    labelIds: ['backend'],
    priority: 'urgent',
    storyPoints: 8,
    assignee: '李開発',
    subtasks: buildSubtasks(['スキーマ定義', 'Resolver 実装', 'E2E テスト']),
    comments: [],
    activities: [],
  },
  {
    id: createId(),
    title: '設定画面のテンプレート拡充',
    summary: 'テンプレートの並び替えと検索機能を追加します。',
    statusId: 'done',
    labelIds: ['frontend'],
    priority: 'medium',
    storyPoints: 2,
    assignee: '田中太郎',
    subtasks: buildSubtasks(['UI 設計', 'ストア連携']).map((subtask) => ({
      ...subtask,
      status: 'done',
    })),
    comments: [],
    activities: [],
  },
];

const INITIAL_SETTINGS: WorkspaceSettings = {
  defaultStatusId: 'todo',
  defaultAssignee: '田中太郎',
  timezone: 'Asia/Tokyo',
  statuses: INITIAL_STATUSES,
  labels: INITIAL_LABELS,
  templates: INITIAL_TEMPLATES,
  storyPointScale: [1, 2, 3, 5, 8, 13],
};

const INITIAL_FILTERS: BoardFilters = {
  search: '',
  labelIds: [],
  statusIds: [],
};

/**
 * Signal-based workspace store providing board data to all features.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly settingsSignal = signal<WorkspaceSettings>(INITIAL_SETTINGS);
  private readonly cardsSignal = signal<readonly Card[]>(INITIAL_CARDS);
  private readonly groupingSignal = signal<BoardGrouping>('label');
  private readonly filtersSignal = signal<BoardFilters>({ ...INITIAL_FILTERS });
  private readonly selectedCardIdSignal = signal<string | null>(null);
  private readonly templateConfidenceThresholds = computed(() =>
    new Map(this.settingsSignal().templates.map((template) => [template.id, template.confidenceThreshold])),
  );

  public readonly settings = computed(() => this.settingsSignal());
  public readonly cards = computed(() => this.cardsSignal());
  public readonly grouping = computed(() => this.groupingSignal());
  public readonly filters = computed(() => this.filtersSignal());
  public readonly selectedCardId = computed(() => this.selectedCardIdSignal());

  public readonly filteredCards = computed<readonly Card[]>(() => {
    const allowed = new Set(this.filteredCardIds());
    return this.cardsSignal().filter((card) => allowed.has(card.id));
  });

  /**
   * Evaluates whether a proposal meets the workspace template confidence threshold.
   *
   * @param proposal - Proposal metadata returned from the analyzer.
   * @returns True when the proposal should be presented to the user.
   */
  public readonly isProposalEligible = (
    proposal: Pick<AnalysisProposal, 'templateId' | 'confidence'>,
  ): boolean => {
    const threshold =
      proposal.templateId !== undefined && proposal.templateId !== null
        ? this.templateConfidenceThresholds().get(proposal.templateId)
        : undefined;

    return proposal.confidence >= (threshold ?? DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD);
  };
  public readonly summary = computed<WorkspaceSummary>(() => {
    const cards = this.cardsSignal();
    const doneStatusIds = new Set(
      this.settingsSignal()
        .statuses.filter((status) => status.category === 'done')
        .map((status) => status.id),
    );
    const doneCount = cards.filter((card) => doneStatusIds.has(card.statusId)).length;
    const labelCount = new Set(cards.flatMap((card) => card.labelIds)).size;

    return {
      totalCards: cards.length,
      doneCards: doneCount,
      progressRatio: cards.length === 0 ? 0 : Math.round((doneCount / cards.length) * 100),
      activeLabels: labelCount,
    };
  });

  private readonly filteredCardIds = computed(() => {
    const { search, labelIds, statusIds } = this.filtersSignal();
    const normalizedSearch = search.trim().toLowerCase();

    return this.cardsSignal()
      .filter((card) => {
        if (normalizedSearch.length > 0) {
          const corpus = `${card.title} ${card.summary}`.toLowerCase();
          if (!corpus.includes(normalizedSearch)) {
            return false;
          }
        }

        if (labelIds.length > 0 && !labelIds.some((labelId) => card.labelIds.includes(labelId))) {
          return false;
        }

        if (statusIds.length > 0 && !statusIds.includes(card.statusId)) {
          return false;
        }

        return true;
      })
      .map((card) => card.id);
  });

  public readonly boardColumns = computed<BoardColumnView[]>(() => {
    const cards = this.cardsSignal();
    const allowedIds = new Set(this.filteredCardIds());
    const grouping = this.groupingSignal();

    if (grouping === 'status') {
      return this.settingsSignal()
        .statuses.slice()
        .sort((a, b) => a.order - b.order)
        .map((status) => {
          const matches = cards.filter(
            (card) => card.statusId === status.id && allowedIds.has(card.id),
          );
          return {
            id: status.id,
            title: status.name,
            accent: status.color,
            cards: matches.map((card) => card.id),
            count: matches.length,
          };
        });
    }

    return this.settingsSignal().labels.map((label) => {
      const matches = cards.filter(
        (card) => card.labelIds.includes(label.id) && allowedIds.has(card.id),
      );
      return {
        id: label.id,
        title: label.name,
        accent: label.color,
        cards: matches.map((card) => card.id),
        count: matches.length,
      };
    });
  });

  /**
   * Persists grouping updates from the board toolbar.
   *
   * @param grouping - New grouping strategy.
   */
  public readonly setGrouping = (grouping: BoardGrouping): void => {
    this.groupingSignal.set(grouping);
  };

  /**
   * Updates board filters using a partial payload.
   *
   * @param filters - Next filter patch.
   */
  public readonly updateFilters = (filters: Partial<BoardFilters>): void => {
    this.filtersSignal.update((current) => ({ ...current, ...filters }));
  };

  /**
   * Clears the current board filters.
   */
  public readonly resetFilters = (): void => {
    this.filtersSignal.set({ ...INITIAL_FILTERS });
  };

  /**
   * Tracks the currently selected card for the detail drawer.
   *
   * @param cardId - Selected card identifier.
   */
  public readonly selectCard = (cardId: string | null): void => {
    this.selectedCardIdSignal.set(cardId);
  };

  /**
   * Imports proposals from the analyzer into the board store.
   *
   * @param proposals - AI generated proposals ready for publication.
   */
  public readonly importProposals = (proposals: readonly AnalysisProposal[]): void => {
    if (proposals.length === 0) {
      return;
    }

    const eligible = proposals.filter((proposal) => this.isProposalEligible(proposal));
    if (eligible.length === 0) {
      return;
    }

    const settings = this.settingsSignal();
    const defaultStatus = settings.defaultStatusId;
    const defaultLabel = settings.labels[0]?.id ?? 'general';

    const mapped: Card[] = eligible.map((proposal) => {
      const template = proposal.templateId
        ? settings.templates.find((entry) => entry.id === proposal.templateId)
        : undefined;

      const statusId = proposal.suggestedStatusId || template?.defaultStatusId || defaultStatus;
      const labelIds = proposal.suggestedLabelIds.length > 0
        ? [...proposal.suggestedLabelIds]
        : template
            ? [...template.defaultLabelIds]
            : [defaultLabel];

      return {
        id: createId(),
        title: proposal.title,
        summary: proposal.summary,
        statusId,
        labelIds,
        priority: 'medium',
        storyPoints: 3,
        assignee: settings.defaultAssignee,
        confidence: proposal.confidence,
        subtasks: proposal.subtasks.map((task) => ({
          id: createId(),
          title: task,
          status: 'todo',
        })),
        comments: [],
        activities: [],
      } satisfies Card;
    });

    this.cardsSignal.update((current) => [...mapped, ...current]);
  };

  /**
   * Moves a card to a different status.
   *
   * @param cardId - Identifier of the card to update.
   * @param statusId - New status.
   */
  public readonly updateCardStatus = (cardId: string, statusId: string): void => {
    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              statusId,
            }
          : card,
      ),
    );
  };

  public readonly updateSubtaskStatus = (
    cardId: string,
    subtaskId: string,
    status: Subtask['status'],
  ): void => {
    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              subtasks: card.subtasks.map((subtask) =>
                subtask.id === subtaskId
                  ? {
                      ...subtask,
                      status,
                    }
                  : subtask,
              ),
            }
          : card,
      ),
    );
  };

  /**
   * Creates a new card from a suggested improvement action.
   *
   * @param payload - Attributes describing the new card.
   * @returns Created card instance.
   */
  public readonly createCardFromSuggestion = (payload: {
    title: string;
    summary: string;
    statusId?: string;
    labelIds?: readonly string[];
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    assignee?: string;
    dueDate?: string;
    originSuggestionId?: string;
    initiativeId?: string;
  }): Card => {
    const settings = this.settingsSignal();
    const defaultStatusId = payload.statusId || settings.defaultStatusId;
    const labels = payload.labelIds && payload.labelIds.length > 0
      ? [...payload.labelIds]
      : [settings.labels[0]?.id ?? 'general'];

    const card: Card = {
      id: createId(),
      title: payload.title,
      summary: payload.summary,
      statusId: defaultStatusId,
      labelIds: labels,
      priority: payload.priority ?? 'medium',
      storyPoints: 3,
      assignee: payload.assignee ?? settings.defaultAssignee,
      dueDate: payload.dueDate,
      subtasks: [],
      comments: [],
      activities: [],
      originSuggestionId: payload.originSuggestionId,
      initiativeId: payload.initiativeId,
    };

    this.cardsSignal.update((cards) => [card, ...cards]);

    return card;
  };
  /**
   * Derives the card for the current selection.
   *
   * @returns Signal exposing the active card when available.
   */
  public readonly selectedCard = computed<Card | undefined>(() => {
    const cardId = this.selectedCardIdSignal();
    if (!cardId) {
      return undefined;
    }

    return this.cardsSignal().find((card) => card.id === cardId);
  });

  /**
   * Exposes a read method for cards by identifier.
   *
   * @param cardId - Target identifier.
   * @returns Card instance when found.
   */
  public readonly getCard = (cardId: string): Card | undefined =>
    this.cardsSignal().find((card) => card.id === cardId);

  /**
   * Adds a custom label to the workspace settings.
   *
   * @param payload - Label attributes from the settings form.
   */
  public readonly addLabel = (payload: { name: string; color: string }): void => {
    this.settingsSignal.update((settings) => ({
      ...settings,
      labels: [...settings.labels, { id: createId(), name: payload.name, color: payload.color }],
    }));
  };

  /**
   * Adds a new status lane to the workspace configuration.
   *
   * @param payload - Status name and lifecycle category.
   */
  public readonly addStatus = (
    payload: { name: string; category: 'todo' | 'in-progress' | 'done'; color: string },
  ): void => {
    this.settingsSignal.update((settings) => {
      const currentOrders = settings.statuses.map((status) => status.order);
      const nextOrder = currentOrders.length === 0 ? 1 : Math.max(...currentOrders) + 1;
      return {
        ...settings,
        statuses: [
          ...settings.statuses,
          {
            id: createId(),
            name: payload.name,
            category: payload.category,
            order: nextOrder,
            color: payload.color,
          },
        ],
      };
    });
  };

  /**
   * Registers a new template available for analyzer driven proposals.
   *
   * @param payload - Template information collected from settings forms.
   */
  public readonly addTemplate = (payload: {
    name: string;
    description: string;
    defaultStatusId: string;
    defaultLabelIds: readonly string[];
    confidenceThreshold: number;
  }): void => {
    this.settingsSignal.update((settings) => ({
      ...settings,
      templates: [
        ...settings.templates,
        {
          id: createId(),
          name: payload.name,
          description: payload.description,
          defaultStatusId: payload.defaultStatusId,
          defaultLabelIds: [...payload.defaultLabelIds],
          confidenceThreshold: payload.confidenceThreshold,
        },
      ],
    }));
  };

  /**
   * Applies updates to an existing template.
   *
   * @param templateId - Target template identifier.
   * @param changes - Partial template payload.
   */
  public readonly updateTemplate = (
    templateId: string,
    changes: Partial<Omit<TemplatePreset, 'id'>>,
  ): void => {
    this.settingsSignal.update((settings) => ({
      ...settings,
      templates: settings.templates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        const { defaultLabelIds, ...rest } = changes;
        return {
          ...template,
          ...rest,
          defaultLabelIds:
            defaultLabelIds !== undefined ? [...defaultLabelIds] : template.defaultLabelIds,
        } satisfies TemplatePreset;
      }),
    }));
  };

  /**
   * Removes a template from the workspace configuration.
   *
   * @param templateId - Identifier of the template to delete.
   */
  public readonly removeTemplate = (templateId: string): void => {
    this.settingsSignal.update((settings) => ({
      ...settings,
      templates: settings.templates.filter((template) => template.id !== templateId),
    }));
  };
}
