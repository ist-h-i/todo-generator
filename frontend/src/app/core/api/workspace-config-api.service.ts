import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { buildApiUrl } from './api.config';

export interface StatusResponse {
  readonly id: string;
  readonly name: string;
  readonly category?: string | null;
  readonly order?: number | null;
  readonly color?: string | null;
  readonly wip_limit?: number | null;
}

export interface StatusCreateRequest {
  readonly name: string;
  readonly category?: string | null;
  readonly order?: number | null;
  readonly color?: string | null;
  readonly wip_limit?: number | null;
}

export interface StatusUpdateRequest {
  readonly name?: string | null;
  readonly category?: string | null;
  readonly order?: number | null;
  readonly color?: string | null;
  readonly wip_limit?: number | null;
}

export interface LabelResponse {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface LabelCreateRequest {
  readonly name: string;
  readonly color: string;
}

export interface LabelUpdateRequest {
  readonly name?: string | null;
  readonly color?: string | null;
}

export interface WorkspaceTemplateFieldVisibilityResponse {
  readonly show_story_points: boolean;
  readonly show_due_date: boolean;
  readonly show_assignee: boolean;
  readonly show_confidence: boolean;
}

export interface WorkspaceTemplateResponse {
  readonly id: string;
  readonly owner_id: string;
  readonly name: string;
  readonly description?: string | null;
  readonly default_status_id?: string | null;
  readonly default_label_ids?: readonly string[] | null;
  readonly confidence_threshold: number;
  readonly field_visibility: WorkspaceTemplateFieldVisibilityResponse;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface WorkspaceTemplateCreateRequest {
  readonly name: string;
  readonly description?: string | null;
  readonly default_status_id?: string | null;
  readonly default_label_ids?: readonly string[];
  readonly confidence_threshold?: number;
  readonly field_visibility?: WorkspaceTemplateFieldVisibilityResponse;
}

export interface WorkspaceTemplateUpdateRequest {
  readonly name?: string | null;
  readonly description?: string | null;
  readonly default_status_id?: string | null;
  readonly default_label_ids?: readonly string[];
  readonly confidence_threshold?: number;
  readonly field_visibility?: WorkspaceTemplateFieldVisibilityResponse;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceConfigApiService {
  private readonly http = inject(HttpClient);

  public listStatuses(): Observable<StatusResponse[]> {
    return this.http.get<StatusResponse[]>(buildApiUrl('/statuses'));
  }

  public createStatus(payload: StatusCreateRequest): Observable<StatusResponse> {
    return this.http.post<StatusResponse>(buildApiUrl('/statuses'), payload);
  }

  public updateStatus(statusId: string, payload: StatusUpdateRequest): Observable<StatusResponse> {
    return this.http.put<StatusResponse>(buildApiUrl(`/statuses/${statusId}`), payload);
  }

  public deleteStatus(statusId: string): Observable<void> {
    return this.http.delete<void>(buildApiUrl(`/statuses/${statusId}`));
  }

  public listLabels(): Observable<LabelResponse[]> {
    return this.http.get<LabelResponse[]>(buildApiUrl('/labels'));
  }

  public createLabel(payload: LabelCreateRequest): Observable<LabelResponse> {
    return this.http.post<LabelResponse>(buildApiUrl('/labels'), payload);
  }

  public updateLabel(labelId: string, payload: LabelUpdateRequest): Observable<LabelResponse> {
    return this.http.put<LabelResponse>(buildApiUrl(`/labels/${labelId}`), payload);
  }

  public deleteLabel(labelId: string): Observable<void> {
    return this.http.delete<void>(buildApiUrl(`/labels/${labelId}`));
  }

  public listTemplates(): Observable<WorkspaceTemplateResponse[]> {
    return this.http.get<WorkspaceTemplateResponse[]>(buildApiUrl('/workspace/templates'));
  }

  public createTemplate(
    payload: WorkspaceTemplateCreateRequest,
  ): Observable<WorkspaceTemplateResponse> {
    return this.http.post<WorkspaceTemplateResponse>(buildApiUrl('/workspace/templates'), payload);
  }

  public updateTemplate(
    templateId: string,
    payload: WorkspaceTemplateUpdateRequest,
  ): Observable<WorkspaceTemplateResponse> {
    return this.http.patch<WorkspaceTemplateResponse>(
      buildApiUrl(`/workspace/templates/${templateId}`),
      payload,
    );
  }

  public deleteTemplate(templateId: string): Observable<void> {
    return this.http.delete<void>(buildApiUrl(`/workspace/templates/${templateId}`));
  }
}
