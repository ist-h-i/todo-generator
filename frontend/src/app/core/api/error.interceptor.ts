import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { TimeoutError, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { isApiRequestUrl } from './api.config';
import { HttpErrorNotifierService } from './http-error-notifier.service';

const NETWORK_ERROR_MESSAGE =
  '\u30b5\u30fc\u30d0\u30fc\u306b\u63a5\u7d9a\u3067\u304d\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002';
const SERVER_ERROR_MESSAGE =
  '\u30b5\u30fc\u30d0\u30fc\u3067\u30a8\u30e9\u30fc\u304c\u767a\u751f\u3057\u307e\u3057\u305f\u3002\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002';
const CLIENT_ERROR_MESSAGE =
  '\u30ea\u30af\u30a8\u30b9\u30c8\u306b\u5931\u6557\u3057\u307e\u3057\u305f\u3002\u5165\u529b\u5185\u5bb9\u3092\u78ba\u8a8d\u3057\u3001\u6642\u9593\u3092\u304a\u3044\u3066\u518d\u5ea6\u304a\u8a66\u3057\u304f\u3060\u3055\u3044\u3002';
const UNKNOWN_ERROR_MESSAGE = SERVER_ERROR_MESSAGE;

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

  return UNKNOWN_ERROR_MESSAGE;
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
      } else if (error instanceof TimeoutError) {
        notifier.notify(NETWORK_ERROR_MESSAGE);
      } else {
        notifier.notify(UNKNOWN_ERROR_MESSAGE);
      }

      return throwError(() => error);
    }),
  );
};
