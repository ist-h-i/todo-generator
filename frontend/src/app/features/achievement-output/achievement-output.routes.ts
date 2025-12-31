import { Routes } from '@angular/router';

export const achievementOutputRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./achievement-output.page').then((mod) => mod.AchievementOutputPage),
  },
];
