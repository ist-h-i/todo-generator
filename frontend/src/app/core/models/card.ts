/**
 * Represents a comment attached to a task card.
 */
export interface CardComment {
  readonly id: string;
  readonly author: string;
  readonly message: string;
  readonly createdAt: string;
}

/**
 * Represents a subtask belonging to a parent card.
 */
export interface Subtask {
  readonly id: string;
  readonly title: string;
  readonly status: 'todo' | 'in-progress' | 'done';
  readonly assignee?: string;
  readonly estimateHours?: number;
}

/**
 * Activity event describing a mutation to a card.
 */
export interface CardActivity {
  readonly id: string;
  readonly message: string;
  readonly createdAt: string;
}

/**
 * Canonical card record used across the workspace features.
 */
export interface Card {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly statusId: string;
  readonly labelIds: readonly string[];
  readonly priority: 'low' | 'medium' | 'high' | 'urgent';
  readonly storyPoints: number;
  readonly startDate?: string;
  readonly dueDate?: string;
  readonly assignee?: string;
  readonly confidence?: number;
  readonly subtasks: readonly Subtask[];
  readonly comments: readonly CardComment[];
  readonly activities: readonly CardActivity[];
  readonly originSuggestionId?: string;
  readonly initiativeId?: string;
}
