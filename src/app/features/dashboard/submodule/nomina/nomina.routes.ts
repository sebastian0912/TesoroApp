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
  // Submódulo "Entidades Externas" (mantenimiento general con borrado lógico,
  // tipo controlado). Ruta canónica: 'entidades-externas'. Se mantienen los
  // paths 'empresas-usuarias' y 'emepresa-usuaria' (este último es el del menú
  // pre-sembrado en db_admin.modulo, con typo) como alias al mismo componente
  // general, para que el menú actual siga funcionando sin tocar datos productivos.
  { path: 'entidades-externas', loadComponent: () => import('./pages/entidades-externas/entidades-externas.component').then(m => m.EntidadesExternasComponent) },
  { path: 'empresas-usuarias', loadComponent: () => import('./pages/entidades-externas/entidades-externas.component').then(m => m.EntidadesExternasComponent) },
  { path: 'emepresa-usuaria', loadComponent: () => import('./pages/entidades-externas/entidades-externas.component').then(m => m.EntidadesExternasComponent) },
  // Submódulo "Centros de Costo" (mantenimiento con borrado lógico).
  // Ruta canónica: 'centros-costo'. El item de menú debe registrarse en
  // db_admin.modulo con ruta 'nomina/centros-costo' (igual que los demás
  // submódulos de nómina); no se tocan datos productivos desde aquí.
  { path: 'centros-costo', loadComponent: () => import('./pages/centros-costo/centros-costo.component').then(m => m.CentrosCostoComponent) },
  // Path principal: 'homologador-de-novedades' (coincide con db_admin.modulo).
  // Mantenemos 'homologador' como alias por compatibilidad con bookmarks/menus antiguos.
  { path: 'homologador-de-novedades', loadComponent: () => import('./pages/homologador/homologador.component').then(m => m.HomologadorComponent) },
  { path: 'homologador', redirectTo: 'homologador-de-novedades', pathMatch: 'full' },
  // Submódulo "Reportes y Analítica" (solo lectura). Ruta canónica: 'reportes'
  // porque el ítem de menú en db_admin.modulo (creado desde la UI de admin,
  // id ba6d847d-…) apunta a '/dashboard/nomina/reportes'. Se dejan alias
  // descriptivos por compatibilidad con bookmarks.
  { path: 'reportes', loadComponent: () => import('./pages/reportes-analitica/reportes-analitica.component').then(m => m.ReportesAnaliticaComponent) },
  { path: 'reportes-analitica', redirectTo: 'reportes', pathMatch: 'full' },
  { path: 'reportes-y-analitica', redirectTo: 'reportes', pathMatch: 'full' },
  { path: 'analitica', redirectTo: 'reportes', pathMatch: 'full' },
  // Submódulo "Analítica Nómina IA" (informe con anomalías + chat asistente).
  // Ruta canónica: 'analitica-nomina-ia' → registrar el ítem de menú en
  // db_admin.modulo con ruta 'nomina/analitica-nomina-ia'. Alias descriptivos
  // por compatibilidad. Habla con ms-payroll (/api/nomina/analitica-ia) y con
  // ms-ai (/ia/nomina/*) a través del gateway.
  { path: 'analitica-nomina-ia', loadComponent: () => import('./pages/analitica-nomina-ia/analitica-nomina-ia.component').then(m => m.AnaliticaNominaIaComponent) },
  { path: 'analitica-ia', redirectTo: 'analitica-nomina-ia', pathMatch: 'full' },
  { path: 'nomina-ia', redirectTo: 'analitica-nomina-ia', pathMatch: 'full' },
];
