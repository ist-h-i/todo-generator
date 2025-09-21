import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';

import { WorkspaceStore } from '@core/state/workspace-store';
import { BoardColumnView, BoardGrouping, Card, Label } from '@core/models';
import { createSignalForm } from '@lib/forms/signal-forms';

/**
 * Board page rendering grouped task cards with filtering controls.
 */
@Component({
  selector: 'app-board-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page.html',
  styleUrl: './page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BoardPage {
  private readonly workspace = inject(WorkspaceStore);

  public readonly groupingSignal = this.workspace.grouping;
  public readonly columnsSignal = this.workspace.boardColumns;
  public readonly filtersSignal = this.workspace.filters;
  public readonly statusesSignal = computed(() => this.workspace.settings().statuses);
  public readonly labelsSignal = computed(() => this.workspace.settings().labels);

  public readonly cardsById = computed(() => {
    const lookup = new Map<string, Card>();
    for (const card of this.workspace.cards()) {
      lookup.set(card.id, card);
    }
    return lookup;
  });

  public readonly labelsById = computed(() => {
    const lookup = new Map<string, Label>();
    for (const label of this.labelsSignal()) {
      lookup.set(label.id, label);
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

  public readonly selectedCard = computed(() => this.workspace.selectedCard());

  public readonly statusColor = (statusId: string): string => {
    const status = this.statusesSignal().find((item) => item.id === statusId);
    return status?.color ?? '#94a3b8';
  };

  public readonly columnAccent = (column: BoardColumnView): string => column.accent;

  public readonly statusName = (statusId: string): string => {
    const status = this.statusesSignal().find((item) => item.id === statusId);
    return status ? status.name : statusId;
  };

  public readonly labelName = (labelId: string): string => {
    const label = this.labelsById().get(labelId);
    return label ? label.name : labelId;
  };
}
