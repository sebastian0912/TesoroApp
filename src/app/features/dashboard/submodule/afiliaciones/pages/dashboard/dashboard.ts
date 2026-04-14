import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AfiliacionesDashboardService } from '../../services/afiliaciones-dashboard.service';
import { AfiliacionesFiltersBarComponent } from '../../components/filters/afiliaciones-filters-bar.component';
import { AfiliacionesKpiStripComponent } from '../../components/kpi-strip/afiliaciones-kpi-strip.component';
import { ContratacionesTableComponent } from '../../components/contrataciones-table/contrataciones-table.component';
import { ChartCardComponent } from '../../../metricas/shared/components/chart-card/chart-card.component';
import { ResumenPorOficina, ResumenPorEmpresa } from '../../models/afiliaciones-dashboard.models';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-afiliaciones-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    AfiliacionesFiltersBarComponent,
    AfiliacionesKpiStripComponent,
    ContratacionesTableComponent,
    ChartCardComponent
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class AfiliacionesDashboard {
  public service = inject(AfiliacionesDashboardService);

  kpiSummary$ = this.service.kpiSummary$;
  contrataciones$ = this.service.contratacionesFiltradas$;
  resumenOficinas$ = this.service.resumenPorOficina$;
  resumenEmpresas$ = this.service.resumenPorEmpresa$;

  onDateRangeChanged(range: { start: Date; end: Date }) {
    this.service.updateDateRange(range.start, range.end);
  }

  onSearchChanged(term: string) {
    this.service.updateSearch(term);
  }

  getMaxBar(items: ResumenPorOficina[] | ResumenPorEmpresa[]): number {
    if (!items || items.length === 0) return 1;
    return Math.max(...items.map(i => i.total));
  }
}
