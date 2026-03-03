import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';
import * as _moment from 'moment';
// @ts-ignore
const moment = _moment.default || _moment;

@Component({
    selector: 'app-tx-timeseries-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsDirective, EmptyStateComponent],
    providers: [provideEchartsCore({ echarts: () => import('echarts') })],
    template: `
    <div class="chart-container" *ngIf="hasData; else empty">
      <div echarts [options]="chartOption" [merge]="chartUpdate" class="echarts-wrapper"></div>
    </div>
    <ng-template #empty>
      <app-empty-state 
        icon="show_chart" 
        title="Sin Datos de Tiempo"
        description="No encontramos transacciones ejecutadas ni autorizadas en este rango.">
      </app-empty-state>
    </ng-template>
  `,
    styles: [`
    :host { display: block; height: 100%; width: 100%; }
    .chart-container { height: 100%; width: 100%; }
    .echarts-wrapper { height: 100%; min-height: 250px; width: 100%; }
  `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TxTimeseriesChartComponent implements OnChanges {
    // Recibe la data cruda, tabulamos internamente para no ensuciar el facade
    @Input() rawTransactions: any[] | null = null;

    hasData = false;

    chartOption: EChartsOption = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } }
        },
        legend: {
            data: ['Monto Ejecutado', 'Monto Autorizado'],
            bottom: 0
        },
        grid: {
            left: '3%', right: '4%', bottom: '15%', containLabel: true
        },
        xAxis: [
            {
                type: 'category',
                boundaryGap: false,
                data: []
            }
        ],
        yAxis: [
            {
                type: 'value',
                axisLabel: { formatter: '$ {value}' }
            }
        ],
        color: ['#10b981', '#0ea5e9'],
        series: [
            {
                name: 'Monto Ejecutado',
                type: 'line',
                stack: 'Total',
                areaStyle: { opacity: 0.3 },
                smooth: true,
                data: []
            },
            {
                name: 'Monto Autorizado',
                type: 'line',
                stack: 'Total2',
                areaStyle: { opacity: 0.3 },
                smooth: true,
                data: []
            }
        ]
    };

    chartUpdate: any;

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['rawTransactions'] && this.rawTransactions) {
            if (this.rawTransactions.length === 0) {
                this.hasData = false;
                return;
            }
            this.hasData = true;

            // Group by date (YYYY-MM-DD)
            const groups: Record<string, { ejecutado: number, autorizado: number }> = {};

            this.rawTransactions.forEach(tx => {
                if (!tx.created_at) return;
                const dt = moment(tx.created_at).format('YYYY-MM-DD');
                if (!groups[dt]) groups[dt] = { ejecutado: 0, autorizado: 0 };

                const val = Number(tx.valor) || 0;
                if (tx.estado === 'EJECUTADA') groups[dt].ejecutado += val;
                else if (tx.estado === 'AUTORIZADA') groups[dt].autorizado += val;
            });

            // Sort dates
            const dates = Object.keys(groups).sort();
            const execData = dates.map(d => groups[d].ejecutado);
            const autData = dates.map(d => groups[d].autorizado);

            // Limitar a los que tengan movimientos
            if (execData.every(v => v === 0) && autData.every(v => v === 0)) {
                this.hasData = false;
                return;
            }

            this.chartUpdate = {
                xAxis: [{ data: dates.map(d => moment(d).format('MMM DD')) }],
                series: [
                    { data: execData },
                    { data: autData }
                ]
            };
        }
    }
}
