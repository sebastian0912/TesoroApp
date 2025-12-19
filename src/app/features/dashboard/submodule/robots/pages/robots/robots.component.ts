import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';

import Swal from 'sweetalert2';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import {
  RobotsService,
  PendientesResumenResponse,
  PendientesPorOficinaResponse,
} from '../../services/robots/robots.service';

type PdfKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo';

type ProgresoRow = {
  prioridad: string;
  total: number;
  llevas: number;
  faltan: number;
};

// ===== PIVOT progreso (solo faltan por tipo) =====
type ProgresoPivotRow = {
  prioridad: string;
  [k: string]: any; // p_<pdf>_faltan
};

// ===== tipos para tablas de pendientes =====
type PendienteConsultaKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo_pension'
  | 'medidas_correctivas'
  | 'union';

type PendientesResumenRow = {
  tipo: string;
  consulta: PendienteConsultaKey;
  sin_consultar: number;
  en_progreso: number;
  pendientes: number;
};

// ===== PIVOT pendientes por oficina =====
type PendientesPorOficinaPivotRow = {
  oficina: string | null;
  [k: string]: any; // c_<consultaKey> = SIN_CONSULTAR + EN_PROGRESO
};

@Component({
  selector: 'app-robots',
  imports: [
    CommonModule,
    StandardFilterTable,
    MatIconModule,
    MatCardModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  templateUrl: './robots.component.html',
  styleUrl: './robots.component.css',
})
export class RobotsComponent implements OnInit {
  constructor(
    private utilityService: UtilityServiceService,
    private robots: RobotsService,
    private dialog: MatDialog,
  ) {}

  // =========================
  // FULL
  // =========================
  isLoadingFull = false;
  robotsFull: any[] = [];
  fullColumns: ColumnDefinition[] = [];

  // =========================
  // PROGRESO GLOBAL (PIVOT)
  // =========================
  isLoadingProgresoAll = false;
  totalRegistros = 0;

  // 🔁 mismos nombres para no romper el HTML
  progresoTipoPrioridad: ProgresoPivotRow[] = [];
  progresoTipoPrioridadColumns: ColumnDefinition[] = [];

  private progresoByPdf: Partial<Record<PdfKey, ProgresoRow[]>> = {};

  private readonly pdfOptions: Array<{ key: PdfKey; label: string }> = [
    { key: 'adress', label: 'ADRES' },
    { key: 'policivo', label: 'POLICIVOS' },
    { key: 'ofac', label: 'OFAC' },
    { key: 'contraloria', label: 'CONTRALORÍA' },
    { key: 'sisben', label: 'SISBÉN' },
    { key: 'procuraduria', label: 'PROCURADURÍA' },
    { key: 'fondo', label: 'AFP' },
  ];

  // =========================
  // PENDIENTES (RESUMEN + POR OFICINA PIVOT)
  // =========================
  isLoadingPendientesResumen = false;
  pendientesResumenRows: PendientesResumenRow[] = [];
  pendientesResumenColumns: ColumnDefinition[] = [];

  isLoadingPendientesPorOficina = false;
  pendientesPorOficinaRows: PendientesPorOficinaPivotRow[] = [];
  pendientesPorOficinaColumns: ColumnDefinition[] = [];

  pendientesRowsWithAnyPending = 0;
  pendientesDistinctCedulasWithAnyPending = 0;

  private readonly pendientesOptions: Array<{ key: PendienteConsultaKey; label: string }> = [
    { key: 'adress', label: 'ADRES' },
    { key: 'policivo', label: 'POLICIVOS' },
    { key: 'ofac', label: 'OFAC' },
    { key: 'contraloria', label: 'CONTRALORÍA' },
    { key: 'sisben', label: 'SISBÉN' },
    { key: 'procuraduria', label: 'PROCURADURÍA' },
    { key: 'fondo_pension', label: 'AFP (Fondo pensión)' },
    { key: 'medidas_correctivas', label: 'MEDIDAS CORRECTIVAS' },
    { key: 'union', label: 'UNIÓN' },
  ];

  private readonly STATUS_OPTIONS = ['SIN_CONSULTAR', 'EN_PROGRESO', 'FINALIZADO', 'ERROR', 'Sin Pasado'];

  private readonly HEADER_ALIASES: Record<string, string[]> = {
    Identificación: [
      'identificación',
      'identificacion',
      'cédula',
      'cedula',
      'documento',
      'numero_documento',
      'número de documento',
      'numero de documento',
      'id',
    ],
    'Tipo documento': ['tipo documento', 'tipo_documento', 'tipo doc', 'tipo'],
    PAQUETE: ['paquete', 'oficina', 'sede'],
    'Nombre Y Apellidos': [
      'nombre y apellidos',
      'nombres y apellidos',
      'nombre y apellido',
      'nombres y apellido',
    ],
    'Primer Nombre': ['primer nombre', 'pn'],
    'Segundo Nombre': ['segundo nombre', 'sn'],
    'Primer Apellido': ['primer apellido', 'pa'],
    'Segundo Apellido': ['segundo apellido', 'sa'],
  };

  ngOnInit(): void {
    this.buildColumns();
    void this.loadAllWithSwal();
  }

  // =========================
  // ACCIONES UI
  // =========================
  reloadAll(): void {
    void this.loadAllWithSwal();
  }

  openPdf(url?: string | null): void {
    if (!url || !String(url).trim()) return;
    window.open(String(url), '_blank', 'noopener,noreferrer');
  }

  // =========================
  // SWAL LOADING GLOBAL
  // =========================
  private async loadAllWithSwal(): Promise<void> {
    Swal.fire({
      icon: 'info',
      title: 'Cargando información...',
      text: 'Por favor espera un momento',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const results = await Promise.allSettled([
        this.cargarRobotsFull(true),
        this.loadProgresoAll(true),
        this.loadPendientesResumen(true),
        this.loadPendientesPorOficina(true),
      ]);

      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'Carga incompleta',
          text: `Se cargaron algunos datos, pero ${failed} sección(es) fallaron. Puedes intentar recargar.`,
        });
      }
    } finally {
      Swal.close();
    }
  }

  // =========================
  // DATA LOADERS
  // (silent=true => no Swal de error aquí, se maneja arriba)
  // =========================
  async cargarRobotsFull(silent = false): Promise<void> {
    this.isLoadingFull = true;
    try {
      const resp: any = await firstValueFrom(this.robots.getRobotsFull() as any);

      const arr = Array.isArray(resp)
        ? resp
        : Array.isArray(resp?.body)
          ? resp.body
          : [];

      this.robotsFull = arr.map((r: any) => this.mapFullRow(r));
    } catch (e) {
      console.error(e);
      this.robotsFull = [];
      if (!silent) {
        await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar /Robots/full/' });
      } else {
        throw e;
      }
    } finally {
      this.isLoadingFull = false;
    }
  }

  async loadProgresoAll(silent = false): Promise<void> {
    this.isLoadingProgresoAll = true;

    try {
      const resp: any = await firstValueFrom(this.robots.getProgresoPrioridadesAll() as any);

      this.totalRegistros = Number(resp?.total_registros ?? 0);

      for (const p of this.pdfOptions) {
        const block = resp?.por_pdf?.[p.key];
        const rows = Array.isArray(block?.por_prioridad) ? block.por_prioridad : [];

        this.progresoByPdf[p.key] = rows.map((r: any) => ({
          prioridad: String(r?.prioridad ?? 'SIN_PRIORIDAD'),
          total: Number(r?.total ?? 0),
          llevas: Number(r?.llevas ?? 0),
          faltan: Number(r?.faltan ?? 0),
        }));
      }

      // ✅ PIVOT: filas = prioridad, columnas = tipo (SOLO FALTAN)
      this.progresoTipoPrioridad = this.pivotProgresoPorPrioridadSoloFaltan();
    } catch (e) {
      console.error(e);
      this.totalRegistros = 0;
      this.progresoTipoPrioridad = [];
      for (const p of this.pdfOptions) this.progresoByPdf[p.key] = [];

      if (!silent) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar /Robots/progreso-prioridades/ (ALL).',
        });
      } else {
        throw e;
      }
    } finally {
      this.isLoadingProgresoAll = false;
    }
  }

  // ===== Pendientes resumen (igual) =====
  async loadPendientesResumen(silent = false): Promise<void> {
    this.isLoadingPendientesResumen = true;
    try {
      const resp: PendientesResumenResponse = await firstValueFrom(this.robots.getPendientesResumen());

      this.pendientesRowsWithAnyPending = Number(resp?.rowsWithAnyPending ?? 0);
      this.pendientesDistinctCedulasWithAnyPending = Number(resp?.distinctCedulasWithAnyPending ?? 0);

      const by = resp?.byConsulta ?? {};
      const labelMap = new Map<PendienteConsultaKey, string>(this.pendientesOptions.map(o => [o.key, o.label]));

      const rows: PendientesResumenRow[] = [];
      for (const opt of this.pendientesOptions) {
        const c = by?.[opt.key] ?? { SIN_CONSULTAR: 0, EN_PROGRESO: 0, PENDIENTES: 0 };
        rows.push({
          tipo: labelMap.get(opt.key) ?? String(opt.key),
          consulta: opt.key,
          sin_consultar: Number(c.SIN_CONSULTAR ?? 0),
          en_progreso: Number(c.EN_PROGRESO ?? 0),
          pendientes: Number(c.PENDIENTES ?? 0),
        });
      }

      this.pendientesResumenRows = rows;
    } catch (e) {
      console.error(e);
      this.pendientesResumenRows = [];
      this.pendientesRowsWithAnyPending = 0;
      this.pendientesDistinctCedulasWithAnyPending = 0;

      if (!silent) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar /pendientes/resumen/',
        });
      } else {
        throw e;
      }
    } finally {
      this.isLoadingPendientesResumen = false;
    }
  }

  // ✅ PIVOT: filas = oficina, columnas = tipos, celda = sin_consultar + en_progreso
  async loadPendientesPorOficina(silent = false): Promise<void> {
    this.isLoadingPendientesPorOficina = true;
    try {
      const resp: PendientesPorOficinaResponse = await firstValueFrom(this.robots.getPendientesPorOficina());
      const items = Array.isArray(resp?.items) ? resp.items : [];

      const rows: PendientesPorOficinaPivotRow[] = items.map((it: any) => {
        const oficina = it?.oficina ?? null;
        const by = it?.byConsulta ?? {};

        const row: PendientesPorOficinaPivotRow = { oficina };

        for (const opt of this.pendientesOptions) {
          const c = by?.[opt.key] ?? { SIN_CONSULTAR: 0, EN_PROGRESO: 0 };
          const sin = Number(c.SIN_CONSULTAR ?? 0);
          const pro = Number(c.EN_PROGRESO ?? 0);
          row[this.pendientesColKey(opt.key)] = sin + pro;
        }

        return row;
      });

      rows.sort((a, b) =>
        String(a.oficina ?? '').toUpperCase().localeCompare(String(b.oficina ?? '').toUpperCase()),
      );

      this.pendientesPorOficinaRows = rows;
    } catch (e) {
      console.error(e);
      this.pendientesPorOficinaRows = [];

      if (!silent) {
        await Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'No se pudo cargar /pendientes/por-oficina/',
        });
      } else {
        throw e;
      }
    } finally {
      this.isLoadingPendientesPorOficina = false;
    }
  }

  // =========================
  // PIVOTS
  // =========================
  // ✅ SOLO FALTAN
  private pivotProgresoPorPrioridadSoloFaltan(): ProgresoPivotRow[] {
    const prioridadSet = new Set<string>();

    for (const opt of this.pdfOptions) {
      const rows = this.progresoByPdf[opt.key] ?? [];
      for (const r of rows) prioridadSet.add(String(r?.prioridad ?? 'SIN_PRIORIDAD'));
    }

    const prioridades = Array.from(prioridadSet);

    const prioridadOrder = (p: string): number => {
      const s = String(p ?? '').trim();
      if (!s) return 999999;
      const n = Number(s);
      if (Number.isFinite(n) && s === String(n)) return n;
      return s.toUpperCase() === 'SIN_PRIORIDAD' ? 999998 : 999997;
    };

    prioridades.sort((a, b) => prioridadOrder(a) - prioridadOrder(b));

    const out: ProgresoPivotRow[] = [];

    for (const prio of prioridades) {
      const row: ProgresoPivotRow = { prioridad: prio };

      for (const opt of this.pdfOptions) {
        const list = this.progresoByPdf[opt.key] ?? [];
        const found = list.find(x => String(x?.prioridad ?? 'SIN_PRIORIDAD') === prio);

        row[this.progresoColKey(opt.key)] = Number(found?.faltan ?? 0);
      }

      out.push(row);
    }

    return out;
  }

  private progresoColKey(pdf: PdfKey): string {
    return `p_${pdf}_faltan`;
  }

  private pendientesColKey(consulta: PendienteConsultaKey): string {
    return `c_${consulta}`;
  }

  // =========================
  // COLUMNAS
  // =========================
  private buildColumns(): void {
    // ===== Pendientes resumen (igual) =====
    this.pendientesResumenColumns = [
      { name: 'tipo', header: 'Tipo', type: 'text' as const, width: '220px' },
      { name: 'sin_consultar', header: 'Sin consultar', type: 'number' as const, width: '150px' },
      { name: 'en_progreso', header: 'En progreso', type: 'number' as const, width: '150px' },
      { name: 'pendientes', header: 'Pendientes', type: 'number' as const, width: '140px' },
    ];

    // ✅ Pendientes por oficina (PIVOT): oficina + columnas por tipo (sin+progreso)
    const pendientesPivotCols: ColumnDefinition[] = this.pendientesOptions.map(opt => ({
      name: this.pendientesColKey(opt.key),
      header: opt.label,
      type: 'number' as const,
      width: '160px',
    }));

    this.pendientesPorOficinaColumns = [
      { name: 'oficina', header: 'Oficina', type: 'text' as const, width: '180px' },
      ...pendientesPivotCols,
    ];

    // ✅ Progreso por prioridad (PIVOT): prioridad + 1 columna por tipo (FALTAN)
    const progresoPivotCols: ColumnDefinition[] = this.pdfOptions.map(opt => ({
      name: this.progresoColKey(opt.key),
      header: `${opt.label}`, // si quieres: `${opt.label} (Faltan)`
      type: 'number' as const,
      width: '160px',
    }));

    this.progresoTipoPrioridadColumns = [
      { name: 'prioridad', header: 'Prioridad', type: 'text' as const, width: '140px' },
      ...progresoPivotCols,
    ];

    // ===== FULL (igual que tenías) =====
    this.fullColumns = [
      { name: 'oficina', header: 'Oficina', type: 'text' as const, width: '140px' },
      { name: 'robot', header: 'Robot', type: 'text' as const, width: '140px' },
      { name: 'cedula', header: 'Cédula', type: 'text' as const, width: '140px' },
      { name: 'tipo_documento', header: 'Tipo documento', type: 'text' as const, width: '160px' },

      { name: 'estado_adress', header: 'Estado ADRES', type: 'status' as const, width: '170px', options: this.STATUS_OPTIONS },
      { name: 'apellido_adress', header: 'Apellido ADRES', type: 'text' as const, width: '200px' },
      { name: 'entidad_adress', header: 'Entidad ADRES', type: 'text' as const, width: '240px' },
      { name: 'pdf_adress', header: 'PDF ADRES', type: 'text' as const, width: '220px', filterable: false },
      { name: 'fecha_adress', header: 'Fecha ADRES', type: 'text' as const, width: '170px' },

      { name: 'estado_policivo', header: 'Estado Policivo', type: 'status' as const, width: '180px', options: this.STATUS_OPTIONS },
      { name: 'anotacion_policivo', header: 'Anotación Policivo', type: 'text' as const, width: '260px' },
      { name: 'pdf_policivo', header: 'PDF Policivo', type: 'text' as const, width: '220px', filterable: false },

      { name: 'estado_ofac', header: 'Estado OFAC', type: 'status' as const, width: '170px', options: this.STATUS_OPTIONS },
      { name: 'anotacion_ofac', header: 'Anotación OFAC', type: 'text' as const, width: '260px' },
      { name: 'pdf_ofac', header: 'PDF OFAC', type: 'text' as const, width: '220px', filterable: false },

      { name: 'estado_contraloria', header: 'Estado Contraloría', type: 'status' as const, width: '190px', options: this.STATUS_OPTIONS },
      { name: 'anotacion_contraloria', header: 'Anotación Contraloría', type: 'text' as const, width: '280px' },
      { name: 'pdf_contraloria', header: 'PDF Contraloría', type: 'text' as const, width: '220px', filterable: false },

      { name: 'estado_sisben', header: 'Estado Sisben', type: 'status' as const, width: '170px', options: this.STATUS_OPTIONS },
      { name: 'tipo_sisben', header: 'Tipo Sisben', type: 'text' as const, width: '170px' },
      { name: 'pdf_sisben', header: 'PDF Sisben', type: 'text' as const, width: '220px', filterable: false },
      { name: 'fecha_sisben', header: 'Fecha Sisben', type: 'text' as const, width: '170px' },

      { name: 'estado_procuraduria', header: 'Estado Procuraduría', type: 'status' as const, width: '200px', options: this.STATUS_OPTIONS },
      { name: 'anotacion_procuraduria', header: 'Anotación Procuraduría', type: 'text' as const, width: '280px' },
      { name: 'pdf_procuraduria', header: 'PDF Procuraduría', type: 'text' as const, width: '220px', filterable: false },

      { name: 'estado_fondo_pension', header: 'Estado AFP', type: 'status' as const, width: '210px', options: this.STATUS_OPTIONS },
      { name: 'entidad_fondo_pension', header: 'Entidad AFP', type: 'text' as const, width: '280px' },
      { name: 'pdf_fondo_pension', header: 'PDF AFP', type: 'text' as const, width: '220px', filterable: false },
      { name: 'fecha_fondo_pension', header: 'Fecha AFP', type: 'text' as const, width: '200px' },

      { name: 'estado_union', header: 'Estado Unión', type: 'status' as const, width: '170px', options: this.STATUS_OPTIONS },
      { name: 'union_pdf', header: 'Unión PDF', type: 'text' as const, width: '260px', filterable: false },
      { name: 'fecha_union_pdf', header: 'Fecha Unión PDF', type: 'text' as const, width: '200px' },

      { name: 'actions', header: 'Acciones', type: 'custom' as const, width: '160px', filterable: false, sortable: false },
    ];
  }

  private mapFullRow(r: any): any {
    return {
      oficina: r?.oficina ?? null,

      robot: r?.Robot ?? r?.robot ?? null,
      cedula: r?.Cedula ?? r?.cedula ?? null,
      tipo_documento: r?.Tipo_documento ?? r?.tipo_documento ?? null,

      estado_adress: r?.Estado_Adress ?? r?.estado_adress ?? null,
      apellido_adress: r?.Apellido_Adress ?? r?.apellido_adress ?? null,
      entidad_adress: r?.Entidad_Adress ?? r?.entidad_adress ?? null,
      pdf_adress: r?.PDF_Adress ?? r?.pdf_adress ?? null,
      fecha_adress: r?.Fecha_Adress ?? r?.fecha_adress ?? null,

      estado_policivo: r?.Estado_Policivo ?? r?.estado_policivo ?? null,
      anotacion_policivo: r?.Anotacion_Policivo ?? r?.anotacion_policivo ?? null,
      pdf_policivo: r?.PDF_Policivo ?? r?.pdf_policivo ?? null,

      estado_ofac: r?.Estado_OFAC ?? r?.estado_ofac ?? null,
      anotacion_ofac: r?.Anotacion_OFAC ?? r?.anotacion_ofac ?? null,
      pdf_ofac: r?.PDF_OFAC ?? r?.pdf_ofac ?? null,

      estado_contraloria: r?.Estado_Contraloria ?? r?.estado_contraloria ?? null,
      anotacion_contraloria: r?.Anotacion_Contraloria ?? r?.anotacion_contraloria ?? null,
      pdf_contraloria: r?.PDF_Contraloria ?? r?.pdf_contraloria ?? null,

      estado_sisben: r?.Estado_Sisben ?? r?.estado_sisben ?? null,
      tipo_sisben: r?.Tipo_Sisben ?? r?.tipo_sisben ?? null,
      pdf_sisben: r?.PDF_Sisben ?? r?.pdf_sisben ?? null,
      fecha_sisben: r?.Fecha_Sisben ?? r?.fecha_sisben ?? null,

      estado_procuraduria: r?.Estado_Procuraduria ?? r?.estado_procuraduria ?? null,
      anotacion_procuraduria: r?.Anotacion_Procuraduria ?? r?.anotacion_procuraduria ?? null,
      pdf_procuraduria: r?.PDF_Procuraduria ?? r?.pdf_procuraduria ?? null,

      estado_fondo_pension: r?.Estado_FondoPension ?? r?.estado_fondo_pension ?? null,
      entidad_fondo_pension: r?.Entidad_FondoPension ?? r?.entidad_fondo_pension ?? null,
      pdf_fondo_pension: r?.PDF_FondoPension ?? r?.pdf_fondo_pension ?? null,
      fecha_fondo_pension: r?.Fecha_FondoPension ?? r?.fecha_fondo_pension ?? null,

      estado_union: r?.Estado_Union ?? r?.estado_union ?? null,
      union_pdf: r?.Union_PDF ?? r?.union_pdf ?? null,
      fecha_union_pdf: r?.Fecha_UnionPDF ?? r?.fecha_union_pdf ?? null,
    };
  }
}
