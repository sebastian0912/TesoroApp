import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';

import { ContratacionMetricasApiService } from '../../services/contratacion-metricas-api.service';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

@Component({
  selector: 'app-informe-temporal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatCardModule, MatProgressSpinnerModule,
    NgxEchartsDirective,
    StandardFilterTable,
  ],
  providers: [provideEchartsCore({ echarts: () => import('echarts') })],
  templateUrl: './informe-temporal.component.html',
  styleUrls: ['./informe-temporal.component.css'],
})
export class InformeTemporalComponent {
  private api = inject(ContratacionMetricasApiService);

  // Filtros
  temporalControl = new FormControl('');
  dateRange = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  readonly temporales = [
    'APOYO LABORAL TS SAS',
    'TU ALIANZA SAS',
  ];

  // Estado
  loading = signal(false);
  kpis = signal<any>(null);
  rows = signal<any[]>([]);

  // Gráficas
  chartOficina = signal<any>(null);
  chartFinca = signal<any>(null);
  chartTendencia = signal<any>(null);

  // Tabla
  readonly tableColumns: ColumnDefinition[] = [
    { name: 'numero_documento', header: 'Documento', type: 'text', width: '130px' },
    { name: 'primer_nombre', header: 'Nombre', type: 'text', width: '140px' },
    { name: 'primer_apellido', header: 'Apellido', type: 'text', width: '140px' },
    { name: 'oficina', header: 'Oficina', type: 'text', width: '140px' },
    { name: 'empresa', header: 'Empresa', type: 'text', width: '180px' },
    { name: 'finca', header: 'Finca', type: 'text', width: '160px' },
    { name: 'fecha_ingreso', header: 'Fecha ingreso', type: 'date', width: '130px' },
  ];

  consultar() {
    const temporal = this.temporalControl.value || '';
    const range = this.dateRange.value;
    const start = range.start ? this.toYMD(range.start) : '';
    const end = range.end ? this.toYMD(range.end) : '';

    this.loading.set(true);
    this.api.fetchMetricasTemporal(temporal, start, end).subscribe({
      next: (resp: any) => {
        this.kpis.set(resp.kpis || {});
        this.rows.set(resp.rows || []);
        this.buildChartOficina(resp.por_oficina || []);
        this.buildChartFinca(resp.por_finca || []);
        this.buildChartTendencia(resp.por_fecha || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  private toYMD(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private buildChartOficina(data: { name: string; value: number }[]) {
    this.chartOficina.set({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: data.map(d => d.name || 'Sin oficina'), axisLabel: { rotate: 30 } },
      yAxis: { type: 'value' },
      series: [{ type: 'bar', data: data.map(d => d.value), itemStyle: { color: '#1565C0' }, label: { show: true, position: 'top' } }],
      grid: { bottom: 80 },
    });
  }

  private buildChartFinca(data: { name: string; value: number }[]) {
    this.chartFinca.set({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      legend: { bottom: 0, type: 'scroll' },
      series: [{
        type: 'pie', radius: ['35%', '65%'],
        data: data.map(d => ({ name: d.name || 'Sin finca', value: d.value })),
        label: { show: true, formatter: '{b}\n{c}' },
      }],
    });
  }

  private buildChartTendencia(data: { name: string; value: number }[]) {
    this.chartTendencia.set({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: data.map(d => d.name), axisLabel: { rotate: 45 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{ type: 'line', data: data.map(d => d.value), smooth: true, areaStyle: { opacity: 0.15 }, itemStyle: { color: '#2E7D32' }, label: { show: true } }],
      grid: { bottom: 80 },
    });
  }
}
