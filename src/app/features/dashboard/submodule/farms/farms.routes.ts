import { Routes } from '@angular/router';
import { FarmsComponent } from './pages/farms/farms.component';

export const routes: Routes = [
  { path: '', redirectTo: 'management-farms', pathMatch: 'full' },
  { path: 'management-farms', component: FarmsComponent }
];
