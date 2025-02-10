import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TrasladosComponent } from './pages/traslados/traslados.component';

const routes: Routes = [
  { path: 'process-transfers', component: TrasladosComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EpsTransfersRoutingModule { }
