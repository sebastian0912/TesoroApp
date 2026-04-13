import { Component, OnInit, inject, ChangeDetectionStrategy, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';

import { TesoreriaMetricasApiService } from '../../services/tesoreria-metricas-api.service';
import { MetricasDateRange } from '../../models/tesoreria-metricas.models';

import { ChartCardComponent } from '../../../../shared/components/chart-card/chart-card.component';
import { KpiStripComponent } from '../../components/kpi-strip/kpi-strip.component';
import { MetricasFiltersBarComponent } from '../../components/filters/metricas-filters-bar/metricas-filters-bar.component';
import { TxTimeseriesChartComponent } from '../../components/charts/tx-timeseries-chart/tx-timeseries-chart.component';
import { TxFunnelChartComponent } from '../../components/charts/tx-funnel-chart/tx-funnel-chart.component';
import { PersonasDistributionChartComponent } from '../../components/charts/personas-distribution-chart/personas-distribution-chart.component';
import { InventarioTopProductsChartComponent } from '../../components/charts/inventario-top-products-chart/inventario-top-products-chart.component';
import { HistorialTableComponent } from '../../components/historial-table/historial-table.component';
import { TopCompradoresChartComponent } from '../../components/charts/top-compradores-chart/top-compradores-chart.component';
import { RankingAutorizadoresChartComponent } from '../../components/charts/ranking-autorizadores-chart/ranking-autorizadores-chart.component';
import { ProductosFechaChartComponent } from '../../components/charts/productos-fecha-chart/productos-fecha-chart.component';

@Component({
    selector: 'app-tesoreria-dashboard',
    standalone: true,
    imports: [
        CommonModule,
        ChartCardComponent,
        KpiStripComponent,
        MetricasFiltersBarComponent,
        TxTimeseriesChartComponent,
        TxFunnelChartComponent,
        PersonasDistributionChartComponent,
        InventarioTopProductsChartComponent,
        HistorialTableComponent,
        TopCompradoresChartComponent,
        RankingAutorizadoresChartComponent,
        ProductosFechaChartComponent
    ],
    templateUrl: './tesoreria-dashboard.component.html',
    styleUrls: ['./tesoreria-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TesoreriaDashboardComponent implements OnInit, OnDestroy {
    public store = inject(TesoreriaMetricasApiService);

    ngOnInit(): void { }

    ngOnDestroy(): void { }

    onRangeChanged(range: MetricasDateRange): void {
        this.store.updateDateRange(range.start, range.end);
    }
}
