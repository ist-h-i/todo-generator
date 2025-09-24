import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { CompetencyEvaluation, EvaluationQuotaStatus, SelfEvaluationRequest } from '@core/models';

import { buildApiUrl } from './api.config';

/**
 * API client for competency evaluation resources available to authenticated users.
 */
@Injectable({ providedIn: 'root' })
export class CompetencyApiService {
  private readonly http = inject(HttpClient);

  /**
   * Retrieves the competency evaluation history for the current user.
   *
   * @param limit Maximum number of evaluations to return. Defaults to 20, capped at the API layer.
   */
  public getMyEvaluations(limit?: number): Observable<CompetencyEvaluation[]> {
    const params = limit ? { limit: limit.toString() } : undefined;
    return this.http.get<CompetencyEvaluation[]>(buildApiUrl('/users/me/evaluations'), {
      params,
    });
  }

  public getMyEvaluationQuota(): Observable<EvaluationQuotaStatus> {
    return this.http.get<EvaluationQuotaStatus>(buildApiUrl('/users/me/evaluations/quota'));
  }

  public runMyEvaluation(payload: SelfEvaluationRequest): Observable<CompetencyEvaluation> {
    return this.http.post<CompetencyEvaluation>(buildApiUrl('/users/me/evaluations'), payload);
  }
}
