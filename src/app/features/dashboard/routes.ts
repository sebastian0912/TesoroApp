import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { HomeComponent } from './submodule/home/home/home.component';

export const routes: Routes = [
  {
    path: '',
    component: DashboardComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'authorizations', loadChildren: () => import('./submodule/authorizations/authorizations.routes').then(m => m.routes) },
      { path: 'document-management', loadChildren: () => import('./submodule/document-management/document-management.routes').then(m => m.routes) },
      { path: 'eps-transfers', loadChildren: () => import('./submodule/eps-transfers/eps-transfers.routes').then(m => m.routes) },
      { path: 'hiring', loadChildren: () => import('./submodule/hiring/hiring.routes').then(m => m.routes) },
      { path: 'history', loadChildren: () => import('./submodule/history/history.routes').then(m => m.routes) },
      { path: 'market', loadChildren: () => import('./submodule/market/market.routes').then(m => m.routes) },
      { path: 'merchandise', loadChildren: () => import('./submodule/merchandise/merchandise.routes').then(m => m.routes) },
      { path: 'money-loan', loadChildren: () => import('./submodule/money-loan/money-loan.routes').then(m => m.routes) },
      { path: 'users', loadChildren: () => import('./submodule/users/users.routes').then(m => m.routes) },
      { path: 'treasury', loadChildren: () => import('./submodule/treasury/treasury.routes').then(m => m.routes) },
      { path: 'payments', loadChildren: () => import('./submodule/payments/payments.routes').then(m => m.routes) },
      { path: 'disabilities', loadChildren: () => import('./submodule/disabilities/disabilities.routes').then(m => m.routes) },
      { path: 'vacancies', loadChildren: () => import('./submodule/vacancies/vacancies.routes').then(m => m.routes) },
      { path: 'positions', loadChildren: () => import('./submodule/positions/positions.routes').then(m => m.routes) },
      { path: 'farms', loadChildren: () => import('./submodule/farms/farms.routes').then(m => m.routes) },
      { path: 'robots', loadChildren: () => import('./submodule/robots/robots.routes').then(m => m.routes) },
    ],
  },
];
