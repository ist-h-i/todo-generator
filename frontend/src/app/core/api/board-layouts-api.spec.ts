import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { BoardLayoutsApi } from './board-layouts-api';
import { buildApiUrl } from './api.config';

describe('BoardLayoutsApi', () => {
  let service: BoardLayoutsApi;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [BoardLayoutsApi],
    });

    service = TestBed.inject(BoardLayoutsApi);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('retrieves and updates board layout preferences', () => {
    service.getBoardLayout().subscribe();
    httpMock.expectOne(`${baseUrl}board-layouts`).flush({ user_id: 'user-1' });

    service.updateBoardLayout({ visible_fields: ['status'] } as never).subscribe();
    const updateRequest = httpMock.expectOne(`${baseUrl}board-layouts`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toEqual({ visible_fields: ['status'] });
    updateRequest.flush({ user_id: 'user-1' });
  });
});
