import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TimeoutError, throwError } from 'rxjs';

import { TIMEOUT_ERROR_MESSAGE, timeoutInterceptor } from './timeout.interceptor';

describe('timeoutInterceptor', () => {
  it('wraps timeout errors in an HttpErrorResponse with a user-friendly detail message', () => {
    const handler: HttpHandlerFn = () => throwError(() => new TimeoutError());
    let received: unknown;

    timeoutInterceptor(new HttpRequest('GET', '/api/example'), handler).subscribe({
      next: () => fail('Expected an error to be thrown.'),
      error: (error) => {
        received = error;
      },
    });

    expect(received).toEqual(jasmine.any(HttpErrorResponse));
    const httpError = received as HttpErrorResponse;
    expect(httpError.status).toBe(0);
    expect(httpError.statusText).toBe('Timeout');
    expect(httpError.error).toEqual({ detail: TIMEOUT_ERROR_MESSAGE });
  });

  it('passes through non-timeout errors unchanged', () => {
    const httpError = new HttpErrorResponse({ status: 500, url: '/api/example' });
    const handler: HttpHandlerFn = () => throwError(() => httpError);
    let received: unknown;

    timeoutInterceptor(new HttpRequest('GET', '/api/example'), handler).subscribe({
      next: () => fail('Expected an error to be thrown.'),
      error: (error) => {
        received = error;
      },
    });

    expect(received).toBe(httpError);
  });

  it('bypasses non-API URLs without applying the timeout', () => {
    const timeoutError = new TimeoutError();
    const handler: HttpHandlerFn = () => throwError(() => timeoutError);
    let received: unknown;

    timeoutInterceptor(new HttpRequest('GET', 'https://example.com'), handler).subscribe({
      next: () => fail('Expected an error to be thrown.'),
      error: (error) => {
        received = error;
      },
    });

    expect(received).toBe(timeoutError);
  });
});
