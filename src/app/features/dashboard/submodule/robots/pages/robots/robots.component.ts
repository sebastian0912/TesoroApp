import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { catchError, finalize, map, take, tap } from 'rxjs/operators';

import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';

import Swal from 'sweetalert2';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

import {
  RobotsService,
  PendientesPorOficinaResponse,
  EstadoRobotStatsResponse,
  StatsGroup,
  AntecedenteKey,
  UltimosPorMarcaTemporalRow,
} from '../../services/robots/robots.service';

// =========================
// PENDIENTES POR OFICINA
// =========================
type PendienteKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo_pension'
  | 'union';

type PendientesOficinasMatrixRow = {
  tipo: string;
  key: PendienteKey | '__TOTAL__';
  total?: number;
  [k: string]: any;
};

// =========================
// ROBOTS FULL
// =========================
type RobotFullRow = {
  oficina: string | null;
  Robot: string | null;
  Cedula: string | null;
  Tipo_documento: string | null;
  Estado_Adress: string | null;
  Nombre_Adress: string | null;
  Apellido_Adress: string | null;
  Entidad_Adress: string | null;
  PDF_Adress: string | null;
  Fecha_Adress: string | null;

  Estado_Policivo: string | null;
  Anotacion_Policivo: string | null;
  PDF_Policivo: string | null;

  Estado_OFAC: string | null;
  Anotacion_OFAC: string | null;
  PDF_OFAC: string | null;

  Estado_Contraloria: string | null;
  Anotacion_Contraloria: string | null;
  PDF_Contraloria: string | null;

  Estado_Sisben: string | null;
  Tipo_Sisben: string | null;
  PDF_Sisben: string | null;
  Fecha_Sisben: string | null;

  Estado_Procuraduria: string | null;
  Anotacion_Procuraduria: string | null;
  PDF_Procuraduria: string | null;

  Estado_FondoPension: string | null;
  Entidad_FondoPension: string | null;
  PDF_FondoPension: string | null;
  Fecha_FondoPension: string | null;
};

// =========================
// ✅ ULTIMOS POR MARCA TEMPORAL (por antecedente)
/// =========================
type UltimosAntecedenteUiKey =
  | 'adress'
  | 'policivo'
  | 'procuraduria'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'fondo_pension'
  | 'union'
  | 'medidas_correctivas';

// =========================
// STATS MULTILÍNEA
// =========================
type StatsPoint = { period: string } & Record<string, any>;
type TooltipState = { key: string; label: string; stroke: string };

type ChartLineVm = {
  key: string;
  label: string;
  stroke: string;
  d: string;
  y: number[]; // y pixel por punto (para hover circles)
};

type ChartVm = {
  yMax: number;
  ticks: { y: number; label: string }[];
  xMarks: { x: number; label: string }[];
  xPoints: number[];
  paths: ChartLineVm[];
};

@Component({
  selector: 'app-robots',
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatIconModule,
    MatCardModule,
    MatButtonModule,

    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,

    StandardFilterTable,
  ],
  templateUrl: './robots.component.html',
  styleUrl: './robots.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RobotsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);

  @ViewChild('chartWrap') chartWrap!: ElementRef<HTMLDivElement>;

  constructor(private readonly robots: RobotsService) {}

  // =========================
  // STATE (TABLAS)
  // =========================
  isLoadingRobotsFull = false;
  robotsFullRows: RobotFullRow[] = [];
  robotsFullColumns: ColumnDefinition[] = [];

  isLoadingPendientesPorOficina = false;
  pendientesPorOficinaRows: PendientesOficinasMatrixRow[] = [];
  pendientesPorOficinaColumns: ColumnDefinition[] = [];

  // =========================
  // ✅ STATE (ÚLTIMOS POR ANTECEDENTE)
  // =========================
  isLoadingUltimos = false;
  ultimosRows: UltimosPorMarcaTemporalRow[] = [];
  ultimosColumns: ColumnDefinition[] = [];

  ultimosForm: FormGroup = this.fb.group({
    antecedente: ['adress' as UltimosAntecedenteUiKey],
    estado: [''], // opcional
    limit: [50], // 1..200
  });

  readonly ultimosAntecedentesOptions: Array<{ key: UltimosAntecedenteUiKey; label: string }> = [
    { key: 'adress', label: 'Adress (marca_temporal_adress)' },
    { key: 'policivo', label: 'Policivo (marca_temporal_policivo)' },
    { key: 'procuraduria', label: 'Procuraduría (marca_temporal_procuraduria)' },
    { key: 'ofac', label: 'OFAC (marca_temporal_ofac)' },
    { key: 'contraloria', label: 'Contraloría (marca_temporal_contraloria)' },
    { key: 'sisben', label: 'Sisben (marca_temporal_sisben)' },
    { key: 'fondo_pension', label: 'Fondo Pensión (marca_temporal_fondo_pension)' },
    { key: 'union', label: 'Unión (marca_temporal_union)' },
    { key: 'medidas_correctivas', label: 'Medidas Correctivas (marca_temporal_medidas_correctivas)' },
  ];

  // =========================
  // STATE (STATS / GRAFICA)
  // =========================
  isLoadingStats = false;
  stats: EstadoRobotStatsResponse | null = null;

  // ✅ puntos crudos (cada punto trae period + estados)
  statsSeries: StatsPoint[] = [];

  // ✅ catálogo estados detectados + colores
  tooltipStates: TooltipState[] = [];

  oficinasOptions: string[] = [];

  statsForm: FormGroup = this.fb.group({
    from: [''],
    to: [''],
    group: ['day' as StatsGroup],
    oficina: [''],
  });

  // hover/tooltip
  hoverIndex: number | null = null;
  tooltip = { leftPx: 0, topPx: 0 };
  tooltipSide: 'left' | 'right' = 'right';

  // SVG layout
  chartBox = { w: 1000, h: 320, padL: 56, padR: 20, padT: 18, padB: 44 };

  // =========================
  // CONFIG
  // =========================
  private readonly pendientesKeys: Array<{ key: PendienteKey; label: string }> = [
    { key: 'adress', label: 'Adress' },
    { key: 'policivo', label: 'Policivos' },
    { key: 'ofac', label: 'OFAC' },
    { key: 'contraloria', label: 'Contraloría' },
    { key: 'sisben', label: 'Sisben' },
    { key: 'procuraduria', label: 'Procuraduría' },
    { key: 'fondo_pension', label: 'Fondo Pensión' },
    { key: 'union', label: 'Unión' },
  ];

  // palette (colores garantizados)
  private readonly palette = [
    '#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed',
    '#0891b2', '#db2777', '#65a30d', '#ea580c', '#0f766e',
    '#4f46e5', '#9333ea',
  ];

  // toast
  private readonly toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    timer: 2600,
    timerProgressBar: true,
    showConfirmButton: false,
  });

  ngOnInit(): void {
    this.buildColumns();
    this.initStatsDefaults();

    this.reloadAll(false);
    this.loadStats({ showToast: false });

    // ✅ carga inicial (puedes quitarla si lo quieres solo manual)
    this.loadUltimosPorMarcaTemporal({ showToast: false });
  }

  trackByState = (_: number, s: TooltipState) => s.key;
  trackByUltimosOpt = (_: number, o: { key: UltimosAntecedenteUiKey }) => o.key;

  // =========================
  // ✅ Limpieza de marca temporal (sin microsegundos ni offset)
  // =========================
  private cleanIsoTimestamp(v: any): string {
    if (!v) return '';
    let s = String(v).trim();

    // 2026-01-22T05:57:07.898188+00:00  ->  2026-01-22 05:57:07
    s = s.replace('T', ' ');
    s = s.replace(/\.\d+/, ''); // quita .898188
    s = s.replace(/([+-]\d{2}:\d{2}|Z)$/, ''); // quita +00:00 o Z

    return s.trim();
  }

  // =========================
  // DEFAULTS STATS
  // =========================
  private initStatsDefaults(): void {
    const to = this.todayYmd();
    const from = this.addDaysYmd(to, -29);
    this.statsForm.patchValue({ from, to, group: 'day', oficina: '' }, { emitEvent: false });
  }

  private todayYmd(): string {
    return this.toYmd(new Date());
  }

  private addDaysYmd(ymd: string, days: number): string {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setDate(dt.getDate() + days);
    return this.toYmd(dt);
  }

  private toYmd(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // =========================
  // UI ACTIONS
  // =========================
  reloadAll(showToast = true): void {
    this.loadPendientesPorOficina({ showToast });
    this.loadRobotsFull({ showToast });

    // ✅ recarga también "últimos" con el selector actual
    this.loadUltimosPorMarcaTemporal({ showToast: false });
  }

  applyStats(): void {
    this.loadStats({ showToast: true });
  }

  applyUltimos(): void {
    this.loadUltimosPorMarcaTemporal({ showToast: true });
  }

  // =========================
  // ✅ LOAD ULTIMOS (por antecedente -> marca_temporal_x)
  // =========================
  loadUltimosPorMarcaTemporal(opts?: { showToast?: boolean }): void {
    if (this.isLoadingUltimos) return;

    const antecedenteUi = String(this.ultimosForm.value?.antecedente ?? '').trim() as UltimosAntecedenteUiKey;

    const estadoRaw = String(this.ultimosForm.value?.estado ?? '').trim();
    const estado = estadoRaw ? estadoRaw.toUpperCase() : null;

    let limit = Number(this.ultimosForm.value?.limit ?? 50);
    if (!Number.isFinite(limit)) limit = 50;
    limit = Math.max(1, Math.min(200, Math.trunc(limit)));

    this.isLoadingUltimos = true;
    this.cdr.markForCheck();

    const antecedenteApi = this.mapAntecedenteUiToServiceKey(antecedenteUi);

    this.robots
      .getUltimosPorMarcaTemporal({ antecedente: antecedenteApi, estado, limit })
      .pipe(
        take(1),
        tap((rows: UltimosPorMarcaTemporalRow[]) => {
          const arr = Array.isArray(rows) ? rows : [];

          // ✅ aquí se limpia la marca temporal para la tabla
          this.ultimosRows = arr.map((r: any) => ({
            ...r,
            marcaTemporal: this.cleanIsoTimestamp(r?.marcaTemporal),
          })) as UltimosPorMarcaTemporalRow[];

          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error /Robots/ultimos/<antecedente>/', err);
          this.ultimosRows = [];
          this.cdr.markForCheck();
          if (opts?.showToast) void this.toast.fire({ icon: 'error', title: 'Últimos: error al cargar' });
          return of([] as UltimosPorMarcaTemporalRow[]);
        }),
        finalize(() => {
          this.isLoadingUltimos = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (opts?.showToast) void this.toast.fire({ icon: 'success', title: 'Últimos actualizados' });
      });
  }

  // ✅ mapea UI -> key esperada por el servicio (si usas guiones en el endpoint)
  private mapAntecedenteUiToServiceKey(ui: UltimosAntecedenteUiKey): AntecedenteKey {
    const m: Record<string, string> = {
      fondo_pension: 'fondo-pension',
      medidas_correctivas: 'medidas-correctivas',
    };
    return (m[ui] ?? ui) as AntecedenteKey;
  }

  // =========================
  // LOAD STATS (MULTILINE)
  // =========================
  loadStats(opts?: { showToast?: boolean }): void {
    if (this.isLoadingStats) return;

    const from = String(this.statsForm.value?.from ?? '').trim();
    const to = String(this.statsForm.value?.to ?? '').trim();
    const group = (this.statsForm.value?.group ?? 'day') as StatsGroup;
    const oficinaRaw = String(this.statsForm.value?.oficina ?? '').trim();
    const oficina = oficinaRaw ? oficinaRaw : null;

    this.isLoadingStats = true;
    this.cdr.markForCheck();

    this.robots
      .getEstadosRobotStats({ from: from || undefined, to: to || undefined, group, oficina })
      .pipe(
        take(1),
        tap((resp: any) => {
          this.stats = resp ?? null;

          const series: StatsPoint[] = Array.isArray(resp?.series) ? resp.series : [];
          this.statsSeries = series.map((p: any) => ({ ...p, period: String(p?.period ?? '') }));

          this.tooltipStates = this.detectStates(this.statsSeries);

          this.hoverIndex = null;
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error /EstadosRobots/stats/', err);
          this.stats = null;
          this.statsSeries = [];
          this.tooltipStates = [];
          this.hoverIndex = null;
          this.cdr.markForCheck();
          if (opts?.showToast) void this.toast.fire({ icon: 'error', title: 'Stats: error al cargar' });
          return of(null);
        }),
        finalize(() => {
          this.isLoadingStats = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (opts?.showToast) void this.toast.fire({ icon: 'success', title: 'Gráfica actualizada' });
      });
  }

  // =========================
  // KPI helpers (global)
  // =========================
  get kpiRegistered(): number {
    const s = this.statsSeries ?? [];
    if (!s.length || !this.tooltipStates.length) return 0;

    let acc = 0;
    for (const p of s) {
      for (const st of this.tooltipStates) acc += this.getHpTotal(p, st.key);
    }
    return acc;
  }

  get kpiFinalized(): number {
    const s = this.statsSeries ?? [];
    if (!s.length || !this.tooltipStates.length) return 0;

    let acc = 0;
    for (const p of s) {
      for (const st of this.tooltipStates) acc += this.getHpFinalized(p, st.key);
    }
    return acc;
  }

  get kpiRate(): number {
    const t = this.kpiRegistered;
    return t > 0 ? Math.round((this.kpiFinalized / t) * 1000) / 10 : 0;
  }

  // =========================
  // Tooltip getters (NO $any)
  // =========================
  get hoverPoint(): StatsPoint | null {
    const i = this.hoverIndex;
    const s = this.statsSeries ?? [];
    if (i === null || i < 0 || i >= s.length) return null;
    return s[i];
  }

  getHpTotal(hp: StatsPoint, stateKey: string): number {
    const v = hp?.[stateKey];
    if (v == null) return 0;
    if (typeof v === 'object') return Number((v as any)?.total ?? (v as any)?.registered ?? 0) || 0;
    return Number(v) || 0;
  }

  getHpFinalized(hp: StatsPoint, stateKey: string): number {
    const v = hp?.[stateKey];
    if (v == null) return 0;
    if (typeof v === 'object') return Number((v as any)?.finalized ?? 0) || 0;
    return 0;
  }

  // =========================
  // SVG chart computed
  // =========================
  get chartVm(): ChartVm {
    const s = this.statsSeries ?? [];
    const n = s.length;

    const { w, h, padL, padR, padT, padB } = this.chartBox;
    const plotW = Math.max(10, w - padL - padR);
    const plotH = Math.max(10, h - padT - padB);

    const xAt = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);

    const maxVal = this.computeMaxTotal(s);
    const yMax = this.niceCeil(maxVal);

    const yAt = (v: number) => padT + plotH - (yMax === 0 ? 0 : (v / yMax) * plotH);

    const xPoints = Array.from({ length: n }).map((_, i) => xAt(i));

    const paths: ChartLineVm[] = (this.tooltipStates ?? []).map((st) => {
      const yArr = s.map((p) => yAt(this.getHpTotal(p, st.key)));
      const d =
        n === 0
          ? ''
          : yArr
              .map((yy, i) => `${i === 0 ? 'M' : 'L'} ${xPoints[i].toFixed(2)} ${yy.toFixed(2)}`)
              .join(' ');

      return { key: st.key, label: st.label, stroke: st.stroke, d, y: yArr };
    });

    const tickCount = 4;
    const ticks = Array.from({ length: tickCount + 1 }).map((_, i) => {
      const v = (yMax / tickCount) * i;
      return { y: yAt(v), label: this.formatCompact(v) };
    });

    const xMarks: { x: number; label: string }[] = [];
    if (n > 0) {
      const idxs = n <= 2 ? [0, n - 1] : [0, Math.floor((n - 1) / 2), n - 1];
      const uniq = Array.from(new Set(idxs)).filter((i) => i >= 0 && i < n);
      for (const i of uniq) xMarks.push({ x: xPoints[i], label: String(s[i]?.period ?? '') });
    }

    return { yMax, ticks, xMarks, xPoints, paths };
  }

  private computeMaxTotal(series: StatsPoint[]): number {
    let maxVal = 0;
    const states = this.tooltipStates ?? [];
    for (const p of series) {
      for (const st of states) {
        const v = this.getHpTotal(p, st.key);
        if (v > maxVal) maxVal = v;
      }
    }
    return maxVal;
  }

  private niceCeil(v: number): number {
    if (v <= 0) return 0;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return nice * pow;
  }

  private formatCompact(v: number): string {
    const num = Math.round(v);
    if (num >= 1_000_000) return `${Math.round(num / 100_000) / 10}M`;
    if (num >= 1_000) return `${Math.round(num / 100) / 10}k`;
    return String(num);
  }

  // =========================
  // Hover/tooltip position (flip left/right)
  // =========================
  onChartMove(ev: MouseEvent): void {
    const s = this.statsSeries ?? [];
    if (!s.length || !this.chartWrap) return;

    const rect = this.chartWrap.nativeElement.getBoundingClientRect();
    const x = ev.clientX - rect.left;

    const n = s.length;
    const idx = n <= 1 ? 0 : Math.round((x / rect.width) * (n - 1));
    const clamped = Math.max(0, Math.min(n - 1, idx));
    this.hoverIndex = clamped;

    const pad = 12;
    const margin = 14;
    const tooltipW = Math.min(380, Math.max(260, rect.width * 0.42));
    const canRight = x + margin + tooltipW <= rect.width - pad;

    this.tooltipSide = canRight ? 'right' : 'left';

    let left = canRight ? x + margin : x - margin - tooltipW;
    left = Math.max(pad, Math.min(rect.width - tooltipW - pad, left));

    const top = 12;

    this.tooltip = { leftPx: left, topPx: top };
    this.cdr.markForCheck();
  }

  onChartLeave(): void {
    this.hoverIndex = null;
    this.cdr.markForCheck();
  }

  // =========================
  // Detecta estados desde el payload
  // =========================
  private detectStates(series: StatsPoint[]): TooltipState[] {
    if (!series?.length) return [];

    const first = series[0] ?? {};
    const banned = new Set(['period', 'from', 'to', 'group', 'meta', 'x', 'y']);

    const keys = Object.keys(first).filter((k) => !banned.has(k));

    const candidates: string[] = [];
    for (const k of keys) {
      const v = (first as any)[k];
      if (typeof v === 'number') candidates.push(k);
      else if (v && typeof v === 'object' && ('total' in v || 'finalized' in v || 'registered' in v)) candidates.push(k);
    }

    const ordered: string[] = [];
    const knownMap = new Map(this.pendientesKeys.map((p) => [p.key, p.label]));

    for (const pk of this.pendientesKeys.map((p) => p.key)) {
      if (candidates.includes(pk)) ordered.push(pk);
    }
    for (const k of candidates) {
      if (!ordered.includes(k)) ordered.push(k);
    }

    return ordered.map((key, i) => ({
      key,
      label: knownMap.get(key as PendienteKey) ?? this.prettyLabel(key),
      stroke: this.palette[i % this.palette.length],
    }));
  }

  private prettyLabel(key: string): string {
    return String(key)
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (m) => m.toUpperCase());
  }

  // =========================
  // LOADERS TABLAS
  // =========================
  loadRobotsFull(opts?: { showToast?: boolean }): void {
    if (this.isLoadingRobotsFull) return;

    this.isLoadingRobotsFull = true;
    this.cdr.markForCheck();

    this.robots
      .getRobotsFull()
      .pipe(
        take(1),
        map((resp: any) => {
          const rows: RobotFullRow[] = Array.isArray(resp)
            ? resp
            : Array.isArray(resp?.results)
              ? resp.results
              : [];
          return rows;
        }),
        tap((rows) => {
          this.robotsFullRows = rows;
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error /Robots/full/', err);
          this.robotsFullRows = [];
          this.cdr.markForCheck();
          if (opts?.showToast) void this.toast.fire({ icon: 'error', title: 'Robots Full: error al cargar' });
          return of([] as RobotFullRow[]);
        }),
        finalize(() => {
          this.isLoadingRobotsFull = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (opts?.showToast) void this.toast.fire({ icon: 'success', title: 'Robots Full actualizado' });
      });
  }

  loadPendientesPorOficina(opts?: { showToast?: boolean }): void {
    if (this.isLoadingPendientesPorOficina) return;

    this.isLoadingPendientesPorOficina = true;
    this.cdr.markForCheck();

    this.robots
      .getPendientesPorOficina({ soloPendientes: false })
      .pipe(
        take(1),
        tap((resp: PendientesPorOficinaResponse) => {
          const backendRows: any[] = Array.isArray((resp as any)?.rows) ? (resp as any).rows : [];

          const oficinasRaw: string[] = backendRows.map((r: any) => {
            const o = r?.oficina ?? r?.oficina_norm ?? null;
            const txt = String(o ?? '').trim();
            return txt ? txt : 'SIN_OFICINA';
          });

          const oficinasUniq: string[] = [];
          for (const o of oficinasRaw) if (!oficinasUniq.includes(o)) oficinasUniq.push(o);

          this.oficinasOptions = oficinasUniq.filter((o) => o !== 'SIN_OFICINA');
          this.cdr.markForCheck();

          const colKeys = oficinasUniq.map((o) => this.oficinaColKey(o));

          this.pendientesPorOficinaColumns = [
            { name: 'tipo', header: 'Módulo', type: 'text' as const, width: '220px', stickyStart: true },
            ...oficinasUniq.map((of, idx) => ({
              name: colKeys[idx],
              header: of,
              type: 'number' as const,
              width: '160px',
              align: 'right' as const,
            })),
            { name: 'total', header: 'Total', type: 'number' as const, width: '140px', stickyEnd: true, align: 'right' },
          ];

          const faltantesByCol: Record<string, Record<PendienteKey, number>> = {};

          for (let i = 0; i < backendRows.length; i++) {
            const of = oficinasRaw[i];
            const ck = this.oficinaColKey(of);
            const f = (backendRows[i]?.faltantes ?? {}) as Record<string, any>;

            if (!faltantesByCol[ck]) {
              faltantesByCol[ck] = {
                adress: 0,
                policivo: 0,
                ofac: 0,
                contraloria: 0,
                sisben: 0,
                procuraduria: 0,
                fondo_pension: 0,
                union: 0,
              };
            }

            for (const mod of this.pendientesKeys) {
              faltantesByCol[ck][mod.key] =
                Number(faltantesByCol[ck][mod.key] ?? 0) + Number(f?.[mod.key] ?? 0);
            }
          }

          const matrixRows: PendientesOficinasMatrixRow[] = this.pendientesKeys.map((mod) => {
            const row: PendientesOficinasMatrixRow = { tipo: mod.label, key: mod.key };
            let rowTotal = 0;
            for (const ck of colKeys) {
              const v = Number(faltantesByCol[ck]?.[mod.key] ?? 0);
              row[ck] = v;
              rowTotal += v;
            }
            row.total = rowTotal;
            return row;
          });

          const totalRow: PendientesOficinasMatrixRow = { tipo: 'TOTAL', key: '__TOTAL__' };
          let grandTotal = 0;
          for (const ck of colKeys) {
            let colTotal = 0;
            for (const r of matrixRows) colTotal += Number(r[ck] ?? 0);
            totalRow[ck] = colTotal;
            grandTotal += colTotal;
          }
          totalRow.total = grandTotal;

          this.pendientesPorOficinaRows = [...matrixRows, totalRow];
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error /EstadosRobots/pendientes/por-oficina/', err);

          this.pendientesPorOficinaRows = [];
          this.pendientesPorOficinaColumns = [
            { name: 'tipo', header: 'Módulo', type: 'text' as const, width: '220px', stickyStart: true },
            { name: 'total', header: 'Total', type: 'number' as const, width: '140px', stickyEnd: true, align: 'right' },
          ];

          this.cdr.markForCheck();
          if (opts?.showToast) void this.toast.fire({ icon: 'error', title: 'Por oficina: error al cargar' });
          return of(null);
        }),
        finalize(() => {
          this.isLoadingPendientesPorOficina = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (opts?.showToast) void this.toast.fire({ icon: 'success', title: 'Por oficina actualizado' });
      });
  }

  // =========================
  // COLUMNAS
  // =========================
  private buildColumns(): void {
    this.robotsFullColumns = [
      { name: 'oficina', header: 'oficina', type: 'text' as const, width: '140px' },
      { name: 'Robot', header: 'Robot', type: 'text' as const, width: '140px' },
      { name: 'Cedula', header: 'Cedula', type: 'text' as const, width: '140px' },
      { name: 'Tipo_documento', header: 'Tipo_documento', type: 'text' as const, width: '160px' },
      { name: 'Estado_Adress', header: 'Estado_Adress', type: 'text' as const, width: '160px' },
      { name: 'Nombre_Adress', header: 'Nombre_Adress', type: 'text' as const, width: '160px' },
      { name: 'Apellido_Adress', header: 'Apellido_Adress', type: 'text' as const, width: '220px' },
      { name: 'Entidad_Adress', header: 'Entidad_Adress', type: 'text' as const, width: '360px' },
      { name: 'PDF_Adress', header: 'PDF_Adress', type: 'text' as const, width: '260px' },
      { name: 'Fecha_Adress', header: 'Fecha_Adress', type: 'text' as const, width: '180px' },
      // ... deja el resto igual como lo tenías
    ];

    this.pendientesPorOficinaColumns = [
      { name: 'tipo', header: 'Módulo', type: 'text' as const, width: '220px', stickyStart: true },
      { name: 'total', header: 'Total', type: 'number' as const, width: '140px', stickyEnd: true, align: 'right' },
    ];

    // ✅ NUEVO: columnas para el listado de últimos
    this.ultimosColumns = [
      { name: 'cedula', header: 'Cédula', type: 'text' as const, width: '180px', stickyStart: true },
      { name: 'tipo_documento', header: 'Tipo doc', type: 'text' as const, width: '140px' },
      { name: 'marcaTemporal', header: 'Marca temporal', type: 'text' as const, width: '260px' },
    ];
  }

  // =========================
  // Helpers oficinas
  // =========================
  private oficinaColKey(oficina: string): string {
    return `o_${this.slugify(oficina)}`;
  }

  private slugify(input: string): string {
    const s = String(input ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

    const cleaned = s
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    return cleaned || 'sin_oficina';
  }
}
