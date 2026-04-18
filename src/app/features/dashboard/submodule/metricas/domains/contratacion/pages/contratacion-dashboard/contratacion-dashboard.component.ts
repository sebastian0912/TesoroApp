import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';
import { ContratacionMetricasApiService } from '../../services/contratacion-metricas-api.service';
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
    private snack = inject(MatSnackBar);

    kpiSummary$ = this.apiService.kpiSummary$;
    formulariosPorOficina$ = this.apiService.formulariosPorOficina$;
    pipelinePorOficina$ = this.apiService.pipelinePorOficina$;
    pipelineXAxis$ = this.apiService.pipelineOffices$;
    sinCelularList$ = this.apiService.sinCelularList$;

    public downloading = signal(false);

    onDateRangeChanged(range: { start: Date, end: Date }) {
        this.apiService.updateDateRange(range.start, range.end);
    }

    // ── Click handlers ──────────────────────────────────────────
    onFormulariosSegmentClick(e: { oficina: string }): void {
        this.runDownload(
            this.apiService.getDocsByOficina(e.oficina),
            `oficina-${e.oficina}`,
            `Oficina: ${e.oficina}`
        );
    }

    onCelularSegmentClick(e: { conCelular: boolean }): void {
        const label = e.conCelular ? 'con-celular' : 'sin-celular';
        this.runDownload(
            this.apiService.getDocsByCelularStatus(e.conCelular),
            label,
            e.conCelular ? 'Candidatos con celular' : 'Candidatos sin celular'
        );
    }

    onPipelineSegmentClick(e: { oficina: string; stage: string }): void {
        const label = `${e.oficina}-${e.stage}`.replace(/\s+/g, '_');
        this.runDownload(
            this.apiService.getDocsByPipelineSegment(e.oficina, e.stage),
            label,
            `${e.oficina} · ${e.stage}`
        );
    }

    onSinCelularBulkDownload(docs: string[]): void {
        if (!docs?.length) {
            this.snack.open('No hay candidatos para descargar.', 'Cerrar', { duration: 2500 });
            return;
        }
        if (this.downloading()) return;
        this.downloading.set(true);
        this.snack.open(`Descargando ${docs.length} candidato(s)…`, 'Cerrar', { duration: 2500 });
        this.apiService.downloadCandidatosExcel(docs, 'sin_celular').subscribe({
            next: () => {
                this.downloading.set(false);
                this.snack.open('Excel descargado.', 'Cerrar', { duration: 2000 });
            },
            error: err => {
                this.downloading.set(false);
                console.error('[downloadCandidatosExcel]', err);
                this.snack.open('Error al descargar el Excel.', 'Cerrar', { duration: 3500 });
            }
        });
    }

    onSinCelularRowDownload(doc: string): void {
        if (!doc) return;
        if (this.downloading()) return;
        this.downloading.set(true);
        this.apiService.downloadCandidatosExcel([doc], `candidato_${doc}`).subscribe({
            next: () => {
                this.downloading.set(false);
                this.snack.open('Excel descargado.', 'Cerrar', { duration: 2000 });
            },
            error: err => {
                this.downloading.set(false);
                console.error('[downloadCandidatosExcel]', err);
                this.snack.open('Error al descargar el Excel.', 'Cerrar', { duration: 3500 });
            }
        });
    }

    // ── Shared runner ───────────────────────────────────────────
    private runDownload(docs$: Observable<string[]>, filenameHint: string, contextLabel: string): void {
        if (this.downloading()) return;
        this.downloading.set(true);
        docs$.subscribe({
            next: docs => {
                if (!docs.length) {
                    this.downloading.set(false);
                    this.snack.open(`Sin candidatos para "${contextLabel}".`, 'Cerrar', { duration: 3000 });
                    return;
                }
                this.snack.open(`Descargando ${docs.length} candidato(s)…`, 'Cerrar', { duration: 2500 });
                this.apiService.downloadCandidatosExcel(docs, this.slug(filenameHint)).subscribe({
                    next: () => {
                        this.downloading.set(false);
                        this.snack.open('Excel descargado.', 'Cerrar', { duration: 2000 });
                    },
                    error: err => {
                        this.downloading.set(false);
                        console.error('[downloadCandidatosExcel]', err);
                        this.snack.open('Error al descargar el Excel.', 'Cerrar', { duration: 3500 });
                    }
                });
            },
            error: err => {
                this.downloading.set(false);
                console.error('[resolveDocs]', err);
                this.snack.open('Error al resolver los candidatos.', 'Cerrar', { duration: 3500 });
            }
        });
    }

    private slug(s: string): string {
        return s
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9_-]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .toLowerCase() || 'candidatos';
    }
}
