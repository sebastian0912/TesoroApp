import { Routes } from '@angular/router';
import { EditarEnvioComponent } from './pages/editar-envio/editar-envio.component';
import { EnviarMercanciaComponent } from './pages/enviar-mercancia/enviar-mercancia.component';
import { RecibirEnvioComponent } from './pages/recibir-envio/recibir-envio.component';

export const routes: Routes = [
  { path: 'send-merchandise', component: EnviarMercanciaComponent },
  { path: 'edit-merchandise', component: EditarEnvioComponent },
  { path: 'receive-merchandise', component: RecibirEnvioComponent }
];
