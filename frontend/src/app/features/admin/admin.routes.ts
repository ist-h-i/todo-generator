import { Routes } from '@angular/router';

import { adminGuard } from '@core/auth/admin.guard';

export const adminRoutes: Routes = [
  {
    path: '',
    canActivate: [adminGuard],
    loadComponent: () => import('./admin.page').then((mod) => mod.AdminPage),
  },
];
