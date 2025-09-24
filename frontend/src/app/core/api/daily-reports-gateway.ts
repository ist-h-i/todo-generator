import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { buildApiUrl } from '@core/api/api.config';
import {
  DailyReportCreateRequest,
  DailyReportDetail,
  DailyReportListItem,
  DailyReportRead,
  DailyReportUpdateRequest,
} from '@core/models';

@Injectable({ providedIn: 'root' })
export class DailyReportsGateway {
  private readonly http = inject(HttpClient);

  public listReports(params?: { readonly status?: string }): Observable<DailyReportListItem[]> {
    let httpParams = new HttpParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value) {
          httpParams = httpParams.set(key, value);
        }
      });
    }

    return this.http.get<DailyReportListItem[]>(buildApiUrl('/daily-reports'), {
      params: httpParams,
    });
  }

  public createReport(payload: DailyReportCreateRequest): Observable<DailyReportRead> {
    return this.http.post<DailyReportRead>(buildApiUrl('/daily-reports'), payload);
  }

  public updateReport(id: string, payload: DailyReportUpdateRequest): Observable<DailyReportRead> {
    return this.http.put<DailyReportRead>(buildApiUrl(`/daily-reports/${id}`), payload);
  }

  public getReport(id: string): Observable<DailyReportDetail> {
    return this.http.get<DailyReportDetail>(buildApiUrl(`/daily-reports/${id}`));
  }

  public submitReport(id: string): Observable<DailyReportDetail> {
    return this.http.post<DailyReportDetail>(buildApiUrl(`/daily-reports/${id}/submit`), {});
  }

  public retryReport(id: string): Observable<DailyReportDetail> {
    return this.http.post<DailyReportDetail>(buildApiUrl(`/daily-reports/${id}/retry`), {});
  }
}
