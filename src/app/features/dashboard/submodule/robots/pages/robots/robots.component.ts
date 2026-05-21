import { CommonModule, TitleCasePipe } from '@angular/common';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
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
import { Title } from '@angular/platform-browser';
import { of, interval, fromEvent } from 'rxjs';
import { catchError, finalize, map, take, tap, debounceTime } from 'rxjs/operators';

import { ReactiveFormsModule, FormBuilder, FormGroup, FormControl } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';

import Swal, { SweetAlertIcon } from 'sweetalert2';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

import {
  RobotsService,
  PendientesPorOficinaResponse,
  EstadoRobotStatsResponse,
  StatsGroup,
  AntecedenteKey,
  UltimosPorMarcaTemporalRow,
  RobotLockRow,
  DuplicadoCedulaRow,
  ProximoEnColaRow,
  ProximosEnColaResponse,
} from '../../services/robots/robots.service';

// =========================
// LOCKS (presentación enriquecida)
// =========================
interface RobotLockDisplayRow extends RobotLockRow {
  edad_min: number;          // minutos desde locked_at; -1 si no hay lock
  edad_label: string;        // "47m", "2m", "—"
  estado_lock: 'ZOMBIE' | 'ACTIVO' | 'SIN_LOCK';
}

interface LocksByWorkerRow {
  worker: string;
  locks_activos: number;
  zombies: number;
  edad_mas_vieja_min: number;
  edad_mas_vieja_label: string;
  antecedentes: string;      // CSV (ofac, policivo, ...)
}

// Mismos minutos que el backend (EstadoRobotActual.LEASE_MINUTES)
const LEASE_MINUTES = 5;

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

interface PendientesOficinasMatrixRow {
  tipo: string;
  key: PendienteKey | '__TOTAL__';
  total?: number;
  [k: string]: any;
}

// =========================
// ROBOTS FULL
// =========================
export interface RobotFullRow {
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
}

// =========================
// ✅ ULTIMOS POR MARCA TEMPORAL (por antecedente)
// =========================
type UltimosAntecedenteUiKey =
  | 'adress'
  | 'policivo'
  | 'procuraduria'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'fondo_pension'

// =========================
// STATS MULTILÍNEA
// =========================
type StatsPoint = { period: string } & Record<string, { total?: number; finalized?: number; registered?: number } | number>;
type TooltipState = { key: string; label: string; stroke: string };

interface ChartLineVm {
  key: string;
  label: string;
  stroke: string;
  d: string;
  y: number[]; // y pixel por punto (para hover circles)
}

interface ChartVm {
  yMax: number;
  ticks: { y: number; label: string }[];
  xMarks: { x: number; label: string }[];
  xPoints: number[];
  paths: ChartLineVm[];
}

@Component({
  selector: 'app-robots',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TitleCasePipe,

    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,

    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatMenuModule,
    MatTooltipModule,

    StandardFilterTable,
  ],
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }],
  templateUrl: './robots.component.html',
  styleUrl: './robots.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RobotsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  private readonly titleService = inject(Title);
  private readonly robots = inject(RobotsService);

  @ViewChild('chartWrap') chartWrap!: ElementRef<HTMLDivElement>;

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
  // EXCEL ANTECEDENTES
  // =========================
  selectedAntecedenteForExcel: string = '';
  isUploadingExcel = false;
  @ViewChild('excelFileInput') excelFileInput!: ElementRef<HTMLInputElement>;

  // =========================
  // ✅ STATE (ÚLTIMOS POR ANTECEDENTE)
  // =========================
  isLoadingUltimos = false;
  ultimosRows: UltimosPorMarcaTemporalRow[] = [];
  ultimosColumns: ColumnDefinition[] = [];

  ultimosForm = this.fb.group({
    antecedente: new FormControl<UltimosAntecedenteUiKey>('adress', { nonNullable: true }),
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
  ];

  // =========================
  // ✅ STATE (MONITOREO LOCKS)
  // =========================
  isLoadingLocks = false;
  locksRowsRaw: RobotLockRow[] = [];
  locksRows: RobotLockDisplayRow[] = [];
  locksColumns: ColumnDefinition[] = [];

  // Toggle: ver por antecedente (default) vs agrupado por worker
  viewLocksByWorker = false;
  locksByWorkerRows: LocksByWorkerRow[] = [];
  locksByWorkerColumns: ColumnDefinition[] = [];

  // =========================
  // ✅ STATE (DUPLICADOS DE CÉDULA)
  // =========================
  isLoadingDuplicados = false;
  duplicadosCount = 0;
  duplicadosFilasAfectadas = 0;
  duplicadosDetalles: DuplicadoCedulaRow[] = [];

  // =========================
  // ✅ STATE (PRÓXIMOS EN COLA)
  // =========================
  isLoadingProximos = false;
  proximosRows: ProximoEnColaRow[] = [];
  proximosColumns: ColumnDefinition[] = [];
  proximosTotalPendientes = 0;
  proximosModoAtencion: 'HORARIO_LABORAL' | 'FUERA_DE_HORARIO' | '' = '';
  proximosGeneratedAt: string = '';

  proximosForm = this.fb.group({
    antecedente: new FormControl<UltimosAntecedenteUiKey>('ofac', { nonNullable: true }),
    limit: [20],
  });

  readonly proximosAntecedentesOptions: Array<{ key: UltimosAntecedenteUiKey; label: string }> = [
    { key: 'adress', label: 'Adress' },
    { key: 'policivo', label: 'Policivo' },
    { key: 'ofac', label: 'OFAC' },
    { key: 'contraloria', label: 'Contraloría' },
    { key: 'sisben', label: 'Sisben' },
    { key: 'procuraduria', label: 'Procuraduría' },
    { key: 'fondo_pension', label: 'Fondo Pensión' },
  ];

  // =========================
  // STATE (STATS / GRAFICA)
  // =========================
  isLoadingStats = false;
  stats: EstadoRobotStatsResponse | null = null; // ✅ Relax type for now as backend changed

  // ✅ puntos crudos (cada punto trae period + estados)
  statsSeries: StatsPoint[] = [];

  // ✅ catálogo estados detectados + colores
  tooltipStates: TooltipState[] = [];

  oficinasOptions: string[] = [];

  statsForm = this.fb.group({
    from: [''],
    to: [''],
    group: new FormControl<StatsGroup>('day', { nonNullable: true }),
    oficina: [''],
  });

  // ✅ Form para "Faltantes por Oficina"
  pendientesForm = this.fb.group({
    from: [null as Date | null],
    to: [null as Date | null],
    // paquete, soloPendientes podrases agregarlos aqui si quisieras full binding,
    // pero por ahora solo fechas.
  });

  // KPI Pre-calculated values
  kpiRegistered = 0;
  kpiFinalized = 0;
  kpiRate = 0;

  // hover/tooltip
  hoverIndex: number | null = null;
  tooltip = { leftPx: 0, topPx: 0 };
  tooltipSide: 'left' | 'right' = 'right';

  // SVG layout
  chartBox = { w: 1000, h: 320, padL: 56, padR: 20, padT: 18, padB: 44 };

  // =========================
  // CONFIG
  // =========================
  private readonly robotKeys: Array<{ key: string; label: string; color: string }> = [
    { key: 'adress', label: 'Adress', color: '#3b82f6' },        // Blue
    { key: 'policivo', label: 'Policivo', color: '#ef4444' },      // Red
    { key: 'ofac', label: 'OFAC', color: '#10b981' },          // Green
    { key: 'contraloria', label: 'Contraloría', color: '#f59e0b' }, // Amber
    { key: 'sisben', label: 'Sisben', color: '#8b5cf6' },        // Violet
    { key: 'procuraduria', label: 'Procuraduría', color: '#ec4899' }, // Pink
    { key: 'fondo_pension', label: 'Fondo P.', color: '#06b6d4' },   // Cyan
    { key: 'medidas_correctivas', label: 'Medidas C.', color: '#d946ef' }, // Fuchsia (replaced union/generic)
  ];

  // Alias for compatibility with loadPendientesPorOficina
  private readonly pendientesKeys: Array<{ key: any; label: string }> = this.robotKeys.map(r => ({ key: r.key as any, label: r.label }));

  // toast
  private readonly toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    timer: 2600,
    timerProgressBar: true,
    showConfirmButton: false,
  });

  /**
   * Intervalo en ms para auto-refresh.
   * Antes: 30 s. Con backend prod (MySQL remoto) cada tick disparaba 7
   * endpoints pesados y se acumulaban requests en vuelo (`/Robots/full/`
   * sin paginar es el más caro). Subimos a 2 min para aliviar al backend
   * sin perder utilidad del dashboard.
   */
  private readonly AUTO_POLL_MS = 120_000;

  ngOnInit(): void {
    this.titleService.setTitle('Robots Dashboard - Tesoreria');
    this.buildColumns();
    this.initStatsDefaults();
    // ✅ Escuchar cambios en pendientes form
    this.pendientesForm.valueChanges
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.loadPendientesPorOficina({ showToast: false });
      });

    // Carga inicial
    this.reloadAll(false);
    this.loadStats({ showToast: false });
    this.loadUltimosPorMarcaTemporal({ showToast: false });
    this.loadLocks();
    this.loadDuplicados();
    this.loadProximosEnCola({ showToast: false });

    // ✅ Auto-polling: refresca datos cada AUTO_POLL_MS. Salta el tick si el
    // tab/ventana NO está visible — no tiene sentido pegarle al backend
    // mientras nadie está mirando el dashboard. Al volver al tab se hace un
    // refresh inmediato vía el listener `visibilitychange` de abajo.
    interval(this.AUTO_POLL_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!this.isDashboardVisible()) return;
        this.refreshDashboard();
      });

    // Al volver al tab tras un rato oculto, los datos en pantalla están
    // viejos: dispara un refresh inmediato sin esperar al próximo tick.
    if (typeof document !== 'undefined') {
      fromEvent(document, 'visibilitychange')
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          if (this.isDashboardVisible()) this.refreshDashboard();
        });
    }

    // ✅ Cuando el usuario cambia antecedente/limit, recarga (debounced)
    this.proximosForm.valueChanges
      .pipe(
        debounceTime(300),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        this.loadProximosEnCola({ showToast: false });
      });
  }

  trackByState = (_: number, s: TooltipState) => s.key;
  trackByUltimosOpt = (_: number, o: { key: UltimosAntecedenteUiKey }) => o.key;

  // =========================
  // ✅ Limpieza de marca temporal (sin microsegundos ni offset)
  // =========================
  private cleanIsoTimestamp(v: unknown): string {
    if (!v || typeof v !== 'string') return '';

    try {
      // Intenta parsear la fecha y formatearla usando Intl.DateTimeFormat
      const date = new Date(v);
      if (isNaN(date.getTime())) {
        // Fallback a string manipulation si la fecha es inválida
        let s = v.trim();
        s = s.replace('T', ' ');
        s = s.replace(/\.\d+/, ''); // quita .898188
        s = s.replace(/([+-]\d{2}:\d{2}|Z)$/, ''); // quita +00:00 o Z
        return s.trim();
      }

      // Formato seguro: YYYY-MM-DD HH:mm:ss
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');

      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

    } catch (e) {
      return String(v);
    }
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

  /**
   * Dispara el set completo de loaders que corresponde a un "tick" del
   * auto-polling. Centralizado para reusarlo desde el interval y desde el
   * listener de visibilitychange.
   */
  private refreshDashboard(): void {
    this.reloadAll(false);
    this.loadStats({ showToast: false });
    this.loadLocks();
    this.loadDuplicados();
    this.loadProximosEnCola({ showToast: false });
  }

  /**
   * True si el dashboard está realmente visible para el usuario.
   * `document.visibilityState === 'hidden'` cuando el tab está en background,
   * la ventana está minimizada o el sistema bloqueó la pantalla.
   * En SSR `document` no existe → tratamos como visible (el polling no
   * arranca en server-side de todas formas porque interval es async).
   */
  private isDashboardVisible(): boolean {
    if (typeof document === 'undefined') return true;
    return document.visibilityState === 'visible';
  }

  applyStats(): void {
    this.loadStats({ showToast: true });
  }

  applyUltimos(): void {
    this.loadUltimosPorMarcaTemporal({ showToast: true });
  }

  // =========================
  // ✅ EXCEL DOWNLOAD METHODS
  // =========================
  onCargarExcelAntecedente(antecedente: string): void {
    this.selectedAntecedenteForExcel = antecedente;
    // reset input to allow uploading same file again
    if (this.excelFileInput?.nativeElement) {
      this.excelFileInput.nativeElement.value = '';
      this.excelFileInput.nativeElement.click();
    }
  }

  onExcelFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) {
      return;
    }
    
    const file = input.files[0];
    const antecedente = this.selectedAntecedenteForExcel;
    
    if (!antecedente) {
      void this.toast.fire({ icon: 'warning', title: 'Seleccione un antecedente primero.' });
      return;
    }

    this.isUploadingExcel = true;
    this.cdr.markForCheck();
    void this.toast.fire({ icon: 'info', title: `Cargando archivo para ${antecedente}...`, timer: 10000 });

    this.robots.uploadExcelAntecedentes(file, antecedente).subscribe({
      next: (blob: Blob) => {
        // Create an object URL containing the blob
        const downloadURL = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadURL;
        link.download = `resultados_${antecedente}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadURL);

        void this.toast.fire({ icon: 'success', title: 'Excel descargado exitosamente.' });
        this.isUploadingExcel = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error procesando Excel:', err);
        const msg = err?.error?.detail || 'Error procesando el Excel';
        
        // Sometimes Blob response type masks JSON errors, try to extract error text 
        if (err?.error instanceof Blob) {
            err.error.text().then((text: string) => {
                let detail = msg;
                try {
                    const parsed = JSON.parse(text);
                    detail = parsed.detail || msg;
                } catch(e) {}
                void this.toast.fire({ icon: 'error', title: 'Oops...', text: detail });
            });
        } else {
            void this.toast.fire({ icon: 'error', title: 'Oops...', text: msg });
        }
        
        this.isUploadingExcel = false;
        this.cdr.markForCheck();
      }
    });
  }

  // =========================
  // ✅ LOAD ULTIMOS (por antecedente -> marca_temporal_x)
  // =========================
  loadUltimosPorMarcaTemporal(opts?: { showToast?: boolean }): void {
    if (this.isLoadingUltimos) return;

    const antecedenteUi = this.ultimosForm.controls.antecedente.value as UltimosAntecedenteUiKey;
    const estadoRaw = this.ultimosForm.value?.estado?.trim();
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
          this.ultimosRows = arr.map((r) => ({
            ...r,
            marcaTemporal: this.cleanIsoTimestamp(r?.marcaTemporal),
          }));

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

    const from = this.statsForm.value?.from?.trim();
    const to = this.statsForm.value?.to?.trim();
    const group = this.statsForm.controls.group.value;
    const oficinaRaw = this.statsForm.value?.oficina?.trim();
    const oficina = oficinaRaw ? oficinaRaw : null;

    this.isLoadingStats = true;
    this.cdr.markForCheck();

    this.robots
      .getEstadosRobotStats({ from: from || undefined, to: to || undefined, group, oficina })
      .pipe(
        take(1),
        tap((resp: EstadoRobotStatsResponse) => {
          this.stats = resp ?? null;

          const series: StatsPoint[] = Array.isArray(resp?.series) ? (resp.series as unknown[] as StatsPoint[]) : [];
          this.statsSeries = series.map((p) => ({ ...p, period: String(p?.period ?? '') }));

          // ✅ Define lines: 1 Ceiling (Total) + N Robot Progress Lines (Finalized)
          this.tooltipStates = [
            { key: 'total', label: 'TOTAL (Techo)', stroke: '#111827' }, // Dark line for ceiling
            ...this.robotKeys.map(r => ({
              key: r.key,
              label: r.label,
              stroke: r.color
            }))
          ];

          this.calculateKpis();

          this.hoverIndex = null;
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error /EstadosRobots/stats/', err);
          this.stats = null;
          this.statsSeries = [];
          this.tooltipStates = [];
          this.hoverIndex = null;
          this.kpiRegistered = 0;
          this.kpiFinalized = 0;
          this.kpiRate = 0;
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
  // KPI helpers (Calculated once)
  // =========================
  private calculateKpis(): void {
    const s = this.statsSeries ?? [];
    if (!s.length) {
      this.kpiRegistered = 0;
      this.kpiFinalized = 0;
      this.kpiRate = 0;
      return;
    }

    // Global totals from 'summary' if available, or calc manual
    const statsAny = this.stats as any;
    if (statsAny?.summary?.total_registros !== undefined) {
      this.kpiRegistered = Number(statsAny.summary.total_registros || 0);
      // Sum finalized of all robots
      let sumFin = 0;
      for (const k of this.robotKeys) {
        const robSum = statsAny.summary[k.key]; // { finalized: N, pending: M }
        if (robSum) sumFin += Number(robSum.finalized || 0);
      }
      this.kpiFinalized = sumFin;
      // Rate? Maybe avg completion rate or just raw finalized count?
      // User didn't specify global KPI logic change, but let's keep it consistent.
      // Since 'Total' is "Records Created", and 'Finalized' is sum of all robot completions.
      // Actually, if 1 record generates 8 robot checks, max completions = 8 * total_registros.
      // kpiRate = (Finalized / (Total * 8)) * 100? or just show raw numbers.
      // Let's settle on: Rate = (Finalized / (Total * NumberOfRobots)) * 100 approx.
      const maxPossible = this.kpiRegistered * this.robotKeys.length;
      this.kpiRate = maxPossible > 0 ? Math.round((this.kpiFinalized / maxPossible) * 1000) / 10 : 0;
    } else {
      // Fallback calc from series
      this.kpiRegistered = 0;
      this.kpiFinalized = 0;
      this.kpiRate = 0;
    }
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

  // key = 'total' | 'adress' | 'policivo' ...
  getHpVal(hp: StatsPoint, key: string): number {
    if (key === 'total') {
      return Number(hp['total_registros'] ?? 0);
    }
    // Robot keys: hp.adress = { total, finalized, pending }
    const robData = hp[key] as any;
    if (robData) {
      return Number(robData.finalized ?? 0);
    }
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
      // st.key es 'total', 'adress', 'policivo'...
      const yArr = s.map((p) => yAt(this.getHpVal(p, st.key)));

      // Dashed for progress lines, Solid for Total? Or all solid?
      // User said "techo" (ceiling). Maybe make Total dashed or thicker?
      // Let's keep distinct colors.

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
    // Max is usually 'total_registros'
    for (const p of series) {
      const t = Number(p['total_registros'] ?? 0);
      if (t > maxVal) maxVal = t;
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
    // ✅ No longer needed using manual map
    return [];
  }

  private prettyLabel(key: string): string {
    // No longer needed
    return key;
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
      
    this.isLoadingRobotsFull = false;
    this.cdr.markForCheck();
  }

  loadPendientesPorOficina(opts?: { showToast?: boolean }): void {
    if (this.isLoadingPendientesPorOficina) return;

    this.isLoadingPendientesPorOficina = true;
    this.cdr.markForCheck();

    const fVal = this.pendientesForm.value.from;
    const tVal = this.pendientesForm.value.to;

    let from: string | undefined;
    let to: string | undefined;

    // Helper u offset fix si quieres, o simple ISO slice
    if (fVal && fVal instanceof Date) {
      from = fVal.toISOString().split('T')[0];
    }
    if (tVal && tVal instanceof Date) {
      to = tVal.toISOString().split('T')[0];
    }

    this.robots
      .getPendientesPorOficina({ soloPendientes: false, from, to })
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
              const mk = mod.key as PendienteKey;
              if (faltantesByCol[ck]) {
                faltantesByCol[ck][mk] = Number(faltantesByCol[ck][mk] ?? 0) + Number(f?.[mk] ?? 0);
              }
            }
          }

          const matrixRows: PendientesOficinasMatrixRow[] = this.pendientesKeys.map((mod) => {
            const mk = mod.key as PendienteKey;
            const row: PendientesOficinasMatrixRow = { tipo: mod.label, key: mk };
            let rowTotal = 0;
            for (const ck of colKeys) {
              const v = Number(faltantesByCol[ck]?.[mk] ?? 0);
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

  // ======================================
  // CARGA DE MONITOREO DE LOCKS (NUEVO TAB)
  // ======================================
  loadLocks(opts?: { showToast?: boolean }) {
    if (this.isLoadingLocks) return;

    this.isLoadingLocks = true;
    this.cdr.markForCheck();

    this.robots.getMonitoreoLocks().subscribe({
      next: (data) => {
        const raw = Array.isArray(data) ? data : [];
        this.locksRowsRaw = raw;
        this.locksRows = raw.map((r) => this.enrichLock(r));
        this.locksByWorkerRows = this.buildLocksByWorker(this.locksRows);

        this.isLoadingLocks = false;
        this.cdr.markForCheck();
        if (opts?.showToast) void this.toast.fire({ icon: 'success', title: 'Locks actualizados' });
      },
      error: (err) => {
        console.error('Error cargando Monitoreo Locks', err);
        this.locksRowsRaw = [];
        this.locksRows = [];
        this.locksByWorkerRows = [];
        this.isLoadingLocks = false;
        this.cdr.markForCheck();
        if (opts?.showToast) void this.toast.fire({ icon: 'error', title: 'Locks: error al cargar' });
      },
    });
  }

  // Enriquece una fila de lock con edad y semáforo (ZOMBIE si supera el lease).
  private enrichLock(r: RobotLockRow): RobotLockDisplayRow {
    const edad_min = this.minsSince(r?.locked_at);

    let estado_lock: RobotLockDisplayRow['estado_lock'];
    if (edad_min < 0 || !r?.locked_at) {
      estado_lock = 'SIN_LOCK';
    } else if (edad_min >= LEASE_MINUTES) {
      estado_lock = 'ZOMBIE';
    } else {
      estado_lock = 'ACTIVO';
    }

    return {
      ...r,
      edad_min,
      edad_label: this.formatEdad(edad_min),
      estado_lock,
    };
  }

  // Agrupa la lista por worker: cuántos locks tiene, cuántos zombies, lock más viejo.
  private buildLocksByWorker(rows: RobotLockDisplayRow[]): LocksByWorkerRow[] {
    const byWorker = new Map<string, RobotLockDisplayRow[]>();
    for (const r of rows) {
      if (r.estado_lock === 'SIN_LOCK') continue;
      const key = (r.locked_by ?? '(anónimo)').toString();
      if (!byWorker.has(key)) byWorker.set(key, []);
      byWorker.get(key)!.push(r);
    }

    const out: LocksByWorkerRow[] = [];
    byWorker.forEach((arr, worker) => {
      const zombies = arr.filter((x) => x.estado_lock === 'ZOMBIE').length;
      const masVieja = arr.reduce((acc, x) => (x.edad_min > acc ? x.edad_min : acc), 0);
      const antecedentes = Array.from(new Set(arr.map((x) => x.antecedente))).join(', ');
      out.push({
        worker,
        locks_activos: arr.length,
        zombies,
        edad_mas_vieja_min: masVieja,
        edad_mas_vieja_label: this.formatEdad(masVieja),
        antecedentes,
      });
    });

    return out.sort((a, b) => b.edad_mas_vieja_min - a.edad_mas_vieja_min);
  }

  toggleLocksView(): void {
    this.viewLocksByWorker = !this.viewLocksByWorker;
    this.cdr.markForCheck();
  }

  // Minutos transcurridos desde un ISO timestamp; -1 si es null o inválido.
  private minsSince(iso: string | null): number {
    if (!iso) return -1;
    const t = Date.parse(iso);
    if (isNaN(t)) return -1;
    return Math.max(0, Math.floor((Date.now() - t) / 60000));
  }

  private formatEdad(mins: number): string {
    if (mins < 0) return '—';
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }

  // ======================================
  // CARGA DE PRÓXIMOS EN COLA
  // ======================================
  applyProximos(): void {
    this.loadProximosEnCola({ showToast: true });
  }

  loadProximosEnCola(opts?: { showToast?: boolean }): void {
    if (this.isLoadingProximos) return;

    const antecedente = this.proximosForm.controls.antecedente.value;
    let limit = Number(this.proximosForm.value?.limit ?? 20);
    if (!Number.isFinite(limit)) limit = 20;
    limit = Math.max(1, Math.min(100, Math.trunc(limit)));

    this.isLoadingProximos = true;
    this.cdr.markForCheck();

    this.robots
      .getProximosEnCola({ antecedente, limit })
      .pipe(
        take(1),
        tap((resp: ProximosEnColaResponse) => {
          const rows = Array.isArray(resp?.proximos) ? resp.proximos : [];
          // Normalizamos las fechas para render legible
          this.proximosRows = rows.map((r) => ({
            ...r,
            locked_at: this.cleanIsoTimestamp(r?.locked_at) || (r?.locked_at ?? null),
            created_at: this.cleanIsoTimestamp(r?.created_at) || (r?.created_at ?? null),
          }));
          this.proximosTotalPendientes = Number(resp?.total_pendientes ?? 0);
          this.proximosModoAtencion = (resp?.modo_atencion as any) || '';
          this.proximosGeneratedAt = this.cleanIsoTimestamp(resp?.generated_at) || '';
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error /EstadosRobots/proximos-en-cola/', err);
          this.proximosRows = [];
          this.proximosTotalPendientes = 0;
          this.cdr.markForCheck();
          if (opts?.showToast) {
            void this.toast.fire({ icon: 'error', title: 'Próximos en cola: error al cargar' });
          }
          return of(null);
        }),
        finalize(() => {
          this.isLoadingProximos = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => {
        if (opts?.showToast) {
          void this.toast.fire({ icon: 'success', title: 'Próximos en cola actualizados' });
        }
      });
  }

  trackByProximo = (_: number, r: ProximoEnColaRow) => r.id;

  // ======================================
  // CARGA DE DUPLICADOS DE CÉDULA
  //
  // ⚡ Polling ligero: solo trae contadores (1 query agregada en backend).
  // Los detalles se cargan SOLO cuando el usuario abre el modal.
  // ======================================
  loadDuplicados(opts?: { showToast?: boolean }): void {
    if (this.isLoadingDuplicados) return;
    this.isLoadingDuplicados = true;
    this.cdr.markForCheck();

    // Modo ligero: solo contadores, sin detalle.
    this.robots.getDuplicadosCedulas({ detail: false })
      .pipe(
        take(1),
        tap((resp) => {
          this.duplicadosCount = Number(resp?.total_cedulas_duplicadas ?? 0);
          this.duplicadosFilasAfectadas = Number(resp?.total_filas_afectadas ?? 0);
          // NO sobrescribir detalles si ya los cargamos antes (cache).
          if (!this.duplicadosDetalles.length && Array.isArray(resp?.detalles) && resp.detalles.length) {
            this.duplicadosDetalles = resp.detalles;
          }
          this.cdr.markForCheck();
        }),
        catchError((err) => {
          console.error('Error /Robots/duplicados-cedulas/', err);
          this.duplicadosCount = 0;
          this.duplicadosFilasAfectadas = 0;
          this.cdr.markForCheck();
          return of(null);
        }),
        finalize(() => {
          this.isLoadingDuplicados = false;
          this.cdr.markForCheck();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        if (opts?.showToast) {
          void this.toast.fire({ icon: 'info', title: `Duplicados: ${this.duplicadosCount} cédula(s)` });
        }
      });
  }

  // Modal SweetAlert con la lista de cédulas duplicadas.
  // Si no tenemos los detalles cargados aún, los pide ahora (lazy).
  verDuplicados(): void {
    if (!this.duplicadosCount) {
      void this.toast.fire({ icon: 'success', title: 'No hay cédulas duplicadas' });
      return;
    }

    // Si ya tenemos detalles en memoria, abrimos directo el modal.
    if (this.duplicadosDetalles.length) {
      this.renderModalDuplicados();
      return;
    }

    // Lazy fetch del detalle (modo `detail=1`). Mostramos loader entretanto.
    void Swal.fire({
      title: 'Cargando detalle…',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.robots.getDuplicadosCedulas({ detail: true, limit: 200 })
      .pipe(take(1), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp) => {
          this.duplicadosDetalles = Array.isArray(resp?.detalles) ? resp.detalles : [];
          Swal.close();
          this.renderModalDuplicados();
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'No se pudo cargar el detalle' });
        },
      });
  }

  // Helper que abre el modal usando this.duplicadosDetalles (ya cargados).
  private renderModalDuplicados(): void {

    // Agrupa filas por cédula para mostrar de forma legible.
    const porCedula = new Map<string, DuplicadoCedulaRow[]>();
    for (const r of this.duplicadosDetalles) {
      const key = String(r.cedula);
      if (!porCedula.has(key)) porCedula.set(key, []);
      porCedula.get(key)!.push(r);
    }

    let html = `
      <div style="text-align:left;font-size:13px;max-height:60vh;overflow:auto">
        <p style="margin:0 0 12px;color:#666;">
          <b>${this.duplicadosCount}</b> cédula(s) tienen más de un registro en <code>EstadoRobotActual</code>
          (mismo número con distinto <code>tipo_documento</code>).
          Esto puede causar que el POST de un robot cierre el registro equivocado.
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:6px;text-align:left;border-bottom:1px solid #ddd;">Cédula</th>
              <th style="padding:6px;text-align:left;border-bottom:1px solid #ddd;">Filas</th>
              <th style="padding:6px;text-align:left;border-bottom:1px solid #ddd;">Tipos doc</th>
            </tr>
          </thead>
          <tbody>
    `;

    let i = 0;
    porCedula.forEach((rows, cedula) => {
      if (i >= 50) return;
      const tipos = rows.map((r) => `${r.tipo_documento} (id ${r.id})`).join('<br>');
      html += `
        <tr>
          <td style="padding:6px;border-bottom:1px solid #f0f0f0;"><b>${cedula}</b></td>
          <td style="padding:6px;border-bottom:1px solid #f0f0f0;">${rows.length}</td>
          <td style="padding:6px;border-bottom:1px solid #f0f0f0;font-size:11px;">${tipos}</td>
        </tr>
      `;
      i++;
    });

    html += `
          </tbody>
        </table>
        ${porCedula.size > 50 ? `<p style="margin-top:10px;color:#666;font-style:italic;">+${porCedula.size - 50} cédula(s) más</p>` : ''}
      </div>
    `;

    void Swal.fire({
      title: `⚠️ Duplicados detectados`,
      html,
      icon: 'warning',
      width: '700px',
      confirmButtonText: 'Cerrar',
      showCloseButton: true,
    });
  }

  // ======================================
  // RESUMEN DE LOCKS (para mostrar arriba del Tab 3)
  // ======================================
  get locksSummary(): { total: number; zombies: number; activos: number; sinLock: number } {
    const rows = this.locksRows ?? [];
    let zombies = 0, activos = 0, sinLock = 0;
    for (const r of rows) {
      if (r.estado_lock === 'ZOMBIE') zombies++;
      else if (r.estado_lock === 'ACTIVO') activos++;
      else sinLock++;
    }
    return { total: rows.length, zombies, activos, sinLock };
  }

  // ======================================
  // PRESETS DE FECHA (Tab 4 — Faltantes por Oficina)
  // ======================================
  applyPendientesPreset(preset: 'hoy' | '7d' | '30d' | 'all'): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let from: Date | null = null;
    const to: Date = new Date(today);

    switch (preset) {
      case 'hoy':
        from = new Date(today);
        break;
      case '7d':
        from = new Date(today);
        from.setDate(from.getDate() - 6);
        break;
      case '30d':
        from = new Date(today);
        from.setDate(from.getDate() - 29);
        break;
      case 'all':
        from = null;
        break;
    }

    // El valueChanges del form ya re-dispara la carga (debounce 300ms).
    this.pendientesForm.patchValue({
      from,
      to: preset === 'all' ? null : to,
    });
  }

  // Total de filas pendientes (gran total que ya calcula loadPendientesPorOficina,
  // se obtiene leyendo la fila marcada con key '__TOTAL__').
  get pendientesGranTotal(): number {
    const totalRow = this.pendientesPorOficinaRows.find((r) => r.key === '__TOTAL__');
    return Number(totalRow?.total ?? 0);
  }

  get pendientesCountOficinas(): number {
    // -1 (cols Módulo) - 1 (col Total). Solo válido si ya hay columnas.
    return Math.max(0, (this.pendientesPorOficinaColumns?.length ?? 0) - 2);
  }

  // ======================================
  // INDICADOR HORARIO LABORAL (computed)
  // 7:30 – 19:30 = HORARIO_LABORAL. Coincide con el backend.
  // ======================================
  get modoAtencion(): 'HORARIO_LABORAL' | 'FUERA_DE_HORARIO' {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const start = 7 * 60 + 30;   // 7:30
    const end = 19 * 60 + 30;    // 19:30
    return mins >= start && mins < end ? 'HORARIO_LABORAL' : 'FUERA_DE_HORARIO';
  }

  get modoAtencionLabel(): string {
    return this.modoAtencion === 'HORARIO_LABORAL' ? 'Horario laboral' : 'Fuera de horario';
  }

  // =========================
  // COLUMNAS
  // =========================
  private buildColumns(): void {
    // ✅ FIX: completar columnas para los 7 antecedentes (antes solo se veía Adress).
    this.robotsFullColumns = [
      { name: 'oficina', header: 'Oficina', type: 'text' as const, width: '140px', stickyStart: true },
      { name: 'Robot', header: 'Robot', type: 'text' as const, width: '140px' },
      { name: 'Cedula', header: 'Cédula', type: 'text' as const, width: '140px' },
      { name: 'Tipo_documento', header: 'Tipo doc', type: 'text' as const, width: '110px' },

      // ADRES
      { name: 'Estado_Adress', header: 'Adres · Estado', type: 'text' as const, width: '150px' },
      { name: 'Nombre_Adress', header: 'Adres · Nombre', type: 'text' as const, width: '160px' },
      { name: 'Apellido_Adress', header: 'Adres · Apellido', type: 'text' as const, width: '180px' },
      { name: 'Entidad_Adress', header: 'Adres · Entidad', type: 'text' as const, width: '260px' },
      { name: 'PDF_Adress', header: 'Adres · PDF', type: 'text' as const, width: '220px' },
      { name: 'Fecha_Adress', header: 'Adres · Fecha', type: 'text' as const, width: '150px' },

      // POLICIVO
      { name: 'Estado_Policivo', header: 'Policivo · Estado', type: 'text' as const, width: '150px' },
      { name: 'Anotacion_Policivo', header: 'Policivo · Anot.', type: 'text' as const, width: '180px' },
      { name: 'PDF_Policivo', header: 'Policivo · PDF', type: 'text' as const, width: '220px' },

      // OFAC
      { name: 'Estado_OFAC', header: 'OFAC · Estado', type: 'text' as const, width: '150px' },
      { name: 'Anotacion_OFAC', header: 'OFAC · Anot.', type: 'text' as const, width: '180px' },
      { name: 'PDF_OFAC', header: 'OFAC · PDF', type: 'text' as const, width: '220px' },

      // CONTRALORÍA
      { name: 'Estado_Contraloria', header: 'Contraloría · Estado', type: 'text' as const, width: '160px' },
      { name: 'Anotacion_Contraloria', header: 'Contraloría · Anot.', type: 'text' as const, width: '180px' },
      { name: 'PDF_Contraloria', header: 'Contraloría · PDF', type: 'text' as const, width: '220px' },

      // SISBÉN
      { name: 'Estado_Sisben', header: 'Sisbén · Estado', type: 'text' as const, width: '150px' },
      { name: 'Tipo_Sisben', header: 'Sisbén · Tipo', type: 'text' as const, width: '140px' },
      { name: 'PDF_Sisben', header: 'Sisbén · PDF', type: 'text' as const, width: '220px' },
      { name: 'Fecha_Sisben', header: 'Sisbén · Fecha', type: 'text' as const, width: '150px' },

      // PROCURADURÍA
      { name: 'Estado_Procuraduria', header: 'Procuraduría · Estado', type: 'text' as const, width: '180px' },
      { name: 'Anotacion_Procuraduria', header: 'Procuraduría · Anot.', type: 'text' as const, width: '180px' },
      { name: 'PDF_Procuraduria', header: 'Procuraduría · PDF', type: 'text' as const, width: '220px' },

      // FONDO PENSIÓN
      { name: 'Estado_FondoPension', header: 'Fondo P. · Estado', type: 'text' as const, width: '170px' },
      { name: 'Entidad_FondoPension', header: 'Fondo P. · Entidad', type: 'text' as const, width: '220px' },
      { name: 'PDF_FondoPension', header: 'Fondo P. · PDF', type: 'text' as const, width: '220px' },
      { name: 'Fecha_FondoPension', header: 'Fondo P. · Fecha', type: 'text' as const, width: '150px' },
    ];

    this.pendientesPorOficinaColumns = [
      { name: 'tipo', header: 'Módulo', type: 'text' as const, width: '220px', stickyStart: true },
      { name: 'total', header: 'Total', type: 'number' as const, width: '140px', stickyEnd: true, align: 'right' },
    ];

    // ✅ Tab 2: columnas para últimos por marca temporal
    this.ultimosColumns = [
      { name: 'cedula', header: 'Cédula', type: 'text' as const, width: '180px', stickyStart: true },
      { name: 'tipo_documento', header: 'Tipo doc', type: 'text' as const, width: '140px' },
      { name: 'marcaTemporal', header: 'Marca temporal', type: 'text' as const, width: '260px' },
    ];

    // ✅ Tab 3 (vista por antecedente): ahora incluye edad y semáforo.
    this.locksColumns = [
      { name: 'antecedente', header: 'Antecedente', type: 'text' as const, width: '160px', stickyStart: true },
      { name: 'estado_lock', header: 'Estado lock', type: 'status' as const, width: '140px',
        statusConfig: {
          ACTIVO:   { color: '#065f46', background: '#d1fae5' },
          ZOMBIE:   { color: '#7f1d1d', background: '#fee2e2' },
          SIN_LOCK: { color: '#374151', background: '#e5e7eb' },
        } },
      { name: 'edad_label', header: 'Edad', type: 'text' as const, width: '100px', align: 'right' },
      { name: 'cedula', header: 'Cédula', type: 'text' as const, width: '140px' },
      { name: 'tipo_documento', header: 'Tipo doc', type: 'text' as const, width: '100px' },
      { name: 'locked_by', header: 'Worker', type: 'text' as const, width: '220px' },
      { name: 'locked_at', header: 'Locked at', type: 'date' as const, width: '180px' },
      { name: 'ultima_consulta_estado', header: 'Última consulta', type: 'date' as const, width: '180px' },
      { name: 'ultima_marca_temporal', header: 'Última marca', type: 'date' as const, width: '180px' },
    ];

    // ✅ Tab 3 (vista agrupada por worker)
    this.locksByWorkerColumns = [
      { name: 'worker', header: 'Worker', type: 'text' as const, width: '260px', stickyStart: true },
      { name: 'locks_activos', header: 'Locks activos', type: 'number' as const, width: '140px', align: 'right' },
      { name: 'zombies', header: 'Zombies', type: 'number' as const, width: '120px', align: 'right' },
      { name: 'edad_mas_vieja_label', header: 'Lock más viejo', type: 'text' as const, width: '160px', align: 'right' },
      { name: 'antecedentes', header: 'Antecedentes', type: 'text' as const, width: '320px' },
    ];

    // ✅ Tab Próximos en cola
    this.proximosColumns = [
      { name: 'posicion', header: '#', type: 'number' as const, width: '60px', align: 'right', stickyStart: true },
      { name: 'cedula', header: 'Cédula', type: 'text' as const, width: '140px' },
      { name: 'tipo_documento', header: 'Tipo doc', type: 'text' as const, width: '100px' },
      { name: 'oficina', header: 'Oficina', type: 'text' as const, width: '160px' },
      { name: 'paquete', header: 'Paquete', type: 'text' as const, width: '160px' },
      { name: 'prioridad', header: 'Prioridad', type: 'text' as const, width: '110px', align: 'right' },
      { name: 'bucket_label', header: 'Bucket', type: 'text' as const, width: '180px' },
      { name: 'estado_actual', header: 'Estado actual', type: 'status' as const, width: '150px',
        statusConfig: {
          SIN_CONSULTAR: { color: '#1e3a8a', background: '#dbeafe' },
          EN_PROGRESO:   { color: '#92400e', background: '#fef3c7' },
        } },
      { name: 'lock_estado', header: 'Lock', type: 'status' as const, width: '110px',
        statusConfig: {
          libre:    { color: '#065f46', background: '#d1fae5' },
          expirado: { color: '#7c2d12', background: '#ffedd5' },
          activo:   { color: '#7f1d1d', background: '#fee2e2' },
        } },
      { name: 'locked_by', header: 'Worker dueño', type: 'text' as const, width: '220px' },
      { name: 'locked_at', header: 'Locked at', type: 'text' as const, width: '170px' },
      { name: 'created_at', header: 'Creado', type: 'text' as const, width: '170px' },
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
