import { Routes } from '@angular/router';
import { NominaComponent } from './pages/nomina/nomina.component';
import { CalculoNominaComponent } from './pages/calculo-nomina/calculo-nomina.component';

export const routes: Routes = [
  { path: 'empleados', component: NominaComponent },
  { path: 'calculo-nomina', component: CalculoNominaComponent },
  { path: 'historico-nomina', loadComponent: () => import('./pages/historico-nomina/historico-nomina.component').then(m => m.HistoricoNominaComponent) },
  { path: 'parametrizacion-novedades', loadComponent: () => import('./pages/parametrizacion-novedades/parametrizacion-novedades.component').then(m => m.ParametrizacionNovedadesComponent) },
  { path: 'convalidador', loadComponent: () => import('./pages/convalidador/convalidador.component').then(m => m.ConvalidadorComponent) },
];
