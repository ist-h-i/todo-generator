import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import {
  AnalysisProposal,
  BoardColumnView,
  BoardFilters,
  BoardGrouping,
  Card,
  Label,
  Status,
  Subtask,
  TemplateFieldVisibility,
  TemplatePreset,
  WorkspaceSettings,
  WorkspaceSummary,
  DEFAULT_TEMPLATE_FIELDS,
} from '@core/models';
import { createId } from '@core/utils/create-id';

const STORAGE_NAMESPACE = 'todo-generator/workspace-settings';

const cloneStatus = (status: Status): Status => ({
  id: status.id,
  name: status.name,
  category: status.category,
  order: status.order,
  color: status.color,
});

const cloneLabel = (label: Label): Label => ({
  id: label.id,
  name: label.name,
  color: label.color,
});

const cloneTemplate = (template: TemplatePreset): TemplatePreset => ({
  id: template.id,
  name: template.name,
  description: template.description,
  defaultStatusId: template.defaultStatusId,
  defaultLabelIds: [...template.defaultLabelIds],
  confidenceThreshold: template.confidenceThreshold,
  fieldVisibility: { ...template.fieldVisibility },
});

const cloneSettings = (settings: WorkspaceSettings): WorkspaceSettings => ({
  defaultStatusId: settings.defaultStatusId,
  defaultAssignee: settings.defaultAssignee,
  timezone: settings.timezone,
  statuses: settings.statuses.map(cloneStatus),
  labels: settings.labels.map(cloneLabel),
  templates: settings.templates.map(cloneTemplate),
  storyPointScale: [...settings.storyPointScale],
});

const clampConfidence = (value: number): number => Math.min(Math.max(value, 0), 1);

const unique = <T>(values: readonly T[]): T[] => Array.from(new Set(values));

const DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD = 0.5;

type RawWorkspaceSettings = {
  statuses?: unknown;
  labels?: unknown;
  templates?: unknown;
  storyPointScale?: unknown;
  defaultStatusId?: unknown;
  defaultAssignee?: unknown;
  timezone?: unknown;
};

type RawStatusRecord = {
  id?: unknown;
  name?: unknown;
  category?: unknown;
  order?: unknown;
  color?: unknown;
};

type RawLabelRecord = {
  id?: unknown;
  name?: unknown;
  color?: unknown;
};

type RawTemplateRecord = {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  defaultStatusId?: unknown;
  defaultLabelIds?: unknown;
  confidenceThreshold?: unknown;
  fieldVisibility?: unknown;
};

type RawTemplateFieldVisibility = {
  showStoryPoints?: unknown;
  showDueDate?: unknown;
  showAssignee?: unknown;
  showConfidence?: unknown;
};

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
    fieldVisibility: { ...DEFAULT_TEMPLATE_FIELDS },
  },
  {
    id: 'ux-template',
    name: 'UX 検証',
    description: 'プロトタイプ検証とユーザーテスト',
    defaultStatusId: 'in-progress',
    defaultLabelIds: ['ux'],
    confidenceThreshold: 0.7,
    fieldVisibility: { ...DEFAULT_TEMPLATE_FIELDS },
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
    templateId: 'ai-template',
    priority: 'high',
    storyPoints: 5,
    createdAt: '2025-04-18T09:00:00.000Z',
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
    templateId: 'ux-template',
    priority: 'medium',
    storyPoints: 3,
    createdAt: '2025-04-25T04:30:00.000Z',
    dueDate: '2025-04-30',
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
    templateId: null,
    priority: 'urgent',
    storyPoints: 8,
    createdAt: '2025-05-01T01:15:00.000Z',
    dueDate: '2025-05-12',
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
    templateId: 'ai-template',
    priority: 'medium',
    storyPoints: 2,
    createdAt: '2025-03-30T10:45:00.000Z',
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
  quickFilters: [],
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const QUICK_FILTER_RECENT_DAYS = 14;
const QUICK_FILTER_DUE_SOON_DAYS = 7;

type CardSuggestionPayload = {
  readonly title: string;
  readonly summary: string;
  readonly statusId?: string;
  readonly labelIds?: readonly string[];
  readonly priority?: Card['priority'];
  readonly assignee?: string;
  readonly dueDate?: string;
  readonly createdAt?: string;
  readonly originSuggestionId?: string;
  readonly initiativeId?: string;
  readonly confidence?: number;
  readonly storyPoints?: number;
  readonly subtasks?: readonly Subtask[];
};

/**
 * Signal-based workspace store providing board data to all features.
 */
@Injectable({ providedIn: 'root' })
export class WorkspaceStore {
  private readonly auth = inject(AuthService);
  private readonly storage = this.resolveStorage();
  private readonly activeUserId = computed(() => this.auth.user()?.id ?? null);

  private readonly settingsSignal = signal<WorkspaceSettings>(cloneSettings(INITIAL_SETTINGS));
  private readonly cardsSignal = signal<readonly Card[]>(INITIAL_CARDS);
  private readonly groupingSignal = signal<BoardGrouping>('label');
  private readonly filtersSignal = signal<BoardFilters>({ ...INITIAL_FILTERS });
  private readonly selectedCardIdSignal = signal<string | null>(null);
  private readonly templateConfidenceThresholds = computed(
    () =>
      new Map(
        this.settingsSignal().templates.map((template) => [
          template.id,
          template.confidenceThreshold,
        ]),
      ),
  );

  public constructor() {
    effect(
      () => {
        const userId = this.activeUserId();
        const settings = this.loadSettings(userId);
        this.settingsSignal.set(settings);
        this.reconcileCardsForSettings(settings);
        this.reconcileFiltersForSettings(settings);
      },
      { allowSignalWrites: true },
    );
  }

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
    const { search, labelIds, statusIds, quickFilters } = this.filtersSignal();
    const normalizedSearch = search.trim().toLowerCase();
    const quickFilterSet = new Set(quickFilters);
    const settings = this.settingsSignal();
    const now = new Date();
    const defaultAssignee = settings.defaultAssignee.trim().toLowerCase();

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

        if (quickFilterSet.size > 0) {
          if (quickFilterSet.has('myAssignments')) {
            const assignee = card.assignee?.trim().toLowerCase() ?? '';
            if (!defaultAssignee || assignee !== defaultAssignee) {
              return false;
            }
          }

          if (quickFilterSet.has('noAssignee')) {
            if ((card.assignee?.trim() ?? '').length > 0) {
              return false;
            }
          }

          if (quickFilterSet.has('highPriority')) {
            if (card.priority !== 'high' && card.priority !== 'urgent') {
              return false;
            }
          }

          if (quickFilterSet.has('dueSoon')) {
            if (!card.dueDate) {
              return false;
            }

            const due = new Date(card.dueDate);
            const dueTime = due.getTime();
            if (Number.isNaN(dueTime)) {
              return false;
            }

            const diffMs = dueTime - now.getTime();
            const threshold = QUICK_FILTER_DUE_SOON_DAYS * MS_PER_DAY;
            if (diffMs > threshold) {
              return false;
            }
            if (diffMs < 0 && Math.abs(diffMs) > threshold) {
              return false;
            }
          }

          if (quickFilterSet.has('recentlyCreated')) {
            const created = new Date(card.createdAt);
            const createdTime = created.getTime();
            if (Number.isNaN(createdTime)) {
              return false;
            }

            if (now.getTime() - createdTime > QUICK_FILTER_RECENT_DAYS * MS_PER_DAY) {
              return false;
            }
          }
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
      const labelIds =
        proposal.suggestedLabelIds.length > 0
          ? [...proposal.suggestedLabelIds]
          : template
            ? [...template.defaultLabelIds]
            : [defaultLabel];

      return this.buildCardFromPayload({
        title: proposal.title,
        summary: proposal.summary,
        statusId,
        labelIds,
        priority: 'medium',
        assignee: settings.defaultAssignee,
        confidence: proposal.confidence,
        subtasks: proposal.subtasks.map((task) => ({
          id: createId(),
          title: task,
          status: 'todo',
        })),
      });
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
   * Appends a new comment to the specified card.
   *
   * @param cardId - Identifier of the card receiving the comment.
   * @param payload - Author and message content entered by the user.
   */
  public readonly addComment = (
    cardId: string,
    payload: { author: string; message: string },
  ): void => {
    const author = payload.author.trim();
    const message = payload.message.trim();
    if (!author || !message) {
      return;
    }

    const timestamp = new Date().toISOString();

    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              comments: [
                ...card.comments,
                {
                  id: createId(),
                  author,
                  message,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                },
              ],
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
  public readonly createCardFromSuggestion = (payload: CardSuggestionPayload): Card => {
    const card = this.buildCardFromPayload(payload);

    this.cardsSignal.update((cards) => [card, ...cards]);

    return card;
  };

  private readonly buildCardFromPayload = (payload: CardSuggestionPayload): Card => {
    const settings = this.settingsSignal();
    const statusId = payload.statusId ?? settings.defaultStatusId;
    const labelIds =
      payload.labelIds && payload.labelIds.length > 0
        ? [...payload.labelIds]
        : [settings.labels[0]?.id ?? 'general'];

    return {
      id: createId(),
      title: payload.title,
      summary: payload.summary,
      statusId,
      labelIds,
      priority: payload.priority ?? 'medium',
      storyPoints: payload.storyPoints ?? 3,
      createdAt: payload.createdAt ?? new Date().toISOString(),
      assignee: payload.assignee ?? settings.defaultAssignee,
      dueDate: payload.dueDate,
      confidence: payload.confidence,
      subtasks: payload.subtasks ? payload.subtasks.map((subtask) => ({ ...subtask })) : [],
      comments: [],
      activities: [],
      originSuggestionId: payload.originSuggestionId,
      initiativeId: payload.initiativeId,
    } satisfies Card;
  };
  /**
   * Replaces the label set associated with a card.
   *
   * @param cardId - Identifier of the card to update.
   * @param labelIds - Next label identifiers selected by the user.
   */
  public readonly updateCardLabels = (cardId: string, labelIds: readonly string[]): void => {
    const unique = Array.from(new Set(labelIds));
    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              labelIds: unique,
            }
          : card,
      ),
    );
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
    this.settingsSignal.update((settings) => {
      const next: WorkspaceSettings = {
        ...settings,
        labels: [
          ...settings.labels,
          { id: createId(), name: payload.name, color: payload.color },
        ],
      };
      this.persistSettings(next);
      return next;
    });
  };

  /**
   * Removes a label from the workspace configuration.
   *
   * @param labelId - Identifier of the label to delete.
   * @returns True when the label was removed.
   */
  public readonly removeLabel = (labelId: string): boolean => {
    let removed = false;
    this.settingsSignal.update((settings) => {
      if (!settings.labels.some((label) => label.id === labelId)) {
        return settings;
      }

      removed = true;
      const labels = settings.labels.filter((label) => label.id !== labelId);
      const templates = settings.templates.map((template) => {
        if (!template.defaultLabelIds.includes(labelId)) {
          return template;
        }

        return {
          ...template,
          defaultLabelIds: template.defaultLabelIds.filter((id) => id !== labelId),
          fieldVisibility: { ...template.fieldVisibility },
        } satisfies TemplatePreset;
      });

      const next: WorkspaceSettings = {
        ...settings,
        labels,
        templates,
      };

      this.persistSettings(next);
      return next;
    });

    if (!removed) {
      return false;
    }

    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.labelIds.includes(labelId)
          ? { ...card, labelIds: card.labelIds.filter((id) => id !== labelId) }
          : card,
      ),
    );

    this.filtersSignal.update((filters) => ({
      ...filters,
      labelIds: filters.labelIds.filter((id) => id !== labelId),
    }));

    return true;
  };

  /**
   * Adds a new status lane to the workspace configuration.
   *
   * @param payload - Status name and lifecycle category.
   */
  public readonly addStatus = (payload: {
    name: string;
    category: 'todo' | 'in-progress' | 'done';
    color: string;
  }): void => {
    this.settingsSignal.update((settings) => {
      const currentOrders = settings.statuses.map((status) => status.order);
      const nextOrder = currentOrders.length === 0 ? 1 : Math.max(...currentOrders) + 1;
      const statuses = [
        ...settings.statuses,
        {
          id: createId(),
          name: payload.name,
          category: payload.category,
          order: nextOrder,
          color: payload.color,
        },
      ];

      const next: WorkspaceSettings = {
        ...settings,
        statuses,
      };

      this.persistSettings(next);
      return next;
    });
  };

  /**
   * Removes an existing status column from the workspace.
   *
   * @param statusId - Identifier of the status to delete.
   * @returns Identifier of the fallback status applied to affected cards.
   */
  public readonly removeStatus = (statusId: string): string | null => {
    let fallbackStatusId: string | null = null;
    let removed = false;

    this.settingsSignal.update((settings) => {
      const statuses = settings.statuses.filter((status) => status.id !== statusId);
      if (statuses.length === settings.statuses.length || statuses.length === 0) {
        return settings;
      }

      removed = true;
      const sorted = statuses.slice().sort((a, b) => a.order - b.order);
      const defaultStatusId =
        settings.defaultStatusId === statusId ? sorted[0].id : settings.defaultStatusId;
      fallbackStatusId = defaultStatusId;

      const templates = settings.templates.map((template) => {
        if (template.defaultStatusId !== statusId) {
          return template;
        }

        return {
          ...template,
          defaultStatusId,
          defaultLabelIds: [...template.defaultLabelIds],
          fieldVisibility: { ...template.fieldVisibility },
        } satisfies TemplatePreset;
      });

      const next: WorkspaceSettings = {
        ...settings,
        statuses,
        defaultStatusId,
        templates,
      };

      this.persistSettings(next);
      return next;
    });

    if (!removed || fallbackStatusId === null) {
      return null;
    }

    const fallback = fallbackStatusId;
    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.statusId === statusId ? { ...card, statusId: fallback } : card,
      ),
    );

    this.filtersSignal.update((filters) => ({
      ...filters,
      statusIds: filters.statusIds.filter((id) => id !== statusId),
    }));

    return fallback;
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
    fieldVisibility: TemplateFieldVisibility;
  }): void => {
    this.settingsSignal.update((settings) => {
      const allowedStatuses = new Set(settings.statuses.map((status) => status.id));
      const allowedLabels = new Set(settings.labels.map((label) => label.id));
      const defaultStatusId = allowedStatuses.has(payload.defaultStatusId)
        ? payload.defaultStatusId
        : settings.defaultStatusId;
      const defaultLabelIds = unique(
        payload.defaultLabelIds.filter((labelId) => allowedLabels.has(labelId)),
      );

      const nextTemplate: TemplatePreset = {
        id: createId(),
        name: payload.name,
        description: payload.description,
        defaultStatusId,
        defaultLabelIds,
        confidenceThreshold: clampConfidence(payload.confidenceThreshold),
        fieldVisibility: { ...payload.fieldVisibility },
      };

      const next: WorkspaceSettings = {
        ...settings,
        templates: [...settings.templates, nextTemplate],
      };

      this.persistSettings(next);
      return next;
    });
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
    this.settingsSignal.update((settings) => {
      const allowedStatuses = new Set(settings.statuses.map((status) => status.id));
      const allowedLabels = new Set(settings.labels.map((label) => label.id));

      const templates = settings.templates.map((template) => {
        if (template.id !== templateId) {
          return template;
        }

        const { defaultLabelIds, fieldVisibility, confidenceThreshold, defaultStatusId, ...rest } =
          changes;

        return {
          ...template,
          ...rest,
          defaultStatusId:
            defaultStatusId !== undefined && allowedStatuses.has(defaultStatusId)
              ? defaultStatusId
              : template.defaultStatusId,
          defaultLabelIds:
            defaultLabelIds !== undefined
              ? unique(defaultLabelIds.filter((labelId) => allowedLabels.has(labelId)))
              : template.defaultLabelIds,
          confidenceThreshold:
            confidenceThreshold !== undefined
              ? clampConfidence(confidenceThreshold)
              : template.confidenceThreshold,
          fieldVisibility:
            fieldVisibility !== undefined ? { ...fieldVisibility } : template.fieldVisibility,
        } satisfies TemplatePreset;
      });

      const next: WorkspaceSettings = {
        ...settings,
        templates,
      };

      this.persistSettings(next);
      return next;
    });
  };

  /**
   * Removes a template from the workspace configuration.
   *
   * @param templateId - Identifier of the template to delete.
   */
  public readonly removeTemplate = (templateId: string): void => {
    let removed = false;

    this.settingsSignal.update((settings) => {
      const templates = settings.templates.filter((template) => template.id !== templateId);
      if (templates.length === settings.templates.length) {
        return settings;
      }

      removed = true;
      const next: WorkspaceSettings = {
        ...settings,
        templates,
      };

      this.persistSettings(next);
      return next;
    });

    if (!removed) {
      return;
    }

    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.templateId === templateId ? { ...card, templateId: null } : card,
      ),
    );
  };

  private reconcileCardsForSettings(settings: WorkspaceSettings): void {
    const allowedStatusIds = new Set(settings.statuses.map((status) => status.id));
    const allowedLabelIds = new Set(settings.labels.map((label) => label.id));
    const fallbackStatusId = settings.defaultStatusId;

    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        const statusId = allowedStatusIds.has(card.statusId) ? card.statusId : fallbackStatusId;
        const labelIds = card.labelIds.filter((labelId) => allowedLabelIds.has(labelId));

        if (statusId === card.statusId && labelIds.length === card.labelIds.length) {
          return card;
        }

        return {
          ...card,
          statusId,
          labelIds,
        } satisfies Card;
      }),
    );
  }

  private reconcileFiltersForSettings(settings: WorkspaceSettings): void {
    const allowedStatusIds = new Set(settings.statuses.map((status) => status.id));
    const allowedLabelIds = new Set(settings.labels.map((label) => label.id));

    this.filtersSignal.update((filters) => {
      const statusIds = filters.statusIds.filter((id) => allowedStatusIds.has(id));
      const labelIds = filters.labelIds.filter((id) => allowedLabelIds.has(id));

      if (
        statusIds.length === filters.statusIds.length &&
        labelIds.length === filters.labelIds.length
      ) {
        return filters;
      }

      return {
        ...filters,
        statusIds,
        labelIds,
      } satisfies BoardFilters;
    });
  }

  private resolveStorage(): Storage | null {
    if (typeof window === 'undefined') {
      return null;
    }

    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }

  private buildStorageKey(userId: string): string {
    return `${STORAGE_NAMESPACE}/${userId}`;
  }

  private loadSettings(userId: string | null): WorkspaceSettings {
    if (!userId || !this.storage) {
      return cloneSettings(INITIAL_SETTINGS);
    }

    const key = this.buildStorageKey(userId);
    const stored = this.storage.getItem(key);

    if (!stored) {
      const defaults = cloneSettings(INITIAL_SETTINGS);
      this.persistSettingsForUser(userId, defaults);
      return defaults;
    }

    try {
      const parsed = JSON.parse(stored);
      const sanitized = this.sanitizeSettings(parsed);
      this.persistSettingsForUser(userId, sanitized);
      return sanitized;
    } catch {
      const defaults = cloneSettings(INITIAL_SETTINGS);
      this.persistSettingsForUser(userId, defaults);
      return defaults;
    }
  }

  private persistSettings(settings: WorkspaceSettings): void {
    const userId = this.activeUserId();
    if (!userId) {
      return;
    }

    this.persistSettingsForUser(userId, settings);
  }

  private persistSettingsForUser(userId: string, settings: WorkspaceSettings): void {
    if (!this.storage) {
      return;
    }

    try {
      this.storage.setItem(this.buildStorageKey(userId), JSON.stringify(settings));
    } catch {
      // Swallow storage exceptions to avoid breaking UX on quota issues.
    }
  }

  private sanitizeSettings(raw: unknown): WorkspaceSettings {
    const defaults = cloneSettings(INITIAL_SETTINGS);
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const data = raw as RawWorkspaceSettings;
    const statuses = this.sanitizeStatuses(data.statuses);
    const labels = this.sanitizeLabels(data.labels);
    const primaryStatus = statuses.reduce<Status | null>(
      (best, status) => (best === null || status.order < best.order ? status : best),
      null,
    );
    const fallbackStatusId = primaryStatus?.id ?? defaults.defaultStatusId;
    const templates = this.sanitizeTemplates(data.templates, statuses, labels, fallbackStatusId);
    const storyPointScale = this.sanitizeStoryPointScale(data.storyPointScale);
    const defaultStatusId = this.resolveDefaultStatusId(
      data.defaultStatusId,
      statuses,
      fallbackStatusId,
    );
    const defaultAssignee =
      typeof data.defaultAssignee === 'string' && data.defaultAssignee.trim().length > 0
        ? data.defaultAssignee
        : defaults.defaultAssignee;
    const timezone =
      typeof data.timezone === 'string' && data.timezone.trim().length > 0
        ? data.timezone
        : defaults.timezone;

    return {
      defaultStatusId,
      defaultAssignee,
      timezone,
      statuses,
      labels,
      templates,
      storyPointScale,
    };
  }

  private sanitizeStatuses(value: unknown): readonly Status[] {
    if (!Array.isArray(value)) {
      return INITIAL_SETTINGS.statuses.map(cloneStatus);
    }

    const sanitized = value
      .map((entry) => this.sanitizeStatus(entry))
      .filter((status): status is Status => status !== null);

    return sanitized.length > 0 ? sanitized : INITIAL_SETTINGS.statuses.map(cloneStatus);
  }

  private sanitizeStatus(value: unknown): Status | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as RawStatusRecord;
    const id = typeof record.id === 'string' ? record.id : null;
    const name = typeof record.name === 'string' ? record.name : null;
    const category =
      record.category === 'todo' || record.category === 'in-progress' || record.category === 'done'
        ? (record.category as Status['category'])
        : null;
    const order =
      typeof record.order === 'number' && Number.isFinite(record.order) ? record.order : null;
    const color = typeof record.color === 'string' ? record.color : null;

    if (!id || !name || !category || order === null || color === null) {
      return null;
    }

    return { id, name, category, order, color } satisfies Status;
  }

  private sanitizeLabels(value: unknown): readonly Label[] {
    if (!Array.isArray(value)) {
      return INITIAL_SETTINGS.labels.map(cloneLabel);
    }

    return value
      .map((entry) => this.sanitizeLabel(entry))
      .filter((label): label is Label => label !== null);
  }

  private sanitizeLabel(value: unknown): Label | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as RawLabelRecord;
    const id = typeof record.id === 'string' ? record.id : null;
    const name = typeof record.name === 'string' ? record.name : null;
    const color = typeof record.color === 'string' ? record.color : null;

    if (!id || !name || color === null) {
      return null;
    }

    return { id, name, color } satisfies Label;
  }

  private sanitizeTemplates(
    value: unknown,
    statuses: readonly Status[],
    labels: readonly Label[],
    fallbackStatusId: string,
  ): readonly TemplatePreset[] {
    if (!Array.isArray(value)) {
      return INITIAL_SETTINGS.templates.map(cloneTemplate);
    }

    const allowedStatuses = new Set(statuses.map((status) => status.id));
    const allowedLabels = new Set(labels.map((label) => label.id));

    return value
      .map((entry) =>
        this.sanitizeTemplate(entry, allowedStatuses, allowedLabels, fallbackStatusId),
      )
      .filter((template): template is TemplatePreset => template !== null);
  }

  private sanitizeTemplate(
    value: unknown,
    allowedStatuses: ReadonlySet<string>,
    allowedLabels: ReadonlySet<string>,
    fallbackStatusId: string,
  ): TemplatePreset | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as RawTemplateRecord;
    const id = typeof record.id === 'string' ? record.id : null;
    const name = typeof record.name === 'string' ? record.name : null;

    if (!id || !name) {
      return null;
    }

    const description = typeof record.description === 'string' ? record.description : '';
    const defaultStatusId =
      typeof record.defaultStatusId === 'string' && allowedStatuses.has(record.defaultStatusId)
        ? record.defaultStatusId
        : fallbackStatusId;
    const defaultLabelIds = Array.isArray(record.defaultLabelIds)
      ? unique(
          record.defaultLabelIds.filter(
            (labelId): labelId is string =>
              typeof labelId === 'string' && allowedLabels.has(labelId),
          ),
        )
      : [];
    const confidenceThreshold =
      typeof record.confidenceThreshold === 'number' && Number.isFinite(record.confidenceThreshold)
        ? clampConfidence(record.confidenceThreshold)
        : DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD;
    const fieldVisibility = this.sanitizeFieldVisibility(record.fieldVisibility);

    return {
      id,
      name,
      description,
      defaultStatusId,
      defaultLabelIds,
      confidenceThreshold,
      fieldVisibility,
    } satisfies TemplatePreset;
  }

  private sanitizeFieldVisibility(value: unknown): TemplateFieldVisibility {
    if (!value || typeof value !== 'object') {
      return { ...DEFAULT_TEMPLATE_FIELDS };
    }

    const record = value as RawTemplateFieldVisibility;
    const toBoolean = (input: unknown, fallback: boolean): boolean =>
      typeof input === 'boolean' ? input : fallback;

    return {
      showStoryPoints: toBoolean(
        record.showStoryPoints,
        DEFAULT_TEMPLATE_FIELDS.showStoryPoints,
      ),
      showDueDate: toBoolean(record.showDueDate, DEFAULT_TEMPLATE_FIELDS.showDueDate),
      showAssignee: toBoolean(record.showAssignee, DEFAULT_TEMPLATE_FIELDS.showAssignee),
      showConfidence: toBoolean(record.showConfidence, DEFAULT_TEMPLATE_FIELDS.showConfidence),
    } satisfies TemplateFieldVisibility;
  }

  private sanitizeStoryPointScale(value: unknown): readonly number[] {
    if (!Array.isArray(value)) {
      return [...INITIAL_SETTINGS.storyPointScale];
    }

    const sanitized = value.filter(
      (entry): entry is number => typeof entry === 'number' && Number.isFinite(entry),
    );

    return sanitized.length > 0 ? sanitized : [...INITIAL_SETTINGS.storyPointScale];
  }

  private resolveDefaultStatusId(
    value: unknown,
    statuses: readonly Status[],
    fallbackStatusId: string,
  ): string {
    if (typeof value === 'string' && statuses.some((status) => status.id === value)) {
      return value;
    }

    const primary = statuses.reduce<Status | null>(
      (best, status) => (best === null || status.order < best.order ? status : best),
      null,
    );

    return primary?.id ?? fallbackStatusId;
  }
}
