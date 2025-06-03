import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VacantesComponent } from './pages/vacantes/vacantes.component';

const routes: Routes = [
  { path: '', component: VacantesComponent, data: { title: 'Vacantes' } },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VacanciesRoutingModule { }
