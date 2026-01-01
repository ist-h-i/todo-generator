import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { AppealsApi } from './appeals-api';
import { buildApiUrl } from './api.config';
import {
  AI_REQUEST_TIMEOUT_MS,
  API_REQUEST_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
} from './timeout.interceptor';
import {
  AppealConfigResponse,
  AppealGenerationRequest,
  AppealGenerationResponse,
} from '@core/models';

describe('AppealsApi', () => {
  let api: AppealsApi;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AppealsApi],
    });

    api = TestBed.inject(AppealsApi);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches config and submits generation requests', () => {
    const config: AppealConfigResponse = {
      labels: [
        {
          id: 'label-1',
          name: 'Sales',
          color: '#1f2937',
          description: 'Sales wins',
          achievements: [{ id: 'ach-1', title: 'Closed deal', summary: 'Enterprise' }],
        },
      ],
      recommended_flow: ['challenge', 'action', 'result', 'reflection'],
      formats: [
        { id: 'markdown', name: 'Markdown', description: 'Rich text', editor_mode: 'markdown' },
        { id: 'table', name: 'CSV', description: 'Table', editor_mode: 'csv' },
      ],
    };

    let configResponse: AppealConfigResponse | undefined;
    api.getConfig().subscribe((value) => {
      configResponse = value;
    });

    const configRequest = httpMock.expectOne(`${baseUrl}appeals/config`);
    expect(configRequest.request.method).toBe('GET');
    expect(configRequest.request.context.get(REQUEST_TIMEOUT_MS)).toBe(API_REQUEST_TIMEOUT_MS);
    configRequest.flush(config);

    expect(configResponse).toEqual(config);

    const payload: AppealGenerationRequest = {
      subject: { type: 'label', value: 'label-1' },
      flow: ['challenge', 'action'],
      formats: ['markdown', 'table'],
    };
    const generationResponse: AppealGenerationResponse = {
      generation_id: 'gen-1',
      subject_echo: 'Sales',
      flow: ['challenge', 'action'],
      warnings: [],
      formats: {
        markdown: { content: 'Output', tokens_used: 12 },
        table: { content: 'Step,Result', tokens_used: 4 },
      },
    };

    let generateResponse: AppealGenerationResponse | undefined;
    api.generate(payload).subscribe((value) => {
      generateResponse = value;
    });

    const generateRequest = httpMock.expectOne(`${baseUrl}appeals/generate`);
    expect(generateRequest.request.method).toBe('POST');
    expect(generateRequest.request.body).toEqual(payload);
    expect(generateRequest.request.context.get(REQUEST_TIMEOUT_MS)).toBe(AI_REQUEST_TIMEOUT_MS);
    generateRequest.flush(generationResponse);

    expect(generateResponse).toEqual(generationResponse);
  });
});
