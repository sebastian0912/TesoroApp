import { Routes } from '@angular/router';
import { FeatureComingSoonComponent } from '../../../../shared/components/feature-coming-soon/feature-coming-soon.component';

// Placeholder routes para Mercado (Carga de Mercado, Ferias, Comercializadora).
// Implementación pendiente — ver tickets backlog.
export const routes: Routes = [
  { path: '', redirectTo: 'load-market', pathMatch: 'full' },
  {
    path: 'load-market',
    component: FeatureComingSoonComponent,
    data: { feature: 'Carga de Mercado' },
  },
  {
    path: 'load-fair-market',
    component: FeatureComingSoonComponent,
    data: { feature: 'Carga de Mercado — Ferias' },
  },
  {
    path: 'marketing-market',
    component: FeatureComingSoonComponent,
    data: { feature: 'Carga de Mercado — Comercializadora' },
  },
];
