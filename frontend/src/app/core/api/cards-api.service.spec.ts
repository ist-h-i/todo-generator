import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import {
  CardsApiService,
  CardCreateRequest,
  CardUpdateRequest,
  SubtaskCreateRequest,
  SubtaskUpdateRequest,
} from './cards-api.service';
import { buildApiUrl } from './api.config';

describe('CardsApiService', () => {
  let service: CardsApiService;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CardsApiService],
    });

    service = TestBed.inject(CardsApiService);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('builds query parameters for listCards while filtering empty values', () => {
    service
      .listCards({
        statusId: 'status-1',
        labelIds: ['label-1', '  ', undefined as unknown as string],
        statusIds: ['status-2', null as unknown as string],
        assignees: ['alice', ''],
        priorities: ['high', 'low'],
        createdFrom: '2025-02-01',
        createdTo: '2025-02-28',
        dueFrom: '2025-02-10',
        dueTo: undefined,
        timeRange: 'last_7_days',
        search: '  backend  ',
      })
      .subscribe();

    const request = httpMock.expectOne((req) => req.url === `${baseUrl}cards`);
    expect(request.request.method).toBe('GET');

    const params = request.request.params;
    expect(params.get('status_id')).toBe('status-1');
    expect(params.getAll('label_ids')).toEqual(['label-1']);
    expect(params.getAll('status_ids')).toEqual(['status-2']);
    expect(params.getAll('assignees')).toEqual(['alice']);
    expect(params.getAll('priorities')).toEqual(['high', 'low']);
    expect(params.get('created_from')).toBe('2025-02-01');
    expect(params.get('created_to')).toBe('2025-02-28');
    expect(params.get('due_from')).toBe('2025-02-10');
    expect(params.get('due_to')).toBeNull();
    expect(params.get('time_range')).toBe('last_7_days');
    expect(params.get('search')).toBe('backend');

    request.flush([]);
  });

  it('omits params when listCards is called without arguments', () => {
    service.listCards().subscribe();

    const request = httpMock.expectOne(`${baseUrl}cards`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys()).toEqual([]);

    request.flush([]);
  });

  it('supports all CRUD operations for cards and subtasks', () => {
    const createPayload = { title: 'Create API card' } as CardCreateRequest;
    const updatePayload = { title: 'Updated title' } as CardUpdateRequest;
    const subtaskCreate = { title: 'Initial subtask' } as SubtaskCreateRequest;
    const subtaskUpdate = { title: 'Updated subtask' } as SubtaskUpdateRequest;

    service.createCard(createPayload).subscribe();
    const createRequest = httpMock.expectOne(`${baseUrl}cards`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toBe(createPayload);
    createRequest.flush({ id: 'card-1' });

    service.updateCard('card-1', updatePayload).subscribe();
    const updateRequest = httpMock.expectOne(`${baseUrl}cards/card-1`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toBe(updatePayload);
    updateRequest.flush({ id: 'card-1' });

    service.deleteCard('card-1').subscribe();
    const deleteRequest = httpMock.expectOne(`${baseUrl}cards/card-1`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);

    service.createSubtask('card-1', subtaskCreate).subscribe();
    const subtaskCreateRequest = httpMock.expectOne(`${baseUrl}cards/card-1/subtasks`);
    expect(subtaskCreateRequest.request.method).toBe('POST');
    expect(subtaskCreateRequest.request.body).toBe(subtaskCreate);
    subtaskCreateRequest.flush({ id: 'subtask-1' });

    service.updateSubtask('card-1', 'subtask-1', subtaskUpdate).subscribe();
    const subtaskUpdateRequest = httpMock.expectOne(`${baseUrl}cards/card-1/subtasks/subtask-1`);
    expect(subtaskUpdateRequest.request.method).toBe('PUT');
    expect(subtaskUpdateRequest.request.body).toBe(subtaskUpdate);
    subtaskUpdateRequest.flush({ id: 'subtask-1' });

    service.deleteSubtask('card-1', 'subtask-1').subscribe();
    const subtaskDeleteRequest = httpMock.expectOne(`${baseUrl}cards/card-1/subtasks/subtask-1`);
    expect(subtaskDeleteRequest.request.method).toBe('DELETE');
    subtaskDeleteRequest.flush(null);
  });
});
