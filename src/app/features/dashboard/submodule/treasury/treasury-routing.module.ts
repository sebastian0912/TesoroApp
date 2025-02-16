import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManageWorkersComponent } from './pages/manage-workers/manage-workers.component';

const routes: Routes = [
  { path: 'manage-workers', component: ManageWorkersComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TreasuryRoutingModule { }
