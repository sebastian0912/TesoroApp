import { Routes } from '@angular/router';
import { ManagePositionsComponent } from './pages/manage-positions/manage-positions.component';

export const routes: Routes = [
  { path: '', redirectTo: 'manage-positions', pathMatch: 'full' },
  { path: 'manage-positions', component: ManagePositionsComponent }
];
