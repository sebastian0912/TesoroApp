import { Component, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ContratacionMetricasApiService } from '../../services/contratacion-metricas-api.service';
import { CandidatosExcelDownloadService } from '../../services/candidatos-excel-download.service';
import { MetricasContratacionFiltersBarComponent } from '../../components/filters/metricas-contratacion-filters-bar/metricas-contratacion-filters-bar.component';
import { ContratacionKpiStripComponent } from '../../components/kpi-strip/contratacion-kpi-strip/contratacion-kpi-strip.component';
import { ChartCardComponent } from '../../../../shared/components/chart-card/chart-card.component';
import { FormulariosPorOficinaChartComponent } from '../../components/charts/formularios-por-oficina-chart/formularios-por-oficina-chart.component';
import { CelularConfirmadoChartComponent } from '../../components/charts/celular-confirmado-chart/celular-confirmado-chart.component';
import { PipelinePorOficinaChartComponent } from '../../components/charts/pipeline-por-oficina-chart/pipeline-por-oficina-chart.component';
import { SinCelularTableComponent } from '../../components/charts/sin-celular-table/sin-celular-table.component';

@Component({
    changeDetection: ChangeDetectionStrategy.OnPush,
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
    private downloader = inject(CandidatosExcelDownloadService);
    private snack = inject(MatSnackBar);
    private destroyRef = inject(DestroyRef);

    kpiSummary$ = this.apiService.kpiSummary$;
    formulariosPorOficina$ = this.apiService.formulariosPorOficina$;
    pipelineVM$ = this.apiService.pipelineVM$;
    sinCelularList$ = this.apiService.sinCelularList$;

    /** Signal compartido con el servicio de descarga — controla el overlay del layout. */
    public downloading = this.downloader.downloading;

    constructor() {
        this.apiService.errors$
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(msg => this.snack.open(msg, 'Cerrar', { duration: 4500 }));
    }

    onDateRangeChanged(range: { start: Date, end: Date }) {
        this.apiService.updateDateRange(range.start, range.end);
    }

    onFormulariosSegmentClick(e: { oficina: string }): void {
        this.downloader.run(
            this.apiService.getDocsByOficina(e.oficina),
            { filenameHint: `oficina-${e.oficina}`, contextLabel: `Oficina: ${e.oficina}` }
        );
    }

    onCelularSegmentClick(e: { conCelular: boolean }): void {
        const label = e.conCelular ? 'con-celular' : 'sin-celular';
        this.downloader.run(
            this.apiService.getDocsByCelularStatus(e.conCelular),
            {
                filenameHint: label,
                contextLabel: e.conCelular ? 'Candidatos con celular' : 'Candidatos sin celular'
            }
        );
    }

    onPipelineSegmentClick(e: { oficina: string; stage: string }): void {
        this.downloader.run(
            this.apiService.getDocsByPipelineSegment(e.oficina, e.stage),
            {
                filenameHint: `${e.oficina}-${e.stage}`,
                contextLabel: `${e.oficina} · ${e.stage}`
            }
        );
    }

    onSinCelularBulkDownload(docs: string[]): void {
        this.downloader.runDirect(docs, {
            filenameHint: 'sin_celular',
            contextLabel: 'Candidatos sin celular'
        });
    }

    onSinCelularRowDownload(doc: string): void {
        this.downloader.runDirect([doc], { filenameHint: `candidato_${doc}` });
    }
}
