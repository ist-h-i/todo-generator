import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { isApiRequestUrl } from './api.config';

export const API_REQUEST_TIMEOUT_MS = 15000;
export const TIMEOUT_ERROR_MESSAGE =
  'リクエストがタイムアウトしました。時間をおいて再度お試しください。';

/**
 * Applies a timeout to API requests and surfaces a user-friendly error on expiry.
 */
export const timeoutInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequestUrl(req.url)) {
    return next(req);
  }

  return next(req).pipe(
    timeout(API_REQUEST_TIMEOUT_MS),
    catchError((error: unknown) => {
      if (error instanceof TimeoutError) {
        const timeoutError = new HttpErrorResponse({
          url: req.url,
          status: 0,
          statusText: 'Timeout',
          error: { detail: TIMEOUT_ERROR_MESSAGE },
        });

        return throwError(() => timeoutError);
      }

      return throwError(() => error);
    }),
  );
};
