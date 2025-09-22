import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

import { WorkspaceStore } from '@core/state/workspace-store';
import { BoardColumnView, Card, Label, Status, Subtask } from '@core/models';
import { createSignalForm } from '@lib/forms/signal-forms';

const DEFAULT_STATUS_COLOR = '#94a3b8';

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

const RESOLVED_SUBTASK_STATUSES = new Set<SubtaskStatus>(['done', 'non-issue']);

/**
 * Board page rendering grouped task cards with filtering controls.
 */
@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [CommonModule, DragDropModule],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPage {
  private readonly workspace = inject(WorkspaceStore);

  public readonly groupingSignal = this.workspace.grouping;
  public readonly columnsSignal = this.workspace.boardColumns;
  public readonly filtersSignal = this.workspace.filters;
  public readonly filteredCardsSignal = this.workspace.filteredCards;
  public readonly statusesSignal = computed(() => this.workspace.settings().statuses);
  public readonly labelsSignal = computed(() => this.workspace.settings().labels);

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

  /**
   * Opens the card detail drawer by storing selection state.
   *
   * @param cardId - Identifier for the selected card or null to close.
   */
  public readonly openCard = (cardId: string | null): void => {
    this.workspace.selectCard(cardId);
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

  public readonly labelName = (labelId: string): string => {
    const label = this.labelsByIdSignal().get(labelId);
    return label ? label.name : labelId;
  };
}
