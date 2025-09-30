import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { isApiRequestUrl } from './api.config';
import { HttpErrorNotifierService } from './http-error-notifier.service';

const NETWORK_ERROR_MESSAGE = 'サーバーに接続できませんでした。時間をおいて再度お試しください。';
const SERVER_ERROR_MESSAGE = 'サーバーでエラーが発生しました。時間をおいて再度お試しください。';
const CLIENT_ERROR_MESSAGE = 'リクエストに失敗しました。入力内容を確認し、時間をおいて再度お試しください。';

const extractDetail = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const detail = (payload as { detail?: unknown }).detail;
  return typeof detail === 'string' && detail.trim().length > 0 ? detail : null;
};

const buildErrorMessage = (error: HttpErrorResponse): string => {
  if (error.status === 0) {
    return NETWORK_ERROR_MESSAGE;
  }

  const detail = extractDetail(error.error);
  if (detail) {
    return detail;
  }

  if (error.status >= 500) {
    return SERVER_ERROR_MESSAGE;
  }

  if (error.status >= 400) {
    return CLIENT_ERROR_MESSAGE;
  }

  return SERVER_ERROR_MESSAGE;
};

/**
 * Intercepts API responses and surfaces error messages when requests fail.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequestUrl(req.url)) {
    return next(req);
  }

  const notifier = inject(HttpErrorNotifierService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        notifier.notify(buildErrorMessage(error));
      } else {
        notifier.notify(SERVER_ERROR_MESSAGE);
      }

      return throwError(() => error);
    }),
  );
};
