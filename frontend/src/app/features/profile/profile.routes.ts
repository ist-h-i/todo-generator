import { Routes } from '@angular/router';

export const profileRoutes: Routes = [
  {
    path: 'evaluations',
    loadComponent: () =>
      import('./profile-evaluations.page').then((mod) => mod.ProfileEvaluationsPage),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'evaluations',
  },
];
