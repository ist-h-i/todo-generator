import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { buildApiUrl } from '@core/api/api.config';
import { ImmunityMapRequest, ImmunityMapResponse } from '@core/models';

@Injectable({ providedIn: 'root' })
export class ImmunityMapGateway {
  private readonly http = inject(HttpClient);

  public generate(payload: ImmunityMapRequest): Observable<ImmunityMapResponse> {
    return this.http.post<ImmunityMapResponse>(buildApiUrl('/analysis/immunity-map'), payload);
  }
}

