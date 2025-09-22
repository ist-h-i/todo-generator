import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router, UrlTree } from '@angular/router';

import { AuthService } from './auth.service';


const resolveAuthState = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ensureInitialized();

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.parseUrl('/login');
};

export const authGuard: CanActivateFn = () => resolveAuthState();

export const authChildGuard: CanActivateChildFn = () => resolveAuthState();
