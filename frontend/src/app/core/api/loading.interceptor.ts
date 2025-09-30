import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs/operators';

import { isApiRequestUrl } from './api.config';
import { HttpLoadingStore } from './http-loading.store';
import { createId } from '@core/utils/create-id';

/**
 * Tracks API requests to toggle the global loading indicator.
 */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isApiRequestUrl(req.url)) {
    return next(req);
  }

  const loadingStore = inject(HttpLoadingStore);
  const requestId = createId();

  loadingStore.beginRequest(requestId);

  return next(req).pipe(
    finalize(() => {
      loadingStore.endRequest(requestId);
    }),
  );
};
