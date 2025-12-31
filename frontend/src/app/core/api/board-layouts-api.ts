import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { buildApiUrl } from './api.config';

export interface BoardLayoutResponse {
  readonly user_id: string;
  readonly board_grouping?: string | null;
  readonly board_layout?: Record<string, unknown> | null;
  readonly visible_fields: readonly string[];
  readonly notification_settings: Record<string, unknown>;
  readonly preferred_language?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface BoardLayoutUpdateRequest {
  readonly board_grouping?: string | null;
  readonly board_layout?: Record<string, unknown> | null;
  readonly visible_fields?: readonly string[];
  readonly notification_settings?: Record<string, unknown>;
  readonly preferred_language?: string | null;
}

@Injectable({ providedIn: 'root' })
export class BoardLayoutsApi {
  private readonly http = inject(HttpClient);

  public getBoardLayout(): Observable<BoardLayoutResponse> {
    return this.http.get<BoardLayoutResponse>(buildApiUrl('/board-layouts'));
  }

  public updateBoardLayout(payload: BoardLayoutUpdateRequest): Observable<BoardLayoutResponse> {
    return this.http.put<BoardLayoutResponse>(buildApiUrl('/board-layouts'), payload);
  }
}
