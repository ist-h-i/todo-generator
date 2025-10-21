import { Routes } from '@angular/router';

import { adminGuard } from '@core/auth/admin.guard';
import { authChildGuard, authGuard } from '@core/auth/auth.guard';

/**
 * Centralized route definitions. Each route lazy loads its standalone feature page.
 */
export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('@features/auth/login/feature/login-page.component').then(
        (mod) => mod.LoginPageComponent,
      ),
  },
  {
    path: '',
    loadComponent: () =>
      import('@features/shell/feature/shell.component').then((mod) => mod.ShellComponent),
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
        loadComponent: () =>
          import('@features/board/feature/board-page.component').then(
            (mod) => mod.BoardPageComponent,
          ),
      },
      {
        path: 'input',
        loadComponent: () =>
          import('@features/analyze/feature/analyze-page.component').then(
            (mod) => mod.AnalyzePageComponent,
          ),
      },
      {
        path: 'status-reports',
        pathMatch: 'full',
        redirectTo: 'reports',
      },
      {
        path: 'reports',
        loadComponent: () =>
          import('@features/reports/feature/reports-page.component').then(
            (mod) => mod.ReportAssistantPageComponent,
          ),
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('@features/analytics/feature/analytics-page.component').then(
            (mod) => mod.AnalyticsPageComponent,
          ),
      },
      {
        path: 'profile/evaluations',
        loadComponent: () =>
          import('@features/profile/evaluations/feature/profile-evaluations-page.component').then(
            (mod) => mod.ProfileEvaluationsPageComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('@features/settings/feature/settings-page.component').then(
            (mod) => mod.SettingsPageComponent,
          ),
      },
      {
        path: 'admin',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('@features/admin/feature/admin-page.component').then(
            (mod) => mod.AdminPageComponent,
          ),
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
