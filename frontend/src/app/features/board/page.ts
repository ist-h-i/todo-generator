import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { PageHeaderComponent } from '@shared/ui/page-header/page-header';

import { WorkspaceStore } from '@core/state/workspace-store';
import {
  BoardColumnView,
  BoardGrouping,
  BoardQuickFilter,
  Card,
  CardComment,
  Label,
  Status,
  Subtask,
} from '@core/models';
import { createSignalForm } from '@lib/forms/signal-forms';

const DEFAULT_STATUS_COLOR = '#94a3b8';

interface QuickFilterOption {
  readonly id: BoardQuickFilter;
  readonly label: string;
  readonly description: string;
}

const QUICK_FILTER_OPTIONS: readonly QuickFilterOption[] = [
  {
    id: 'myAssignments',
    label: '自分の担当',
    description: 'ワークスペースのデフォルト担当者に割り当てられたカードだけを表示します。',
  },
  {
    id: 'dueSoon',
    label: '期限が近い',
    description: '期限日が7日以内、または直近で期限切れのカードを抽出します。',
  },
  {
    id: 'recentlyCreated',
    label: '最近作成',
    description: '直近14日以内に作成された新しいカードだけを表示します。',
  },
  {
    id: 'highPriority',
    label: '重要タスク',
    description: '優先度が高または緊急に設定されたカードに絞り込みます。',
  },
  {
    id: 'noAssignee',
    label: '担当未設定',
    description: '担当者がまだ割り当てられていないカードを見つけます。',
  },
];

const QUICK_FILTER_LABEL_LOOKUP = new Map(
  QUICK_FILTER_OPTIONS.map((option) => [option.id, option.label] as const),
);

const PRIORITY_LABEL_LOOKUP: Record<Card['priority'], string> = {
  low: '低',
  medium: '中',
  high: '高',
  urgent: '緊急',
};

interface CardFormState {
  readonly title: string;
  readonly summary: string;
  readonly statusId: string;
  readonly assignee: string;
  readonly storyPoints: string;
  readonly priority: Card['priority'];
}

type SubtaskStatus = Subtask['status'];

interface SubtaskStatusMeta {
  readonly id: SubtaskStatus;
  readonly title: string;
  readonly accent: string;
}

interface SubtaskCardView {
  readonly id: string;
  readonly title: string;
  readonly parentId: string;
  readonly parentTitle: string;
  readonly parentLabels: readonly string[];
  readonly status: SubtaskStatus;
  readonly assignee?: string;
  readonly estimateHours?: number;
  readonly dueDate?: string;
  readonly highlight: boolean;
  readonly isCompact: boolean;
}

interface SubtaskColumnView {
  readonly id: SubtaskStatus;
  readonly title: string;
  readonly accent: string;
  readonly subtasks: readonly SubtaskCardView[];
}

const SUBTASK_STATUS_META: readonly SubtaskStatusMeta[] = [
  { id: 'todo', title: '未着手', accent: '#94a3b8' },
  { id: 'in-progress', title: '進行中', accent: '#2563eb' },
  { id: 'done', title: '完了', accent: '#16a34a' },
  { id: 'non-issue', title: 'NonIssue', accent: '#f59e0b' },
];

const SUBTASK_STATUS_META_LOOKUP = new Map(
  SUBTASK_STATUS_META.map((meta) => [meta.id, meta] as const),
);

const RESOLVED_SUBTASK_STATUSES = new Set<SubtaskStatus>(['done', 'non-issue']);

/**
 * Board page rendering grouped task cards with filtering controls.
 */
@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [CommonModule, DragDropModule, PageHeaderComponent],
  templateUrl: './page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPage {
  private readonly workspace = inject(WorkspaceStore);

  public constructor() {
    void this.workspace.refreshWorkspaceData();
  }

  public readonly groupingSignal = this.workspace.grouping;
  public readonly groupingLabelSignal = computed(() =>
    this.groupingSignal() === 'status' ? 'ステータス別' : 'ラベル別',
  );
  public readonly columnsSignal = this.workspace.boardColumns;
  public readonly filtersSignal = this.workspace.filters;
  public readonly filteredCardsSignal = this.workspace.filteredCards;
  public readonly statusesSignal = computed(() => this.workspace.settings().statuses);
  public readonly labelsSignal = computed(() => this.workspace.settings().labels);
  public readonly quickFilters = QUICK_FILTER_OPTIONS;

  public readonly cardsByIdSignal = computed<ReadonlyMap<string, Card>>(() => {
    const lookup = new Map<string, Card>();
    for (const card of this.workspace.cards()) {
      lookup.set(card.id, card);
    }
    return lookup;
  });

  public readonly labelsByIdSignal = computed<ReadonlyMap<string, Label>>(() => {
    const lookup = new Map<string, Label>();
    for (const label of this.labelsSignal()) {
      lookup.set(label.id, label);
    }
    return lookup;
  });

  public readonly statusesByIdSignal = computed<ReadonlyMap<string, Status>>(() => {
    const lookup = new Map<string, Status>();
    for (const status of this.statusesSignal()) {
      lookup.set(status.id, status);
    }
    return lookup;
  });

  public readonly isSubtaskResolved = (subtask: Subtask): boolean =>
    RESOLVED_SUBTASK_STATUSES.has(subtask.status);

  public readonly isCardResolved = (card: Card): boolean =>
    card.subtasks.length > 0 && card.subtasks.every((task) => this.isSubtaskResolved(task));

  public readonly subtaskColumnsSignal = computed<SubtaskColumnView[]>(() => {
    const cards = this.filteredCardsSignal();
    const selectedCardId = this.workspace.selectedCardId();

    return SUBTASK_STATUS_META.map((meta) => {
      const subtasks: SubtaskCardView[] = [];

      for (const card of cards) {
        for (const subtask of card.subtasks) {
          if (subtask.status !== meta.id) {
            continue;
          }

          subtasks.push({
            id: subtask.id,
            title: subtask.title,
            parentId: card.id,
            parentTitle: card.title,
            parentLabels: card.labelIds,
            status: subtask.status,
            assignee: subtask.assignee,
            estimateHours: subtask.estimateHours,
            dueDate: subtask.dueDate,
            highlight: card.id === selectedCardId,
            isCompact: this.isSubtaskResolved(subtask),
          });
        }
      }

      return {
        id: meta.id,
        title: meta.title,
        accent: meta.accent,
        subtasks,
      } satisfies SubtaskColumnView;
    });
  });

  public readonly searchForm = createSignalForm({ search: '' });

  public readonly cardForm = createSignalForm({
    title: '',
    summary: '',
    statusId: '',
    assignee: '',
    storyPoints: '',
    priority: 'medium' as Card['priority'],
  });

  public readonly newSubtaskForm = createSignalForm({
    title: '',
    assignee: '',
    estimateHours: '',
    dueDate: '',
    status: 'todo' as SubtaskStatus,
  });

  private readonly syncSearchFormEffect = effect(() => {
    const search = this.filtersSignal().search;
    const currentValue = this.searchForm.controls.search.value();
    if (currentValue === search) {
      return;
    }

    this.searchForm.controls.search.setValue(search);
  });

  private readonly commentDraftsState = signal<Record<string, string>>({ card: '' });
  private readonly editingCommentState = signal<{ id: string; contextId: string } | null>(null);
  public readonly commentAuthorNameSignal = this.workspace.commentAuthorName;

  public readonly commentsByContextSignal = computed<ReadonlyMap<string, readonly CardComment[]>>(
    () => {
      const active = this.selectedCardSignal();
      const grouped = new Map<string, CardComment[]>();

      if (!active) {
        return grouped;
      }

      for (const comment of active.comments) {
        const contextId = comment.subtaskId ?? 'card';
        const bucket = grouped.get(contextId);
        if (bucket) {
          bucket.push(comment);
        } else {
          grouped.set(contextId, [comment]);
        }
      }

      return grouped;
    },
  );

  public readonly orphanedSubtaskCommentsSignal = computed<readonly CardComment[]>(() => {
    const active = this.selectedCardSignal();

    if (!active) {
      return [];
    }

    const existingSubtaskIds = new Set(active.subtasks.map((subtask) => subtask.id));

    const orphaned: CardComment[] = [];
    for (const comment of active.comments) {
      if (comment.subtaskId && !existingSubtaskIds.has(comment.subtaskId)) {
        orphaned.push(comment);
      }
    }

    return orphaned;
  });

  private lastCardFormBaseline: CardFormState | null = null;
  private lastSelectedCardId: string | null = null;

  private areCardFormStatesEqual(left: CardFormState, right: CardFormState): boolean {
    return (
      left.title === right.title &&
      left.summary === right.summary &&
      left.statusId === right.statusId &&
      left.assignee === right.assignee &&
      left.storyPoints === right.storyPoints &&
      left.priority === right.priority
    );
  }

  public readonly isCardFormValid = (): boolean => {
    const snapshot = this.cardForm.value();
    return snapshot.title.trim().length > 0 && snapshot.statusId.trim().length > 0;
  };

  public readonly isNewSubtaskFormValid = (): boolean =>
    this.newSubtaskForm.controls.title.value().trim().length > 0;

  public readonly quickFilterSummarySignal = computed(() => {
    const active = this.filtersSignal().quickFilters;
    if (active.length === 0) {
      return 'なし';
    }

    return active.map((id) => QUICK_FILTER_LABEL_LOOKUP.get(id) ?? id).join(', ');
  });

  /**
   * Applies a text search filter to the board.
   *
   * @param value - User provided keyword.
   */
  public readonly updateSearch = (value: string): void => {
    this.searchForm.controls.search.setValue(value);
    this.workspace.updateFilters({ search: value });
  };

  /**
   * Clears all board filters.
   */
  public readonly clearFilters = (): void => {
    this.searchForm.reset({ search: '' });
    this.workspace.resetFilters();
  };

  public readonly toggleQuickFilter = (filter: BoardQuickFilter): void => {
    const current = new Set(this.filtersSignal().quickFilters);
    if (current.has(filter)) {
      current.delete(filter);
    } else {
      current.add(filter);
    }

    this.workspace.updateFilters({ quickFilters: Array.from(current) });
  };

  public readonly isQuickFilterActive = (filter: BoardQuickFilter): boolean =>
    this.filtersSignal().quickFilters.includes(filter);

  public readonly selectGrouping = (grouping: BoardGrouping): void => {
    this.workspace.setGrouping(grouping);
  };

  /**
   * Opens the card detail drawer by storing selection state.
   *
   * @param cardId - Identifier for the selected card or null to close.
   */
  public readonly openCard = (cardId: string | null): void => {
    this.workspace.selectCard(cardId);
  };

  /**
   * Requests confirmation before deleting the provided card.
   *
   * @param card - Card slated for deletion.
   */
  public readonly confirmDeleteCard = (card: Card): void => {
    const message = `カード「${card.title}」を削除しますか？この操作は取り消せません。`;
    if (window.confirm(message)) {
      this.workspace.removeCard(card.id);
    }
  };

  /**
   * Updates the status of a card from the inline menu.
   *
   * @param cardId - Card identifier to update.
   * @param statusId - New status value.
   */
  public readonly moveCard = (cardId: string, statusId: string): void => {
    this.workspace.updateCardStatus(cardId, statusId);
  };

  public readonly handleDrop = (columnId: string, event: CdkDragDrop<readonly string[]>): void => {
    if (this.groupingSignal() !== 'status') {
      return;
    }

    if (event.previousContainer === event.container) {
      return;
    }

    const cardId = event.item.data as string | undefined;
    if (!cardId) {
      return;
    }

    this.moveCard(cardId, columnId);
  };

  public readonly handleSubtaskDrop = (
    status: SubtaskStatus,
    event: CdkDragDrop<readonly SubtaskCardView[]>,
  ): void => {
    if (event.previousContainer === event.container) {
      return;
    }

    const data = event.item.data as SubtaskCardView | undefined;
    if (!data || data.status === status) {
      return;
    }

    this.workspace.updateSubtaskStatus(data.parentId, data.id, status);
  };

  public readonly selectedCardSignal = this.workspace.selectedCard;

  private readonly syncSelectedCardFormsEffect = effect(() => {
    const active = this.selectedCardSignal();
    const formSnapshot = this.cardForm.value();

    if (!active) {
      const statuses = this.statusesSignal();
      const fallback: CardFormState = {
        title: '',
        summary: '',
        statusId: statuses[0]?.id ?? '',
        assignee: '',
        storyPoints: '',
        priority: 'medium',
      };

      if (!this.areCardFormStatesEqual(formSnapshot, fallback)) {
        this.cardForm.reset(fallback);
      }
      this.lastCardFormBaseline = fallback;
      this.commentDraftsState.set({ card: '' });
      this.editingCommentState.set(null);
      this.newSubtaskForm.reset({
        title: '',
        assignee: '',
        estimateHours: '',
        dueDate: '',
        status: 'todo',
      });
      this.lastSelectedCardId = null;
      return;
    }

    const baseline: CardFormState = {
      title: active.title,
      summary: active.summary,
      statusId: active.statusId,
      assignee: active.assignee ?? '',
      storyPoints: active.storyPoints.toString(),
      priority: active.priority,
    };

    let baselineChanged = true;
    let hasUnsavedChanges = false;

    if (this.lastCardFormBaseline) {
      baselineChanged = !this.areCardFormStatesEqual(baseline, this.lastCardFormBaseline);
      hasUnsavedChanges = !this.areCardFormStatesEqual(formSnapshot, this.lastCardFormBaseline);
    }

    const selectedCardChanged = this.lastSelectedCardId !== active.id;

    if (selectedCardChanged || (!hasUnsavedChanges && baselineChanged)) {
      this.cardForm.reset(baseline);
      this.lastCardFormBaseline = baseline;
    } else if (baselineChanged && this.areCardFormStatesEqual(formSnapshot, baseline)) {
      this.lastCardFormBaseline = baseline;
    } else if (!this.lastCardFormBaseline) {
      this.lastCardFormBaseline = baseline;
    }

    if (selectedCardChanged) {
      this.commentDraftsState.set({ card: '' });
      this.editingCommentState.set(null);
      this.newSubtaskForm.reset({
        title: '',
        assignee: '',
        estimateHours: '',
        dueDate: '',
        status: 'todo',
      });
    }

    this.lastSelectedCardId = active.id;
  });

  public readonly saveCardDetails = (event: Event): void => {
    event.preventDefault();

    const active = this.selectedCardSignal();
    if (!active || !this.isCardFormValid()) {
      return;
    }

    const snapshot = this.cardForm.value();
    const title = snapshot.title.trim();
    const summary = snapshot.summary.trim();
    const statusId = snapshot.statusId.trim();
    const assignee = snapshot.assignee.trim();
    const storyPointsInput = snapshot.storyPoints.trim();
    const parsedStoryPoints = storyPointsInput.length > 0 ? Number(storyPointsInput) : undefined;

    this.workspace.updateCardDetails(active.id, {
      title,
      summary,
      statusId,
      priority: snapshot.priority,
      assignee: assignee.length > 0 ? assignee : undefined,
      storyPoints:
        parsedStoryPoints !== undefined && Number.isFinite(parsedStoryPoints)
          ? parsedStoryPoints
          : undefined,
    });
  };

  private readonly setCommentDraft = (contextId: string, value: string): void => {
    this.commentDraftsState.update((drafts) => ({ ...drafts, [contextId]: value }));
  };

  public readonly commentDraftValue = (contextId: string): string =>
    this.commentDraftsState()[contextId] ?? '';

  public readonly updateCommentDraft = (contextId: string, value: string): void => {
    this.setCommentDraft(contextId, value);
  };

  public readonly isCommentDraftValid = (contextId: string): boolean =>
    this.commentDraftValue(contextId).trim().length > 0;

  public readonly isContextBeingEdited = (contextId: string): boolean =>
    this.editingCommentState()?.contextId === contextId;

  public readonly commentsForContext = (contextId: string): readonly CardComment[] =>
    this.commentsByContextSignal().get(contextId) ?? [];

  public readonly startEditingComment = (comment: CardComment): void => {
    const contextId = comment.subtaskId ?? 'card';
    this.editingCommentState.set({ id: comment.id, contextId });
    this.setCommentDraft(contextId, comment.message);
  };

  public readonly cancelCommentEditing = (): void => {
    const editing = this.editingCommentState();
    if (!editing) {
      return;
    }

    this.editingCommentState.set(null);
    this.setCommentDraft(editing.contextId, '');
  };

  public readonly isCommentBeingEdited = (commentId: string): boolean =>
    this.editingCommentState()?.id === commentId;

  public readonly saveCommentForContext = (contextId: string, event: Event): void => {
    event.preventDefault();

    const active = this.selectedCardSignal();
    if (!active || !this.isCommentDraftValid(contextId)) {
      return;
    }

    const message = this.commentDraftValue(contextId).trim();
    const subtaskId = contextId === 'card' ? undefined : contextId;
    const editing = this.editingCommentState();

    if (editing && editing.contextId === contextId) {
      this.workspace.updateComment(active.id, editing.id, { message, subtaskId });
      this.editingCommentState.set(null);
    } else {
      this.workspace.addComment(active.id, { message, subtaskId });
    }

    this.setCommentDraft(contextId, '');
  };

  public readonly removeComment = (cardId: string, commentId: string): void => {
    const editing = this.editingCommentState();
    if (editing && editing.id === commentId) {
      this.cancelCommentEditing();
    }
    this.workspace.removeComment(cardId, commentId);
  };

  public readonly updateSubtaskTitle = (cardId: string, subtaskId: string, value: string): void => {
    const title = value.trim();
    if (!title) {
      return;
    }

    this.workspace.updateSubtaskDetails(cardId, subtaskId, { title });
  };

  public readonly updateSubtaskAssignee = (
    cardId: string,
    subtaskId: string,
    value: string,
  ): void => {
    const assignee = value.trim();
    this.workspace.updateSubtaskDetails(cardId, subtaskId, {
      assignee: assignee.length > 0 ? assignee : undefined,
    });
  };

  public readonly updateSubtaskEstimate = (
    cardId: string,
    subtaskId: string,
    value: string,
  ): void => {
    const raw = value.trim();
    if (!raw) {
      this.workspace.updateSubtaskDetails(cardId, subtaskId, { estimateHours: undefined });
      return;
    }

    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      return;
    }

    this.workspace.updateSubtaskDetails(cardId, subtaskId, { estimateHours: parsed });
  };

  public readonly updateSubtaskDueDate = (
    cardId: string,
    subtaskId: string,
    value: string,
  ): void => {
    const raw = value.trim();
    this.workspace.updateSubtaskDetails(cardId, subtaskId, {
      dueDate: raw.length > 0 ? raw : undefined,
    });
  };

  public readonly changeSubtaskStatus = (
    cardId: string,
    subtaskId: string,
    status: SubtaskStatus,
  ): void => {
    this.workspace.updateSubtaskStatus(cardId, subtaskId, status);
  };

  public readonly deleteSubtask = (cardId: string, subtaskId: string): void => {
    this.workspace.removeSubtask(cardId, subtaskId);
  };

  public readonly addSubtask = (event: Event): void => {
    event.preventDefault();

    const active = this.selectedCardSignal();
    if (!active || !this.isNewSubtaskFormValid()) {
      return;
    }

    const snapshot = this.newSubtaskForm.value();
    const title = snapshot.title.trim();
    const assignee = snapshot.assignee.trim();
    const rawEstimate = snapshot.estimateHours.trim();
    const rawDueDate = snapshot.dueDate.trim();
    const parsedEstimate = rawEstimate.length > 0 ? Number(rawEstimate) : undefined;

    this.workspace.addSubtask(active.id, {
      title,
      status: snapshot.status,
      assignee: assignee.length > 0 ? assignee : undefined,
      estimateHours:
        parsedEstimate !== undefined && Number.isFinite(parsedEstimate)
          ? parsedEstimate
          : undefined,
      dueDate: rawDueDate.length > 0 ? rawDueDate : undefined,
    });

    this.newSubtaskForm.reset({
      title: '',
      assignee: '',
      estimateHours: '',
      dueDate: '',
      status: snapshot.status,
    });
  };

  public readonly isActiveCard = (cardId: string): boolean =>
    this.workspace.selectedCardId() === cardId;

  public readonly statusColor = (statusId: string): string => {
    const status = this.statusesByIdSignal().get(statusId);
    return status?.color ?? DEFAULT_STATUS_COLOR;
  };

  public readonly columnAccent = (column: BoardColumnView): string => column.accent;

  public readonly statusName = (statusId: string): string => {
    const status = this.statusesByIdSignal().get(statusId);
    return status ? status.name : statusId;
  };

  public readonly subtaskStatusLabel = (status: SubtaskStatus): string =>
    SUBTASK_STATUS_META_LOOKUP.get(status)?.title ?? status;

  public readonly subtaskStatusAccent = (status: SubtaskStatus): string =>
    SUBTASK_STATUS_META_LOOKUP.get(status)?.accent ?? DEFAULT_STATUS_COLOR;

  public readonly priorityLabel = (priority: Card['priority']): string =>
    PRIORITY_LABEL_LOOKUP[priority] ?? priority;

  public readonly labelName = (labelId: string): string => {
    const label = this.labelsByIdSignal().get(labelId);
    return label ? label.name : labelId;
  };

  public readonly isLabelApplied = (card: Card, labelId: string): boolean =>
    card.labelIds.includes(labelId);

  public readonly handleLabelToggle = (card: Card, labelId: string, checked: boolean): void => {
    const labels = new Set(card.labelIds);
    if (checked) {
      labels.add(labelId);
    } else {
      labels.delete(labelId);
    }
    this.workspace.updateCardLabels(card.id, Array.from(labels));
  };
}
