/**
 * Represents a comment attached to a task card.
 */
export interface CardComment {
  readonly id: string;
  readonly authorId?: string;
  readonly authorNickname: string;
  readonly message: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly subtaskId?: string;
}

/**
 * Represents a subtask belonging to a parent card.
 */
export interface Subtask {
  readonly id: string;
  readonly title: string;
  readonly status: 'todo' | 'in-progress' | 'done' | 'non-issue';
  readonly assignee?: string;
  readonly estimateHours?: number;
  readonly dueDate?: string;
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
  readonly templateId?: string | null;
  readonly priority: 'low' | 'medium' | 'high' | 'urgent';
  readonly storyPoints: number;
  readonly createdAt: string;
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
