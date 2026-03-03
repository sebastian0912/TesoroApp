import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContratacionMetricasApiService } from '../../services/contratacion-metricas-api.service';
import { MetricasContratacionFiltersBarComponent } from '../../components/filters/metricas-contratacion-filters-bar/metricas-contratacion-filters-bar.component';
import { ContratacionKpiStripComponent } from '../../components/kpi-strip/contratacion-kpi-strip/contratacion-kpi-strip.component';
import { ChartCardComponent } from '../../../../shared/components/chart-card/chart-card.component';
import { FormulariosPorOficinaChartComponent } from '../../components/charts/formularios-por-oficina-chart/formularios-por-oficina-chart.component';
import { CelularConfirmadoChartComponent } from '../../components/charts/celular-confirmado-chart/celular-confirmado-chart.component';
import { PipelinePorOficinaChartComponent } from '../../components/charts/pipeline-por-oficina-chart/pipeline-por-oficina-chart.component';
import { SinCelularTableComponent } from '../../components/charts/sin-celular-table/sin-celular-table.component';

@Component({
    selector: 'app-contratacion-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        MetricasContratacionFiltersBarComponent,
        ContratacionKpiStripComponent,
        ChartCardComponent,
        FormulariosPorOficinaChartComponent,
        CelularConfirmadoChartComponent,
        PipelinePorOficinaChartComponent,
        SinCelularTableComponent
    ],
    templateUrl: './contratacion-dashboard.component.html',
    styleUrls: ['./contratacion-dashboard.component.css']
})
export class ContratacionDashboardComponent {
    public apiService = inject(ContratacionMetricasApiService);

    // Observables directly exposed to the template via async pipe
    kpiSummary$ = this.apiService.kpiSummary$;
    formulariosPorOficina$ = this.apiService.formulariosPorOficina$;
    pipelinePorOficina$ = this.apiService.pipelinePorOficina$;
    pipelineXAxis$ = this.apiService.pipelineOffices$;
    sinCelularList$ = this.apiService.sinCelularList$;

    onDateRangeChanged(range: { start: Date, end: Date }) {
        this.apiService.updateDateRange(range.start, range.end);
    }

}
