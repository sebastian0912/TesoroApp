import { Routes } from '@angular/router';
import { NominaComponent } from './pages/nomina/nomina.component';
import { CalculoNominaComponent } from './pages/calculo-nomina/calculo-nomina.component';

export const routes: Routes = [
  { path: 'empleados', component: NominaComponent },
  { path: 'calculo-nomina', component: CalculoNominaComponent }
];
