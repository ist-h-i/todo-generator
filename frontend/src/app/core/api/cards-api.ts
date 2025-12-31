import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { buildApiUrl } from './api.config';

export interface CardStatusResponse {
  readonly id: string;
  readonly name?: string | null;
  readonly category?: string | null;
  readonly order?: number | null;
  readonly color?: string | null;
}

export interface CardLabelResponse {
  readonly id: string;
  readonly name?: string | null;
  readonly color?: string | null;
}

export interface SubtaskResponse {
  readonly id: string;
  readonly title: string;
  readonly status?: string | null;
  readonly assignee?: string | null;
  readonly estimate_hours?: number | null;
  readonly due_date?: string | null;
}

export interface SubtaskCreateRequest {
  title: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  assignee?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimate_hours?: number | null;
  story_points?: number | null;
  checklist?: readonly unknown[];
  ai_similarity_vector_id?: string | null;
}

export interface SubtaskUpdateRequest {
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  assignee?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  estimate_hours?: number | null;
  story_points?: number | null;
  checklist?: readonly unknown[];
  ai_similarity_vector_id?: string | null;
}

export interface CardCreateRequest {
  title: string;
  summary?: string | null;
  description?: string | null;
  status_id?: string | null;
  priority?: string | null;
  story_points?: number | null;
  estimate_hours?: number | null;
  assignees?: readonly string[];
  start_date?: string | null;
  due_date?: string | null;
  dependencies?: readonly string[];
  ai_confidence?: number | null;
  ai_notes?: string | null;
  generated_by?: string | null;
  custom_fields?: Readonly<Record<string, unknown>>;
  label_ids?: readonly string[];
  error_category_id?: string | null;
  initiative_id?: string | null;
  analytics_notes?: string | null;
  subtasks?: readonly SubtaskCreateRequest[];
}

export interface CardUpdateRequest {
  title?: string | null;
  summary?: string | null;
  description?: string | null;
  status_id?: string | null;
  priority?: string | null;
  story_points?: number | null;
  estimate_hours?: number | null;
  assignees?: readonly string[] | null;
  start_date?: string | null;
  due_date?: string | null;
  dependencies?: readonly string[] | null;
  ai_confidence?: number | null;
  ai_notes?: string | null;
  custom_fields?: Readonly<Record<string, unknown>> | null;
  label_ids?: readonly string[] | null;
  error_category_id?: string | null;
  initiative_id?: string | null;
  analytics_notes?: string | null;
}

export interface CardResponse {
  readonly id: string;
  readonly title: string;
  readonly summary?: string | null;
  readonly description?: string | null;
  readonly status_id?: string | null;
  readonly priority?: string | null;
  readonly story_points?: number | null;
  readonly estimate_hours?: number | null;
  readonly assignees?: readonly string[] | null;
  readonly start_date?: string | null;
  readonly due_date?: string | null;
  readonly dependencies?: readonly string[] | null;
  readonly ai_confidence?: number | null;
  readonly ai_notes?: string | null;
  readonly custom_fields?: Readonly<Record<string, unknown>> | null;
  readonly label_ids?: readonly string[] | null;
  readonly error_category_id?: string | null;
  readonly initiative_id?: string | null;
  readonly analytics_notes?: string | null;
  readonly created_at: string;
  readonly updated_at?: string | null;
  readonly completed_at?: string | null;
  readonly labels?: readonly CardLabelResponse[] | null;
  readonly subtasks?: readonly SubtaskResponse[] | null;
  readonly status?: CardStatusResponse | null;
  readonly error_category?: { readonly id?: string | null } | null;
  readonly initiative?: { readonly id?: string | null } | null;
}

export type CardListParams = {
  readonly statusId?: string;
  readonly labelId?: string;
  readonly search?: string;
  readonly statusIds?: readonly string[];
  readonly labelIds?: readonly string[];
  readonly assignees?: readonly string[];
  readonly priority?: string;
  readonly priorities?: readonly string[];
  readonly errorCategoryId?: string;
  readonly initiativeId?: string;
  readonly createdFrom?: string;
  readonly createdTo?: string;
  readonly dueFrom?: string;
  readonly dueTo?: string;
  readonly timeRange?: string;
};

const CARD_LIST_PARAM_MAP: Record<keyof CardListParams, string> = {
  statusId: 'status_id',
  labelId: 'label_id',
  search: 'search',
  statusIds: 'status_ids',
  labelIds: 'label_ids',
  assignees: 'assignees',
  priority: 'priority',
  priorities: 'priorities',
  errorCategoryId: 'error_category_id',
  initiativeId: 'initiative_id',
  createdFrom: 'created_from',
  createdTo: 'created_to',
  dueFrom: 'due_from',
  dueTo: 'due_to',
  timeRange: 'time_range',
};

const buildCardListParams = (params: CardListParams): HttpParams => {
  let httpParams = new HttpParams();

  (
    Object.entries(params) as [keyof CardListParams, CardListParams[keyof CardListParams]][]
  ).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }

    const queryKey = CARD_LIST_PARAM_MAP[key];
    if (!queryKey) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (entry === undefined || entry === null) {
          return;
        }
        const stringValue = String(entry).trim();
        if (stringValue.length === 0) {
          return;
        }
        httpParams = httpParams.append(queryKey, stringValue);
      });
      return;
    }

    const stringValue = String(value).trim();
    if (stringValue.length === 0) {
      return;
    }
    httpParams = httpParams.set(queryKey, stringValue);
  });

  return httpParams;
};

/**
 * API gateway for task cards stored in the backend.
 */
@Injectable({ providedIn: 'root' })
export class CardsApi {
  private readonly http = inject(HttpClient);

  /**
   * Fetches cards belonging to the authenticated workspace owner.
   */
  public listCards(params?: CardListParams): Observable<CardResponse[]> {
    const options = params ? { params: buildCardListParams(params) } : undefined;
    return this.http.get<CardResponse[]>(buildApiUrl('/cards'), options);
  }

  /**
   * Persists a new card on the backend.
   */
  public createCard(payload: CardCreateRequest): Observable<CardResponse> {
    return this.http.post<CardResponse>(buildApiUrl('/cards'), payload);
  }

  /**
   * Updates an existing card with the provided attributes.
   */
  public updateCard(cardId: string, payload: CardUpdateRequest): Observable<CardResponse> {
    return this.http.put<CardResponse>(buildApiUrl(`/cards/${cardId}`), payload);
  }

  /**
   * Deletes a card permanently from the workspace.
   */
  public deleteCard(cardId: string): Observable<void> {
    return this.http.delete<void>(buildApiUrl(`/cards/${cardId}`));
  }

  /**
   * Creates a new subtask for the specified card.
   */
  public createSubtask(cardId: string, payload: SubtaskCreateRequest): Observable<SubtaskResponse> {
    return this.http.post<SubtaskResponse>(buildApiUrl(`/cards/${cardId}/subtasks`), payload);
  }

  /**
   * Updates a subtask belonging to a card.
   */
  public updateSubtask(
    cardId: string,
    subtaskId: string,
    payload: SubtaskUpdateRequest,
  ): Observable<SubtaskResponse> {
    return this.http.put<SubtaskResponse>(
      buildApiUrl(`/cards/${cardId}/subtasks/${subtaskId}`),
      payload,
    );
  }

  /**
   * Deletes a subtask from a card.
   */
  public deleteSubtask(cardId: string, subtaskId: string): Observable<void> {
    return this.http.delete<void>(buildApiUrl(`/cards/${cardId}/subtasks/${subtaskId}`));
  }
}
