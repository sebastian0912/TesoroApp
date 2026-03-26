import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/financiera/financiera').then(m => m.Financiera)
  }
];
