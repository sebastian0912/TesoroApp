import { Routes } from '@angular/router';
import { HistorialAutorizacionesComponent } from './pages/historial-autorizaciones/historial-autorizaciones.component';
import { HistorialModificacionesComponent } from './pages/historial-modificaciones/historial-modificaciones.component';

export const routes: Routes = [
  { path: '', redirectTo: 'authorizations-history', pathMatch: 'full' },
  { path: 'authorizations-history', component: HistorialAutorizacionesComponent },
  { path: 'modifications-history', component: HistorialModificacionesComponent },
];
