import { Injectable, computed, signal } from '@angular/core';

import {
  AnalysisProposal,
  BoardColumnView,
  BoardFilters,
  BoardGrouping,
  Card,
  WorkspaceSettings,
  WorkspaceSummary,
} from '@core/models';
import { createId } from '@core/utils/create-id';
import { INITIAL_CARDS, INITIAL_SETTINGS } from './workspace-fixtures';

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
  private readonly groupingSignal = signal<BoardGrouping>('status');
  private readonly filtersSignal = signal<BoardFilters>({ ...INITIAL_FILTERS });
  private readonly selectedCardIdSignal = signal<string | null>(null);

  public readonly settings = computed(() => this.settingsSignal());
  public readonly cards = computed(() => this.cardsSignal());
  public readonly grouping = computed(() => this.groupingSignal());
  public readonly filters = computed(() => this.filtersSignal());
  public readonly selectedCardId = computed(() => this.selectedCardIdSignal());

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

    const defaultStatus = this.settingsSignal().defaultStatusId;
    const defaultLabel = this.settingsSignal().labels[0]?.id ?? 'general';

    const mapped: Card[] = proposals.map((proposal) => ({
      id: createId(),
      title: proposal.title,
      summary: proposal.summary,
      statusId: proposal.suggestedStatusId || defaultStatus,
      labelIds:
        proposal.suggestedLabelIds.length > 0
          ? [...proposal.suggestedLabelIds]
          : [defaultLabel],
      priority: 'medium',
      storyPoints: 3,
      assignee: this.settingsSignal().defaultAssignee,
      confidence: proposal.confidence,
      subtasks: proposal.subtasks.map((task) => ({
        id: createId(),
        title: task,
        status: 'todo',
      })),
      comments: [],
      activities: [],
    }));

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
}
