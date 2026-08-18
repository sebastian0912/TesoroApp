import { Routes } from '@angular/router';

/**
 * Formularios Dinámicos (Administración → Formularios dinamicos).
 * Ruta base real: /dashboard/gestion-del-programa/formularios-dinamicos
 * (coincide con el módulo sembrado en db_admin y con las rutas que el
 * aprovisionador registra por formulario: llenar/{id} y {id}/respuestas).
 *
 * OJO con el orden: 'builder' y 'llenar/:formId' van ANTES de los patrones
 * ':formId/...' porque el router resuelve en orden de declaración.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/forms-list/forms-list.component').then(m => m.FormsListComponent),
  },
  {
    path: 'builder',
    loadComponent: () => import('./pages/form-builder/form-builder.component').then(m => m.FormBuilderComponent),
  },
  {
    path: 'llenar/:formId',
    loadComponent: () => import('./pages/form-runtime/form-runtime.component').then(m => m.FormRuntimeComponent),
  },
  {
    // Edición de estructura = el MISMO builder en modo edición (crea versión nueva).
    path: ':formId/editar',
    loadComponent: () => import('./pages/form-builder/form-builder.component').then(m => m.FormBuilderComponent),
  },
  {
    path: ':formId/respuestas',
    loadComponent: () => import('./pages/form-responses/form-responses.component').then(m => m.FormResponsesComponent),
  },
  {
    path: ':formId/respuestas/:submissionId',
    loadComponent: () => import('./pages/form-response-detail/form-response-detail.component').then(m => m.FormResponseDetailComponent),
  },
  {
    path: ':formId/soportes',
    loadComponent: () => import('./pages/form-supports/form-supports.component').then(m => m.FormSupportsComponent),
  },
  {
    path: ':formId/analitica',
    loadComponent: () => import('./pages/form-analytics/form-analytics.component').then(m => m.FormAnalyticsComponent),
  },
];
