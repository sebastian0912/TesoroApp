import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CargarMercadoComponent } from './pages/cargar-mercado/cargar-mercado.component';
import { CargarMercadoFeriasComponent } from './pages/cargar-mercado-ferias/cargar-mercado-ferias.component';
import { MercadoComercializadoraComponent } from './pages/mercado-comercializadora/mercado-comercializadora.component';

const routes: Routes = [
  { path: 'load-market', component: CargarMercadoComponent },
  { path: 'load-fair-market', component: CargarMercadoFeriasComponent },
  { path: 'marketing-market', component: MercadoComercializadoraComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MarketRoutingModule { }
