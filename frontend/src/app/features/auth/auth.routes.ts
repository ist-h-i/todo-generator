import { Routes } from '@angular/router';

export const authRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./login.page').then((mod) => mod.LoginPage),
  },
];
