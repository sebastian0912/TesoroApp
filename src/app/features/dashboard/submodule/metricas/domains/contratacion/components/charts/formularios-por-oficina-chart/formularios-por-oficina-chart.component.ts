import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { ChartDataPoint } from '../../../models/contratacion-metricas.models';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
    selector: 'app-formularios-por-oficina-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsDirective, EmptyStateComponent],
    providers: [provideEchartsCore({ echarts: () => import('echarts') })],
    template: `
    <div class="chart-container" *ngIf="hasData; else empty">
      <div echarts [options]="chartOption" [merge]="chartUpdate" class="echarts-wrapper"></div>
    </div>
    <ng-template #empty>
      <app-empty-state 
        icon="assignment" 
        title="Sin Formularios"
        description="No se encontraron formularios llenados para el rango y criterios especificados.">
      </app-empty-state>
    </ng-template>
  `,
    styles: [`
    :host { display: block; height: 100%; width: 100%; }
    .chart-container { height: 100%; width: 100%; }
    .echarts-wrapper { height: 100%; min-height: 350px; width: 100%; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormulariosPorOficinaChartComponent implements OnChanges {
    @Input() data: ChartDataPoint[] | null = null;
    hasData = false;

    chartOption: EChartsOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: [], axisTick: { alignWithLabel: true } },
        series: [
            {
                name: 'Formularios Llenados',
                type: 'bar',
                barWidth: '60%',
                data: [],
                itemStyle: { color: '#3b82f6', borderRadius: [0, 4, 4, 0] },
                label: { show: true, position: 'right' }
            }
        ]
    };
    chartUpdate: any;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['data'] && this.data) {
            if (this.data.length > 0) {
                this.hasData = true;
                // Invert for horizontal bar descending
                const sorted = [...this.data].sort((a, b) => a.value - b.value);
                this.chartUpdate = {
                    yAxis: { data: sorted.map(d => d.name) },
                    series: [{ data: sorted.map(d => d.value) }]
                };
            } else {
                this.hasData = false;
            }
        }
    }
}
