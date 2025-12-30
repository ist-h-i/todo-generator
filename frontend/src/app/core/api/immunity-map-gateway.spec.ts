import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ImmunityMapGateway } from './immunity-map-gateway';
import { buildApiUrl } from './api.config';
import {
  ImmunityMapCandidateRequest,
  ImmunityMapCandidateResponse,
  ImmunityMapRequest,
  ImmunityMapResponse,
} from '@core/models';

describe('ImmunityMapGateway', () => {
  let gateway: ImmunityMapGateway;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ImmunityMapGateway],
    });

    gateway = TestBed.inject(ImmunityMapGateway);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts candidate requests', () => {
    const payload: ImmunityMapCandidateRequest = {
      window_days: 28,
      max_candidates: 10,
      include: {
        status_reports: true,
        cards: true,
        profile: true,
        snapshots: false,
      },
    };
    let response: ImmunityMapCandidateResponse | undefined;

    gateway.getCandidates(payload).subscribe((value) => {
      response = value;
    });

    const request = httpMock.expectOne(`${baseUrl}analysis/immunity-map/candidates`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(payload);

    const expected = {
      candidates: [],
      context_summary: 'summary',
      used_sources: { status_reports: 2, cards: 4 },
      model: 'test-model',
      token_usage: { total_tokens: 10 },
    } satisfies ImmunityMapCandidateResponse;
    request.flush(expected);

    expect(response).toEqual(expected);
  });

  it('posts immunity map generation requests', () => {
    const payload: ImmunityMapRequest = {
      a_items: [{ kind: 'should', text: 'Focus on deep work' }],
      context: null,
      context_policy: 'auto',
    };
    let response: ImmunityMapResponse | undefined;

    gateway.generate(payload).subscribe((value) => {
      response = value;
    });

    const request = httpMock.expectOne(`${baseUrl}analysis/immunity-map`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(payload);

    const expected = {
      model: null,
      payload: { nodes: [], edges: [] },
      mermaid: 'flowchart TD',
      summary: null,
      readout_cards: [],
      token_usage: { total_tokens: 20 },
    } satisfies ImmunityMapResponse;
    request.flush(expected);

    expect(response).toEqual(expected);
  });
});
