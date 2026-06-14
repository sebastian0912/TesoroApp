import { Routes } from '@angular/router';
import { FeatureComingSoonComponent } from '../../../../shared/components/feature-coming-soon/feature-coming-soon.component';

// Placeholder routes para Préstamos por Calamidad y Programados.
// Implementación pendiente — ver tickets backlog.
export const routes: Routes = [
  { path: '', redirectTo: 'emergency-loan', pathMatch: 'full' },
  {
    path: 'emergency-loan',
    component: FeatureComingSoonComponent,
    data: { feature: 'Préstamo por Calamidad' },
  },
  {
    path: 'loan-to-perform',
    component: FeatureComingSoonComponent,
    data: { feature: 'Préstamo Programado' },
  },
];
