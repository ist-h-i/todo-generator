import { Routes } from '@angular/router';

export const analyticsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./analytics.page').then((mod) => mod.AnalyticsPage),
  },
];
