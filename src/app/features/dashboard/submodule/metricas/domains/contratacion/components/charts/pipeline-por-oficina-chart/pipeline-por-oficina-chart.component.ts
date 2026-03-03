import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { ChartSeriesPoint } from '../../../models/contratacion-metricas.models';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
    selector: 'app-pipeline-por-oficina-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsDirective, EmptyStateComponent],
    providers: [provideEchartsCore({ echarts: () => import('echarts') })],
    template: `
    <div class="chart-container" *ngIf="hasData; else empty">
      <div echarts [options]="chartOption" [merge]="chartUpdate" class="echarts-wrapper"></div>
    </div>
    <ng-template #empty>
      <app-empty-state 
        icon="view_kanban" 
        title="Sin Pipeline"
        description="No hay eventos de contratacion para estos filtros.">
      </app-empty-state>
    </ng-template>
  `,
    styles: [`
    :host { display: block; height: 100%; width: 100%; }
    .chart-container { height: 100%; width: 100%; }
    .echarts-wrapper { height: 100%; min-height: 400px; width: 100%; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PipelinePorOficinaChartComponent implements OnChanges {
    @Input() seriesData: ChartSeriesPoint[] | null = null;
    @Input() xAxisCategories: string[] = [];

    hasData = false;

    chartOption: EChartsOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { top: 10 },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', data: [] },
        yAxis: { type: 'value' },
        color: ['#6366f1', '#14b8a6', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'],
        series: []
    };

    chartUpdate: any;

    ngOnChanges(changes: SimpleChanges): void {
        if ((changes['seriesData'] || changes['xAxisCategories']) && this.seriesData) {
            const isNotEmpty = this.seriesData.some(s => s.data && s.data.some(v => v > 0));

            if (isNotEmpty && this.xAxisCategories?.length > 0) {
                this.hasData = true;
                this.chartUpdate = {
                    xAxis: { data: this.xAxisCategories },
                    series: this.seriesData
                };
            } else {
                this.hasData = false;
            }
        }
    }
}
