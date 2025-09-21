import { Routes } from '@angular/router';

/**
 * Centralized route definitions. Each route lazy loads its standalone feature page.
 */
export const appRoutes: Routes = [
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
    path: 'analytics',
    loadComponent: () => import('@features/analytics/page').then((mod) => mod.AnalyticsPage),
  },
  {
    path: 'settings',
    loadComponent: () => import('@features/settings/page').then((mod) => mod.SettingsPage),
  },
  {
    path: '**',
    loadComponent: () => import('@shared/ui/not-found').then((mod) => mod.NotFoundPage),
  },
];
