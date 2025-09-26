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
export class CardsApiService {
  private readonly http = inject(HttpClient);

  /**
   * Fetches cards belonging to the authenticated workspace owner.
   */
  public listCards(params?: CardListParams): Observable<CardResponse[]> {
    const options = params ? { params: buildCardListParams(params) } : undefined;
    return this.http.get<CardResponse[]>(buildApiUrl('/cards'), options);
  }
}
