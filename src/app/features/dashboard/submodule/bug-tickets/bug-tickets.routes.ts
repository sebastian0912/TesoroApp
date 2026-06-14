import { Routes } from '@angular/router';
import { BugDashboardComponent } from './pages/bug-dashboard/bug-dashboard.component';
import { TicketsListComponent } from './pages/tickets-list/tickets-list.component';
import { FeatureComingSoonComponent } from '../../../../shared/components/feature-coming-soon/feature-coming-soon.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: BugDashboardComponent },
  { path: 'tickets', component: TicketsListComponent },
  // Submódulo "Bugs Reportados" todavía no implementado.
  { path: 'bugs', component: FeatureComingSoonComponent, data: { feature: 'Bugs Reportados' } },
];
