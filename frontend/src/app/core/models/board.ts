/**
 * View grouping applied to the board.
 */
export type BoardGrouping = 'status' | 'label';

/**
 * Filters available for board searching.
 */
export interface BoardFilters {
  readonly search: string;
  readonly labelIds: readonly string[];
  readonly statusIds: readonly string[];
}

/**
 * Summary metrics shown across the shell and analytics page.
 */
export interface WorkspaceSummary {
  readonly totalCards: number;
  readonly doneCards: number;
  readonly progressRatio: number;
  readonly activeLabels: number;
}

/**
 * Column view model consumed by the board page.
 */
export interface BoardColumnView {
  readonly id: string;
  readonly title: string;
  readonly accent: string;
  readonly count: number;
  readonly cards: readonly string[];
}
