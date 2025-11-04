import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { TimeoutError, throwError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

import { isApiRequestUrl } from './api.config';

export const API_REQUEST_TIMEOUT_MS = 15000;
export const TIMEOUT_ERROR_MESSAGE =
  '\u30ea\u30af\u30a8\u30b9\u30c8\u304c\u30bf\u30a4\u30e0\u30a2\u30a6\u30c8\u3057\u307e\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002';

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
