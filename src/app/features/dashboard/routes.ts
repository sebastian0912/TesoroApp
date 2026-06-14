import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', loadComponent: () => import('./submodule/home/home/home.component').then(m => m.HomeComponent) },
      { path: 'authorizations', loadChildren: () => import('./submodule/authorizations/authorizations.routes').then(m => m.routes) },
      { path: 'document-management', loadChildren: () => import('./submodule/document-management/document-management.routes').then(m => m.routes) },
      { path: 'eps-transfers', loadChildren: () => import('./submodule/eps-transfers/eps-transfers.routes').then(m => m.routes) },
      { path: 'hiring', loadChildren: () => import('./submodule/hiring/hiring.routes').then(m => m.routes) },
      { path: 'history', loadChildren: () => import('./submodule/history/history.routes').then(m => m.routes) },
      { path: 'users', loadChildren: () => import('./submodule/users/users.routes').then(m => m.routes) },
      { path: 'treasury', loadChildren: () => import('./submodule/treasury/treasury.routes').then(m => m.routes) },
      { path: 'payments', loadChildren: () => import('./submodule/payments/payments.routes').then(m => m.routes) },
      { path: 'vacancies', loadChildren: () => import('./submodule/vacancies/vacancies.routes').then(m => m.routes) },
      { path: 'positions', loadChildren: () => import('./submodule/positions/positions.routes').then(m => m.routes) },
      { path: 'farms', loadChildren: () => import('./submodule/farms/farms.routes').then(m => m.routes) },
      { path: 'robots', loadChildren: () => import('./submodule/robots/robots.routes').then(m => m.routes) },
      { path: 'nomina', loadChildren: () => import('./submodule/nomina/nomina.routes').then(m => m.routes) },
      { path: 'metricas', loadChildren: () => import('./submodule/metricas/metricas.routes').then(m => m.routes) },
      { path: 'contabilidad', loadChildren: () => import('./submodule/contabilidad/contabilidad.routes').then(m => m.routes) },
      { path: 'afiliaciones', loadChildren: () => import('./submodule/afiliaciones/afiliaciones.routes').then(m => m.routes) },
      { path: 'financiera', loadChildren: () => import('./submodule/financiera/financiera.routes').then(m => m.routes) },
      { path: 'bug-tickets', loadChildren: () => import('./submodule/bug-tickets/bug-tickets.routes').then(m => m.routes) },
      { path: 'matder', loadChildren: () => import('./submodule/matder/matder.routes').then(m => m.routes) },
      { path: 'disabilities', loadChildren: () => import('./submodule/disabilities/disabilities.routes').then(m => m.routes) },
      { path: 'merchandise', loadChildren: () => import('./submodule/merchandise/merchandise.routes').then(m => m.routes) },
      { path: 'market', loadChildren: () => import('./submodule/market/market.routes').then(m => m.routes) },
      { path: 'money-loan', loadChildren: () => import('./submodule/money-loan/money-loan.routes').then(m => m.routes) },

      // Redirects para módulos PADRE del menú (db_admin.modulo) cuyas rutas apuntan
      // a paths sin pantalla propia. Antes hacían redirect silencioso al home;
      // ahora navegan al primer hijo del grupo.
      { path: 'tesoreria',                   redirectTo: 'treasury/manage-workers',           pathMatch: 'full' },
      { path: 'autorizaciones',              redirectTo: 'authorizations/market-bonus',       pathMatch: 'full' },
      { path: 'operaciones-de-tesoreria',    redirectTo: 'treasury/manage-workers',           pathMatch: 'full' },
      { path: 'prestamo-de-dinero',          redirectTo: 'money-loan/emergency-loan',         pathMatch: 'full' },
      { path: 'mercado',                     redirectTo: 'market/load-market',                pathMatch: 'full' },
      { path: 'comercializadora',            redirectTo: 'merchandise/edit-merchandise',      pathMatch: 'full' },
      { path: 'mercancia',                   redirectTo: 'merchandise/edit-merchandise',      pathMatch: 'full' },
      { path: 'salud',                       redirectTo: 'disabilities/formulario',           pathMatch: 'full' },
      { path: 'seleccion-y-contratacion',    redirectTo: 'hiring/recruitment-pipeline',       pathMatch: 'full' },
      { path: 'contratacion/reportes',       redirectTo: 'hiring/hiring-report',              pathMatch: 'full' },
      { path: 'gestion-del-programa',        redirectTo: 'users/manage-users',                pathMatch: 'full' },
      { path: 'gestion-documental',          redirectTo: 'document-management/company-docs-access', pathMatch: 'full' },
      { path: 'traslados',                   redirectTo: 'eps-transfers/process-transfers',   pathMatch: 'full' },

      { path: '**', redirectTo: '' },
    ],
  },
];
