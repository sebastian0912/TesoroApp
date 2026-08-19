import { Routes } from '@angular/router';

/**
 * Rutas del submódulo Gestión de Oficina. Se cargan lazy desde
 * features/dashboard/routes.ts (path 'office-management').
 */
export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.OfficeDashboardComponent) },
  { path: 'builder', loadComponent: () => import('./pages/form-builder/form-builder.component').then(m => m.FormBuilderComponent) },
  { path: 'builder/:id', loadComponent: () => import('./pages/form-builder/form-builder.component').then(m => m.FormBuilderComponent) },
  { path: 'forms/:id/fill', loadComponent: () => import('./pages/form-fill/form-fill.component').then(m => m.FormFillComponent) },
  { path: 'forms/:id/responses', loadComponent: () => import('./pages/form-responses/form-responses.component').then(m => m.FormResponsesComponent) },
  { path: 'responses/:rid', loadComponent: () => import('./pages/response-detail/response-detail.component').then(m => m.ResponseDetailComponent) },
];
