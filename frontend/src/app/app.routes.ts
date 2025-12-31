import { Routes } from '@angular/router';

/**
 * Root-level routing configuration. Feature routes are lazy-loaded per slice.
 */
export const appRoutes: Routes = [
  {
    path: 'login',
    loadChildren: () => import('@features/auth/auth.routes').then((mod) => mod.authRoutes),
  },
  {
    path: '',
    loadChildren: () => import('@features/shell/shell.routes').then((mod) => mod.shellRoutes),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
