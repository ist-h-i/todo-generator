import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { CommentsApiService } from './comments-api.service';
import { buildApiUrl } from './api.config';

describe('CommentsApiService', () => {
  let service: CommentsApiService;
  let httpMock: HttpTestingController;
  let baseUrl: string;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [CommentsApiService],
    });

    service = TestBed.inject(CommentsApiService);
    httpMock = TestBed.inject(HttpTestingController);
    baseUrl = buildApiUrl('/');
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('performs CRUD requests for comments', () => {
    service.listComments({ cardId: 'card-1' }).subscribe();
    const listRequest = httpMock.expectOne(`${baseUrl}comments?card_id=card-1`);
    expect(listRequest.request.method).toBe('GET');
    listRequest.flush([]);

    service.listComments({ cardId: 'card-1', subtaskId: 'subtask-1' }).subscribe();
    const scopedListRequest = httpMock.expectOne(
      `${baseUrl}comments?card_id=card-1&subtask_id=subtask-1`,
    );
    expect(scopedListRequest.request.method).toBe('GET');
    scopedListRequest.flush([]);

    const createPayload = { card_id: 'card-1', content: 'First comment' } as never;
    const updatePayload = { content: 'Updated comment' } as never;

    service.createComment(createPayload).subscribe();
    const createRequest = httpMock.expectOne(`${baseUrl}comments`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.body).toBe(createPayload);
    createRequest.flush({ id: 'comment-1' });

    service.updateComment('comment-1', updatePayload).subscribe();
    const updateRequest = httpMock.expectOne(`${baseUrl}comments/comment-1`);
    expect(updateRequest.request.method).toBe('PUT');
    expect(updateRequest.request.body).toBe(updatePayload);
    updateRequest.flush({ id: 'comment-1' });

    service.deleteComment('comment-1').subscribe();
    const deleteRequest = httpMock.expectOne(`${baseUrl}comments/comment-1`);
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
  });
});
