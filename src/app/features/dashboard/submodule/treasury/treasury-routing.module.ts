import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ManageWorkersComponent } from './pages/manage-workers/manage-workers.component';
import { UploadTreasuryComponent } from './pages/upload-treasury/upload-treasury.component';

const routes: Routes = [
  { path: 'manage-workers', component: ManageWorkersComponent },
  { path: 'upload-treasury', component: UploadTreasuryComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TreasuryRoutingModule { }
