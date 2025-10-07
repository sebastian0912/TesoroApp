import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GestionUsuariosComponent } from './pages/gestion-usuarios/gestion-usuarios.component';
import { GestionRolesComponent } from './pages/gestion-roles/gestion-roles.component';
import { GestionModulosComponent } from './pages/gestion-modulos/gestion-modulos.component';
import { GestionParametrizacionComponent } from './pages/gestion-parametrizacion/gestion-parametrizacion.component';
import { CambiarContrasenaComponent } from './pages/cambiar-contrasena/cambiar-contrasena.component';

export const routes: Routes = [
  { path: 'manage-users', component: GestionUsuariosComponent },
  { path: 'manage-roles', component: GestionRolesComponent },
  { path: 'manage-modules', component: GestionModulosComponent },
  { path: 'manage-parameterization', component: GestionParametrizacionComponent },
  { path: 'change-password', component: CambiarContrasenaComponent }
];
