import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';

import { WorkspaceStore } from '@core/state/workspace-store';
import { BoardColumnView, BoardGrouping, Card, Label, Status } from '@core/models';
import { createSignalForm } from '@lib/forms/signal-forms';

const DEFAULT_STATUS_COLOR = '#94a3b8';

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

  public readonly summarySignal = this.workspace.summary;
  public readonly groupingSignal = this.workspace.grouping;
  public readonly columnsSignal = this.workspace.boardColumns;
  public readonly filtersSignal = this.workspace.filters;
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

  public readonly searchForm = createSignalForm({ search: '' });

  /**
   * Updates the board grouping signal.
   *
   * @param grouping - Desired grouping.
   */
  public readonly selectGrouping = (grouping: BoardGrouping): void => {
    this.workspace.setGrouping(grouping);
  };

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

  public readonly selectedCardSignal = this.workspace.selectedCard;

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
