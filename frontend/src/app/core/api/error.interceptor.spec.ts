import { HttpErrorResponse, HttpHandlerFn, HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';

import { errorInterceptor } from './error.interceptor';
import { HttpErrorNotifierService } from './http-error-notifier.service';

const API_URL = '/api/example';
const NETWORK_ERROR_MESSAGE = 'サーバーに接続できませんでした。時間をおいて再度お試しください。';

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
        error: { detail: 'メンテナンスのため一時的に利用できません。' },
      });

      errorInterceptor(new HttpRequest('GET', API_URL), createHandler(error)).subscribe({
        error: () => {
          // swallow error for testing purposes
        },
      });
    });

    expect(notifySpy).toHaveBeenCalledWith('メンテナンスのため一時的に利用できません。');
  });

  it('does not notify when a request is cancelled with a DOMException whose name indicates cancellation', () => {
    const notifySpy = spyOn(notifier, 'notify');

    TestBed.runInInjectionContext(() => {
      const domException = new DOMException('ユーザーが操作を取り消しました。', 'CancelledError');
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
});
