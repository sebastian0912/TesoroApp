import {
  Component,
  DestroyRef,
  Inject,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  computed,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatMenu } from '@angular/material/menu';

import Swal from 'sweetalert2';
import saveAs from 'file-saver';
import { finalize } from 'rxjs';

import { SharedModule } from '@/app/shared/shared.module';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import {
  VerPdfsComponent,
  ViewerDocument,
} from '../../components/ver-pdfs/ver-pdfs.component';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { HiringService } from '../../service/hiring.service';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ReportesService } from '../../service/reportes/reportes.service';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';

type DateRangeAction =
  | 'filterTables'
  | 'exportContratacion'
  | 'generateCentroCostoTable'
  | 'exportFincas';

interface ReporteRow {
  fecha: string;
  nombre: string;
  sede: string;
  cantidadContratosTuAlianza: number;
  cantidadContratosApoyoLaboral: number;
  nota?: string;
  cedulas?: any[];
  traslados?: any[];
  cruce_document?: { file_url?: string } | null;
  sst_document?: { file_url?: string } | null;
}

interface ConsolidadoRow {
  fecha: string;
  status: string;
  sede: string;
  cantidadContratosTuAlianza: number;
  cantidadContratosApoyoLaboral: number;
  totalIngresos: number;
  cedulas: number;
  traslados: number;
  sst: string;
  notas?: string;
}

interface FincaRow {
  fechaIngreso: string;
  centroCosto: string;
  total: number;
}

interface ErrorValidacionRow {
  id: number;
  fecha: string;
  tipoDeError: string;
  registro: string;
  mensaje: string;
  responsable: string;
}

const STATUS_REPORTADO = 'Reportado';
const STATUS_SIN_CONTRATACION = 'Sin contratación';
const STATUS_NO_REPORTO = 'No reportó';

const STATUS_ORDER: Record<string, number> = {
  [STATUS_NO_REPORTO]: 0,
  [STATUS_SIN_CONTRATACION]: 1,
  [STATUS_REPORTADO]: 2,
};

const EXCLUDED_SEDES = new Set<string>([
  'ADMINISTRATIVOS',
  'ANDES',
  'FORANEOS',
  'MONTE_VERDE',
  'VIRTUAL',
]);

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-view-reports',
  imports: [SharedModule, StandardFilterTable, MatButtonModule, MatProgressBarModule],
  templateUrl: './view-reports.component.html',
  styleUrl: './view-reports.component.css',
})
export class ViewReportsComponent implements OnInit {
  @ViewChild(MatMenu) menu!: MatMenu;

  reportes = signal<ReporteRow[]>([]);
  consolidado = signal<ConsolidadoRow[]>([]);
  fincas = signal<FincaRow[]>([]);
  erroresValidacion = signal<ErrorValidacionRow[]>([]);
  erroresPorTipo = signal<Record<string, number>>({});
  activeFrom = signal<string>('');
  activeTo = signal<string>('');

  isLoadingReportes = signal(false);
  isLoadingErrores = signal(false);
  isExporting = signal(false);
  activeRangeLabel = signal('Hoy');

  userCorreo = '';
  userNombre = '';

  isSidebarHidden = false;
  private readonly isBrowser: boolean;

  private readonly adminEmails = new Set<string>([
    'tuafiliacion@tsservicios.co',
    'programador.ts@gmail.com',
    'a.seguridad.ts@gmail.com',
    'a.sotelotualianza@gmail.com',
    'nominacentral9@gmail.com',
  ]);

  get isAdminReportUser(): boolean {
    return this.adminEmails.has((this.userCorreo || '').toLowerCase());
  }

  readonly kpis = computed(() => {
    const rows = this.consolidado();
    const sum = (key: keyof ConsolidadoRow) =>
      rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);

    return {
      tuAlianza: sum('cantidadContratosTuAlianza'),
      apoyoLaboral: sum('cantidadContratosApoyoLaboral'),
      cedulas: sum('cedulas'),
      oficinasReportaron: rows.filter((r) => r.status === STATUS_REPORTADO).length,
      oficinasTotal: rows.length,
    };
  });

  reportesColumns: ColumnDefinition[] = [
    { name: 'fecha', header: 'Fecha', type: 'date', width: '140px', align: 'left' },
    { name: 'nombre', header: 'Persona quien subió', type: 'text', align: 'left' },
    { name: 'sede', header: 'Sede', type: 'text', align: 'left' },
    {
      name: 'cantidadContratosTuAlianza',
      header: 'Contratos Tu Alianza',
      type: 'number',
      width: '150px',
      align: 'right',
    },
    {
      name: 'cantidadContratosApoyoLaboral',
      header: 'Contratos Apoyo Laboral',
      type: 'number',
      width: '180px',
      align: 'right',
    },
    { name: 'nota', header: 'Nota', type: 'text', align: 'left' },
    {
      name: 'actions',
      header: 'Documentos',
      type: 'custom',
      width: '220px',
      align: 'center',
      filterable: false,
    },
  ];

  consolidadoColumns: ColumnDefinition[] = [
    { name: 'fecha', header: 'Fecha', type: 'date', width: '140px', align: 'left' },
    {
      name: 'status',
      header: 'Estado',
      type: 'status',
      width: '170px',
      align: 'left',
      statusConfig: {
        [STATUS_NO_REPORTO]: { color: '#991b1b', background: '#fee2e2' },
        [STATUS_SIN_CONTRATACION]: { color: '#b45309', background: '#fef3c7' },
        [STATUS_REPORTADO]: { color: '#166534', background: '#dcfce7' },
      },
    },
    { name: 'sede', header: 'Oficina', type: 'text', align: 'left' },
    {
      name: 'cantidadContratosTuAlianza',
      header: 'Contratos Tu Alianza',
      type: 'number',
      width: '150px',
      align: 'right',
    },
    {
      name: 'cantidadContratosApoyoLaboral',
      header: 'Contratos Apoyo Laboral',
      type: 'number',
      width: '180px',
      align: 'right',
    },
    {
      name: 'totalIngresos',
      header: 'Total ingresos',
      type: 'number',
      width: '140px',
      align: 'right',
    },
    {
      name: 'cedulas',
      header: 'Cédulas subidas',
      type: 'number',
      width: '140px',
      align: 'right',
    },
    {
      name: 'traslados',
      header: 'Traslados',
      type: 'number',
      width: '120px',
      align: 'right',
    },
    {
      name: 'sst',
      header: 'SST',
      type: 'select',
      options: ['Sí', 'No'],
      width: '80px',
      align: 'center',
    },
    { name: 'notas', header: 'Notas', type: 'text', align: 'left' },
  ];

  fincasColumns: ColumnDefinition[] = [
    { name: 'fechaIngreso', header: 'Fecha', type: 'text', width: '160px', align: 'left' },
    { name: 'centroCosto', header: 'Centro de Costo', type: 'text', align: 'left' },
    { name: 'total', header: 'Total', type: 'number', width: '120px', align: 'right' },
  ];

  erroresColumns: ColumnDefinition[] = [
    { name: 'fecha', header: 'Fecha', type: 'date', width: '160px', align: 'left' },
    {
      name: 'tipoDeError',
      header: 'Tipo',
      type: 'custom',
      width: '200px',
      align: 'left',
      customClassConfig: {
        'Validación ARL': { color: '#991b1b', background: '#fee2e2' },
        'Documento de Contratación': { color: '#92400e', background: '#fef3c7' },
        'Cruce Diario - Pre-validación': { color: '#7c2d12', background: '#ffedd5' },
        'Cédulas Escaneadas - Previsualizador': { color: '#1e40af', background: '#dbeafe' },
        'Traslados - Previsualizador': { color: '#5b21b6', background: '#ede9fe' },
      },
    },
    { name: 'registro', header: 'Cédula / Registro', type: 'text', width: '160px', align: 'left' },
    { name: 'responsable', header: 'Responsable', type: 'text', width: '220px', align: 'left' },
    { name: 'mensaje', header: 'Detalle del error', type: 'text', align: 'left' },
  ];

  constructor(
    private readonly hiringService: HiringService,
    private readonly reportesService: ReportesService,
    private readonly dialog: MatDialog,
    private readonly utilityService: UtilityServiceService,
    private readonly cdr: ChangeDetectorRef,
    private readonly destroyRef: DestroyRef,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return;

    const user = await this.utilityService.getUser();
    if (user) {
      this.userCorreo = user.correo_electronico;
      this.userNombre = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;
      this.cdr.markForCheck();
    }

    const today = new Date().toISOString().slice(0, 10);
    this.activeRangeLabel.set('Hoy');
    this.activeFrom.set(today);
    this.activeTo.set(today);
    this.loadReportes({ fechaDesde: today, fechaHasta: today });
    this.loadErroresValidacion(today, today);
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  toggleSidebar(): void {
    if (!this.isBrowser) return;
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  hasAnyDocument(row: any): boolean {
    return (
      (Array.isArray(row?.cedulas) && row.cedulas.length > 0) ||
      (Array.isArray(row?.traslados) && row.traslados.length > 0) ||
      !!row?.cruce_document?.file_url ||
      !!row?.sst_document?.file_url
    );
  }

  private loadReportes(filters?: {
    nombre?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): void {
    if (!this.isBrowser) return;

    this.isLoadingReportes.set(true);

    this.reportesService
      .getReportes(filters)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingReportes.set(false)),
      )
      .subscribe({
        next: ({ reportes, consolidado }) => {
          this.reportes.set(reportes ?? []);

          if (this.isAdminReportUser) {
            const normalizado: ConsolidadoRow[] = (consolidado ?? [])
              .filter(
                (item: any) =>
                  !EXCLUDED_SEDES.has(
                    String(item?.sede ?? '').trim().toUpperCase(),
                  ),
              )
              .map((item: any) => ({
                ...item,
                sst: item.sst ? 'Sí' : 'No',
                status: this.normalizeStatus(item.status),
              }));

            normalizado.sort((a, b) => {
              const pa = STATUS_ORDER[a.status] ?? 99;
              const pb = STATUS_ORDER[b.status] ?? 99;
              if (pa !== pb) return pa - pb;
              return (a.sede || '').localeCompare(b.sede || '');
            });

            this.consolidado.set(normalizado);
          } else {
            this.consolidado.set([]);
          }
        },
        error: () => {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ocurrió un error al obtener los reportes.',
          });
        },
      });
  }

  private loadErroresValidacion(from?: string, to?: string): void {
    if (!this.isBrowser) return;

    this.isLoadingErrores.set(true);

    this.reportesService
      .getErroresValidacion({
        fechaDesde: from || undefined,
        fechaHasta: to || undefined,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isLoadingErrores.set(false)),
      )
      .subscribe({
        next: ({ errores, por_tipo }) => {
          const rows: ErrorValidacionRow[] = (errores ?? []).map((e) => ({
            id: e.id,
            fecha: e.fecha_creacion ?? '',
            tipoDeError: e.tipoDeError || 'Sin tipo',
            registro: e.registro != null ? String(e.registro) : '',
            mensaje: e.mensaje || '',
            responsable: e.responsable || '',
          }));
          this.erroresValidacion.set(rows);
          this.erroresPorTipo.set(por_tipo ?? {});
        },
        error: (err) => {
          console.error('[loadErroresValidacion] Falló:', err);
          this.erroresValidacion.set([]);
          this.erroresPorTipo.set({});
        },
      });
  }

  openDocsDialog(title: string, docs: any[] | null | undefined): void {
    if (!this.isBrowser) return;

    const documents: ViewerDocument[] = (docs ?? [])
      .filter((d: any) => !!d?.file_url)
      .map((d: any) => ({
        id: d.id,
        title: d.title,
        type_name: d.type_name,
        file_url: d.file_url,
      }));

    this.dialog.open(VerPdfsComponent, {
      minWidth: '90vw',
      panelClass: 'docs-viewer-dialog',
      data: { title, documents },
    });
  }

  openDateRangeDialog(action: DateRangeAction): void {
    if (!this.isBrowser) return;

    const dialogRef = this.dialog.open(DateRangeDialogComponent, {
      width: '550px',
    });

    dialogRef
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((result?: { start: string | null; end: string | null }) => {
        if (!result || (!result.start && !result.end)) return;

        const from = result.start ?? '';
        const to = result.end ?? '';

        switch (action) {
          case 'filterTables':
            this.handleFilterTables(from, to);
            break;
          case 'exportContratacion':
            this.handleExportContratacion(from, to);
            break;
          case 'generateCentroCostoTable':
            this.handleGenerateCentroCosto(from, to);
            break;
          case 'exportFincas':
            this.handleExportFincas(from, to);
            break;
        }
      });
  }

  private handleFilterTables(from: string, to: string): void {
    this.activeRangeLabel.set(this.buildRangeLabel(from, to));
    this.activeFrom.set(from);
    this.activeTo.set(to);
    this.loadReportes({
      fechaDesde: from || undefined,
      fechaHasta: to || undefined,
    });
    this.loadErroresValidacion(from, to);
  }

  refreshErroresValidacion(): void {
    this.loadErroresValidacion(this.activeFrom(), this.activeTo());
  }

  private handleExportContratacion(from: string, to: string): void {
    this.isExporting.set(true);

    this.hiringService
      .obtenerBaseContratacionPorFechas(from, to)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isExporting.set(false)),
      )
      .subscribe({
        next: (blob: Blob) => {
          if (!blob || blob.size === 0) {
            Swal.fire({
              icon: 'warning',
              title: 'Sin datos',
              text: 'No se encontraron registros para el rango seleccionado.',
            });
            return;
          }
          saveAs(
            blob,
            `reporte_contratacion_${from || 'sin_desde'}_a_${to || 'sin_hasta'}.xlsx`,
          );
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Error al descargar',
            text: err?.message ?? 'Ocurrió un error al descargar el archivo.',
          });
        },
      });
  }

  private handleGenerateCentroCosto(from: string, to: string): void {
    this.isExporting.set(true);

    this.hiringService
      .obtenerReportesPorFechasCentroCosto(from, to)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isExporting.set(false)),
      )
      .subscribe({
        next: ({ resultado }) => {
          const total = resultado?.total_general ?? 0;
          if (total === 0) {
            Swal.fire({
              icon: 'warning',
              title: 'No hay reportes',
              text: 'No se encontraron reportes para las fechas seleccionadas.',
            });
            this.fincas.set([]);
            return;
          }

          const detalles = resultado?.detalles ?? [];
          this.fincas.set(this.formatData(detalles));
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Error al cargar',
            text: err?.message ?? 'Ocurrió un error al cargar los reportes.',
          });
        },
      });
  }

  private handleExportFincas(from: string, to: string): void {
    this.isExporting.set(true);

    this.hiringService
      .descargarReporteFechaIngresoCentroCostoFincas(from, to)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isExporting.set(false)),
      )
      .subscribe({
        next: (blob: Blob) => {
          if (!blob || blob.size === 0) {
            Swal.fire({
              icon: 'warning',
              title: 'No hay reportes',
              text: 'No se encontraron reportes de fincas para las fechas seleccionadas.',
            });
            return;
          }

          saveAs(
            blob,
            `reporte_fincas_${from || 'sin_desde'}_a_${to || 'sin_hasta'}.xlsx`,
          );
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Error al descargar',
            text:
              err?.message ??
              'Ocurrió un error al descargar el reporte de fincas.',
          });
        },
      });
  }

  private normalizeStatus(raw: unknown): string {
    const s = String(raw ?? '').trim().toUpperCase();
    if (!s) return STATUS_NO_REPORTO;
    if (s === 'REALIZO REPORTE' || s === 'REPORTADO') return STATUS_REPORTADO;
    if (s === 'NO HUBO CONTRATACION' || s === 'SIN CONTRATACION' || s === 'SIN CONTRATACIÓN') {
      return STATUS_SIN_CONTRATACION;
    }
    if (
      s === 'NO REPORTO' ||
      s === 'NO REPORTÓ' ||
      s === 'SIN REPORTE' ||
      s === 'PENDIENTE' ||
      s.includes('NO REPORT')
    ) {
      return STATUS_NO_REPORTO;
    }
    return STATUS_NO_REPORTO;
  }

  private buildRangeLabel(from: string, to: string): string {
    const today = new Date().toISOString().slice(0, 10);
    const fmt = (iso: string) => {
      const [y, m, d] = iso.split('-');
      return `${d}/${m}/${y}`;
    };

    if (from && to) {
      if (from === to) return from === today ? 'Hoy' : fmt(from);
      return `${fmt(from)} → ${fmt(to)}`;
    }
    if (from) return `Desde ${fmt(from)}`;
    if (to) return `Hasta ${fmt(to)}`;
    return 'Sin rango';
  }

  private formatData(data: any): FincaRow[] {
    const fechas = Object.keys(data).sort((a, b) => {
      const dA = new Date(a.split('/').reverse().join('-')).getTime();
      const dB = new Date(b.split('/').reverse().join('-')).getTime();
      return dB - dA;
    });

    const resultado: FincaRow[] = [];
    fechas.forEach((fecha) => {
      let first = true;
      data[fecha].forEach((item: any) => {
        resultado.push({
          fechaIngreso: first ? fecha : '',
          centroCosto: item.centro_costo,
          total: item.total,
        });
        first = false;
      });
    });
    return resultado;
  }

  async descargarCrucesCombinados(): Promise<void> {
    if (!this.isBrowser) return;

    const urls = Array.from(
      new Set(
        this.reportes()
          .map((r) => r.cruce_document?.file_url)
          .filter((u): u is string => !!u),
      ),
    );

    if (urls.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin cruces',
        text: 'No hay documentos de cruce en los reportes visibles para el rango activo.',
      });
      return;
    }

    this.isExporting.set(true);

    try {
      const XLSX = await import('xlsx');

      let header: any[] | null = null;
      const alianzaRows: any[][] = [];
      const apoyoRows: any[][] = [];

      for (const url of urls) {
        const resp = await fetch(url);
        if (!resp.ok) continue;
        const buf = await resp.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });

        for (const sheetName of wb.SheetNames) {
          const ws = wb.Sheets[sheetName];
          const data: any[][] = XLSX.utils.sheet_to_json(ws, {
            header: 1,
            defval: '',
            blankrows: false,
          });
          if (data.length < 2) continue;

          const [rawHeader, ...body] = data;
          if (!header) header = rawHeader;

          const colIdx = this.detectEmpresaColumn(rawHeader, body);

          for (const row of body) {
            if (!row.some((c) => String(c ?? '').trim() !== '')) continue;
            const bucket = this.classifyRow(row, colIdx, sheetName);
            if (bucket === 'TA') alianzaRows.push(row);
            else if (bucket === 'AL') apoyoRows.push(row);
          }
        }
      }

      if (!header) {
        Swal.fire({
          icon: 'warning',
          title: 'Sin datos',
          text: 'Los archivos de cruce están vacíos o no se pudieron leer.',
        });
        return;
      }

      if (alianzaRows.length === 0 && apoyoRows.length === 0) {
        Swal.fire({
          icon: 'warning',
          title: 'No se pudo clasificar',
          text:
            'No se encontró una columna que distinga TA / AL en los cruces. Verifica que los archivos incluyan una columna con esos valores.',
        });
        return;
      }

      const newWb = XLSX.utils.book_new();
      const wsTA = XLSX.utils.aoa_to_sheet([header, ...alianzaRows]);
      const wsAL = XLSX.utils.aoa_to_sheet([header, ...apoyoRows]);
      XLSX.utils.book_append_sheet(newWb, wsTA, 'Tu Alianza');
      XLSX.utils.book_append_sheet(newWb, wsAL, 'Apoyo Laboral');

      const out = XLSX.write(newWb, { bookType: 'xlsx', type: 'array' });
      const fileName = `cruces_combinados_${new Date().toISOString().slice(0, 10)}.xlsx`;
      saveAs(
        new Blob([out], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }),
        fileName,
      );

      Swal.fire({
        icon: 'success',
        title: 'Descarga lista',
        html:
          `Se combinaron <b>${urls.length}</b> archivo(s) de cruce.<br>` +
          `<b>Tu Alianza:</b> ${alianzaRows.length} filas<br>` +
          `<b>Apoyo Laboral:</b> ${apoyoRows.length} filas`,
      });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error al combinar cruces',
        text: err?.message ?? 'No se pudieron combinar los archivos de cruce.',
      });
    } finally {
      this.isExporting.set(false);
    }
  }

  private detectEmpresaColumn(header: any[], body: any[][]): number {
    const headerIdx = header.findIndex((h) => {
      const s = String(h ?? '').toLowerCase().trim();
      return (
        s === 'empresa' ||
        s === 'cliente' ||
        s === 'ta/al' ||
        s === 'ta_al' ||
        s === 'tipo' ||
        s.includes('empresa') ||
        s.includes('alianza') ||
        s.includes('apoyo')
      );
    });
    if (headerIdx >= 0) return headerIdx;

    const sample = body.slice(0, Math.min(30, body.length));
    let bestIdx = -1;
    let bestScore = 0;

    for (let c = 0; c < header.length; c++) {
      let score = 0;
      for (const row of sample) {
        const s = String(row[c] ?? '').trim().toUpperCase();
        if (
          s === 'TA' ||
          s === 'AL' ||
          s === 'ALIANZA' ||
          s === 'APOYO' ||
          s.includes('TU ALIANZA') ||
          s.includes('APOYO LABORAL')
        ) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = c;
      }
    }
    return bestIdx;
  }

  private classifyRow(
    row: any[],
    colIdx: number,
    sheetName: string,
  ): 'TA' | 'AL' | null {
    const normalize = (v: unknown) => String(v ?? '').trim().toUpperCase();

    if (colIdx >= 0) {
      const v = normalize(row[colIdx]);
      if (v === 'TA' || v.includes('TU ALIANZA') || v === 'ALIANZA') return 'TA';
      if (v === 'AL' || v.includes('APOYO LABORAL') || v === 'APOYO') return 'AL';
    }

    const sn = normalize(sheetName);
    if (sn.includes('ALIANZA') || sn === 'TA') return 'TA';
    if (sn.includes('APOYO') || sn === 'AL') return 'AL';

    for (const cell of row) {
      const v = normalize(cell);
      if (v === 'TA' || v.includes('TU ALIANZA')) return 'TA';
      if (v === 'AL' || v.includes('APOYO LABORAL')) return 'AL';
    }
    return null;
  }

  descargarCedulasZip(): void {
    if (!this.isBrowser) return;

    this.isExporting.set(true);

    this.reportesService
      .downloadCedulasZip()
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.isExporting.set(false)),
      )
      .subscribe({
        next: (blob: Blob) => {
          if (!blob || blob.size === 0) {
            Swal.fire({
              icon: 'warning',
              title: 'Sin cédulas',
              text: 'No se encontraron documentos de cédula para descargar.',
            });
            return;
          }

          saveAs(blob, 'cedulas_reportes.zip');

          Swal.fire({
            icon: 'success',
            title: 'Descarga lista',
            text: 'El archivo ZIP de cédulas se generó correctamente.',
          });
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Error al descargar',
            text:
              err?.message ??
              'Ocurrió un error al descargar el ZIP de cédulas.',
          });
        },
      });
  }
}
