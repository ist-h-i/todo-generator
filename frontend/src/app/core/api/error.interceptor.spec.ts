import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TimeoutError, throwError } from 'rxjs';

import { errorInterceptor } from './error.interceptor';
import { HttpErrorNotifierService } from './http-error-notifier.service';

const API_URL = '/api/example';
const NETWORK_ERROR_MESSAGE =
  '\u30b5\u30fc\u30d0\u30fc\u306b\u63a5\u7d9a\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002';
const DETAIL_MESSAGE =
  '\u30e1\u30f3\u30c6\u30ca\u30f3\u30b9\u306e\u305f\u3081\u4e00\u6642\u7684\u306b\u5229\u7528\u3067\u304d\u307e\u305b\u3093\u3002';

const createHandler =
  (error: HttpErrorResponse): HttpHandlerFn =>
  () =>
    throwError(() => error);

describe('errorInterceptor', () => {
  let notifier: HttpErrorNotifierService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [HttpErrorNotifierService],
    });

    notifier = TestBed.inject(HttpErrorNotifierService);
  });

  it('prefers detail messages over the generic network fallback even for status 0 responses', () => {
    const notifySpy = spyOn(notifier, 'notify');

    TestBed.runInInjectionContext(() => {
      const error = new HttpErrorResponse({
        url: API_URL,
        status: 0,
        statusText: 'Unknown Error',
        error: { detail: DETAIL_MESSAGE },
      });

      errorInterceptor(new HttpRequest('GET', API_URL), createHandler(error)).subscribe({
        error: () => {
          // swallow error for testing purposes
        },
      });
    });

    expect(notifySpy).toHaveBeenCalledWith(DETAIL_MESSAGE);
  });

  it('does not notify when a request is cancelled with a DOMException whose name indicates cancellation', () => {
    const notifySpy = spyOn(notifier, 'notify');

    TestBed.runInInjectionContext(() => {
      const domException = new DOMException(
        '\u30e6\u30fc\u30b6\u30fc\u304c\u64cd\u4f5c\u3092\u53d6\u308a\u6d88\u3057\u307e\u3057\u305f\u3002',
        'CancelledError',
      );
      const error = new HttpErrorResponse({
        url: API_URL,
        status: 0,
        statusText: 'Cancelled',
        error: domException,
      });

      errorInterceptor(new HttpRequest('GET', API_URL), createHandler(error)).subscribe({
        error: () => {
          // ignore cancellation
        },
      });
    });

    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('does not notify when a request is cancelled with a lowercase cancellation reason string', () => {
    const notifySpy = spyOn(notifier, 'notify');

    TestBed.runInInjectionContext(() => {
      const error = new HttpErrorResponse({
        url: API_URL,
        status: 0,
        statusText: 'cancelled',
        error: 'cancelled',
      });

      errorInterceptor(new HttpRequest('GET', API_URL), createHandler(error)).subscribe({
        error: () => {
          // ignore cancellation
        },
      });
    });

    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('does not notify when a cancellation error object exposes a cancellation code', () => {
    const notifySpy = spyOn(notifier, 'notify');

    TestBed.runInInjectionContext(() => {
      const error = new HttpErrorResponse({
        url: API_URL,
        status: 0,
        statusText: 'Cancelled',
        error: { code: 'ERR_CANCELED' },
      });

      errorInterceptor(new HttpRequest('GET', API_URL), createHandler(error)).subscribe({
        error: () => {
          // ignore cancellation
        },
      });
    });

    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('does not notify when a cancellation error object exposes a cancellation name', () => {
    const notifySpy = spyOn(notifier, 'notify');

    TestBed.runInInjectionContext(() => {
      const error = new HttpErrorResponse({
        url: API_URL,
        status: 0,
        statusText: 'Cancelled',
        error: { name: 'CancelledRequest' },
      });

      errorInterceptor(new HttpRequest('GET', API_URL), createHandler(error)).subscribe({
        error: () => {
          // ignore cancellation
        },
      });
    });

    expect(notifySpy).not.toHaveBeenCalled();
  });

  it('falls back to the generic network message when no detail is provided', () => {
    const notifySpy = spyOn(notifier, 'notify');

    TestBed.runInInjectionContext(() => {
      const error = new HttpErrorResponse({
        url: API_URL,
        status: 0,
        statusText: 'Unknown Error',
      });

      errorInterceptor(new HttpRequest('GET', API_URL), createHandler(error)).subscribe({
        error: () => {
          // swallow error for testing purposes
        },
      });
    });

    expect(notifySpy).toHaveBeenCalledWith(NETWORK_ERROR_MESSAGE);
  });

  it('notifies the network message when a timeout error bubbles up', () => {
    const notifySpy = spyOn(notifier, 'notify');

    TestBed.runInInjectionContext(() => {
      const handler: HttpHandlerFn = () => throwError(() => new TimeoutError());

      errorInterceptor(new HttpRequest('GET', API_URL), handler).subscribe({
        error: () => {
          // swallow error for testing purposes
        },
      });
    });

    expect(notifySpy).toHaveBeenCalledWith(NETWORK_ERROR_MESSAGE);
  });
});
