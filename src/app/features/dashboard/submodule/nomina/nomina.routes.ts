import { Routes } from '@angular/router';
import { NominaComponent } from './pages/nomina/nomina.component';
import { CalculoNominaComponent } from './pages/calculo-nomina/calculo-nomina.component';

export const routes: Routes = [
  { path: '', redirectTo: 'empleados', pathMatch: 'full' },
  { path: 'empleados', component: NominaComponent },
  { path: 'calculo-nomina', component: CalculoNominaComponent },
  // Path principal: 'historial-de-nomina' (coincide con db_admin.modulo).
  // Mantenemos 'historico-nomina' como alias por compatibilidad con bookmarks antiguos.
  { path: 'historial-de-nomina', loadComponent: () => import('./pages/historico-nomina/historico-nomina.component').then(m => m.HistoricoNominaComponent) },
  { path: 'historico-nomina', redirectTo: 'historial-de-nomina', pathMatch: 'full' },
  // Path principal: 'historial-de-novedades' (coincide con db_admin.modulo).
  // Mantenemos 'historico-novedades' como alias por si alguien tiene bookmarks.
  { path: 'historial-de-novedades', loadComponent: () => import('./pages/historico-novedades/historico-novedades.component').then(m => m.HistoricoNovedadesComponent) },
  { path: 'historico-novedades', redirectTo: 'historial-de-novedades', pathMatch: 'full' },
  { path: 'parametrizacion-novedades', loadComponent: () => import('./pages/parametrizacion-novedades/parametrizacion-novedades.component').then(m => m.ParametrizacionNovedadesComponent) },
  // Path principal: 'homologador-de-novedades' (coincide con db_admin.modulo).
  // Mantenemos 'homologador' como alias por compatibilidad con bookmarks/menus antiguos.
  { path: 'homologador-de-novedades', loadComponent: () => import('./pages/homologador/homologador.component').then(m => m.HomologadorComponent) },
  { path: 'homologador', redirectTo: 'homologador-de-novedades', pathMatch: 'full' },
];
