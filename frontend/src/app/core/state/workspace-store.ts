import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import {
  CardCreateRequest,
  CardResponse,
  CardsApiService,
  SubtaskResponse,
} from '@core/api/cards-api.service';
import { Logger } from '@core/logger/logger';
import {
  AnalysisProposal,
  BoardColumnView,
  BoardFilters,
  BoardGrouping,
  BoardQuickFilter,
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

const STORAGE_NAMESPACE = 'verbalize-yourself/workspace-settings';
const PREFERENCES_STORAGE_NAMESPACE = 'verbalize-yourself/workspace-preferences';
const LEGACY_STORAGE_NAMESPACE = 'todo-generator/workspace-settings';
const LEGACY_PREFERENCES_STORAGE_NAMESPACE = 'todo-generator/workspace-preferences';
const ANONYMOUS_STORAGE_USER_ID = 'anonymous';

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

const cloneFilters = (filters: BoardFilters): BoardFilters => ({
  search: filters.search,
  labelIds: [...filters.labelIds],
  statusIds: [...filters.statusIds],
  quickFilters: [...filters.quickFilters],
});

const arraysEqual = <T>(left: readonly T[], right: readonly T[]): boolean =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const CARD_PRIORITY_FALLBACK: Card['priority'] = 'medium';
const CARD_PRIORITY_MAP: Record<string, Card['priority']> = {
  low: 'low',
  medium: 'medium',
  normal: 'medium',
  high: 'high',
  urgent: 'urgent',
  critical: 'urgent',
};

const SUBTASK_STATUS_FALLBACK: Subtask['status'] = 'todo';
const SUBTASK_STATUS_MAP: Record<string, Subtask['status']> = {
  todo: 'todo',
  'not-started': 'todo',
  not_started: 'todo',
  backlog: 'todo',
  pending: 'todo',
  'in-progress': 'in-progress',
  in_progress: 'in-progress',
  doing: 'in-progress',
  active: 'in-progress',
  review: 'in-progress',
  qa: 'in-progress',
  testing: 'in-progress',
  blocked: 'in-progress',
  done: 'done',
  completed: 'done',
  complete: 'done',
  resolved: 'done',
  closed: 'done',
  'non-issue': 'non-issue',
  non_issue: 'non-issue',
  'not-applicable': 'non-issue',
  not_applicable: 'non-issue',
  skipped: 'non-issue',
  'n/a': 'non-issue',
  na: 'non-issue',
};

const STATUS_CATEGORY_ACCENTS: Record<Status['category'], string> = {
  todo: '#64748b',
  'in-progress': '#2563eb',
  done: '#16a34a',
};

const FALLBACK_LABEL_COLORS = [
  '#38bdf8',
  '#a855f7',
  '#ec4899',
  '#f97316',
  '#14b8a6',
  '#eab308',
  '#6366f1',
];

const filtersEqual = (left: BoardFilters, right: BoardFilters): boolean =>
  left.search === right.search &&
  arraysEqual(left.labelIds, right.labelIds) &&
  arraysEqual(left.statusIds, right.statusIds) &&
  arraysEqual(left.quickFilters, right.quickFilters);

const sanitizeString = (value: string | null | undefined): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const sanitizeNumber = (value: number | null | undefined): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const sanitizeDateString = (value: string | null | undefined): string | undefined => {
  const sanitized = sanitizeString(value);
  if (!sanitized) {
    return undefined;
  }

  return Number.isNaN(Date.parse(sanitized)) ? undefined : sanitized;
};

const sanitizeDateTime = (value: string | null | undefined): string => {
  const sanitized = sanitizeString(value);
  if (!sanitized || Number.isNaN(Date.parse(sanitized))) {
    return new Date().toISOString();
  }

  return new Date(sanitized).toISOString();
};

const normalizeCardPriority = (value: string | null | undefined): Card['priority'] => {
  const normalized = sanitizeString(value)?.toLowerCase();
  if (!normalized) {
    return CARD_PRIORITY_FALLBACK;
  }

  return CARD_PRIORITY_MAP[normalized] ?? CARD_PRIORITY_FALLBACK;
};

const normalizeSubtaskStatus = (value: string | null | undefined): Subtask['status'] => {
  const normalized = sanitizeString(value)?.toLowerCase();
  if (!normalized) {
    return SUBTASK_STATUS_FALLBACK;
  }

  if (normalized in SUBTASK_STATUS_MAP) {
    return SUBTASK_STATUS_MAP[normalized];
  }

  if (normalized.includes('progress') || normalized === 'doing') {
    return 'in-progress';
  }

  if (normalized.includes('done') || normalized.includes('complete')) {
    return 'done';
  }

  if (normalized.includes('issue') || normalized.includes('skip')) {
    return 'non-issue';
  }

  return SUBTASK_STATUS_FALLBACK;
};

const normalizeStatusCategory = (value: string | null | undefined): Status['category'] => {
  const normalized = sanitizeString(value)?.toLowerCase();
  if (!normalized) {
    return 'todo';
  }

  if (normalized.includes('done') || normalized.includes('complete') || normalized === 'closed') {
    return 'done';
  }

  if (
    normalized.includes('progress') ||
    normalized === 'doing' ||
    normalized === 'active' ||
    normalized === 'review' ||
    normalized === 'qa'
  ) {
    return 'in-progress';
  }

  return 'todo';
};

const normalizeStatusColor = (
  value: string | null | undefined,
  category: Status['category'],
): string => sanitizeString(value) ?? STATUS_CATEGORY_ACCENTS[category];

const pickPrimaryAssignee = (
  assignees: readonly string[] | null | undefined,
): string | undefined => {
  if (!assignees) {
    return undefined;
  }

  for (const assignee of assignees) {
    const sanitized = sanitizeString(assignee);
    if (sanitized) {
      return sanitized;
    }
  }

  return undefined;
};

const sanitizeStoryPoints = (value: number | null | undefined): number => {
  if (value === null || value === undefined) {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.round(numeric));
};

const sanitizeConfidence = (value: number | null | undefined): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  return Math.min(Math.max(numeric, 0), 1);
};

const dedupeIds = (ids: readonly (string | null | undefined)[]): string[] => {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    const sanitized = sanitizeString(id);
    if (!sanitized || seen.has(sanitized)) {
      continue;
    }

    seen.add(sanitized);
    result.push(sanitized);
  }

  return result;
};

const mapSubtaskFromResponse = (source: SubtaskResponse): Subtask => ({
  id: source.id,
  title: source.title,
  status: normalizeSubtaskStatus(source.status),
  assignee: sanitizeString(source.assignee),
  estimateHours: sanitizeNumber(source.estimate_hours),
  dueDate: sanitizeDateString(source.due_date),
});

const mapCardFromResponse = (source: CardResponse, fallbackStatusId: string): Card => {
  const rawLabelIds = dedupeIds([
    ...((source.label_ids ?? []) as readonly (string | null | undefined)[]),
    ...((source.labels ?? []).map((label) => label?.id) as readonly (string | null | undefined)[]),
  ]);
  const subtasks = (source.subtasks ?? []).map(mapSubtaskFromResponse);
  const statusId = sanitizeString(source.status_id ?? source.status?.id) ?? fallbackStatusId;

  return {
    id: source.id,
    title: source.title,
    summary: source.summary ?? '',
    statusId,
    labelIds: rawLabelIds,
    templateId: null,
    priority: normalizeCardPriority(source.priority),
    storyPoints: sanitizeStoryPoints(source.story_points),
    createdAt: sanitizeDateTime(source.created_at),
    startDate: sanitizeDateString(source.start_date),
    dueDate: sanitizeDateString(source.due_date),
    assignee: pickPrimaryAssignee(source.assignees),
    confidence: sanitizeConfidence(source.ai_confidence),
    subtasks,
    comments: [],
    activities: [],
    originSuggestionId: undefined,
    initiativeId: sanitizeString(source.initiative_id ?? source.initiative?.id),
  } satisfies Card;
};

const collectStatusesFromCards = (cards: readonly CardResponse[]): Status[] => {
  const seen = new Map<string, Status>();
  let fallbackOrder = 0;

  for (const card of cards) {
    const statusId = sanitizeString(card.status_id ?? card.status?.id);
    if (!statusId || seen.has(statusId)) {
      continue;
    }

    const meta = card.status;
    const name = sanitizeString(meta?.name) ?? statusId;
    const category = normalizeStatusCategory(meta?.category);
    const orderCandidate = meta?.order ?? null;
    const order =
      typeof orderCandidate === 'number' && Number.isFinite(orderCandidate)
        ? orderCandidate
        : ++fallbackOrder;
    const color = normalizeStatusColor(meta?.color, category);

    seen.set(statusId, {
      id: statusId,
      name,
      category,
      order,
      color,
    });
  }

  return Array.from(seen.values()).sort((left, right) => {
    if (left.order !== right.order) {
      return left.order - right.order;
    }

    return left.name.localeCompare(right.name);
  });
};

const collectLabelsFromCards = (cards: readonly CardResponse[]): Label[] => {
  const seen = new Map<string, Label>();
  let colorIndex = 0;

  const nextColor = (): string => {
    const color = FALLBACK_LABEL_COLORS[colorIndex % FALLBACK_LABEL_COLORS.length];
    colorIndex += 1;
    return color;
  };

  for (const card of cards) {
    for (const label of card.labels ?? []) {
      const id = sanitizeString(label?.id);
      if (!id || seen.has(id)) {
        continue;
      }

      const name = sanitizeString(label?.name) ?? id;
      const color = sanitizeString(label?.color) ?? nextColor();
      seen.set(id, { id, name, color });
    }
  }

  for (const card of cards) {
    for (const labelId of card.label_ids ?? []) {
      const sanitized = sanitizeString(labelId);
      if (!sanitized || seen.has(sanitized)) {
        continue;
      }

      seen.set(sanitized, { id: sanitized, name: sanitized, color: nextColor() });
    }
  }

  return Array.from(seen.values()).sort((left, right) => left.name.localeCompare(right.name));
};

const statusesEqual = (left: readonly Status[], right: readonly Status[]): boolean =>
  left.length === right.length &&
  left.every((status, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      status.id === other.id &&
      status.name === other.name &&
      status.category === other.category &&
      status.order === other.order &&
      status.color === other.color
    );
  });

const labelsEqual = (left: readonly Label[], right: readonly Label[]): boolean =>
  left.length === right.length &&
  left.every((label, index) => {
    const other = right[index];
    return (
      other !== undefined &&
      label.id === other.id &&
      label.name === other.name &&
      label.color === other.color
    );
  });

const determineDefaultStatusId = (statuses: readonly Status[], fallback: string): string => {
  if (statuses.length === 0) {
    return fallback;
  }

  const todoStatus = statuses.find((status) => status.category === 'todo');
  if (todoStatus) {
    return todoStatus.id;
  }

  return statuses[0]?.id ?? fallback;
};

const DEFAULT_GROUPING: BoardGrouping = 'label';

const QUICK_FILTER_VALUES: readonly BoardQuickFilter[] = [
  'myAssignments',
  'dueSoon',
  'recentlyCreated',
  'highPriority',
  'noAssignee',
];

const QUICK_FILTER_LOOKUP = new Set<BoardQuickFilter>(QUICK_FILTER_VALUES);

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

interface BoardPreferences {
  readonly grouping: BoardGrouping;
  readonly filters: BoardFilters;
}

type RawBoardFilters = {
  search?: unknown;
  labelIds?: unknown;
  statusIds?: unknown;
  quickFilters?: unknown;
};

type RawBoardPreferences = {
  grouping?: unknown;
  filters?: unknown;
};

type CardDetailUpdate = Partial<
  Pick<Card, 'title' | 'summary' | 'statusId' | 'priority' | 'assignee' | 'storyPoints'>
>;

type SubtaskDetailUpdate = Partial<Omit<Subtask, 'id'>>;

type Mutable<T> = { -readonly [P in keyof T]: T[P] };

type MutableCard = Mutable<Card>;
type MutableSubtask = Mutable<Subtask>;

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

const INITIAL_CARDS: readonly Card[] = [];

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
  private readonly cardsApi = inject(CardsApiService);
  private readonly logger = inject(Logger);
  private readonly storage = this.resolveStorage();
  private readonly activeUserId = computed(() => this.auth.user()?.id ?? null);
  private readonly activeUserEmail = computed(() => this.auth.user()?.email ?? null);
  private readonly activeUserNickname = computed(() => {
    const raw = this.auth.user()?.nickname;
    if (raw === null || raw === undefined) {
      return null;
    }

    const nickname = raw.trim();
    return nickname.length > 0 ? nickname : null;
  });
  public readonly currentUserId = computed(() => this.activeUserId());
  public readonly commentAuthorName = computed(() => {
    const nickname = this.activeUserNickname();
    if (nickname) {
      return nickname;
    }

    const email = this.activeUserEmail();
    if (email) {
      return email;
    }

    return '匿名ユーザー';
  });
  private lastSyncedAssigneeName: string | null = null;

  private readonly settingsSignal = signal<WorkspaceSettings>(cloneSettings(INITIAL_SETTINGS));
  private readonly cardsSignal = signal<readonly Card[]>(INITIAL_CARDS);
  private readonly groupingSignal = signal<BoardGrouping>(DEFAULT_GROUPING);
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
  private activeCardRequestToken = 0;

  public constructor() {
    effect(
      () => {
        const userId = this.activeUserId();
        const settings = this.loadSettings(userId);
        const preferences = this.loadPreferences(userId, settings);
        this.settingsSignal.set(settings);
        this.groupingSignal.set(preferences.grouping);
        this.filtersSignal.set(preferences.filters);
        this.reconcileCardsForSettings(settings);
        this.reconcileFiltersForSettings(settings);
      },
      { allowSignalWrites: true },
    );
  }

  private readonly loadCardsEffect = effect(
    () => {
      const userId = this.activeUserId();
      if (!userId) {
        this.activeCardRequestToken += 1;
        this.cardsSignal.set([]);
        return;
      }

      this.fetchCards();
    },
    { allowSignalWrites: true },
  );

  private readonly syncDefaultAssigneeWithNicknameEffect = effect(
    () => {
      const nickname = this.activeUserNickname();
      if (!nickname) {
        this.lastSyncedAssigneeName = null;
        return;
      }

      if (this.lastSyncedAssigneeName === nickname) {
        return;
      }

      const email = this.activeUserEmail();
      const settings = this.settingsSignal();
      const previousDefault = settings.defaultAssignee;
      const canUpdateDefault =
        previousDefault === INITIAL_SETTINGS.defaultAssignee ||
        previousDefault === this.lastSyncedAssigneeName ||
        (email !== null && previousDefault === email);

      if (canUpdateDefault && previousDefault !== nickname) {
        const nextSettings: WorkspaceSettings = {
          ...settings,
          defaultAssignee: nickname,
        };
        this.settingsSignal.set(nextSettings);
        this.persistSettings(nextSettings);
      }

      const aliasValues = new Set<string>();
      if (canUpdateDefault && previousDefault && previousDefault !== nickname) {
        aliasValues.add(previousDefault);
      }
      if (this.lastSyncedAssigneeName && this.lastSyncedAssigneeName !== nickname) {
        aliasValues.add(this.lastSyncedAssigneeName);
      }
      if (email && email !== nickname) {
        aliasValues.add(email);
      }
      if (INITIAL_SETTINGS.defaultAssignee !== nickname) {
        aliasValues.add(INITIAL_SETTINGS.defaultAssignee);
      }

      if (aliasValues.size > 0) {
        this.cardsSignal.update((cards) => {
          let mutated = false;
          const nextCards = cards.map((card) => {
            let updated = false;
            let nextAssignee = card.assignee;

            if (nextAssignee && aliasValues.has(nextAssignee)) {
              nextAssignee = nickname;
              updated = true;
            }

            let nextSubtasks = card.subtasks;
            if (
              card.subtasks.some((subtask) => subtask.assignee && aliasValues.has(subtask.assignee))
            ) {
              nextSubtasks = card.subtasks.map((subtask) =>
                subtask.assignee && aliasValues.has(subtask.assignee)
                  ? { ...subtask, assignee: nickname }
                  : subtask,
              );
              updated = true;
            }

            if (!updated) {
              return card;
            }

            mutated = true;
            return {
              ...card,
              assignee: nextAssignee,
              subtasks: nextSubtasks,
            } satisfies Card;
          });

          return mutated ? nextCards : cards;
        });
      }

      this.lastSyncedAssigneeName = nickname;
    },
    { allowSignalWrites: true },
  );

  private resolveStorageUserId(userId: string | null): string | null {
    if (!this.storage) {
      return null;
    }

    return userId ?? ANONYMOUS_STORAGE_USER_ID;
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
    if (this.groupingSignal() === grouping) {
      return;
    }

    this.groupingSignal.set(grouping);
    this.persistPreferencesState(this.filtersSignal(), grouping);
  };

  /**
   * Updates board filters using a partial payload.
   *
   * @param filters - Next filter patch.
   */
  public readonly updateFilters = (filters: Partial<BoardFilters>): void => {
    let nextFilters: BoardFilters | null = null;

    this.filtersSignal.update((current) => {
      const merged = { ...current, ...filters };
      const sanitized = this.sanitizeFilters(merged, this.settingsSignal());
      if (filtersEqual(current, sanitized)) {
        return current;
      }
      nextFilters = sanitized;
      return sanitized;
    });

    if (nextFilters) {
      this.persistPreferencesState(nextFilters, this.groupingSignal());
    }
  };

  /**
   * Clears the current board filters.
   */
  public readonly resetFilters = (): void => {
    const defaults = this.sanitizeFilters(INITIAL_FILTERS, this.settingsSignal());
    if (filtersEqual(this.filtersSignal(), defaults)) {
      return;
    }
    this.filtersSignal.set(defaults);
    this.persistPreferencesState(defaults, this.groupingSignal());
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

      return this.buildLocalCardFromPayload({
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

  /**
   * Permanently removes a card from the workspace.
   *
   * @param cardId - Identifier of the card to delete.
   */
  public readonly removeCard = (cardId: string): void => {
    let removed = false;

    this.cardsSignal.update((cards) => {
      const next = cards.filter((card) => {
        if (card.id === cardId) {
          removed = true;
          return false;
        }

        return true;
      });

      return removed ? next : cards;
    });

    if (removed && this.selectedCardIdSignal() === cardId) {
      this.selectedCardIdSignal.set(null);
    }
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
    payload: { message: string; subtaskId?: string },
  ): void => {
    const message = payload.message.trim();
    if (!message) {
      return;
    }

    const timestamp = new Date().toISOString();
    const authorNickname = this.commentAuthorName();
    const authorId = this.currentUserId();

    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.id === cardId
          ? {
              ...card,
              comments: [
                ...card.comments,
                {
                  id: createId(),
                  authorId: authorId ?? undefined,
                  authorNickname,
                  message,
                  createdAt: timestamp,
                  updatedAt: timestamp,
                  subtaskId: payload.subtaskId,
                },
              ],
            }
          : card,
      ),
    );
  };

  public readonly updateComment = (
    cardId: string,
    commentId: string,
    changes: { message: string; subtaskId?: string },
  ): void => {
    const message = changes.message.trim();
    if (!message) {
      return;
    }

    const timestamp = new Date().toISOString();

    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        let mutated = false;
        const comments = card.comments.map((comment) => {
          if (comment.id !== commentId) {
            return comment;
          }

          mutated = true;
          return {
            ...comment,
            message,
            subtaskId: changes.subtaskId,
            updatedAt: timestamp,
          };
        });

        return mutated ? { ...card, comments } : card;
      }),
    );
  };

  /**
   * Updates core card metadata such as title, summary, priority, and assignment.
   *
   * @param cardId - Identifier of the card to mutate.
   * @param changes - Subset of fields to update.
   */
  public readonly updateCardDetails = (cardId: string, changes: CardDetailUpdate): void => {
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        let mutated = false;
        const next: MutableCard = { ...card };

        if ('title' in changes && changes.title !== undefined) {
          const title = changes.title.trim();
          if (title && title !== card.title) {
            next.title = title;
            mutated = true;
          }
        }

        if ('summary' in changes && changes.summary !== undefined) {
          const summary = changes.summary.trim();
          if (summary !== card.summary) {
            next.summary = summary;
            mutated = true;
          }
        }

        if ('statusId' in changes && changes.statusId && changes.statusId !== card.statusId) {
          next.statusId = changes.statusId;
          mutated = true;
        }

        if ('priority' in changes && changes.priority && changes.priority !== card.priority) {
          next.priority = changes.priority;
          mutated = true;
        }

        if ('assignee' in changes) {
          const normalized = changes.assignee?.trim();
          const assignee = normalized && normalized.length > 0 ? normalized : undefined;
          if (assignee !== card.assignee) {
            next.assignee = assignee;
            mutated = true;
          }
        }

        if ('storyPoints' in changes && changes.storyPoints !== undefined) {
          const storyPoints = Number.isFinite(changes.storyPoints)
            ? Math.max(0, changes.storyPoints)
            : card.storyPoints;
          if (storyPoints !== card.storyPoints) {
            next.storyPoints = storyPoints;
            mutated = true;
          }
        }

        return mutated ? (next as Card) : card;
      }),
    );
  };

  /**
   * Removes a comment from the specified card.
   *
   * @param cardId - Identifier of the card owning the comment.
   * @param commentId - Identifier of the comment to delete.
   */
  public readonly removeComment = (cardId: string, commentId: string): void => {
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const comments = card.comments.filter((comment) => comment.id !== commentId);
        if (comments.length === card.comments.length) {
          return card;
        }

        return {
          ...card,
          comments,
        } satisfies Card;
      }),
    );
  };

  /**
   * Appends a new subtask to the specified card.
   *
   * @param cardId - Identifier of the parent card.
   * @param payload - Attributes describing the new subtask.
   */
  public readonly addSubtask = (
    cardId: string,
    payload: {
      title: string;
      status?: Subtask['status'];
      assignee?: string;
      estimateHours?: number;
      dueDate?: string;
    },
  ): void => {
    const title = payload.title.trim();
    if (!title) {
      return;
    }

    const normalizedAssignee = payload.assignee?.trim();
    const assignee =
      normalizedAssignee && normalizedAssignee.length > 0 ? normalizedAssignee : undefined;
    const estimate =
      payload.estimateHours !== undefined && Number.isFinite(payload.estimateHours)
        ? Math.max(0, payload.estimateHours)
        : undefined;

    const normalizedDueDate = payload.dueDate?.trim();
    const dueDate =
      normalizedDueDate && normalizedDueDate.length > 0 ? normalizedDueDate : undefined;

    const subtask: Subtask = {
      id: createId(),
      title,
      status: payload.status ?? 'todo',
      assignee,
      estimateHours: estimate,
      dueDate,
    };

    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.id === cardId
          ? ({
              ...card,
              subtasks: [...card.subtasks, subtask],
            } satisfies Card)
          : card,
      ),
    );
  };

  /**
   * Updates fields on an existing subtask.
   *
   * @param cardId - Identifier of the parent card.
   * @param subtaskId - Identifier of the subtask to mutate.
   * @param changes - Fields that should be updated.
   */
  public readonly updateSubtaskDetails = (
    cardId: string,
    subtaskId: string,
    changes: SubtaskDetailUpdate,
  ): void => {
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        let mutated = false;
        const subtasks = card.subtasks.map((subtask) => {
          if (subtask.id !== subtaskId) {
            return subtask;
          }

          let subtaskMutated = false;
          const next: MutableSubtask = { ...subtask };

          if ('title' in changes && changes.title !== undefined) {
            const title = changes.title.trim();
            if (title && title !== subtask.title) {
              next.title = title;
              subtaskMutated = true;
            }
          }

          if ('assignee' in changes) {
            const normalized = changes.assignee?.trim();
            const assignee = normalized && normalized.length > 0 ? normalized : undefined;
            if (assignee !== subtask.assignee) {
              next.assignee = assignee;
              subtaskMutated = true;
            }
          }

          if ('estimateHours' in changes) {
            const raw = changes.estimateHours;
            let estimate: number | undefined;
            if (raw === undefined) {
              estimate = undefined;
            } else if (Number.isFinite(raw)) {
              estimate = Math.max(0, raw);
            } else {
              estimate = subtask.estimateHours;
            }
            if (estimate !== subtask.estimateHours) {
              next.estimateHours = estimate;
              subtaskMutated = true;
            }
          }

          if ('dueDate' in changes) {
            const raw = changes.dueDate?.trim();
            const dueDate = raw && raw.length > 0 ? raw : undefined;
            if (dueDate !== subtask.dueDate) {
              next.dueDate = dueDate;
              subtaskMutated = true;
            }
          }

          if ('status' in changes && changes.status && changes.status !== subtask.status) {
            next.status = changes.status;
            subtaskMutated = true;
          }

          if (subtaskMutated) {
            mutated = true;
            return next as Subtask;
          }

          return subtask;
        });

        if (!mutated) {
          return card;
        }

        return {
          ...card,
          subtasks,
        } satisfies Card;
      }),
    );
  };

  /**
   * Deletes a subtask from the specified card.
   *
   * @param cardId - Identifier of the parent card.
   * @param subtaskId - Identifier of the subtask to remove.
   */
  public readonly removeSubtask = (cardId: string, subtaskId: string): void => {
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const subtasks = card.subtasks.filter((subtask) => subtask.id !== subtaskId);
        if (subtasks.length === card.subtasks.length) {
          return card;
        }

        return {
          ...card,
          subtasks,
        } satisfies Card;
      }),
    );
  };

  /**
   * Creates a new card from a suggested improvement action.
   *
   * @param payload - Attributes describing the new card.
   * @returns Created card instance.
   */
  public readonly createCardFromSuggestion = async (
    payload: CardSuggestionPayload,
  ): Promise<Card> => {
    const settings = this.settingsSignal();
    const fallbackStatusId = settings.defaultStatusId;
    const request = this.buildCardCreateRequest(payload, settings);

    try {
      const response = await firstValueFrom(this.cardsApi.createCard(request));
      const card = {
        ...mapCardFromResponse(response, fallbackStatusId),
        originSuggestionId: payload.originSuggestionId,
      } satisfies Card;

      this.cardsSignal.update((cards) => [card, ...cards]);

      return card;
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
      throw error;
    }
  };

  private readonly buildCardCreateRequest = (
    payload: CardSuggestionPayload,
    settings: WorkspaceSettings,
  ): CardCreateRequest => {
    const statusId = sanitizeString(payload.statusId) ?? settings.defaultStatusId;
    const providedLabelIds = (payload.labelIds ?? [])
      .map((labelId) => sanitizeString(labelId))
      .filter((labelId): labelId is string => Boolean(labelId));
    const labelIds =
      providedLabelIds.length > 0
        ? Array.from(new Set(providedLabelIds))
        : [sanitizeString(settings.labels[0]?.id) ?? 'general'];
    const fallbackAssignee = sanitizeString(payload.assignee ?? settings.defaultAssignee);
    const storyPoints = sanitizeStoryPoints(payload.storyPoints ?? 3);
    const dueDate = sanitizeDateString(payload.dueDate);
    const confidence = sanitizeConfidence(payload.confidence);

    return {
      title: payload.title,
      summary: payload.summary,
      status_id: statusId,
      label_ids: labelIds,
      priority: payload.priority ?? 'medium',
      story_points: storyPoints,
      assignees: fallbackAssignee ? [fallbackAssignee] : [],
      due_date: dueDate,
      ai_confidence: confidence,
      initiative_id: payload.initiativeId,
      subtasks:
        payload.subtasks?.map((subtask) => ({
          title: subtask.title,
          status: subtask.status,
          assignee: sanitizeString(subtask.assignee),
          estimate_hours: subtask.estimateHours,
          due_date: sanitizeDateString(subtask.dueDate),
        })) ?? [],
    } satisfies CardCreateRequest;
  };

  private readonly buildLocalCardFromPayload = (
    payload: CardSuggestionPayload,
    settingsOverride?: WorkspaceSettings,
  ): Card => {
    const settings = settingsOverride ?? this.settingsSignal();
    const statusId = sanitizeString(payload.statusId) ?? settings.defaultStatusId;
    const providedLabelIds = (payload.labelIds ?? [])
      .map((labelId) => sanitizeString(labelId))
      .filter((labelId): labelId is string => Boolean(labelId));
    const labelIds =
      providedLabelIds.length > 0
        ? Array.from(new Set(providedLabelIds))
        : [sanitizeString(settings.labels[0]?.id) ?? 'general'];
    const createdAt = payload.createdAt ?? new Date().toISOString();
    const assignee = sanitizeString(payload.assignee ?? settings.defaultAssignee) ?? undefined;
    const dueDate = sanitizeDateString(payload.dueDate);
    const confidence = sanitizeConfidence(payload.confidence);

    return {
      id: createId(),
      title: payload.title,
      summary: payload.summary,
      statusId,
      labelIds,
      priority: payload.priority ?? 'medium',
      storyPoints: sanitizeStoryPoints(payload.storyPoints ?? 3),
      createdAt,
      assignee,
      dueDate,
      confidence,
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
        labels: [...settings.labels, { id: createId(), name: payload.name, color: payload.color }],
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

    this.updateFilters({
      labelIds: this.filtersSignal().labelIds.filter((id) => id !== labelId),
    });

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
      cards.map((card) => (card.statusId === statusId ? { ...card, statusId: fallback } : card)),
    );

    this.updateFilters({
      statusIds: this.filtersSignal().statusIds.filter((id) => id !== statusId),
    });

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
      cards.map((card) => (card.templateId === templateId ? { ...card, templateId: null } : card)),
    );
  };

  private fetchCards(): void {
    const requestToken = ++this.activeCardRequestToken;

    firstValueFrom(this.cardsApi.listCards())
      .then((response) => {
        if (requestToken !== this.activeCardRequestToken) {
          return;
        }

        this.applyFetchedCards(response);
      })
      .catch((error) => {
        if (requestToken !== this.activeCardRequestToken) {
          return;
        }

        this.logger.error('WorkspaceStore', error);
        this.cardsSignal.set([]);
      });
  }

  private applyFetchedCards(response: readonly CardResponse[]): void {
    const statuses = collectStatusesFromCards(response);
    const labels = collectLabelsFromCards(response);

    this.applyWorkspaceMetadata(statuses, labels);

    const fallbackStatusId = this.settingsSignal().defaultStatusId;
    const mappedCards = response.map((card) => mapCardFromResponse(card, fallbackStatusId));
    this.cardsSignal.set(mappedCards);
    this.reconcileCardsForSettings(this.settingsSignal());
  }

  private applyWorkspaceMetadata(statuses: readonly Status[], labels: readonly Label[]): void {
    if (statuses.length === 0 && labels.length === 0) {
      return;
    }

    let updatedSettings: WorkspaceSettings | null = null;

    this.settingsSignal.update((current) => {
      const nextStatuses = statuses.length > 0 ? statuses : current.statuses;
      const nextLabels = labels.length > 0 ? labels : current.labels;

      let defaultStatusId = current.defaultStatusId;
      if (
        !nextStatuses.some((status) => status.id === defaultStatusId) &&
        nextStatuses.length > 0
      ) {
        defaultStatusId = determineDefaultStatusId(nextStatuses, current.defaultStatusId);
      }

      const unchanged =
        statusesEqual(current.statuses, nextStatuses) &&
        labelsEqual(current.labels, nextLabels) &&
        defaultStatusId === current.defaultStatusId;

      if (unchanged) {
        return current;
      }

      updatedSettings = {
        ...current,
        statuses: nextStatuses,
        labels: nextLabels,
        defaultStatusId,
      } satisfies WorkspaceSettings;

      return updatedSettings;
    });

    if (!updatedSettings) {
      return;
    }

    this.persistSettings(updatedSettings);
    this.reconcileFiltersForSettings(updatedSettings);
  }

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
    let nextFilters: BoardFilters | null = null;

    this.filtersSignal.update((filters) => {
      const sanitized = this.sanitizeFilters(filters, settings);
      if (filtersEqual(filters, sanitized)) {
        return filters;
      }

      nextFilters = sanitized;
      return sanitized;
    });

    if (nextFilters) {
      this.persistPreferencesState(nextFilters, this.groupingSignal());
    }
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

  private buildLegacyStorageKey(userId: string): string {
    return `${LEGACY_STORAGE_NAMESPACE}/${userId}`;
  }

  private buildPreferencesKey(userId: string): string {
    return `${PREFERENCES_STORAGE_NAMESPACE}/${userId}`;
  }

  private buildLegacyPreferencesKey(userId: string): string {
    return `${LEGACY_PREFERENCES_STORAGE_NAMESPACE}/${userId}`;
  }

  private buildDefaultPreferences(): BoardPreferences {
    return {
      grouping: DEFAULT_GROUPING,
      filters: cloneFilters(INITIAL_FILTERS),
    } satisfies BoardPreferences;
  }

  private loadPreferences(userId: string | null, settings: WorkspaceSettings): BoardPreferences {
    const defaults = this.buildDefaultPreferences();
    const storageUserId = this.resolveStorageUserId(userId);
    if (!storageUserId) {
      return defaults;
    }

    const key = this.buildPreferencesKey(storageUserId);
    let stored = this.storage?.getItem(key) ?? null;

    if (!stored) {
      stored = this.migrateLegacyPreferences(storageUserId, key);
    }

    if (!stored) {
      this.persistPreferencesForUser(storageUserId, defaults);
      return defaults;
    }

    try {
      const parsed = JSON.parse(stored);
      const sanitized = this.sanitizePreferences(parsed, settings);
      this.persistPreferencesForUser(storageUserId, sanitized);
      return {
        grouping: sanitized.grouping,
        filters: cloneFilters(sanitized.filters),
      } satisfies BoardPreferences;
    } catch {
      this.persistPreferencesForUser(storageUserId, defaults);
      return defaults;
    }
  }

  private loadSettings(userId: string | null): WorkspaceSettings {
    if (!this.storage) {
      return cloneSettings(INITIAL_SETTINGS);
    }

    const storageUserId = this.resolveStorageUserId(userId);
    if (!storageUserId) {
      return cloneSettings(INITIAL_SETTINGS);
    }

    const defaults = cloneSettings(INITIAL_SETTINGS);
    const key = this.buildStorageKey(storageUserId);
    let stored = this.storage.getItem(key);

    if (!stored) {
      stored = this.migrateLegacySettings(storageUserId, key);
    }

    if (!stored) {
      this.persistSettingsForUser(storageUserId, defaults);
      return defaults;
    }

    try {
      const parsed = JSON.parse(stored);
      const sanitized = this.sanitizeSettings(parsed);
      this.persistSettingsForUser(storageUserId, sanitized);
      return sanitized;
    } catch {
      this.persistSettingsForUser(storageUserId, defaults);
      return defaults;
    }
  }

  private persistSettings(settings: WorkspaceSettings): void {
    const storageUserId = this.resolveStorageUserId(this.activeUserId());
    if (!storageUserId) {
      return;
    }

    this.persistSettingsForUser(storageUserId, settings);
  }

  private migrateLegacySettings(userId: string, targetKey: string): string | null {
    if (!this.storage) {
      return null;
    }

    const legacyKey = this.buildLegacyStorageKey(userId);
    const legacyValue = this.storage.getItem(legacyKey);

    if (!legacyValue) {
      return null;
    }

    try {
      this.storage.setItem(targetKey, legacyValue);
    } catch {
      // Ignore quota or serialization issues when migrating legacy data.
    }

    try {
      this.storage.removeItem(legacyKey);
    } catch {
      // Removing the legacy key is best-effort only.
    }

    return legacyValue;
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

  private persistPreferences(preferences: BoardPreferences): void {
    const storageUserId = this.resolveStorageUserId(this.activeUserId());
    if (!storageUserId) {
      return;
    }

    this.persistPreferencesForUser(storageUserId, preferences);
  }

  private migrateLegacyPreferences(userId: string, targetKey: string): string | null {
    if (!this.storage) {
      return null;
    }

    const legacyKey = this.buildLegacyPreferencesKey(userId);
    const legacyValue = this.storage.getItem(legacyKey);

    if (!legacyValue) {
      return null;
    }

    try {
      this.storage.setItem(targetKey, legacyValue);
    } catch {
      // Ignore quota or serialization issues when migrating legacy data.
    }

    try {
      this.storage.removeItem(legacyKey);
    } catch {
      // Removing the legacy key is best-effort only.
    }

    return legacyValue;
  }

  private persistPreferencesForUser(userId: string, preferences: BoardPreferences): void {
    if (!this.storage) {
      return;
    }

    try {
      const payload: BoardPreferences = {
        grouping: preferences.grouping,
        filters: cloneFilters(preferences.filters),
      };
      this.storage.setItem(this.buildPreferencesKey(userId), JSON.stringify(payload));
    } catch {
      // Swallow storage exceptions to avoid breaking UX on quota issues.
    }
  }

  private persistPreferencesState(filters: BoardFilters, grouping: BoardGrouping): void {
    this.persistPreferences({
      grouping,
      filters: cloneFilters(filters),
    });
  }

  private sanitizePreferences(raw: unknown, settings: WorkspaceSettings): BoardPreferences {
    const defaults = this.buildDefaultPreferences();
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const record = raw as RawBoardPreferences;
    const grouping =
      record.grouping === 'status' || record.grouping === 'label'
        ? (record.grouping as BoardGrouping)
        : defaults.grouping;
    const filters = this.sanitizeFilters(record.filters, settings);

    return { grouping, filters } satisfies BoardPreferences;
  }

  private sanitizeFilters(value: unknown, settings: WorkspaceSettings): BoardFilters {
    const defaults = cloneFilters(INITIAL_FILTERS);
    if (!value || typeof value !== 'object') {
      return defaults;
    }

    const record = value as RawBoardFilters;
    const search = typeof record.search === 'string' ? record.search : defaults.search;
    const allowedStatusIds = new Set(settings.statuses.map((status) => status.id));
    const allowedLabelIds = new Set(settings.labels.map((label) => label.id));
    const statusIds = this.sanitizeFilterIds(record.statusIds, allowedStatusIds);
    const labelIds = this.sanitizeFilterIds(record.labelIds, allowedLabelIds);
    const quickFilters = this.sanitizeQuickFilters(record.quickFilters);

    return {
      search,
      statusIds,
      labelIds,
      quickFilters,
    } satisfies BoardFilters;
  }

  private sanitizeFilterIds(value: unknown, allowed: ReadonlySet<string>): readonly string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return unique(
      value.filter((entry): entry is string => typeof entry === 'string' && allowed.has(entry)),
    );
  }

  private sanitizeQuickFilters(value: unknown): readonly BoardQuickFilter[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return unique(
      value.filter(
        (entry): entry is BoardQuickFilter =>
          typeof entry === 'string' && QUICK_FILTER_LOOKUP.has(entry as BoardQuickFilter),
      ),
    );
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
      showStoryPoints: toBoolean(record.showStoryPoints, DEFAULT_TEMPLATE_FIELDS.showStoryPoints),
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
