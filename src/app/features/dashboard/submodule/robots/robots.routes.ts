import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { RobotsComponent } from './pages/robots/robots.component';


export const routes: Routes = [
    { path: 'dashboard-robots', component: RobotsComponent }
];

