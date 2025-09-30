import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { loadingInterceptor } from './loading.interceptor';
import { HttpLoadingStore } from './http-loading.store';

const API_URL = '/api/example';
const EXTERNAL_URL = 'https://example.com/asset.js';

describe('loadingInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let loadingStore: HttpLoadingStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([loadingInterceptor])),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    loadingStore = TestBed.inject(HttpLoadingStore);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('begins and ends tracking for successful API requests', () => {
    const beginSpy = spyOn(loadingStore, 'beginRequest').and.callThrough();
    const endSpy = spyOn(loadingStore, 'endRequest').and.callThrough();

    http.get(API_URL).subscribe();

    const req = httpMock.expectOne(API_URL);
    expect(beginSpy).toHaveBeenCalledTimes(1);
    const requestId = beginSpy.calls.mostRecent().args[0];
    expect(typeof requestId).toBe('string');

    req.flush({ data: true });

    expect(endSpy).toHaveBeenCalledWith(requestId);
    expect(endSpy).toHaveBeenCalledTimes(1);
  });

  it('ends tracking when the API request fails', () => {
    const beginSpy = spyOn(loadingStore, 'beginRequest').and.callThrough();
    const endSpy = spyOn(loadingStore, 'endRequest').and.callThrough();

    http.get(API_URL).subscribe({
      error: () => {
        // no-op
      },
    });

    const req = httpMock.expectOne(API_URL);
    req.flush('Server error', { status: 500, statusText: 'Server Error' });

    const requestId = beginSpy.calls.mostRecent().args[0];
    expect(endSpy).toHaveBeenCalledWith(requestId);
  });

  it('ignores non-API requests', () => {
    const beginSpy = spyOn(loadingStore, 'beginRequest');

    http.get(EXTERNAL_URL).subscribe();

    const req = httpMock.expectOne(EXTERNAL_URL);
    req.flush('');

    expect(beginSpy).not.toHaveBeenCalled();
  });

  it('clears loading state when requests are aborted', () => {
    const beginSpy = spyOn(loadingStore, 'beginRequest').and.callThrough();
    const endSpy = spyOn(loadingStore, 'endRequest').and.callThrough();

    http.get(API_URL).subscribe({
      error: () => {
        // Swallow the cancellation error.
      },
    });

    const req = httpMock.expectOne(API_URL);
    req.error(new ProgressEvent('abort'), { status: 0, statusText: 'AbortError' });

    const requestId = beginSpy.calls.mostRecent().args[0];
    expect(endSpy).toHaveBeenCalledWith(requestId);
  });
});
