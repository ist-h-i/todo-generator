import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { buildApiUrl } from './api.config';
import {
  AdminUser,
  AdminUserUpdate,
  ApiCredential,
  ApiCredentialUpdate,
  Competency,
  CompetencyLevelDefinition,
  CompetencyLevelInput,
  CompetencyEvaluation,
  CompetencyInput,
  EvaluationTriggerRequest,
  QuotaDefaults,
  QuotaDefaultsUpdate,
} from '@core/models';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  public listCompetencies(): Observable<Competency[]> {
    return this.http.get<Competency[]>(buildApiUrl('/admin/competencies'));
  }

  public createCompetency(payload: CompetencyInput): Observable<Competency> {
    return this.http.post<Competency>(buildApiUrl('/admin/competencies'), payload);
  }

  public updateCompetency(id: string, payload: Partial<CompetencyInput>): Observable<Competency> {
    return this.http.patch<Competency>(buildApiUrl(`/admin/competencies/${id}`), payload);
  }

  public triggerEvaluation(
    competencyId: string,
    payload: EvaluationTriggerRequest,
  ): Observable<CompetencyEvaluation> {
    return this.http.post<CompetencyEvaluation>(
      buildApiUrl(`/admin/competencies/${competencyId}/evaluate`),
      payload,
    );
  }

  public listEvaluations(): Observable<CompetencyEvaluation[]> {
    return this.http.get<CompetencyEvaluation[]>(buildApiUrl('/admin/evaluations'));
  }

  public listCompetencyLevels(): Observable<CompetencyLevelDefinition[]> {
    return this.http.get<CompetencyLevelDefinition[]>(buildApiUrl('/admin/competency-levels'));
  }

  public createCompetencyLevel(
    payload: CompetencyLevelInput,
  ): Observable<CompetencyLevelDefinition> {
    return this.http.post<CompetencyLevelDefinition>(
      buildApiUrl('/admin/competency-levels'),
      payload,
    );
  }

  public listUsers(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>(buildApiUrl('/admin/users'));
  }

  public updateUser(id: string, payload: AdminUserUpdate): Observable<AdminUser> {
    return this.http.patch<AdminUser>(buildApiUrl(`/admin/users/${id}`), payload);
  }

  public deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(buildApiUrl(`/admin/users/${id}`));
  }

  public getApiCredential(provider: string): Observable<ApiCredential> {
    return this.http.get<ApiCredential>(buildApiUrl(`/admin/api-credentials/${provider}`));
  }

  public listApiCredentialModels(provider: string): Observable<string[]> {
    return this.http.get<string[]>(buildApiUrl(`/admin/api-credentials/${provider}/models`));
  }

  public upsertApiCredential(
    provider: string,
    payload: ApiCredentialUpdate,
  ): Observable<ApiCredential> {
    return this.http.put<ApiCredential>(buildApiUrl(`/admin/api-credentials/${provider}`), payload);
  }

  public getQuotaDefaults(): Observable<QuotaDefaults> {
    return this.http.get<QuotaDefaults>(buildApiUrl('/admin/quotas/defaults'));
  }

  public updateQuotaDefaults(payload: QuotaDefaultsUpdate): Observable<QuotaDefaults> {
    return this.http.put<QuotaDefaults>(buildApiUrl('/admin/quotas/defaults'), payload);
  }
}
