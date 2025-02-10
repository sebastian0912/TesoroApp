import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HistorialAutorizacionesComponent } from './pages/historial-autorizaciones/historial-autorizaciones.component';
import { HistorialModificacionesComponent } from './pages/historial-modificaciones/historial-modificaciones.component';

const routes: Routes = [
  { path: 'authorizations-history', component: HistorialAutorizacionesComponent },
  { path: 'modifications-history', component: HistorialModificacionesComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class HistoryRoutingModule { }
