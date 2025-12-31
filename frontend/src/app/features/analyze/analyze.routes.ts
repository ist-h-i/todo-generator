import { Routes } from '@angular/router';

export const analyzeRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./analyze.page').then((mod) => mod.AnalyzePage),
  },
];
