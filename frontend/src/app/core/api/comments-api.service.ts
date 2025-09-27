import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { buildApiUrl } from './api.config';

export interface CommentResponse {
  readonly id: string;
  readonly card_id: string;
  readonly content: string;
  readonly subtask_id?: string | null;
  readonly author_id?: string | null;
  readonly author_nickname?: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CommentCreateRequest {
  readonly card_id: string;
  readonly content: string;
  readonly subtask_id?: string | null;
}

export interface CommentUpdateRequest {
  readonly content?: string | null;
  readonly subtask_id?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CommentsApiService {
  private readonly http = inject(HttpClient);

  public createComment(payload: CommentCreateRequest): Observable<CommentResponse> {
    return this.http.post<CommentResponse>(buildApiUrl('/comments'), payload);
  }

  public updateComment(
    commentId: string,
    payload: CommentUpdateRequest,
  ): Observable<CommentResponse> {
    return this.http.put<CommentResponse>(buildApiUrl(`/comments/${commentId}`), payload);
  }

  public deleteComment(commentId: string): Observable<void> {
    return this.http.delete<void>(buildApiUrl(`/comments/${commentId}`));
  }
}
