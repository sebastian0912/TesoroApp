import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.AfiliacionesDashboard)
  },
  {
    path: 'confirmacion-ingresos',
    loadComponent: () => import('./pages/confirmacion-ingresos/confirmacion-ingresos').then(m => m.ConfirmacionIngresos)
  }
];
