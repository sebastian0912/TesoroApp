import { Routes } from '@angular/router';
import { AutorizacionDinamicaComponent } from './pages/autorizacion-dinamica/autorizacion-dinamica.component';

export const routes: Routes = [
  {
    path: 'market-bonus',
    component: AutorizacionDinamicaComponent,
    data: { tipoAutorizacion: 'mercado' }
  },
  {
    path: 'money-loan',
    component: AutorizacionDinamicaComponent,
    data: { tipoAutorizacion: 'prestamo' }
  }
];
