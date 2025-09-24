import { Routes } from '@angular/router';

import { adminGuard } from '@core/auth/admin.guard';
import { authChildGuard, authGuard } from '@core/auth/auth.guard';

/**
 * Centralized route definitions. Each route lazy loads its standalone feature page.
 */
export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('@features/auth/login/page').then((mod) => mod.LoginPage),
  },
  {
    path: '',
    loadComponent: () => import('@core/layout/shell/shell').then((mod) => mod.Shell),
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'board',
      },
      {
        path: 'board',
        loadComponent: () => import('@features/board/page').then((mod) => mod.BoardPage),
      },
      {
        path: 'input',
        loadComponent: () => import('@features/analyze/page').then((mod) => mod.AnalyzePage),
      },
      {
        path: 'daily-reports',
        loadComponent: () =>
          import('@features/daily-reports/page').then((mod) => mod.DailyReportsPage),
      },
      {
        path: 'analytics',
        loadComponent: () => import('@features/analytics/page').then((mod) => mod.AnalyticsPage),
      },
      {
        path: 'profile/evaluations',
        loadComponent: () =>
          import('@features/profile/evaluations/page').then((mod) => mod.ProfileEvaluationsPage),
      },
      {
        path: 'settings',
        loadComponent: () => import('@features/settings/page').then((mod) => mod.SettingsPage),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () => import('@features/admin/page').then((mod) => mod.AdminPage),
      },
      {
        path: '**',
        loadComponent: () => import('@shared/ui/not-found').then((mod) => mod.NotFoundPage),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
