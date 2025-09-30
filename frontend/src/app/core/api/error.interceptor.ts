import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { isApiRequestUrl } from './api.config';
import { HttpErrorNotifierService } from './http-error-notifier.service';

const NETWORK_ERROR_MESSAGE = 'サーバーに接続できませんでした。時間をおいて再度お試しください。';
const SERVER_ERROR_MESSAGE = 'サーバーでエラーが発生しました。時間をおいて再度お試しください。';
const CLIENT_ERROR_MESSAGE =
  'リクエストに失敗しました。入力内容を確認し、時間をおいて再度お試しください。';

const extractDetail = (payload: unknown): string | null => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const detail = (payload as { detail?: unknown }).detail;
  return typeof detail === 'string' && detail.trim().length > 0 ? detail : null;
};

const isCanceledRequest = (error: HttpErrorResponse): boolean => {
  if (error.status !== 0) {
    return false;
  }

  const cause = error.error;

  if (cause instanceof ProgressEvent) {
    return cause.type === 'abort';
  }

  if (cause instanceof DOMException) {
    return cause.name === 'AbortError';
  }

  if (cause && typeof cause === 'object') {
    const { name, type } = cause as { name?: unknown; type?: unknown };

    if (typeof name === 'string' && (name === 'AbortError' || name === 'CanceledError')) {
      return true;
    }

    if (typeof type === 'string' && type.toLowerCase() === 'abort') {
      return true;
    }
  }

  if (typeof cause === 'string') {
    return cause === 'AbortError' || cause === 'CanceledError';
  }

  return false;
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
        if (isCanceledRequest(error)) {
          return throwError(() => error);
        }
        notifier.notify(buildErrorMessage(error));
      } else {
        notifier.notify(SERVER_ERROR_MESSAGE);
      }

      return throwError(() => error);
    }),
  );
};
