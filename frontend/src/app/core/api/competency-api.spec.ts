import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { CompetencyApi } from './competency-api';
import { buildApiUrl } from './api.config';

describe('CompetencyApi', () => {
  let service: CompetencyApi;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CompetencyApi],
    });

    service = TestBed.inject(CompetencyApi);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches evaluations with optional limits and manages quota', () => {
    service.getMyEvaluations().subscribe();
    const listRequest = httpMock.expectOne(`${baseUrl}users/me/evaluations`);
    expect(listRequest.request.params.keys()).toEqual([]);
    listRequest.flush([]);

    service.getMyEvaluations(5).subscribe();
    const limitedRequest = httpMock.expectOne(
      (req) => req.url === `${baseUrl}users/me/evaluations` && req.params.get('limit') === '5',
    );
    expect(limitedRequest.request.method).toBe('GET');
    limitedRequest.flush([]);

    service.getMyEvaluationQuota().subscribe();
    httpMock.expectOne(`${baseUrl}users/me/evaluations/quota`).flush({ remaining: 3 });

    service.runMyEvaluation({ answers: [] } as never).subscribe();
    const runRequest = httpMock.expectOne(`${baseUrl}users/me/evaluations`);
    expect(runRequest.request.method).toBe('POST');
    runRequest.flush({ id: 'evaluation-1' });
  });
});
