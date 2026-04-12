import { Routes } from '@angular/router';
import { MetricasHomeComponent } from './pages/metricas-home/metricas-home.component';

export const routes: Routes = [
    {
        path: '',
        component: MetricasHomeComponent,
        children: [
            { path: '', redirectTo: 'tesoreria', pathMatch: 'full' },
            {
                path: 'tesoreria',
                loadComponent: () => import('./domains/tesoreria/pages/tesoreria-dashboard/tesoreria-dashboard.component').then(m => m.TesoreriaDashboardComponent)
            },
            {
                path: 'contratacion',
                loadComponent: () => import('./domains/contratacion/pages/informe-temporal/informe-temporal.component').then(m => m.InformeTemporalComponent)
            }
        ]
    }
];