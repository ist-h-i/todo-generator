import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { buildApiUrl } from '@core/api/api.config';
import { AI_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from '@core/api/timeout.interceptor';
import {
  StatusReportCreateRequest,
  StatusReportDetail,
  StatusReportListItem,
  StatusReportRead,
  StatusReportUpdateRequest,
} from '@core/models';

@Injectable({ providedIn: 'root' })
export class StatusReportsGateway {
  private readonly http = inject(HttpClient);

  public listReports(params?: { readonly status?: string }): Observable<StatusReportListItem[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          httpParams = httpParams.set(key, value);
        }
      });
    }

    return this.http.get<StatusReportListItem[]>(buildApiUrl('/status-reports'), {
      params: httpParams,
    });
  }

  public createReport(payload: StatusReportCreateRequest): Observable<StatusReportRead> {
    return this.http.post<StatusReportRead>(buildApiUrl('/status-reports'), payload);
  }

  public updateReport(
    id: string,
    payload: StatusReportUpdateRequest,
  ): Observable<StatusReportRead> {
    return this.http.put<StatusReportRead>(buildApiUrl(`/status-reports/${id}`), payload);
  }

  public getReport(id: string): Observable<StatusReportDetail> {
    return this.http.get<StatusReportDetail>(buildApiUrl(`/status-reports/${id}`));
  }

  public submitReport(id: string): Observable<StatusReportDetail> {
    const context = new HttpContext().set(REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS);
    return this.http.post<StatusReportDetail>(buildApiUrl(`/status-reports/${id}/submit`), {}, { context });
  }

  public retryReport(id: string): Observable<StatusReportDetail> {
    const context = new HttpContext().set(REQUEST_TIMEOUT_MS, AI_REQUEST_TIMEOUT_MS);
    return this.http.post<StatusReportDetail>(buildApiUrl(`/status-reports/${id}/retry`), {}, { context });
  }
}
