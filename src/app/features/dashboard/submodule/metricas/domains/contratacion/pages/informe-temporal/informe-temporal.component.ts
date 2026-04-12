import { Component, inject, signal, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
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
import Swal from 'sweetalert2';

import { ContratacionMetricasApiService } from '../../services/contratacion-metricas-api.service';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

interface KpiData {
  total_procesos: number;
  entrevistado: number;
  prueba_tecnica: number;
  autorizado: number;
  examenes_medicos: number;
  total_contratados: number;
  total_ingreso: number;
  total_rechazados: number;
  total_espera: number;
}

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
export class InformeTemporalComponent implements OnInit, OnDestroy {
  private api = inject(ContratacionMetricasApiService);
  private cdr = inject(ChangeDetectorRef);
  private refreshInterval: any = null;
  private readonly REFRESH_MS = 30_000; // 30 segundos

  // Filtros — por defecto último mes
  temporalControl = new FormControl('');
  dateRange = new FormGroup({
    start: new FormControl<Date | null>(this.daysAgo(30)),
    end: new FormControl<Date | null>(new Date()),
  });

  readonly temporales = ['APOYO LABORAL TS SAS', 'TU ALIANZA SAS'];

  // Estado
  loading = signal(false);
  hasData = signal(false);
  errorMsg = signal('');
  kpis = signal<KpiData | null>(null);
  rows = signal<any[]>([]);

  // Gráficas (ECharts options)
  chartOficina = signal<any>(null);
  chartFinca = signal<any>(null);
  chartTendencia = signal<any>(null);
  chartFunnel = signal<any>(null);
  chartMotivos = signal<any>(null);

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

  // Colores corporativos
  private readonly C = {
    primary: '#051b3f',
    blue: '#1565C0',
    green: '#2E7D32',
    greenLight: '#558B2F',
    cyan: '#00838F',
    purple: '#6A1B9A',
    red: '#C62828',
    yellow: '#F57F17',
    grey: '#78909C',
  };

  ngOnInit() {
    this.consultar();
    // Refresh automático cada 30s para datos en vivo
    this.refreshInterval = setInterval(() => this.consultarSilencioso(), this.REFRESH_MS);
  }

  ngOnDestroy() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  private daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  /** Recarga sin mostrar spinner (datos en vivo) */
  private consultarSilencioso() {
    const temporal = (this.temporalControl.value || '').trim();
    const range = this.dateRange.value;
    const start = range.start ? this.toYMD(range.start) : '';
    const end = range.end ? this.toYMD(range.end) : '';

    this.api.fetchMetricasTemporal(temporal, start, end).subscribe({
      next: (resp: any) => {
        if (!resp || typeof resp !== 'object') return;
        const k = resp.kpis || {};
        this.kpis.set({
          total_procesos: k.total_procesos ?? 0, entrevistado: k.entrevistado ?? 0,
          prueba_tecnica: k.prueba_tecnica ?? 0, autorizado: k.autorizado ?? 0,
          examenes_medicos: k.examenes_medicos ?? 0, total_contratados: k.total_contratados ?? 0,
          total_ingreso: k.total_ingreso ?? 0, total_rechazados: k.total_rechazados ?? 0,
          total_espera: k.total_espera ?? 0,
        });
        this.rows.set(Array.isArray(resp.rows) ? resp.rows : []);
        this.buildChartOficina(Array.isArray(resp.por_oficina) ? resp.por_oficina : []);
        this.buildChartFinca(Array.isArray(resp.por_finca) ? resp.por_finca : []);
        this.buildChartTendencia(Array.isArray(resp.por_fecha) ? resp.por_fecha : []);
        this.buildChartFunnel(Array.isArray(resp.funnel_oficina) ? resp.funnel_oficina : []);
        this.buildChartMotivos(Array.isArray(resp.motivos_no_aplica) ? resp.motivos_no_aplica : []);
        this.hasData.set(true);
        this.cdr.markForCheck();
      },
      error: () => { /* silencioso — no interrumpir al usuario */ },
    });
  }

  consultar() {
    if (this.loading()) return; // evitar doble clic

    const temporal = (this.temporalControl.value || '').trim();
    const range = this.dateRange.value;
    const start = range.start ? this.toYMD(range.start) : '';
    const end = range.end ? this.toYMD(range.end) : '';

    this.loading.set(true);
    this.errorMsg.set('');

    this.api.fetchMetricasTemporal(temporal, start, end).subscribe({
      next: (resp: any) => {
        if (!resp || typeof resp !== 'object') {
          this.setEmpty('Respuesta vacía del servidor.');
          return;
        }

        const k = resp.kpis || {};
        this.kpis.set({
          total_procesos: k.total_procesos ?? 0,
          entrevistado: k.entrevistado ?? 0,
          prueba_tecnica: k.prueba_tecnica ?? 0,
          autorizado: k.autorizado ?? 0,
          examenes_medicos: k.examenes_medicos ?? 0,
          total_contratados: k.total_contratados ?? 0,
          total_ingreso: k.total_ingreso ?? 0,
          total_rechazados: k.total_rechazados ?? 0,
          total_espera: k.total_espera ?? 0,
        });

        this.rows.set(Array.isArray(resp.rows) ? resp.rows : []);
        this.buildChartOficina(Array.isArray(resp.por_oficina) ? resp.por_oficina : []);
        this.buildChartFinca(Array.isArray(resp.por_finca) ? resp.por_finca : []);
        this.buildChartTendencia(Array.isArray(resp.por_fecha) ? resp.por_fecha : []);
        this.buildChartFunnel(Array.isArray(resp.funnel_oficina) ? resp.funnel_oficina : []);
        this.buildChartMotivos(Array.isArray(resp.motivos_no_aplica) ? resp.motivos_no_aplica : []);

        this.hasData.set(true);
        this.loading.set(false);
        this.cdr.markForCheck();
      },
      error: (err: any) => {
        console.error('[informe-temporal] Error:', err);
        const detail = err?.error?.detail || err?.message || 'Error de conexión con el servidor.';
        this.setEmpty(detail);
        Swal.fire({ icon: 'error', title: 'Error cargando métricas', text: detail, confirmButtonColor: '#051b3f' });
      },
    });
  }

  private setEmpty(msg: string) {
    this.loading.set(false);
    this.hasData.set(false);
    this.errorMsg.set(msg);
    this.kpis.set(null);
    this.rows.set([]);
    this.chartOficina.set(null);
    this.chartFinca.set(null);
    this.chartTendencia.set(null);
    this.chartFunnel.set(null);
    this.chartMotivos.set(null);
    this.cdr.markForCheck();
  }

  private toYMD(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private safe(v: any): string { return String(v ?? '').trim() || 'Sin dato'; }

  // ─── Chart builders ───

  private buildChartOficina(data: any[]) {
    if (!data.length) { this.chartOficina.set(null); return; }
    const sorted = [...data].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    this.chartOficina.set({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: sorted.map(d => this.safe(d.name)), axisLabel: { rotate: 30, fontSize: 11, interval: 0 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'bar', data: sorted.map(d => d.value ?? 0),
        itemStyle: { color: this.C.blue, borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top', fontWeight: 'bold', fontSize: 12 },
        barMaxWidth: 50,
      }],
      grid: { top: 30, bottom: 80, left: 50, right: 20 },
    });
  }

  private buildChartFinca(data: any[]) {
    if (!data.length) { this.chartFinca.set(null); return; }
    const sorted = [...data].sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    this.chartFinca.set({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'category', data: sorted.map(d => this.safe(d.name)), axisLabel: { rotate: 35, fontSize: 10, interval: 0 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'bar', data: sorted.map(d => d.value ?? 0),
        itemStyle: { color: this.C.green, borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top', fontWeight: 'bold', fontSize: 12 },
        barMaxWidth: 50,
      }],
      grid: { top: 30, bottom: 100, left: 50, right: 20 },
    });
  }

  private buildChartTendencia(data: any[]) {
    if (!data.length) { this.chartTendencia.set(null); return; }
    this.chartTendencia.set({
      tooltip: { trigger: 'axis' },
      xAxis: { type: 'category', data: data.map(d => String(d.name ?? '')), axisLabel: { rotate: 45, fontSize: 10, interval: 0 }, boundaryGap: false },
      yAxis: { type: 'value', minInterval: 1 },
      series: [{
        type: 'line', data: data.map(d => d.value ?? 0), smooth: true,
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(21,101,192,0.25)' }, { offset: 1, color: 'rgba(21,101,192,0.02)' }] } },
        itemStyle: { color: this.C.blue }, lineStyle: { width: 3 },
        label: { show: data.length <= 30, position: 'top', fontSize: 10 },
        symbol: 'circle', symbolSize: 6,
      }],
      grid: { top: 30, bottom: 80, left: 50, right: 20 },
    });
  }

  private buildChartFunnel(data: any[]) {
    if (!data.length) { this.chartFunnel.set(null); return; }

    const oficinas = data.map(d => this.safe(d.oficina));
    const stages = [
      { key: 'entrevistado', name: 'Entrevistado', color: this.C.purple },
      { key: 'prueba_o_auto', name: 'Prueba/Autorizado', color: this.C.blue },
      { key: 'examenes', name: 'Exámenes', color: this.C.cyan },
      { key: 'contratado', name: 'Contratado', color: this.C.green },
      { key: 'ingreso', name: 'Ingreso', color: this.C.greenLight },
      { key: 'rechazado', name: 'No Aplica (911)', color: this.C.red },
    ];

    this.chartFunnel.set({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { data: stages.map(s => s.name), bottom: 0, type: 'scroll', textStyle: { fontSize: 11 } },
      xAxis: { type: 'category', data: oficinas, axisLabel: { rotate: 30, fontSize: 10, interval: 0 } },
      yAxis: { type: 'value', minInterval: 1 },
      series: stages.map(s => ({
        name: s.name, type: 'bar', stack: 'pipeline',
        data: data.map(d => d[s.key] ?? 0),
        itemStyle: { color: s.color },
        emphasis: { focus: 'series' },
      })),
      grid: { top: 30, bottom: 80, left: 50, right: 20 },
    });
  }

  private buildChartMotivos(data: any[]) {
    if (!data.length) { this.chartMotivos.set(null); return; }

    // Truncar nombres largos y limpiar nulls
    const clean = data.map(d => ({
      name: String(d.name ?? 'Sin motivo').substring(0, 60),
      value: d.value ?? 0,
    }));

    this.chartMotivos.set({
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      xAxis: { type: 'value', minInterval: 1 },
      yAxis: { type: 'category', data: clean.map(d => d.name).reverse(), axisLabel: { fontSize: 11, width: 180, overflow: 'truncate' } },
      series: [{
        type: 'bar', data: clean.map(d => d.value).reverse(),
        itemStyle: { color: this.C.red, borderRadius: [0, 6, 6, 0] },
        label: { show: true, position: 'right', fontWeight: 'bold', fontSize: 12 },
        barMaxWidth: 30,
      }],
      grid: { left: 200, right: 50, top: 10, bottom: 20 },
    });
  }
}
