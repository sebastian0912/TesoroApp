import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EditarAdministrativoComponent } from './pages/editar-administrativo/editar-administrativo.component';
import { EditarRolComponent } from './pages/editar-rol/editar-rol.component';
import { EditarSedeComponent } from './pages/editar-sede/editar-sede.component';
import { EliminarAdministrativosComponent } from './pages/eliminar-administrativos/eliminar-administrativos.component';
import { CreacionUsuariosTrasladosComponent } from './pages/creacion-usuarios-traslados/creacion-usuarios-traslados.component';
import { CambiarContrasenaComponent } from './pages/cambiar-contrasena/cambiar-contrasena.component';

const routes: Routes = [
  { path: 'edit-admin', component: EditarAdministrativoComponent },
  { path: 'edit-role', component: EditarRolComponent },
  { path: 'edit-location', component: EditarSedeComponent },
  { path: 'remove-admin', component: EliminarAdministrativosComponent },
  { path: 'create-transfer-user', component: CreacionUsuariosTrasladosComponent },
  { path: 'change-password', component: CambiarContrasenaComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsersRoutingModule { }
