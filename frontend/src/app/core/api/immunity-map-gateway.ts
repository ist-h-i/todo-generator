import { HttpClient } from '@angular/common/http';
import { Injectable, ResourceRef, Signal, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, of } from 'rxjs';

import { buildApiUrl } from '@core/api/api.config';
import {
  ImmunityMapCandidateRequest,
  ImmunityMapCandidateResponse,
  ImmunityMapRequest,
  ImmunityMapResponse,
} from '@core/models';

@Injectable({ providedIn: 'root' })
export class ImmunityMapGateway {
  private readonly http = inject(HttpClient);

  public getCandidates(
    payload: ImmunityMapCandidateRequest,
  ): Observable<ImmunityMapCandidateResponse> {
    return this.http.post<ImmunityMapCandidateResponse>(
      buildApiUrl('/analysis/immunity-map/candidates'),
      payload,
    );
  }

  public readonly createCandidatesResource = (
    request: Signal<ImmunityMapCandidateRequest | null>,
  ): ResourceRef<ImmunityMapCandidateResponse | null> =>
    rxResource<ImmunityMapCandidateResponse | null, ImmunityMapCandidateRequest | null>({
      defaultValue: null,
      params: request,
      stream: ({ params }): Observable<ImmunityMapCandidateResponse | null> =>
        params ? this.getCandidates(params) : of(null),
    });

  public generate(payload: ImmunityMapRequest): Observable<ImmunityMapResponse> {
    return this.http.post<ImmunityMapResponse>(buildApiUrl('/analysis/immunity-map'), payload);
  }
}
