import { Component, Input, ChangeDetectionStrategy, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import type { EChartsOption } from 'echarts';
import { EmptyStateComponent } from '../../../../../shared/components/empty-state/empty-state.component';

@Component({
    selector: 'app-inventario-top-products-chart',
    standalone: true,
    imports: [CommonModule, NgxEchartsDirective, EmptyStateComponent],
    providers: [provideEchartsCore({ echarts: () => import('echarts') }), CurrencyPipe],
    template: `
    <div class="chart-container" *ngIf="hasData; else empty">
      <div echarts [options]="chartOption" [merge]="chartUpdate" class="echarts-wrapper"></div>
    </div>
    <ng-template #empty>
      <app-empty-state 
        icon="inventory_2" 
        title="Sin Top Productos"
        description="No hay transacciones de inventario con salida de productos para el periodo.">
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
export class InventarioTopProductsChartComponent implements OnChanges {
    @Input() rawTransactions: any[] | null = null;

    hasData = false;

    chartOption: EChartsOption = {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'value' },
        yAxis: { type: 'category', data: [], axisLabel: { interval: 0, width: 90, overflow: 'truncate' } },
        color: ['#8b5cf6'],
        series: [
            {
                name: 'Valor Solicitado/Salida',
                type: 'bar',
                barWidth: '50%',
                label: { show: true, position: 'right' },
                itemStyle: { borderRadius: [0, 4, 4, 0] },
                data: []
            }
        ]
    };

    chartUpdate: any;

    pipe = new CurrencyPipe('es-CO');

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['rawTransactions'] && this.rawTransactions) {
            // Extraer concepto MERCADO que tengan detalle asociado con lotes
            const prodMap: Record<string, number> = {};

            this.rawTransactions.forEach(tx => {
                if (tx.concepto === 'MERCADO' && tx.estado === 'EJECUTADA') { // Asumimos ventas por mercado
                    const detalle = tx.detalle || {};
                    const items = detalle.items || detalle.ventas || []; // Backend struct
                    if (Array.isArray(items)) {
                        items.forEach((item: any) => {
                            // En este fallback sumamos la cantidad monetaria si possible
                            // Si no, la cantidad nominal. Depende como lo guarde el backend.
                            let prodName = item.producto_nombre || item.lote_nombre || `Prod #${item.lote_id}`;
                            let monto = Number(tx.valor) || 0; // Aproximacion si no tenemos el valor desagregado
                            if (!prodMap[prodName]) prodMap[prodName] = 0;
                            prodMap[prodName] += (item.cantidad || 1); // Contemos cantidad por default
                        });
                    } else {
                        // Si el stringify era un objeto simple "MERCADO"
                        let p = detalle.nombre_producto || 'Varios';
                        if (!prodMap[p]) prodMap[p] = 0;
                        prodMap[p] += 1;
                    }
                }
            });

            const entries = Object.entries(prodMap)
                .sort((a, b) => a[1] - b[1]) // Ascendente para que quede top_1 arriba en YAxis horizontal
                .slice(-6); // top 6

            this.hasData = entries.length > 0;
            if (this.hasData) {
                this.chartUpdate = {
                    yAxis: { data: entries.map(e => e[0]) },
                    series: [{
                        data: entries.map(e => ({ value: e[1] }))
                    }]
                };
            }
        }
    }
}
