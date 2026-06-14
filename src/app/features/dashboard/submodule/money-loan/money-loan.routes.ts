import { Routes } from '@angular/router';
import { PrestamoCalamidadComponent } from './pages/prestamo-calamidad/prestamo-calamidad.component';
import { PrestamoParaRealizarComponent } from './pages/prestamo-para-realizar/prestamo-para-realizar.component';

export const routes: Routes = [
  { path: 'emergency-loan', component: PrestamoCalamidadComponent },
  { path: 'loan-to-perform', component: PrestamoParaRealizarComponent }
];
