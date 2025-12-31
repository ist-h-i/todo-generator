import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';

import { Auth } from './auth';

const resolveAdminState = async (): Promise<boolean | UrlTree> => {
  const auth = inject(Auth);
  const router = inject(Router);

  await auth.ensureInitialized();

  if (auth.isAuthenticated() && auth.isAdmin()) {
    return true;
  }

  if (!auth.isAuthenticated()) {
    return router.parseUrl('/login');
  }

  return router.parseUrl('/board');
};

export const adminGuard: CanActivateFn = () => resolveAdminState();
