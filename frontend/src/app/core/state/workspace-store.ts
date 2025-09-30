import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import {
  CardCreateRequest,
  CardResponse,
  CardUpdateRequest,
  CardsApiService,
  SubtaskCreateRequest,
  SubtaskResponse,
  SubtaskUpdateRequest,
} from '@core/api/cards-api.service';
import { BoardLayoutsApiService, BoardLayoutResponse } from '@core/api/board-layouts-api.service';
import {
  CommentCreateRequest,
  CommentResponse,
  CommentUpdateRequest,
  CommentsApiService,
} from '@core/api/comments-api.service';
import {
  WorkspaceConfigApiService,
  WorkspaceTemplateResponse,
  LabelResponse,
  StatusResponse,
} from '@core/api/workspace-config-api.service';
import { createId } from '@core/utils/create-id';
import { Logger } from '@core/logger/logger';
import {
  AnalysisProposal,
  AuthenticatedUser,
  BoardColumnView,
  BoardFilters,
  BoardGrouping,
  BoardQuickFilter,
  Card,
  CardComment,
  Label,
  Status,
  Subtask,
  TemplateFieldVisibility,
  TemplatePreset,
  WorkspaceSettings,
  WorkspaceSummary,
  DEFAULT_TEMPLATE_FIELDS,
} from '@core/models';

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

const clampConfidence = (value: number): number => Math.min(Math.max(value, 0), 100);

const normalizeTemplateThreshold = (value: unknown, fallback: number): number => {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const scaled = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return clampConfidence(scaled);
};

const normalizeProposalConfidence = (confidence: number): number => {
  if (!Number.isFinite(confidence)) {
    return 0;
  }

  const scaled = confidence > 0 && confidence <= 1 ? confidence * 100 : confidence;
  return clampConfidence(scaled);
};

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

const DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD = 60;
const UNASSIGNED_ASSIGNEE_COLUMN_ID = 'assignee:unassigned';
const UNASSIGNED_ASSIGNEE_TITLE = '未割り当て';
const UNASSIGNED_ASSIGNEE_ACCENT = '#94a3b8';
const AUTH_SET_USER_ORIGINAL = Symbol('WorkspaceStoreAuthSetUserOriginal');

type AuthSetUserFn = (user: AuthenticatedUser | null) => void;

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

  const scaled = numeric > 0 && numeric <= 1 ? numeric * 100 : numeric;
  return clampConfidence(scaled);
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

const mapCommentFromResponse = (source: CommentResponse): CardComment => ({
  id: source.id,
  authorId: sanitizeString(source.author_id),
  authorNickname:
    sanitizeString(source.author_nickname) ?? sanitizeString(source.author_id) ?? '匿名ユーザー',
  message: source.content,
  createdAt: sanitizeDateTime(source.created_at),
  updatedAt: sanitizeDateTime(source.updated_at),
  subtaskId: sanitizeString(source.subtask_id),
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

const mapStatusResponse = (response: StatusResponse): Status => {
  const category = normalizeStatusCategory(response.category);
  const order =
    typeof response.order === 'number' && Number.isFinite(response.order) ? response.order : 0;
  const color = normalizeStatusColor(response.color, category);

  return {
    id: response.id,
    name: response.name,
    category,
    order,
    color,
  } satisfies Status;
};

const mapLabelResponse = (response: LabelResponse): Label => ({
  id: response.id,
  name: response.name,
  color: response.color,
});

const mapTemplateResponse = (
  response: WorkspaceTemplateResponse,
  allowedStatuses: ReadonlySet<string>,
  allowedLabels: ReadonlySet<string>,
  fallbackStatusId: string,
): TemplatePreset | null => {
  const name = sanitizeString(response.name);
  if (!name) {
    return null;
  }

  const description = sanitizeString(response.description) ?? '';
  const statusId = response.default_status_id;
  const defaultStatusId = statusId && allowedStatuses.has(statusId) ? statusId : fallbackStatusId;
  const labelIds = Array.isArray(response.default_label_ids)
    ? unique(
        response.default_label_ids.filter(
          (labelId): labelId is string => typeof labelId === 'string' && allowedLabels.has(labelId),
        ),
      )
    : [];
  const confidence = normalizeTemplateThreshold(
    response.confidence_threshold,
    DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD,
  );
  const visibility = response.field_visibility ?? DEFAULT_TEMPLATE_FIELDS;

  return {
    id: response.id,
    name,
    description,
    defaultStatusId,
    defaultLabelIds: labelIds,
    confidenceThreshold: confidence,
    fieldVisibility: {
      showStoryPoints: visibility.show_story_points ?? DEFAULT_TEMPLATE_FIELDS.showStoryPoints,
      showDueDate: visibility.show_due_date ?? DEFAULT_TEMPLATE_FIELDS.showDueDate,
      showAssignee: visibility.show_assignee ?? DEFAULT_TEMPLATE_FIELDS.showAssignee,
      showConfidence: visibility.show_confidence ?? DEFAULT_TEMPLATE_FIELDS.showConfidence,
    },
  } satisfies TemplatePreset;
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
  label_ids?: unknown;
  status_ids?: unknown;
  quick_filters?: unknown;
};

type RawBoardPreferences = {
  grouping?: unknown;
  filters?: unknown;
};

type CardDetailUpdate = Partial<
  Pick<Card, 'title' | 'summary' | 'statusId' | 'priority' | 'assignee' | 'storyPoints'>
>;

type SubtaskDetailUpdate = Partial<Omit<Subtask, 'id'>>;

type Writable<T> = { -readonly [P in keyof T]: T[P] };

const INITIAL_CARDS: readonly Card[] = [];

const INITIAL_SETTINGS: WorkspaceSettings = {
  defaultStatusId: '',
  defaultAssignee: '',
  timezone: '',
  statuses: [],
  labels: [],
  templates: [],
  storyPointScale: [],
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
  readonly confidenceDisplay?: number;
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
  private readonly commentsApi = inject(CommentsApiService);
  private readonly boardLayoutsApi = inject(BoardLayoutsApiService);
  private readonly workspaceConfigApi = inject(WorkspaceConfigApiService);
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
  private configRequest: Promise<WorkspaceSettings> | null = null;
  private lastConfigUserId: string | null = null;
  private preferencesRequestToken = 0;
  private lastAppliedUserId: string | null = null;

  private readonly syncUserContextEffect = effect(() => {
    const userId = this.activeUserId();
    if (userId === this.lastAppliedUserId) {
      return;
    }

    this.applyUserContext(userId);
  });

  public constructor() {
    const initialUser = this.auth.user();
    this.applyUserContext(initialUser?.id ?? null);
    this.bindAuthSetUserPatch();
  }

  private readonly loadCardsEffect = effect(() => {
    const userId = this.activeUserId();
    if (!userId) {
      this.activeCardRequestToken += 1;
      this.cardsSignal.set([]);
      return;
    }

    void this.fetchCards();
  });

  private readonly loadWorkspaceConfigEffect = effect(() => {
    const userId = this.activeUserId();
    if (userId === this.lastConfigUserId) {
      return;
    }

    this.lastConfigUserId = userId;
    void this.refreshWorkspaceConfig(true);
  });

  private readonly syncDefaultAssigneeWithNicknameEffect = effect(() => {
    const nickname = this.activeUserNickname();
    const email = this.activeUserEmail();
    const preferredName =
      nickname && nickname.trim().length > 0
        ? nickname.trim()
        : email && email.trim().length > 0
          ? email.trim()
          : null;

    if (!preferredName) {
      this.lastSyncedAssigneeName = null;
      return;
    }

    const settings = this.settingsSignal();
    const previousDefaultRaw = settings.defaultAssignee;
    const previousDefault = previousDefaultRaw.trim();
    const lastSynced = this.lastSyncedAssigneeName?.trim() ?? null;
    const normalizedEmail = email?.trim() ?? null;

    const canUpdateDefault =
      previousDefault.length === 0 ||
      previousDefault === '匿名ユーザー' ||
      (lastSynced !== null && previousDefault === lastSynced) ||
      (normalizedEmail !== null && previousDefault === normalizedEmail);

    if (canUpdateDefault && previousDefault !== preferredName) {
      const nextSettings: WorkspaceSettings = {
        ...settings,
        defaultAssignee: preferredName,
      };
      this.settingsSignal.set(nextSettings);
      this.persistSettings(nextSettings);
    }

    const aliasValues = new Set<string>();
    const registerAlias = (value: string | null | undefined): void => {
      if (!value) {
        return;
      }

      const normalized = value.trim();
      if (normalized.length === 0 || normalized === preferredName) {
        return;
      }

      aliasValues.add(normalized);
    };

    if (canUpdateDefault) {
      registerAlias(previousDefault);
    }
    registerAlias(lastSynced);
    registerAlias(normalizedEmail);
    registerAlias('匿名ユーザー');

    if (aliasValues.size > 0) {
      this.cardsSignal.update((cards) => {
        let mutated = false;
        const nextCards = cards.map((card) => {
          let updated = false;
          let nextAssignee = card.assignee;

          if (nextAssignee) {
            const normalizedAssignee = nextAssignee.trim();
            if (normalizedAssignee.length > 0 && aliasValues.has(normalizedAssignee)) {
              nextAssignee = preferredName;
              updated = true;
            }
          }

          let nextSubtasks = card.subtasks;
          if (
            card.subtasks.some((subtask) => {
              const normalized = subtask.assignee?.trim();
              return normalized && aliasValues.has(normalized);
            })
          ) {
            nextSubtasks = card.subtasks.map((subtask) => {
              const normalized = subtask.assignee?.trim();
              if (normalized && aliasValues.has(normalized)) {
                return { ...subtask, assignee: preferredName } satisfies Subtask;
              }

              return subtask;
            });
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

    this.lastSyncedAssigneeName = preferredName;
  });

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

    const normalizedConfidence = normalizeProposalConfidence(proposal.confidence);
    return normalizedConfidence >= (threshold ?? DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD);
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

    if (grouping === 'label') {
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
    }

    const assignments = new Map<string, string[]>();
    const unassigned: string[] = [];

    for (const card of cards) {
      if (!allowedIds.has(card.id)) {
        continue;
      }

      const assignee = card.assignee?.trim();
      if (assignee) {
        const bucket = assignments.get(assignee);
        if (bucket) {
          bucket.push(card.id);
        } else {
          assignments.set(assignee, [card.id]);
        }
        continue;
      }

      unassigned.push(card.id);
    }

    const sortedAssignments = Array.from(assignments.entries()).sort((left, right) =>
      left[0].localeCompare(right[0], 'ja', { sensitivity: 'base' }),
    );

    const assigneeColumns = sortedAssignments.map<BoardColumnView>(([name, cardIds], index) => ({
      id: `assignee:${name}`,
      title: name,
      accent: FALLBACK_LABEL_COLORS[index % FALLBACK_LABEL_COLORS.length],
      cards: cardIds,
      count: cardIds.length,
    }));

    const columns: BoardColumnView[] = [
      {
        id: UNASSIGNED_ASSIGNEE_COLUMN_ID,
        title: UNASSIGNED_ASSIGNEE_TITLE,
        accent: UNASSIGNED_ASSIGNEE_ACCENT,
        cards: unassigned,
        count: unassigned.length,
      },
      ...assigneeColumns,
    ];

    return columns;
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
  public readonly importProposals = async (
    proposals: readonly AnalysisProposal[],
  ): Promise<void> => {
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

    const createdCardIds = new Set<string>();

    try {
      for (const proposal of eligible) {
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

        const normalizedConfidence = normalizeProposalConfidence(proposal.confidence);
        const requestConfidence =
          typeof proposal.confidence === 'number' && Number.isFinite(proposal.confidence)
            ? proposal.confidence
            : undefined;

        const card = await this.createCardFromSuggestion({
          title: proposal.title,
          summary: proposal.summary,
          statusId,
          labelIds,
          priority: 'medium',
          assignee: settings.defaultAssignee,
          confidence: requestConfidence,
          confidenceDisplay: normalizedConfidence,
          originSuggestionId: proposal.id,
          subtasks: proposal.subtasks.map((task) => ({
            id: createId(),
            title: task,
            status: 'todo',
          })),
        });

        createdCardIds.add(card.id);
      }
    } catch (error) {
      if (createdCardIds.size > 0) {
        this.cardsSignal.update((cards) => cards.filter((card) => !createdCardIds.has(card.id)));
      }

      throw error;
    }
  };

  /**
   * Moves a card to a different status.
   *
   * @param cardId - Identifier of the card to update.
   * @param statusId - New status.
   */
  public readonly updateCardStatus = (cardId: string, statusId: string): void => {
    this.updateCardDetails(cardId, { statusId });
  };

  /**
   * Permanently removes a card from the workspace.
   *
   * @param cardId - Identifier of the card to delete.
   */
  public readonly removeCard = (cardId: string): void => {
    const cards = this.cardsSignal();
    const next = cards.filter((card) => card.id !== cardId);
    if (next.length === cards.length) {
      return;
    }

    const previousSelection = this.selectedCardIdSignal();
    this.cardsSignal.set(next);
    if (previousSelection === cardId) {
      this.selectedCardIdSignal.set(null);
    }

    void firstValueFrom(this.cardsApi.deleteCard(cardId)).catch((error) => {
      this.logger.error('WorkspaceStore', error);
      this.cardsSignal.set(cards);
      if (previousSelection) {
        this.selectedCardIdSignal.set(previousSelection);
      }
    });
  };

  public readonly updateSubtaskStatus = (
    cardId: string,
    subtaskId: string,
    status: Subtask['status'],
  ): void => {
    this.updateSubtaskDetails(cardId, subtaskId, { status });
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

    const card = this.getCard(cardId);
    if (!card) {
      return;
    }

    const timestamp = new Date().toISOString();
    const authorNickname = this.commentAuthorName();
    const authorId = this.currentUserId() ?? undefined;
    const placeholderId = createId();
    const placeholder: CardComment = {
      id: placeholderId,
      authorId,
      authorNickname,
      message,
      createdAt: timestamp,
      updatedAt: timestamp,
      subtaskId: payload.subtaskId,
    };

    this.cardsSignal.update((cards) =>
      cards.map((item) =>
        item.id === cardId
          ? ({ ...item, comments: [...item.comments, placeholder] } satisfies Card)
          : item,
      ),
    );

    const request: CommentCreateRequest = {
      card_id: cardId,
      content: message,
      subtask_id: payload.subtaskId ?? null,
    };

    void firstValueFrom(this.commentsApi.createComment(request))
      .then((response) => {
        const mapped = mapCommentFromResponse(response);
        this.replaceComment(cardId, placeholderId, mapped);
      })
      .catch((error) => {
        this.logger.error('WorkspaceStore', error);
        this.removeCommentLocal(cardId, placeholderId);
      });
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

    const card = this.getCard(cardId);
    if (!card) {
      return;
    }

    const existing = card.comments.find((comment) => comment.id === commentId);
    if (!existing) {
      return;
    }

    const timestamp = new Date().toISOString();
    const hasSubtaskChange = Object.prototype.hasOwnProperty.call(changes, 'subtaskId');
    const updatedBase: CardComment = {
      ...existing,
      message,
      updatedAt: timestamp,
    };
    const updated: CardComment = hasSubtaskChange
      ? {
          ...updatedBase,
          subtaskId: changes.subtaskId,
        }
      : updatedBase;

    this.replaceComment(cardId, commentId, updated);

    const request: CommentUpdateRequest = hasSubtaskChange
      ? {
          content: message,
          subtask_id: changes.subtaskId ?? null,
        }
      : { content: message };

    void firstValueFrom(this.commentsApi.updateComment(commentId, request))
      .then((response) => {
        const mapped = mapCommentFromResponse(response);
        this.replaceComment(cardId, commentId, mapped);
      })
      .catch((error) => {
        this.logger.error('WorkspaceStore', error);
        this.replaceComment(cardId, commentId, existing);
      });
  };

  /**
   * Updates core card metadata such as title, summary, priority, and assignment.
   *
   * @param cardId - Identifier of the card to mutate.
   * @param changes - Subset of fields to update.
   */
  public readonly updateCardDetails = (cardId: string, changes: CardDetailUpdate): void => {
    const card = this.getCard(cardId);
    if (!card) {
      return;
    }

    const updates: Partial<Writable<Card>> = {};
    const payload: CardUpdateRequest = {};

    if ('title' in changes && changes.title !== undefined) {
      const title = changes.title.trim();
      if (title && title !== card.title) {
        updates.title = title;
        payload.title = title;
      }
    }

    if ('summary' in changes && changes.summary !== undefined) {
      const summary = changes.summary.trim();
      if (summary !== card.summary) {
        updates.summary = summary;
        payload.summary = summary;
      }
    }

    if ('statusId' in changes && changes.statusId !== undefined) {
      const statusId = sanitizeString(changes.statusId);
      if (statusId && statusId !== card.statusId) {
        updates.statusId = statusId;
        payload.status_id = statusId;
      }
    }

    if ('priority' in changes && changes.priority && changes.priority !== card.priority) {
      updates.priority = changes.priority;
      payload.priority = changes.priority;
    }

    if ('assignee' in changes) {
      const normalized = changes.assignee?.trim();
      const assignee = normalized && normalized.length > 0 ? normalized : undefined;
      if (assignee !== card.assignee) {
        updates.assignee = assignee;
        payload.assignees = assignee ? [assignee] : [];
      }
    }

    if ('storyPoints' in changes && changes.storyPoints !== undefined) {
      const numeric = changes.storyPoints;
      const storyPoints = Number.isFinite(numeric)
        ? Math.max(0, Math.round(numeric))
        : card.storyPoints;
      if (storyPoints !== card.storyPoints) {
        updates.storyPoints = storyPoints;
        payload.story_points = storyPoints;
      }
    }

    this.persistCardUpdate(cardId, updates, payload);
  };

  /**
   * Removes a comment from the specified card.
   *
   * @param cardId - Identifier of the card owning the comment.
   * @param commentId - Identifier of the comment to delete.
   */
  public readonly removeComment = (cardId: string, commentId: string): void => {
    const removed = this.removeCommentLocal(cardId, commentId);
    if (!removed) {
      return;
    }

    void firstValueFrom(this.commentsApi.deleteComment(commentId)).catch((error) => {
      this.logger.error('WorkspaceStore', error);
      this.insertComment(cardId, removed.comment, removed.index);
    });
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

    const card = this.getCard(cardId);
    if (!card) {
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
    const status = payload.status ?? 'todo';

    const placeholderId = createId();
    const optimistic: Subtask = {
      id: placeholderId,
      title,
      status,
      assignee,
      estimateHours: estimate,
      dueDate,
    };

    this.cardsSignal.update((cards) =>
      cards.map((item) =>
        item.id === cardId
          ? ({ ...item, subtasks: [...item.subtasks, optimistic] } satisfies Card)
          : item,
      ),
    );

    const request: SubtaskCreateRequest = {
      title,
      status,
      assignee: assignee ?? null,
      estimate_hours: estimate ?? null,
      due_date: dueDate ?? null,
    };

    void firstValueFrom(this.cardsApi.createSubtask(cardId, request))
      .then((response) => {
        const mapped = mapSubtaskFromResponse(response);
        this.replaceSubtask(cardId, placeholderId, mapped);
      })
      .catch((error) => {
        this.logger.error('WorkspaceStore', error);
        this.removeSubtaskLocal(cardId, placeholderId);
      });
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
    const card = this.getCard(cardId);
    if (!card) {
      return;
    }

    const existing = card.subtasks.find((subtask) => subtask.id === subtaskId);
    if (!existing) {
      return;
    }

    const updates: Partial<Writable<Subtask>> = {};
    const payload: SubtaskUpdateRequest = {};

    if ('title' in changes && changes.title !== undefined) {
      const title = changes.title.trim();
      if (title && title !== existing.title) {
        updates.title = title;
        payload.title = title;
      }
    }

    if ('assignee' in changes) {
      const normalized = changes.assignee?.trim();
      const assignee = normalized && normalized.length > 0 ? normalized : undefined;
      if (assignee !== existing.assignee) {
        updates.assignee = assignee;
        payload.assignee = assignee ?? null;
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
        estimate = existing.estimateHours;
      }
      if (estimate !== existing.estimateHours) {
        updates.estimateHours = estimate;
        payload.estimate_hours = estimate ?? null;
      }
    }

    if ('dueDate' in changes) {
      const raw = changes.dueDate?.trim();
      const dueDate = raw && raw.length > 0 ? raw : undefined;
      if (dueDate !== existing.dueDate) {
        updates.dueDate = dueDate;
        payload.due_date = dueDate ?? null;
      }
    }

    if ('status' in changes && changes.status && changes.status !== existing.status) {
      updates.status = changes.status;
      payload.status = changes.status;
    }

    if (!this.payloadHasChanges(payload)) {
      return;
    }

    this.cardsSignal.update((cards) =>
      cards.map((item) => {
        if (item.id !== cardId) {
          return item;
        }

        const subtasks = item.subtasks.map((subtask) =>
          subtask.id === subtaskId ? ({ ...subtask, ...updates } satisfies Subtask) : subtask,
        );

        return { ...item, subtasks } satisfies Card;
      }),
    );

    void firstValueFrom(this.cardsApi.updateSubtask(cardId, subtaskId, payload))
      .then((response) => {
        const mapped = mapSubtaskFromResponse(response);
        this.replaceSubtask(cardId, subtaskId, mapped);
      })
      .catch((error) => {
        this.logger.error('WorkspaceStore', error);
        this.replaceSubtask(cardId, subtaskId, existing);
      });
  };

  /**
   * Deletes a subtask from the specified card.
   *
   * @param cardId - Identifier of the parent card.
   * @param subtaskId - Identifier of the subtask to remove.
   */
  public readonly removeSubtask = (cardId: string, subtaskId: string): void => {
    const removed = this.removeSubtaskLocal(cardId, subtaskId);
    if (!removed) {
      return;
    }

    void firstValueFrom(this.cardsApi.deleteSubtask(cardId, subtaskId)).catch((error) => {
      this.logger.error('WorkspaceStore', error);
      this.insertSubtask(cardId, removed.subtask, removed.index);
    });
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
      const mapped = mapCardFromResponse(response, fallbackStatusId);
      const confidence =
        payload.confidenceDisplay !== undefined
          ? payload.confidenceDisplay
          : normalizeProposalConfidence(mapped.confidence ?? 0);
      const card = {
        ...mapped,
        confidence,
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
    const sanitized = labelIds
      .map((labelId) => sanitizeString(labelId))
      .filter((labelId): labelId is string => Boolean(labelId));
    const uniqueIds = unique(sanitized);

    const card = this.getCard(cardId);
    if (!card || arraysEqual(card.labelIds, uniqueIds)) {
      return;
    }

    this.persistCardUpdate(cardId, { labelIds: uniqueIds }, { label_ids: uniqueIds });
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
  public readonly addLabel = async (payload: { name: string; color: string }): Promise<void> => {
    const name = payload.name.trim();
    if (!name) {
      return;
    }

    try {
      await firstValueFrom(this.workspaceConfigApi.createLabel({ name, color: payload.color }));
      await this.refreshWorkspaceConfig(true);
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
      throw error;
    }
  };

  /**
   * Removes a label from the workspace configuration.
   *
   * @param labelId - Identifier of the label to delete.
   * @returns True when the label was removed.
   */
  public readonly removeLabel = async (labelId: string): Promise<boolean> => {
    const existed = this.settingsSignal().labels.some((label) => label.id === labelId);
    if (!existed) {
      return false;
    }

    try {
      await firstValueFrom(this.workspaceConfigApi.deleteLabel(labelId));
      const updated = await this.refreshWorkspaceConfig(true);
      return !updated.labels.some((label) => label.id === labelId);
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
      throw error;
    }
  };

  /**
   * Adds a new status lane to the workspace configuration.
   *
   * @param payload - Status name and lifecycle category.
   */
  public readonly addStatus = async (payload: {
    name: string;
    category: 'todo' | 'in-progress' | 'done';
    color: string;
  }): Promise<void> => {
    const name = payload.name.trim();
    if (!name) {
      return;
    }

    const currentOrders = this.settingsSignal().statuses.map((status) => status.order);
    const nextOrder = currentOrders.length === 0 ? 1 : Math.max(...currentOrders) + 1;

    try {
      await firstValueFrom(
        this.workspaceConfigApi.createStatus({
          name,
          category: payload.category,
          color: payload.color,
          order: nextOrder,
        }),
      );
      await this.refreshWorkspaceConfig(true);
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
      throw error;
    }
  };

  /**
   * Removes an existing status column from the workspace.
   *
   * @param statusId - Identifier of the status to delete.
   * @returns Identifier of the fallback status applied to affected cards.
   */
  public readonly removeStatus = async (statusId: string): Promise<string | null> => {
    const existed = this.settingsSignal().statuses.some((status) => status.id === statusId);
    if (!existed) {
      return null;
    }

    try {
      await firstValueFrom(this.workspaceConfigApi.deleteStatus(statusId));
      const settings = await this.refreshWorkspaceConfig(true);
      return settings.statuses.length > 0 ? settings.defaultStatusId : null;
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
      throw error;
    }
  };

  /**
   * Registers a new template available for analyzer driven proposals.
   *
   * @param payload - Template information collected from settings forms.
   */
  public readonly addTemplate = async (payload: {
    name: string;
    description: string;
    defaultStatusId: string;
    defaultLabelIds: readonly string[];
    confidenceThreshold: number;
    fieldVisibility: TemplateFieldVisibility;
  }): Promise<void> => {
    const name = payload.name.trim();
    if (!name) {
      return;
    }

    const request = {
      name,
      description: payload.description.trim(),
      default_status_id: payload.defaultStatusId,
      default_label_ids: payload.defaultLabelIds,
      confidence_threshold: clampConfidence(payload.confidenceThreshold),
      field_visibility: {
        show_story_points: payload.fieldVisibility.showStoryPoints,
        show_due_date: payload.fieldVisibility.showDueDate,
        show_assignee: payload.fieldVisibility.showAssignee,
        show_confidence: payload.fieldVisibility.showConfidence,
      },
    };

    try {
      await firstValueFrom(this.workspaceConfigApi.createTemplate(request));
      await this.refreshWorkspaceConfig(true);
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
      throw error;
    }
  };

  /**
   * Applies updates to an existing template.
   *
   * @param templateId - Target template identifier.
   * @param changes - Partial template payload.
   */
  public readonly updateTemplate = async (
    templateId: string,
    changes: Partial<Omit<TemplatePreset, 'id'>>,
  ): Promise<void> => {
    const updatePayload: Record<string, unknown> = {};

    if (Object.prototype.hasOwnProperty.call(changes, 'name')) {
      updatePayload['name'] = changes.name ? changes.name.trim() : (changes.name ?? '');
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'description')) {
      updatePayload['description'] = changes.description
        ? changes.description.trim()
        : (changes.description ?? '');
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'defaultStatusId')) {
      updatePayload['default_status_id'] = changes.defaultStatusId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'defaultLabelIds')) {
      updatePayload['default_label_ids'] = changes.defaultLabelIds ?? [];
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'confidenceThreshold')) {
      const threshold = changes.confidenceThreshold;
      updatePayload['confidence_threshold'] =
        typeof threshold === 'number' ? clampConfidence(threshold) : threshold;
    }

    if (Object.prototype.hasOwnProperty.call(changes, 'fieldVisibility')) {
      const visibility = changes.fieldVisibility;
      if (visibility) {
        updatePayload['field_visibility'] = {
          show_story_points: visibility.showStoryPoints,
          show_due_date: visibility.showDueDate,
          show_assignee: visibility.showAssignee,
          show_confidence: visibility.showConfidence,
        };
      } else {
        updatePayload['field_visibility'] = null;
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return;
    }

    try {
      await firstValueFrom(this.workspaceConfigApi.updateTemplate(templateId, updatePayload));
      await this.refreshWorkspaceConfig(true);
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
      throw error;
    }
  };

  /**
   * Removes a template from the workspace configuration.
   *
   * @param templateId - Identifier of the template to delete.
   */
  public readonly removeTemplate = async (templateId: string): Promise<void> => {
    const existed = this.settingsSignal().templates.some((template) => template.id === templateId);
    if (!existed) {
      return;
    }

    try {
      await firstValueFrom(this.workspaceConfigApi.deleteTemplate(templateId));
      await this.refreshWorkspaceConfig(true);
      this.cardsSignal.update((cards) =>
        cards.map((card) =>
          card.templateId === templateId ? { ...card, templateId: null } : card,
        ),
      );
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
      throw error;
    }
  };

  private async refreshWorkspaceConfig(force = false): Promise<WorkspaceSettings> {
    if (!force && this.configRequest) {
      return this.configRequest;
    }

    const userId = this.activeUserId();
    if (!userId) {
      const defaults = cloneSettings(INITIAL_SETTINGS);
      this.settingsSignal.set(defaults);
      this.persistSettings(defaults);
      this.reconcileCardsForSettings(defaults);
      this.reconcileFiltersForSettings(defaults, false);
      return defaults;
    }

    const loadPromise = (async () => {
      try {
        const [statusResponses, labelResponses, templateResponses] = await Promise.all([
          firstValueFrom(this.workspaceConfigApi.listStatuses()),
          firstValueFrom(this.workspaceConfigApi.listLabels()),
          firstValueFrom(this.workspaceConfigApi.listTemplates()),
        ]);

        const statuses = statusResponses
          .map((response) => mapStatusResponse(response))
          .sort((left, right) =>
            left.order === right.order
              ? left.name.localeCompare(right.name)
              : left.order - right.order,
          );
        const labels = labelResponses
          .map((response) => mapLabelResponse(response))
          .sort((left, right) => left.name.localeCompare(right.name));

        const currentSettings = this.settingsSignal();
        const allowedStatusIds = new Set(statuses.map((status) => status.id));
        const allowedLabelIds = new Set(labels.map((label) => label.id));
        const defaultStatusFallback = determineDefaultStatusId(
          statuses,
          currentSettings.defaultStatusId,
        );
        const templates = templateResponses
          .map((response) =>
            mapTemplateResponse(response, allowedStatusIds, allowedLabelIds, defaultStatusFallback),
          )
          .filter((template): template is TemplatePreset => template !== null)
          .sort((left, right) => left.name.localeCompare(right.name));

        const defaultStatusId = allowedStatusIds.has(currentSettings.defaultStatusId)
          ? currentSettings.defaultStatusId
          : defaultStatusFallback;

        const next: WorkspaceSettings = {
          ...currentSettings,
          statuses,
          labels,
          templates,
          defaultStatusId,
        };

        this.settingsSignal.set(next);
        this.persistSettings(next);
        this.reconcileCardsForSettings(next);
        this.reconcileFiltersForSettings(next);

        return next;
      } catch (error) {
        this.logger.error('WorkspaceStore', error);
        throw error;
      }
    })();

    this.configRequest = loadPromise;
    try {
      return await loadPromise;
    } finally {
      this.configRequest = null;
    }
  }

  public readonly refreshWorkspaceData = async (): Promise<void> => {
    const userId = this.activeUserId();

    if (!userId) {
      this.activeCardRequestToken += 1;
      this.cardsSignal.set([]);
      await this.refreshWorkspaceConfig(true);
      return;
    }

    try {
      await this.refreshWorkspaceConfig(true);
    } catch {
      // Errors are already logged inside refreshWorkspaceConfig.
    } finally {
      await this.fetchCards();
    }
  };

  private fetchCards(): Promise<void> {
    const requestToken = ++this.activeCardRequestToken;

    return firstValueFrom(this.cardsApi.listCards())
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

  private payloadHasChanges(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    return Object.values(payload as Record<string, unknown>).some((value) => value !== undefined);
  }

  private persistCardUpdate(
    cardId: string,
    updates: Partial<Writable<Card>>,
    payload: CardUpdateRequest,
  ): void {
    if (!this.payloadHasChanges(payload)) {
      return;
    }

    const previous = this.getCard(cardId);
    if (!previous) {
      return;
    }

    let mutated = false;
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        mutated = true;
        return { ...card, ...updates } satisfies Card;
      }),
    );

    if (!mutated) {
      return;
    }

    void firstValueFrom(this.cardsApi.updateCard(cardId, payload))
      .then((response) => this.mergeCardResponse(response))
      .catch((error) => {
        this.logger.error('WorkspaceStore', error);
        this.restoreCard(cardId, previous);
      });
  }

  private mergeCardResponse(response: CardResponse): void {
    const fallbackStatusId = this.settingsSignal().defaultStatusId;
    const mapped = mapCardFromResponse(response, fallbackStatusId);

    this.cardsSignal.update((cards) =>
      cards.map((card) =>
        card.id === mapped.id
          ? ({
              ...mapped,
              templateId: card.templateId,
              comments: card.comments,
              activities: card.activities,
              originSuggestionId: card.originSuggestionId,
            } satisfies Card)
          : card,
      ),
    );
  }

  private replaceSubtask(cardId: string, subtaskId: string, replacement: Subtask): void {
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const subtasks = card.subtasks.map((subtask) =>
          subtask.id === subtaskId ? replacement : subtask,
        );
        return { ...card, subtasks } satisfies Card;
      }),
    );
  }

  private removeSubtaskLocal(
    cardId: string,
    subtaskId: string,
  ): { subtask: Subtask; index: number } | null {
    let removed: { subtask: Subtask; index: number } | null = null;

    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const index = card.subtasks.findIndex((subtask) => subtask.id === subtaskId);
        if (index === -1) {
          return card;
        }

        removed = { subtask: card.subtasks[index], index };
        const subtasks = card.subtasks.filter((subtask) => subtask.id !== subtaskId);
        return { ...card, subtasks } satisfies Card;
      }),
    );

    return removed;
  }

  private replaceComment(cardId: string, commentId: string, replacement: CardComment): void {
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const comments = card.comments.map((comment) =>
          comment.id === commentId ? replacement : comment,
        );

        return { ...card, comments } satisfies Card;
      }),
    );
  }

  private removeCommentLocal(
    cardId: string,
    commentId: string,
  ): { comment: CardComment; index: number } | null {
    let removed: { comment: CardComment; index: number } | null = null;

    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const index = card.comments.findIndex((comment) => comment.id === commentId);
        if (index === -1) {
          return card;
        }

        removed = { comment: card.comments[index], index };
        const comments = card.comments.filter((comment) => comment.id !== commentId);
        return { ...card, comments } satisfies Card;
      }),
    );

    return removed;
  }

  private insertComment(cardId: string, comment: CardComment, index?: number): void {
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const comments = [...card.comments];
        const insertionIndex = index ?? comments.length;
        comments.splice(insertionIndex, 0, comment);
        return { ...card, comments } satisfies Card;
      }),
    );
  }

  private insertSubtask(cardId: string, subtask: Subtask, index?: number): void {
    this.cardsSignal.update((cards) =>
      cards.map((card) => {
        if (card.id !== cardId) {
          return card;
        }

        const subtasks = [...card.subtasks];
        const insertionIndex = index ?? subtasks.length;
        subtasks.splice(insertionIndex, 0, subtask);
        return { ...card, subtasks } satisfies Card;
      }),
    );
  }

  private restoreCard(cardId: string, snapshot: Card): void {
    this.cardsSignal.update((cards) => cards.map((card) => (card.id === cardId ? snapshot : card)));
  }

  private applyWorkspaceMetadata(statuses: readonly Status[], labels: readonly Label[]): void {
    if (statuses.length === 0 && labels.length === 0) {
      return;
    }

    let updatedSettings: WorkspaceSettings | null = null;

    this.settingsSignal.update((current) => {
      const nextStatuses = current.statuses.length > 0 ? current.statuses : statuses;
      const nextLabels = current.labels.length > 0 ? current.labels : labels;

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

  private applyUserContext(userId: string | null): void {
    this.lastAppliedUserId = userId;
    const settings = this.loadSettings(userId);
    const preferences = this.loadPreferences(userId, settings);

    this.settingsSignal.set(settings);
    this.groupingSignal.set(preferences.grouping);
    this.filtersSignal.set(preferences.filters);
    this.reconcileCardsForSettings(settings);
    this.reconcileFiltersForSettings(settings, false);
    void this.refreshBoardPreferences(userId, settings);

    if (userId !== this.lastConfigUserId) {
      this.lastConfigUserId = userId;
      void this.refreshWorkspaceConfig(true);
    }
  }

  private bindAuthSetUserPatch(): void {
    const auth = this.auth as { setUser?: AuthSetUserFn };
    if (typeof auth.setUser !== 'function') {
      return;
    }

    const prototype = Object.getPrototypeOf(auth) as {
      setUser: AuthSetUserFn;
      [AUTH_SET_USER_ORIGINAL]?: AuthSetUserFn;
    } | null;

    if (!prototype) {
      return;
    }

    const original = prototype[AUTH_SET_USER_ORIGINAL] ?? prototype.setUser;
    prototype[AUTH_SET_USER_ORIGINAL] = original;
    const handleAuthUserUpdate = this.handleAuthUserUpdate.bind(this);
    prototype.setUser = function patchedSetUser(
      this: unknown,
      user: AuthenticatedUser | null,
    ): void {
      original.call(this, user);
      handleAuthUserUpdate(user);
    };
  }

  private handleAuthUserUpdate(user: AuthenticatedUser | null): void {
    const userId = user?.id ?? null;
    if (userId === this.lastAppliedUserId) {
      return;
    }

    this.applyUserContext(userId);
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

  private reconcileFiltersForSettings(settings: WorkspaceSettings, persistRemote = true): void {
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
      if (persistRemote) {
        this.persistPreferencesState(nextFilters, this.groupingSignal());
      } else {
        this.persistPreferences({
          grouping: this.groupingSignal(),
          filters: nextFilters,
        });
      }
    }
  }

  private async refreshBoardPreferences(
    userId: string | null,
    settings: WorkspaceSettings,
  ): Promise<void> {
    const token = ++this.preferencesRequestToken;
    if (!userId) {
      return;
    }

    try {
      const response = await firstValueFrom(this.boardLayoutsApi.getBoardLayout());
      if (token !== this.preferencesRequestToken) {
        return;
      }

      if (!this.hasRemoteBoardPreferences(response)) {
        this.applyCachedPreferences(userId, settings);
        return;
      }

      const preferences = this.sanitizeRemotePreferences(response, settings);
      this.persistPreferences(preferences, userId);

      if (this.groupingSignal() !== preferences.grouping) {
        this.groupingSignal.set(preferences.grouping);
      }

      if (!filtersEqual(this.filtersSignal(), preferences.filters)) {
        this.filtersSignal.set(preferences.filters);
      }
    } catch (error) {
      this.logger.error('WorkspaceStore', error);

      if (token !== this.preferencesRequestToken) {
        return;
      }

      this.applyCachedPreferences(userId, settings);
    }
  }

  private applyCachedPreferences(userId: string, settings: WorkspaceSettings): void {
    const cached = this.loadPreferences(userId, settings);

    if (this.groupingSignal() !== cached.grouping) {
      this.groupingSignal.set(cached.grouping);
    }

    if (!filtersEqual(this.filtersSignal(), cached.filters)) {
      this.filtersSignal.set(cached.filters);
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

  private persistPreferences(
    preferences: BoardPreferences,
    userId: string | null = this.activeUserId(),
  ): void {
    const storageUserId = this.resolveStorageUserId(userId);
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
    const preferences: BoardPreferences = {
      grouping,
      filters: cloneFilters(filters),
    };

    this.persistPreferences(preferences);
    void this.persistPreferencesRemote(preferences);
  }

  private async persistPreferencesRemote(preferences: BoardPreferences): Promise<void> {
    const user = this.auth.user();
    const userId = user?.id ?? null;
    if (!userId || userId === ANONYMOUS_STORAGE_USER_ID) {
      return;
    }

    try {
      await firstValueFrom(
        this.boardLayoutsApi.updateBoardLayout({
          board_grouping: preferences.grouping,
          board_layout: this.buildBoardLayoutPayload(preferences.filters),
        }),
      );
    } catch (error) {
      this.logger.error('WorkspaceStore', error);
    }
  }

  private buildBoardLayoutPayload(filters: BoardFilters): Record<string, unknown> {
    const cloned = cloneFilters(filters);
    const filterPayload = {
      search: cloned.search,
      labelIds: [...cloned.labelIds],
      statusIds: [...cloned.statusIds],
      quickFilters: [...cloned.quickFilters],
      label_ids: [...cloned.labelIds],
      status_ids: [...cloned.statusIds],
      quick_filters: [...cloned.quickFilters],
    } satisfies Record<string, unknown>;

    return { filters: filterPayload } satisfies Record<string, unknown>;
  }

  private hasRemoteBoardPreferences(response: BoardLayoutResponse | null): boolean {
    if (!response) {
      return false;
    }

    if (response.board_grouping !== null && response.board_grouping !== undefined) {
      return true;
    }

    return this.resolveBoardLayoutFilters(response.board_layout) !== undefined;
  }

  private sanitizeRemotePreferences(
    response: BoardLayoutResponse,
    settings: WorkspaceSettings,
  ): BoardPreferences {
    const defaults = this.buildDefaultPreferences();
    if (!response) {
      return defaults;
    }

    const rawPreferences: RawBoardPreferences = {
      grouping: response.board_grouping ?? undefined,
      filters: this.resolveBoardLayoutFilters(response.board_layout),
    };

    const sanitized = this.sanitizePreferences(rawPreferences, settings);
    return {
      grouping: sanitized.grouping,
      filters: cloneFilters(sanitized.filters),
    } satisfies BoardPreferences;
  }

  private resolveBoardLayoutFilters(layout: unknown): unknown {
    if (!layout || typeof layout !== 'object') {
      return undefined;
    }

    const record = layout as Record<string, unknown>;
    if ('filters' in record) {
      return record['filters'];
    }

    if (
      'search' in record ||
      'labelIds' in record ||
      'label_ids' in record ||
      'statusIds' in record ||
      'status_ids' in record ||
      'quickFilters' in record ||
      'quick_filters' in record
    ) {
      return record;
    }

    return undefined;
  }

  private sanitizePreferences(raw: unknown, settings: WorkspaceSettings): BoardPreferences {
    const defaults = this.buildDefaultPreferences();
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const record = raw as RawBoardPreferences;
    const grouping =
      record.grouping === 'status' || record.grouping === 'label' || record.grouping === 'assignee'
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
    const statusSource = record.statusIds ?? record.status_ids;
    const labelSource = record.labelIds ?? record.label_ids;
    const quickFiltersSource = record.quickFilters ?? record.quick_filters;
    const statusIds = this.sanitizeFilterIds(statusSource, allowedStatusIds);
    const labelIds = this.sanitizeFilterIds(labelSource, allowedLabelIds);
    const quickFilters = this.sanitizeQuickFilters(quickFiltersSource);

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

    const entries = value.filter((entry): entry is string => typeof entry === 'string');
    if (entries.length === 0) {
      return [];
    }

    if (allowed.size === 0) {
      return unique(entries);
    }

    const filtered = entries.filter((entry) => allowed.has(entry));
    if (filtered.length === 0) {
      return [];
    }

    return unique(filtered);
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
    const defaultAssigneeInput =
      typeof data.defaultAssignee === 'string' ? data.defaultAssignee.trim() : '';
    const defaultAssignee =
      defaultAssigneeInput.length > 0 && defaultAssigneeInput !== '匿名ユーザー'
        ? defaultAssigneeInput
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
    const confidenceThreshold = normalizeTemplateThreshold(
      record.confidenceThreshold,
      DEFAULT_TEMPLATE_CONFIDENCE_THRESHOLD,
    );
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
