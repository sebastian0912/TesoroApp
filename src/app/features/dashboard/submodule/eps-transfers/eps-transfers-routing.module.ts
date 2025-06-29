import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TrasladosComponent } from './pages/traslados/traslados.component';
import { TransferQueryComponent } from './pages/transfer-query/transfer-query.component';

const routes: Routes = [
  { path: 'process-transfers', component: TrasladosComponent },
  { path: 'transfer-query', component: TransferQueryComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EpsTransfersRoutingModule { }
