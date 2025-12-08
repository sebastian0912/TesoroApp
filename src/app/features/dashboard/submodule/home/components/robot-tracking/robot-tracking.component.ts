import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  inject,
  PLATFORM_ID,
  NgZone,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import type ApexCharts from 'apexcharts';
import type { ApexOptions } from 'apexcharts';
import { HomeService } from '../../service/home.service';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

type EstadoBucket = 'FINALIZADO' | 'EN_PROGRESO' | 'SIN_CONSULTAR';
type PeriodKey = 'dia' | 'semana' | 'mes';
type AntecedenteKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo_pension'
  | 'medidas_correctivas';

interface EstadosPorClave {
  FINALIZADO: number;
  EN_PROGRESO: number;
  SIN_CONSULTAR: number;
  TOTAL_ESTADO: number;
}

interface TablaEstadosRow {
  oficina: string;
  total_registros: number;
  estados: Record<AntecedenteKey, EstadosPorClave>;
}

interface TablaEstadosPorOficina {
  resultados: TablaEstadosRow[];
  totales: {
    total_registros: number;
    estados: Record<AntecedenteKey, EstadosPorClave>;
  };
}

interface PromedioAntecedente {
  promedio_segundos: number | null;   // <- usamos este tal cual
  promedio_hhmmss: string | null;
  n_finalizados_validos: number;
}

interface PromediosGenerales {
  por_antecedente: Record<AntecedenteKey, PromedioAntecedente>;
  max_promedio: { antecedente: AntecedenteKey | null; segundos: number | null; hhmmss: string | null };
  muestra_registros_corte: number;
}

interface PeriodoPayload {
  tabla: TablaEstadosPorOficina;
  promedios: PromediosGenerales;
}

interface EstadosRobotsResponse {
  rango: {
    dia: { start: string; end_exclusive: string };
    semana: { start: string; end_exclusive: string };
    mes: { start: string; end_exclusive: string };
    tz: string;
  };
  dia: PeriodoPayload;
  semana: PeriodoPayload;
  mes: PeriodoPayload;
}

interface RobotFlatRow {
  oficina: string;
  total_registros: number;
  [k: string]: string | number;
}

@Component({
  selector: 'app-robot-tracking',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatProgressBarModule,
    MatToolbarModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatTooltipModule,
    StandardFilterTable,
  ],
  templateUrl: './robot-tracking.component.html',
  styleUrl: './robot-tracking.component.css',
})
export class RobotTrackingComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private stats = inject(HomeService);
  private zone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  oficina?: string;

  // Períodos (también usados como ids de hosts para charts)
  periods = [
    { key: 'dia' as PeriodKey, title: 'Hoy',           avgHost: 'avg-dia',    countHost: 'count-dia' },
    { key: 'semana' as PeriodKey, title: 'Esta semana',   avgHost: 'avg-semana', countHost: 'count-semana' },
    { key: 'mes' as PeriodKey,    title: 'Este mes',      avgHost: 'avg-mes',    countHost: 'count-mes' },
  ] as const;

  private readonly LABELS: Record<AntecedenteKey, string> = {
    adress: 'ADRES',
    policivo: 'Policivo',
    ofac: 'OFAC',
    contraloria: 'Contraloría',
    sisben: 'Sisbén',
    procuraduria: 'Procuraduría',
    fondo_pension: 'Fondo pensión',
    medidas_correctivas: 'Medidas correctivas',
  };

  private charts: Record<string, ApexCharts | undefined> = {};

  // Payload "todo junto" (rango + { tabla, promedios } por período)
  resumen: EstadosRobotsResponse | null = null;

  // ====== TABLA (toggle por período) ======
  selectedPeriod: PeriodKey = 'dia';

  columnDefinitionsPeriod: ColumnDefinition[] = [
    {
      name: 'estado',
      header: 'Estado',
      type: 'select',
      options: [
        'ADRES',
        'Policivo',
        'OFAC',
        'Contraloría',
        'Sisbén',
        'Procuraduría',
        'Fondo pensión',
        'Medidas correctivas',
      ],
      stickyStart: true,
    },
    { name: 'finalizado',    header: 'Finalizado',    type: 'number', align: 'right', width: '140px' },
    { name: 'en_progreso',   header: 'En progreso',   type: 'number', align: 'right', width: '140px' },
    { name: 'sin_consultar', header: 'Sin consultar', type: 'number', align: 'right', width: '160px' },
    { name: 'total',         header: 'Total',         type: 'number', align: 'right', width: '120px' },
  ];

  tableTitle = 'Estados por período';
  pageSizeOptions = [8, 20, 50];
  defaultPageSize = 8;

  tableDataDia: any[] = [];
  tableDataSemana: any[] = [];
  tableDataMes: any[] = [];

  get activeTableData(): any[] {
    return this.selectedPeriod === 'dia'
      ? this.tableDataDia
      : this.selectedPeriod === 'semana'
      ? this.tableDataSemana
      : this.tableDataMes;
  }

  // Spinner y error para la carga unificada
  loading = false;
  errorMsg = '';

  // ====== CICLO DE VIDA ======
  ngOnInit(): void {
    this.cargarResumen();
  }

  ngAfterViewInit(): void {
    if (this.isBrowser && this.resumen) this.scheduleRender();
  }

  ngOnDestroy(): void {
    Object.values(this.charts).forEach((c) => c?.destroy());
    this.charts = {};
  }

  // ======= API: DISPARADOR (botón Actualizar) =======
  cargarResumen(): void {
    this.loading = true;
    this.errorMsg = '';

    this.stats.getRobotPeriodosUnificado({ oficina: this.oficina }).subscribe({
      next: (res: EstadosRobotsResponse) => {
        this.resumen = res;

        // Construir datasets para la tabla por período usando el payload combinado
        this.tableDataDia    = this.buildTableFromCombined('dia', res);
        this.tableDataSemana = this.buildTableFromCombined('semana', res);
        this.tableDataMes    = this.buildTableFromCombined('mes', res);

        this.loading = false;

        if (!this.isBrowser) return;
        // Asegura que se pinte el DOM antes de montar los charts
        this.cdr.detectChanges();
        this.scheduleRender();
      },
      error: (err) => {
        this.errorMsg = err?.message || 'Error al cargar datos';
        this.loading = false;
      },
    });
  }

  setOficina(ofi?: string) {
    this.oficina = ofi || undefined;
    this.cargarResumen();
  }

  onTogglePeriod(value: PeriodKey) {
    this.selectedPeriod = value;
  }

  // ======= Espera a que existan los hosts de los charts =======
  private scheduleRender(retries = 15, delayMs = 60): void {
    if (!this.isBrowser) return;

    const ready = this.periods.every(
      (p) => document.getElementById(p.avgHost) && document.getElementById(p.countHost)
    );

    if (ready) {
      this.zone.runOutsideAngular(() => this.renderAll());
      return;
    }

    if (retries <= 0) return;

    this.zone.runOutsideAngular(() => {
      setTimeout(() => this.scheduleRender(retries - 1, delayMs), delayMs);
    });
  }

  // ======= RENDER CHARTS =======
  private renderAll(): void {
    if (!this.resumen) return;

    for (const p of this.periods) {
      const bucket = this.resumen?.[p.key] as PeriodoPayload;

      // --- Promedios (SEGUNDOS) desde promedios.por_antecedente ---
      const prom = bucket?.promedios?.por_antecedente || {};
      const keys = this.statesOrder();
      const categories = keys.map((k) => this.LABELS[k]);

      // usamos promedio_segundos "tal cual"
      const avgData = keys.map((k) => this.toSeconds(prom?.[k]?.promedio_segundos));

      // --- Conteos: Finalizados vs Pendientes (EN_PROGRESO + SIN_CONSULTAR) ---
      const tot = bucket?.tabla?.totales?.estados || {};
      const finData = keys.map((k) => Number(tot?.[k]?.FINALIZADO ?? 0));
      const penData = keys.map(
        (k) => Number(tot?.[k]?.EN_PROGRESO ?? 0) + Number(tot?.[k]?.SIN_CONSULTAR ?? 0)
      );

      const avgOpts   = this.makeAvgOptions(categories, avgData, p.title);
      const countOpts = this.makeCountOptions(categories, finData, penData, p.title);

      this.mountChart(p.avgHost, avgOpts);
      this.mountChart(p.countHost, countOpts);
    }
  }

  private async mountChart(hostId: string, opts: ApexOptions): Promise<void> {
    if (!this.isBrowser) return;
    const el = document.getElementById(hostId);
    if (!el) return;

    const Apex = (await import('apexcharts')).default as typeof ApexCharts; // dynamic import SSR-safe

    if (this.charts[hostId]) {
      await this.charts[hostId]!.destroy();
      delete this.charts[hostId];
    }

    const chart = new Apex(el, opts);
    this.charts[hostId] = chart;
    await chart.render();
  }

  // ======= HELPERS =======
  private toSeconds(s: number | null | undefined): number | null {
    if (s == null) return null; // null → “sin dato” (no afecta serie)
    return Math.round(Number(s)); // normalizamos a entero
  }

  private statesOrder(): AntecedenteKey[] {
    return [
      'adress',
      'policivo',
      'ofac',
      'contraloria',
      'sisben',
      'procuraduria',
      'fondo_pension',
      'medidas_correctivas',
    ];
  }

  /** Construye filas para la tabla desde el payload combinado (totales por período) */
  private buildTableFromCombined(periodKey: PeriodKey, res: EstadosRobotsResponse): any[] {
    const out: any[] = [];
    const keys = this.statesOrder();
    const bucket = res?.[periodKey] as PeriodoPayload;
    const estadosTotales = bucket?.tabla?.totales?.estados || {};

    keys.forEach((stateKey) => {
      const item = estadosTotales[stateKey] as EstadosPorClave | undefined;
      const fin  = Number(item?.FINALIZADO ?? 0);
      const prog = Number(item?.EN_PROGRESO ?? 0);
      const sc   = Number(item?.SIN_CONSULTAR ?? 0);
      const total = fin + prog + sc;

      out.push({
        estado: this.LABELS[stateKey],
        finalizado: fin,
        en_progreso: prog,
        sin_consultar: sc,
        total,
      });
    });

    return out;
  }

  private makeAvgOptions(
    categories: string[],
    data: (number | null)[],
    title: string
  ): ApexOptions {
    // Apex no admite null en la serie → sustituimos por 0 solo para pintar
    const serie = (data || []).map((v) => (v == null ? 0 : v));
    return {
      chart: {
        type: 'bar',
        height: 320,
        toolbar: { show: false },
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      },
      title: { text: `${title} · Promedio por antecedente (s)`, align: 'left' },
      series: [{ name: 'Promedio (s)', data: serie }],
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 6 } },
      dataLabels: { enabled: true, style: { fontSize: '12px' } }, // muestra el valor de la serie
      xaxis: {
        categories,
        labels: { rotate: -15, trim: true },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        title: { text: 'Segundos' },                                   // <- eje Y en segundos
        labels: { formatter: (v) => `${Math.round(Number(v))}` },       // <- enteros en labels
      }, // yaxis.labels.formatter: docs
      grid: { borderColor: '#eee', strokeDashArray: 4, padding: { left: 12, right: 12 } },
      tooltip: { shared: true, intersect: false },
      legend: { show: false },
    };
  }

  private makeCountOptions(
    categories: string[],
    finData: number[],
    penData: number[],
    title: string
  ): ApexOptions {
    return {
      chart: {
        type: 'bar',
        stacked: true, // stacked para Finalizados vs Pendientes
        height: 320,
        toolbar: { show: false },
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
      },
      title: { text: `${title} · Finalizados vs Pendientes`, align: 'left' },
      series: [
        { name: 'Finalizados', data: finData },
        { name: 'Pendientes', data: penData },
      ],
      plotOptions: { bar: { columnWidth: '45%', borderRadius: 6 } },
      dataLabels: { enabled: false },
      xaxis: {
        categories,
        labels: { rotate: -15, trim: true },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        title: { text: 'Registros' },
        labels: { formatter: (v) => `${Math.round(Number(v))}` },
      },
      legend: { position: 'top', horizontalAlign: 'right' },
      grid: { borderColor: '#eee', strokeDashArray: 4, padding: { left: 12, right: 12 } },
      tooltip: { shared: true, intersect: false },
    };
  }
}
