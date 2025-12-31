import { Routes } from '@angular/router';

import { authChildGuard, authGuard } from '@core/auth/auth.guard';

export const shellRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./shell.page').then((mod) => mod.ShellPage),
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
        loadChildren: () => import('@features/board/board.routes').then((mod) => mod.boardRoutes),
      },
      {
        path: 'input',
        loadChildren: () =>
          import('@features/analyze/analyze.routes').then((mod) => mod.analyzeRoutes),
      },
      {
        path: 'status-reports',
        pathMatch: 'full',
        redirectTo: 'reports',
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('@features/reports/reports.routes').then((mod) => mod.reportsRoutes),
      },
      {
        path: 'analytics',
        loadChildren: () =>
          import('@features/analytics/analytics.routes').then((mod) => mod.analyticsRoutes),
      },
      {
        path: 'profile',
        loadChildren: () =>
          import('@features/profile/profile.routes').then((mod) => mod.profileRoutes),
      },
      {
        path: 'achievement-output',
        loadChildren: () =>
          import('@features/achievement-output/achievement-output.routes').then(
            (mod) => mod.achievementOutputRoutes,
          ),
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('@features/settings/settings.routes').then((mod) => mod.settingsRoutes),
      },
      {
        path: 'admin',
        loadChildren: () => import('@features/admin/admin.routes').then((mod) => mod.adminRoutes),
      },
      {
        path: '**',
        loadComponent: () =>
          import('@shared/ui/not-found/not-found.page').then((mod) => mod.NotFoundPage),
      },
    ],
  },
];
