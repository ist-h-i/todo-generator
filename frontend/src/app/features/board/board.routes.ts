import { Routes } from '@angular/router';

export const boardRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./board.page').then((mod) => mod.BoardPage),
  },
];
