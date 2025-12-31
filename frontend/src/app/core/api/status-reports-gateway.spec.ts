import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { StatusReportsGateway } from './status-reports-gateway';
import {
  StatusReportCreateRequest,
  StatusReportDetail,
  StatusReportListItem,
  StatusReportRead,
  StatusReportUpdateRequest,
} from '@core/models';
import { buildApiUrl } from './api.config';
import { AI_REQUEST_TIMEOUT_MS, API_REQUEST_TIMEOUT_MS, REQUEST_TIMEOUT_MS } from './timeout.interceptor';

const baseTimestamp = '2025-02-01T00:00:00.000Z';

const buildRead = (overrides: Partial<StatusReportRead> = {}): StatusReportRead => ({
  id: 'report-1',
  shift_type: 'remote',
  tags: ['daily'],
  status: 'draft',
  auto_ticket_enabled: true,
  sections: [],
  analysis_model: null,
  analysis_started_at: null,
  analysis_completed_at: null,
  failure_reason: null,
  confidence: null,
  created_at: baseTimestamp,
  updated_at: baseTimestamp,
  ...overrides,
});

const buildDetail = (overrides: Partial<StatusReportDetail> = {}): StatusReportDetail => ({
  ...buildRead(overrides),
  cards: [],
  events: [],
  processing_meta: {},
  pending_proposals: [],
  ...overrides,
});

describe('StatusReportsGateway', () => {
  let gateway: StatusReportsGateway;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [StatusReportsGateway],
    });

    gateway = TestBed.inject(StatusReportsGateway);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('lists reports with provided query parameters', () => {
    let response: StatusReportListItem[] | undefined;

    gateway.listReports({ status: 'completed' }).subscribe((value) => {
      response = value;
    });

    const request = httpMock.expectOne(
      (req) => req.url === `${baseUrl}status-reports` && req.params.get('status') === 'completed',
    );
    expect(request.request.method).toBe('GET');
    request.flush([] satisfies StatusReportListItem[]);

    expect(response).toEqual([]);
  });

  it('lists reports without adding empty parameters', () => {
    gateway.listReports({ status: '' }).subscribe();

    const request = httpMock.expectOne(`${baseUrl}status-reports`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);
    request.flush([]);
  });

  it('creates, updates, fetches, submits and retries reports', () => {
    const createPayload: StatusReportCreateRequest = {
      shift_type: 'remote',
      tags: ['daily'],
      sections: [{ title: '対応内容', body: 'モニタリングを強化' }],
      auto_ticket_enabled: true,
    };
    const updatePayload: StatusReportUpdateRequest = {
      auto_ticket_enabled: false,
    };

    gateway.createReport(createPayload).subscribe();
    const createRequest = httpMock.expectOne(`${baseUrl}status-reports`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toBe(createPayload);
    expect(createRequest.request.context.get(REQUEST_TIMEOUT_MS)).toBe(API_REQUEST_TIMEOUT_MS);
    createRequest.flush(buildRead());

    gateway.updateReport('report-1', updatePayload).subscribe();
    const updateRequest = httpMock.expectOne(`${baseUrl}status-reports/report-1`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toBe(updatePayload);
    expect(updateRequest.request.context.get(REQUEST_TIMEOUT_MS)).toBe(API_REQUEST_TIMEOUT_MS);
    updateRequest.flush(buildRead({ auto_ticket_enabled: false }));

    gateway.getReport('report-1').subscribe();
    const getRequest = httpMock.expectOne(`${baseUrl}status-reports/report-1`);
    expect(getRequest.request.method).toBe('GET');
    expect(getRequest.request.context.get(REQUEST_TIMEOUT_MS)).toBe(API_REQUEST_TIMEOUT_MS);
    getRequest.flush(buildDetail());

    gateway.submitReport('report-1').subscribe();
    const submitRequest = httpMock.expectOne(`${baseUrl}status-reports/report-1/submit`);
    expect(submitRequest.request.method).toBe('POST');
    expect(submitRequest.request.body).toEqual({});
    expect(submitRequest.request.context.get(REQUEST_TIMEOUT_MS)).toBe(AI_REQUEST_TIMEOUT_MS);
    submitRequest.flush(buildDetail({ status: 'completed' }));

    gateway.retryReport('report-1').subscribe();
    const retryRequest = httpMock.expectOne(`${baseUrl}status-reports/report-1/retry`);
    expect(retryRequest.request.method).toBe('POST');
    expect(retryRequest.request.body).toEqual({});
    expect(retryRequest.request.context.get(REQUEST_TIMEOUT_MS)).toBe(AI_REQUEST_TIMEOUT_MS);
    retryRequest.flush(buildDetail({ status: 'completed' }));
  });
});
