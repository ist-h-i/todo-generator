import { HttpClient, HttpParams } from '@angular/common/http';
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

export interface CommentListParams {
  readonly cardId: string;
  readonly subtaskId?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CommentsApi {
  private readonly http = inject(HttpClient);

  public listComments(params: CommentListParams): Observable<CommentResponse[]> {
    let httpParams = new HttpParams().set('card_id', params.cardId);
    if (params.subtaskId) {
      httpParams = httpParams.set('subtask_id', params.subtaskId);
    }

    return this.http.get<CommentResponse[]>(buildApiUrl('/comments'), { params: httpParams });
  }

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
