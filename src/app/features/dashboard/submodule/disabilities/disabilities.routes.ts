import { Routes } from '@angular/router';

import { FormularioIncapacidadComponent } from './pages/formulario-incapacidad/formulario-incapacidad.component';
import { BuscarIncapacidadComponent } from './pages/buscar-incapacidad/buscar-incapacidad.component';
import { VistaTotalIncapacidadesComponent } from './pages/vista-total-incapacidades/vista-total-incapacidades.component';
import { SubidaArchivosIncapacidadesComponent } from './pages/subida-archivos-incapacidades/subida-archivos-incapacidades.component';

export const routes: Routes = [
  { path: '', redirectTo: 'formulario', pathMatch: 'full' },
    { path: 'formulario', component: FormularioIncapacidadComponent },
    { path: 'buscar', component: BuscarIncapacidadComponent },
    { path: 'total', component: VistaTotalIncapacidadesComponent },
    { path: 'subir', component: SubidaArchivosIncapacidadesComponent },

    // ── Incapacidades v2 ────────────────────────────────────────────────
    // Rutas HERMANAS de las viejas: los 4 componentes de arriba siguen
    // vivos hasta que la funcional valide los nuevos. Se cargan con
    // `loadComponent` (lazy) para no engordar el bundle del modulo.
    {
      path: 'registro',
      loadComponent: () =>
        import('./pages/registro-incapacidad/registro-incapacidad.component').then(
          (m) => m.RegistroIncapacidadComponent,
        ),
    },
    // Edicion: misma pantalla de registro con el id en la ruta. La consulta
    // navega aqui desde su boton "Editar" (ver RUTA_REGISTRO).
    {
      path: 'registro/:id',
      loadComponent: () =>
        import('./pages/registro-incapacidad/registro-incapacidad.component').then(
          (m) => m.RegistroIncapacidadComponent,
        ),
    },
    // Consulta / CRUD: listado paginado en servidor, filtros avanzados,
    // detalle, validacion, borrado logico y exportacion con seleccion de
    // columnas.
    {
      path: 'consulta',
      loadComponent: () =>
        import('./pages/consulta-incapacidades/consulta-incapacidades.component').then(
          (m) => m.ConsultaIncapacidadesComponent,
        ),
    }
];
