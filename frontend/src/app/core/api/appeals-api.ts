import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable } from 'rxjs';

import { buildApiUrl } from '@core/api/api.config';
import { AI_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from '@core/api/timeout.interceptor';
import { AppealConfigResponse, AppealGenerationRequest, AppealGenerationResponse } from '@core/models';

/**
 * API client for achievement output (appeal generation) endpoints.
 */
@Injectable({ providedIn: 'root' })
export class AppealsApi {
  private readonly http = inject(HttpClient);

  public getConfig(): Observable<AppealConfigResponse> {
    return this.http.get<AppealConfigResponse>(buildApiUrl('/appeals/config'));
  }

  public generate(payload: AppealGenerationRequest): Observable<AppealGenerationResponse> {
    const context = new HttpContext().set(REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS);
    return this.http.post<AppealGenerationResponse>(buildApiUrl('/appeals/generate'), payload, {
      context,
    });
  }
}
