import { Routes } from '@angular/router';

import { FormularioIncapacidadComponent } from './pages/formulario-incapacidad/formulario-incapacidad.component';
import { BuscarIncapacidadComponent } from './pages/buscar-incapacidad/buscar-incapacidad.component';
import { VistaTotalIncapacidadesComponent } from './pages/vista-total-incapacidades/vista-total-incapacidades.component';
import { SubidaArchivosIncapacidadesComponent } from './pages/subida-archivos-incapacidades/subida-archivos-incapacidades.component';

export const routes: Routes = [
    { path: 'formulario', component: FormularioIncapacidadComponent },
    { path: 'buscar', component: BuscarIncapacidadComponent },
    { path: 'total', component: VistaTotalIncapacidadesComponent },
    { path: 'subir', component: SubidaArchivosIncapacidadesComponent }
];
