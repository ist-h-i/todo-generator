import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { isApiRequestUrl } from '@core/api/api.config';

import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.token();

  if (!token || !isApiRequestUrl(req.url)) {
    return next(req);
  }

  const authorizedRequest = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` },
  });

  return next(authorizedRequest);
};
