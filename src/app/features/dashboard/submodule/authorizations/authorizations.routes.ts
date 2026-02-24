import { Routes } from '@angular/router';
import { AutorizacionMercadoComponent } from './pages/autorizacion-mercado/autorizacion-mercado.component';
import { AutorizacionPrestamoComponent } from './pages/autorizacion-prestamo/autorizacion-prestamo.component';

export const routes: Routes = [
  { path: 'market-bonus', component: AutorizacionMercadoComponent },
  { path: 'money-loan', component: AutorizacionPrestamoComponent }
];
