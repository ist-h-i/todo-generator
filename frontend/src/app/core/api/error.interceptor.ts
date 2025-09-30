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
  if (typeof detail !== 'string') {
    return null;
  }

  const trimmed = detail.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasCancellationKeyword = (value: unknown): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return normalized.includes('abort') || normalized.includes('cancel');
};

const isCanceledRequest = (error: HttpErrorResponse): boolean => {
  if (error.status !== 0) {
    return false;
  }

  if (hasCancellationKeyword(error.statusText)) {
    return true;
  }

  const cause = error.error;

  if (cause instanceof ProgressEvent) {
    return hasCancellationKeyword(cause.type);
  }

  if (cause instanceof DOMException) {
    return hasCancellationKeyword(cause.name) || hasCancellationKeyword(cause.message);
  }

  if (typeof cause === 'string') {
    return hasCancellationKeyword(cause);
  }

  if (cause && typeof cause === 'object') {
    const { name, type, code, message } = cause as {
      name?: unknown;
      type?: unknown;
      code?: unknown;
      message?: unknown;
    };

    return (
      hasCancellationKeyword(name) ||
      hasCancellationKeyword(type) ||
      hasCancellationKeyword(code) ||
      hasCancellationKeyword(message)
    );
  }

  return false;
};

const buildErrorMessage = (error: HttpErrorResponse): string => {
  const detail = extractDetail(error.error);
  if (detail) {
    return detail;
  }

  if (error.status === 0) {
    return NETWORK_ERROR_MESSAGE;
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
