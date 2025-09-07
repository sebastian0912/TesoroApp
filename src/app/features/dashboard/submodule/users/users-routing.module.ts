import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GestionUsuariosComponent } from './pages/gestion-usuarios/gestion-usuarios.component';

const routes: Routes = [
  { path: 'manage-users', component: GestionUsuariosComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UsersRoutingModule { }
