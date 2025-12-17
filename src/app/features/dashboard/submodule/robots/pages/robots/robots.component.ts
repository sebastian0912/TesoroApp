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
import { RobotsService } from '../../services/robots/robots.service';

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

type ProgresoTipoPrioridadRow = {
  pdf: PdfKey;
  tipo: string;
  prioridad: string;
  llevas: number;
  faltan: number;
  total: number;
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
  // PROGRESO GLOBAL
  // =========================
  isLoadingProgresoAll = false;
  totalRegistros = 0;

  progresoTipoPrioridad: ProgresoTipoPrioridadRow[] = [];
  progresoTipoPrioridadColumns: ColumnDefinition[] = [];

  private progresoByPdf: Partial<Record<PdfKey, ProgresoRow[]>> = {};

  private readonly pdfOptions: Array<{ key: PdfKey; label: string }> = [
    { key: 'adress', label: 'ADRES' },
    { key: 'policivo', label: 'POLICIVOS' },
    { key: 'ofac', label: 'OFAC' },
    { key: 'contraloria', label: 'CONTRALORÍA' },
    { key: 'sisben', label: 'SISBÉN' },
    { key: 'procuraduria', label: 'PROCURADURÍA' },
    { key: 'fondo', label: 'AFP (Fondo pensión)' },
  ];

  private readonly STATUS_OPTIONS = ['SIN_CONSULTAR', 'EN_PROGRESO', 'FINALIZADO', 'ERROR', 'Sin Pasado'];

  // (lo puedes dejar si lo usas en otra parte, el HTML actual no lo usa)
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
    void this.cargarRobotsFull();
    void this.loadProgresoAll();
  }

  // =========================
  // ACCIONES UI
  // =========================
  reloadAll(): void {
    void this.cargarRobotsFull();
    void this.loadProgresoAll();
  }

  openPdf(url?: string | null): void {
    if (!url || !String(url).trim()) return;
    window.open(String(url), '_blank', 'noopener,noreferrer');
  }

  // =========================
  // DATA LOADERS
  // =========================
  async cargarRobotsFull(): Promise<void> {
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
      await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar /Robots/full/' });
    } finally {
      this.isLoadingFull = false;
    }
  }

  async loadProgresoAll(): Promise<void> {
    this.isLoadingProgresoAll = true;

    try {
      const resp: any = await firstValueFrom(this.robots.getProgresoPrioridadesAll() as any);

      this.totalRegistros = Number(resp?.total_registros ?? 0);

      // normaliza por PDF
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

      // tabla plana tipo/prioridad/llevas/cuantos
      this.progresoTipoPrioridad = this.flattenTipoPrioridad();
    } catch (e) {
      console.error(e);
      this.totalRegistros = 0;
      this.progresoTipoPrioridad = [];
      for (const p of this.pdfOptions) this.progresoByPdf[p.key] = [];

      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar /Robots/progreso-prioridades/ (ALL).',
      });
    } finally {
      this.isLoadingProgresoAll = false;
    }
  }

  private flattenTipoPrioridad(): ProgresoTipoPrioridadRow[] {
    const out: ProgresoTipoPrioridadRow[] = [];

    const prioridadOrder = (p: string): number => {
      const s = String(p ?? '').trim();
      if (!s) return 999999;
      const n = Number(s);
      if (Number.isFinite(n) && s === String(n)) return n;
      return s.toUpperCase() === 'SIN_PRIORIDAD' ? 999998 : 999997;
    };

    for (const opt of this.pdfOptions) {
      const rows = this.progresoByPdf[opt.key] ?? [];
      for (const r of rows) {
        out.push({
          pdf: opt.key,
          tipo: opt.label,
          prioridad: String(r?.prioridad ?? 'SIN_PRIORIDAD'),
          llevas: Number(r?.llevas ?? 0),
          faltan: Number(r?.faltan ?? 0),
          total: Number(r?.total ?? 0),
        });
      }
    }

    const pdfIndex = new Map<PdfKey, number>(this.pdfOptions.map((p, i) => [p.key, i]));
    out.sort((a, b) => {
      const ai = pdfIndex.get(a.pdf) ?? 999;
      const bi = pdfIndex.get(b.pdf) ?? 999;
      if (ai !== bi) return ai - bi;
      return prioridadOrder(a.prioridad) - prioridadOrder(b.prioridad);
    });

    return out;
  }

  // =========================
  // COLUMNAS / MAPEOS
  // =========================
  private buildColumns(): void {
    this.progresoTipoPrioridadColumns = [
      { name: 'tipo', header: 'Tipo', type: 'text', width: '170px' },
      { name: 'prioridad', header: 'Prioridad', type: 'text', width: '160px' },
      { name: 'total', header: 'Cuántos', type: 'number', width: '120px' },
      { name: 'llevas', header: 'Llevas', type: 'number', width: '120px' },
      { name: 'faltan', header: 'Faltan', type: 'number', width: '120px' },
    ];

    this.fullColumns = [
      { name: 'oficina', header: 'Oficina', type: 'text', width: '140px' },
      { name: 'robot', header: 'Robot', type: 'text', width: '140px' },
      { name: 'cedula', header: 'Cédula', type: 'text', width: '140px' },
      { name: 'tipo_documento', header: 'Tipo documento', type: 'text', width: '160px' },

      { name: 'estado_adress', header: 'Estado ADRES', type: 'status', width: '170px', options: this.STATUS_OPTIONS },
      { name: 'apellido_adress', header: 'Apellido ADRES', type: 'text', width: '200px' },
      { name: 'entidad_adress', header: 'Entidad ADRES', type: 'text', width: '240px' },
      { name: 'pdf_adress', header: 'PDF ADRES', type: 'text', width: '220px', filterable: false },
      { name: 'fecha_adress', header: 'Fecha ADRES', type: 'text', width: '170px' },

      { name: 'estado_policivo', header: 'Estado Policivo', type: 'status', width: '180px', options: this.STATUS_OPTIONS },
      { name: 'anotacion_policivo', header: 'Anotación Policivo', type: 'text', width: '260px' },
      { name: 'pdf_policivo', header: 'PDF Policivo', type: 'text', width: '220px', filterable: false },

      { name: 'estado_ofac', header: 'Estado OFAC', type: 'status', width: '170px', options: this.STATUS_OPTIONS },
      { name: 'anotacion_ofac', header: 'Anotación OFAC', type: 'text', width: '260px' },
      { name: 'pdf_ofac', header: 'PDF OFAC', type: 'text', width: '220px', filterable: false },

      { name: 'estado_contraloria', header: 'Estado Contraloría', type: 'status', width: '190px', options: this.STATUS_OPTIONS },
      { name: 'anotacion_contraloria', header: 'Anotación Contraloría', type: 'text', width: '280px' },
      { name: 'pdf_contraloria', header: 'PDF Contraloría', type: 'text', width: '220px', filterable: false },

      { name: 'estado_sisben', header: 'Estado Sisben', type: 'status', width: '170px', options: this.STATUS_OPTIONS },
      { name: 'tipo_sisben', header: 'Tipo Sisben', type: 'text', width: '170px' },
      { name: 'pdf_sisben', header: 'PDF Sisben', type: 'text', width: '220px', filterable: false },
      { name: 'fecha_sisben', header: 'Fecha Sisben', type: 'text', width: '170px' },

      { name: 'estado_procuraduria', header: 'Estado Procuraduría', type: 'status', width: '200px', options: this.STATUS_OPTIONS },
      { name: 'anotacion_procuraduria', header: 'Anotación Procuraduría', type: 'text', width: '280px' },
      { name: 'pdf_procuraduria', header: 'PDF Procuraduría', type: 'text', width: '220px', filterable: false },

      { name: 'estado_fondo_pension', header: 'Estado AFP', type: 'status', width: '210px', options: this.STATUS_OPTIONS },
      { name: 'entidad_fondo_pension', header: 'Entidad AFP', type: 'text', width: '280px' },
      { name: 'pdf_fondo_pension', header: 'PDF AFP', type: 'text', width: '220px', filterable: false },
      { name: 'fecha_fondo_pension', header: 'Fecha AFP', type: 'text', width: '200px' },

      { name: 'estado_union', header: 'Estado Unión', type: 'status', width: '170px', options: this.STATUS_OPTIONS },
      { name: 'union_pdf', header: 'Unión PDF', type: 'text', width: '260px', filterable: false },
      { name: 'fecha_union_pdf', header: 'Fecha Unión PDF', type: 'text', width: '200px' },

      { name: 'actions', header: 'Acciones', type: 'custom', width: '160px', filterable: false, sortable: false },
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
