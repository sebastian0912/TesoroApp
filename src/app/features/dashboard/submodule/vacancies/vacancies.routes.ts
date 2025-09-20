import { Routes } from '@angular/router';
import { VacantesComponent } from './pages/vacantes/vacantes.component';

export const routes: Routes = [
  { path: '', component: VacantesComponent, data: { title: 'Vacantes' } },
];

