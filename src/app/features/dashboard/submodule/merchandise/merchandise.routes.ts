import { Routes } from '@angular/router';
import { FeatureComingSoonComponent } from '../../../../shared/components/feature-coming-soon/feature-coming-soon.component';

// Placeholder routes para Comercializadora » Mercancía.
// Implementación pendiente — ver tickets backlog.
export const routes: Routes = [
  { path: '', redirectTo: 'edit-merchandise', pathMatch: 'full' },
  {
    path: 'edit-merchandise',
    component: FeatureComingSoonComponent,
    data: { feature: 'Mercancía — Edición' },
  },
  {
    path: 'send-merchandise',
    component: FeatureComingSoonComponent,
    data: { feature: 'Mercancía — Envío' },
  },
  {
    path: 'receive-merchandise',
    component: FeatureComingSoonComponent,
    data: { feature: 'Mercancía — Recepción' },
  },
];
