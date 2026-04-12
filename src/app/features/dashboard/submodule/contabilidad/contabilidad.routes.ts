import { Routes } from '@angular/router';
import { DashboardContabilidadComponent } from './pages/dashboard-contabilidad/dashboard-contabilidad.component';
import { QuincenasComponent } from './pages/quincenas/quincenas.component';
import { AnalisisNominaComponent } from './pages/analisis-nomina/analisis-nomina.component';

export const routes: Routes = [
  { path: '', redirectTo: 'inicio', pathMatch: 'full' },
  { path: 'inicio', component: DashboardContabilidadComponent },
  { path: 'carga', component: QuincenasComponent },
  { path: 'analisis-nomina', component: AnalisisNominaComponent },
];
