import { Routes } from '@angular/router';
import { TrasladosComponent } from './pages/traslados/traslados.component';
import { TransferQueryComponent } from './pages/transfer-query/transfer-query.component';

export const routes: Routes = [
  { path: 'process-transfers', component: TrasladosComponent },
  { path: 'transfer-query', component: TransferQueryComponent },
];
