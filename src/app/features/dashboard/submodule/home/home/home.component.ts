import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';

import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

import { firstValueFrom } from 'rxjs';

import { UtilityServiceService } from '../../../../../shared/services/utilityService/utility-service.service';
import { MerchandisingMerchandiseComponent } from '../components/merchandising-merchandise/merchandising-merchandise.component';
import { RobotTrackingComponent } from '../components/robot-tracking/robot-tracking.component';
import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import {
  HomeService,
  PdfKey,
  ProgresoRow,
  ProgresoPrioridadesAllResponse,
} from '../service/home.service';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { ColumnDefinition } from '../../../../../shared/models/advanced-table-interface';

type PdfOption = { key: PdfKey; label: string };

// ✅ Tabla que realmente te importa (tipo, prioridad, llevas, cuantos)
type ProgresoTipoPrioridadRow = {
  pdf: PdfKey;         // key técnica
  tipo: string;        // label para mostrar (ADRES, OFAC, etc)
  prioridad: string;
  llevas: number;
  faltan: number;
  total: number;       // "cuantos"
};

@Component({
  selector: 'app-home',
  imports: [
    CommonModule,
    ReactiveFormsModule,

    MatCardModule,
    MatIconModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSelectModule,

    MerchandisingMerchandiseComponent,
    RobotTrackingComponent,
    InfoCardComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit {
  user: any;

  general = false;
  comercializadora = false;
  admin = false;
  traslado = false;

  isSidebarHidden = false;
  robotsHome = false;

  // ===== FULL =====
  isLoadingFull = false;
  robotsFull: any[] = [];
  fullColumns: ColumnDefinition[] = [];

  // ===== PROGRESO (ALL JSON CACHE) =====
  isLoadingProgresoAll = false;
  totalRegistros = 0;
  private progresoAllCache: ProgresoPrioridadesAllResponse | null = null;

  // ===== PROGRESO (por cada PDF) =====
  progresoByPdf: Partial<Record<PdfKey, ProgresoRow[]>> = {};
  isLoadingByPdf: Partial<Record<PdfKey, boolean>> = {};

  // ===== PROGRESO (tabla que te importa: tipo, prioridad, llevas, cuantos) =====
  progresoTipoPrioridad: ProgresoTipoPrioridadRow[] = [];
  progresoTipoPrioridadColumns: ColumnDefinition[] = [];

  // ===== PROGRESO (seleccionado - si lo sigues usando) =====
  isLoadingProgreso = false;
  progreso: ProgresoRow[] = [];
  progresoColumns: ColumnDefinition[] = [];
  currentPdfLabel = '—';

  // ===== SELECTOR PDF =====
  pdfCtrl = new FormControl<PdfKey>('adress', { nonNullable: true });

  pdfOptions: PdfOption[] = [
    { key: 'adress', label: 'ADRES' },
    { key: 'policivo', label: 'POLICIVOS' },
    { key: 'ofac', label: 'OFAC' },
    { key: 'contraloria', label: 'CONTRALORÍA' },
    { key: 'sisben', label: 'SISBÉN' },
    { key: 'procuraduria', label: 'PROCURADURÍA' },
    { key: 'fondo', label: 'AFP (Fondo pensión)' },
  ];

  // ====== (esto ya no se usa en el HTML nuevo, pero lo dejo por si lo usas en otros lados) ======
  paqueteCtrl = new FormControl<string>('', { nonNullable: true });
  paquetes: string[] = [];

  // Ojo: tu backend devuelve "Sin Pasado", por eso lo incluyo
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

  constructor(
    private utilityService: UtilityServiceService,
    private homeService: HomeService,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    this.initializeUserRoles();
    this.buildColumns();

    const first = this.pdfOptions[0]?.key ?? 'adress';
    if (!this.pdfCtrl.value) this.pdfCtrl.setValue(first);

    void this.initData();
  }

  private async initData(): Promise<void> {
    void this.cargarRobotsFull();

    // ✅ caso 2: una sola llamada trae TODO
    await this.loadProgresoAll();

    // si aún mantienes el “selector” (tabla por PDF)
    await this.loadProgresoSelected();
  }

  // ===========================
  // ACCIONES UI
  // ===========================

  reloadAll(): void {
    void this.cargarRobotsFull();
    void this.loadProgresoAll().then(() => this.loadProgresoSelected());
  }

  openPdf(url?: string | null): void {
    if (!url || !String(url).trim()) return;
    window.open(String(url), '_blank', 'noopener,noreferrer');
  }

  // ===========================
  // PROGRESO (CASO 2)
  // ===========================

  // (Opcional) tabla por PDF seleccionado
  async loadProgresoSelected(): Promise<void> {
    const pdfKey = this.pdfCtrl.value;
    const opt = this.pdfOptions.find((o) => o.key === pdfKey);
    this.currentPdfLabel = opt?.label ?? pdfKey;

    if (!this.progresoAllCache) {
      await this.loadProgresoAll();
    }

    this.isLoadingProgreso = true;
    try {
      this.progreso = this.progresoByPdf[pdfKey] ?? [];
    } finally {
      this.isLoadingProgreso = false;
    }
  }

  // ✅ trae TODO y arma:
  async loadProgresoAll(): Promise<void> {
    this.isLoadingProgresoAll = true;
    for (const p of this.pdfOptions) this.isLoadingByPdf[p.key] = true;

    try {
      const resp = await firstValueFrom(this.homeService.getProgresoPrioridadesAll());
      this.progresoAllCache = resp ?? null;

      // ✅ según tu JSON real
      this.totalRegistros = Number((resp as any)?.total_registros ?? 0);

      // 1) normaliza por PDF
      for (const p of this.pdfOptions) {
        const block = resp?.por_pdf?.[p.key];
        const rows = Array.isArray(block?.por_prioridad) ? block!.por_prioridad : [];
        this.progresoByPdf[p.key] = rows.map((r: any) => ({
          prioridad: String(r?.prioridad ?? 'SIN_PRIORIDAD'),
          total: Number(r?.total ?? 0),
          llevas: Number(r?.llevas ?? 0),
          faltan: Number(r?.faltan ?? 0),
        }));
      }

      // 2) arma tabla plana “tipo/prioridad/llevas/cuantos”
      this.progresoTipoPrioridad = this.flattenTipoPrioridad();
    } catch (e) {
      console.error(e);
      this.progresoAllCache = null;
      this.totalRegistros = 0;

      for (const p of this.pdfOptions) this.progresoByPdf[p.key] = [];
      this.progresoTipoPrioridad = [];

      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudo cargar /Robots/progreso-prioridades/ (ALL).',
      });
    } finally {
      for (const p of this.pdfOptions) this.isLoadingByPdf[p.key] = false;
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
      // SIN_PRIORIDAD al final
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

    // ordena por: orden del pdfOptions, luego prioridad numérica
    const pdfIndex = new Map<PdfKey, number>(this.pdfOptions.map((p, i) => [p.key, i]));
    out.sort((a, b) => {
      const ai = pdfIndex.get(a.pdf) ?? 999;
      const bi = pdfIndex.get(b.pdf) ?? 999;
      if (ai !== bi) return ai - bi;
      return prioridadOrder(a.prioridad) - prioridadOrder(b.prioridad);
    });

    return out;
  }

  // ===========================
  // MAPEOS / COLUMNAS
  // ===========================

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

      __raw: r,
    };
  }

  private buildColumns(): void {
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

    // (si aún usas tabla por PDF)
    this.progresoColumns = [
      { name: 'prioridad', header: 'Prioridad', type: 'text', width: '160px' },
      { name: 'total', header: 'Total', type: 'number', width: '120px', filterable: false },
      { name: 'llevas', header: 'Llevas', type: 'number', width: '120px' },
      { name: 'faltan', header: 'Faltan', type: 'number', width: '120px' },
    ];

    // ✅ tabla que te importa: tipo, prioridad, llevas, cuantos
    this.progresoTipoPrioridadColumns = [
      { name: 'tipo', header: 'Tipo', type: 'text', width: '170px' },
      { name: 'prioridad', header: 'Prioridad', type: 'text', width: '160px' },
      { name: 'total', header: 'Cuántos', type: 'number', width: '120px' },
      { name: 'llevas', header: 'Llevas', type: 'number', width: '120px' },
      { name: 'faltan', header: 'Faltan', type: 'number', width: '120px' },
    ];

  }

  // ===========================
  // DATA LOADERS
  // ===========================

  async cargarRobotsFull(): Promise<void> {
    this.isLoadingFull = true;
    try {
      const resp: any = await firstValueFrom(this.homeService.getRobotsFull() as any);
      const arr = Array.isArray(resp) ? resp : Array.isArray(resp?.body) ? resp.body : [];
      this.robotsFull = arr.map((r: any) => this.mapFullRow(r));

      const set = new Set<string>();
      for (const r of this.robotsFull) {
        const p = (r?.oficina ?? '').toString().trim();
        if (p) set.add(p);
      }
      this.paquetes = Array.from(set).sort((a, b) => a.localeCompare(b));
      if (!this.paqueteCtrl.value && this.paquetes.length) this.paqueteCtrl.setValue(this.paquetes[0]);
    } catch (e) {
      console.error(e);
      this.robotsFull = [];
      await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar /Robots/full/' });
    } finally {
      this.isLoadingFull = false;
    }
  }

  // ===========================
  // ROLES / OTROS (IGUAL)
  // ===========================

  private initializeUserRoles(): void {
    this.user = this.utilityService.getUser();

    const rol = this.user?.rol?.nombre ?? 'SIN-ASIGNAR';
    const correo = (this.user?.correo_electronico ?? '').toString().toLowerCase();

    if (!this.user || rol === 'SIN-ASIGNAR') {
      this.general = false;
      this.comercializadora = false;
      this.traslado = false;
      this.admin = false;
      return;
    }

    const isAdmin = rol === 'ADMIN';
    const isGerencia = rol === 'GERENCIA';
    const isTraslados = rol === 'TRASLADOS';
    const isComercial = rol === 'COMERCIALIZADORA';
    const isAliasTuAfiliacion = correo === 'tuafiliacion@tsservicios.co';

    this.general = !(isGerencia || isTraslados);
    this.comercializadora = isComercial || isAdmin || isAliasTuAfiliacion;
    this.traslado = isTraslados || isAdmin || isAliasTuAfiliacion;
    this.admin = isGerencia || isAdmin;
  }

  extraerHistorialBeneficios(): void {
    const rol = this.user?.rol?.nombre ?? 'SIN-ASIGNAR';
    const correo = (this.user?.correo_electronico ?? '').toString().toLowerCase();

    const autorizadoGlobal = rol === 'ADMIN' || rol === 'GERENCIA' || correo === 'mercarflorats@gmail.com';

    this.dialog
      .open(DateRangeDialogComponent, {
        width: '400px',
        data: { title: 'Seleccionar rango de fechas' },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) return;

        const { start, end } = result;

        if (autorizadoGlobal) {
          this.homeService.traerHistorialInformeSoloFecha(start, end, true).subscribe({
            next: (blob) => this.downloadBlob(blob, `historial_beneficios_${start}_a_${end}.xlsx`),
          });
          return;
        }

        const nombrePersona = `${this.user?.datos_basicos?.nombres ?? ''} ${this.user?.datos_basicos?.apellidos ?? ''}`.trim();
        this.homeService.traerHistorialInformePersona(start, end, nombrePersona, true).subscribe({
          next: (blob) => this.downloadBlob(blob, `historial_beneficios_${nombrePersona}_${start}_a_${end}.xlsx`),
        });
      });
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  // ---------- INPUT FILE (EXCEL) ----------
  triggerFileInput(): void {
    (document.getElementById('fileInput') as HTMLInputElement).click();
  }

  private normalizeKey(s: string): string {
    return (s || '')
      .replace(/\u00a0|\u2007|\u202f/g, ' ')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase();
  }

  private toCanonical(h: string): string {
    const nk = this.normalizeKey(String(h || ''));
    for (const canonical of Object.keys(this.HEADER_ALIASES)) {
      const aliases = this.HEADER_ALIASES[canonical].map((a) => this.normalizeKey(a));
      if (aliases.includes(nk) || this.normalizeKey(canonical) === nk) return canonical;
    }
    return String(h || '').trim();
  }

  cargarExcel(evt: any): void {
    const file: File | undefined = evt?.target?.files?.[0];
    if (!file) {
      void Swal.fire({ icon: 'error', title: 'Selecciona un archivo' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

        if (!rows.length) {
          void Swal.fire({ icon: 'error', title: 'Archivo vacío' });
          return;
        }

        const headerRow = (rows[0] || []).map((h) => String(h || ''));
        const canonicalHeaders = headerRow.map((h) => this.toCanonical(h));

        if (!canonicalHeaders.some((h) => h === 'Identificación')) {
          void Swal.fire({ icon: 'error', title: 'Formato incorrecto', text: 'Falta la columna "Identificación".' });
          return;
        }

        const datos = rows
          .slice(1)
          .map((r) => {
            const o: any = {};
            canonicalHeaders.forEach((key, idx) => {
              if (!key) return;
              const val = r[idx];
              const sv = val === null || val === undefined ? '' : String(val).trim();
              if (sv !== '') o[key] = sv;
            });
            return o;
          })
          .filter((o) => !!o && typeof o === 'object' && String(o['Identificación'] || '').trim() !== '');

        if (!datos.length) {
          void Swal.fire({ icon: 'warning', title: 'No hay filas válidas', text: 'Todas las filas carecen de Identificación.' });
          return;
        }

        datos.forEach((o) => {
          if (!o['Tipo documento']) o['Tipo documento'] = 'CC';
        });

        const payload = {
          candidatos_scope: 'nuevos' as 'nuevos' | 'todos' | 'ninguno',
          datos,
        };

        this.homeService.enviarEstadosRobots(payload).subscribe({
          next: async (r: any) => {
            const ok = r?.message === 'success';
            const detalle = [
              r?.estado_robot_creados != null ? `Estados creados: ${r.estado_robot_creados}` : null,
              r?.candidatos_creados != null ? `Candidatos creados: ${r.candidatos_creados}` : null,
              r?.candidatos_actualizados != null ? `Candidatos actualizados: ${r.candidatos_actualizados}` : null,
              Array.isArray(r?.omitidos_por_15d) ? `Omitidos 15d: ${r.omitidos_por_15d.length}` : null,
            ]
              .filter(Boolean)
              .join('\n');

            await Swal.fire({
              icon: ok ? 'success' : 'error',
              title: ok ? 'Carga exitosa' : 'Carga con errores',
              text: detalle || (ok ? 'OK' : 'Revisa el servidor'),
            });

            void this.cargarRobotsFull();
            await this.loadProgresoAll();
            await this.loadProgresoSelected();
          },
          error: async (err) => {
            const msg = err?.error?.message || 'No se pudo cargar el Excel.';
            await Swal.fire({ icon: 'error', title: 'Error', text: msg });
          },
        });
      } catch {
        void Swal.fire({ icon: 'error', title: 'Error al procesar', text: 'Verifica el formato del archivo.' });
      } finally {
        try {
          (evt.target as HTMLInputElement).value = '';
        } catch { }
      }
    };

    reader.readAsArrayBuffer(file);
  }

  private async saveToDownloads(blob: Blob, filename: string): Promise<void> {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    const mime =
      ext === 'zip'
        ? 'application/zip'
        : ext === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/octet-stream';

    try {
      // @ts-ignore
      if (window.showSaveFilePicker) {
        // @ts-ignore
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          startIn: 'downloads',
          types: [{ description: ext.toUpperCase(), accept: { [mime]: ['.' + ext] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }
    } catch (_) { }

    this.downloadBlob(blob, filename);
  }

  async descargarLinksExcel(onlyDrive: 1 | 0 = 1, offset = 0, limit = 0): Promise<void> {
    Swal.fire({
      title: 'Generando Excel de links',
      html: `Solicitando al servidor...`,
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const res = await firstValueFrom(this.homeService.exportarLinksExcel(onlyDrive, offset, limit));
      if (!res.body) throw new Error('Respuesta vacía');

      const cd = res.headers.get('Content-Disposition') || '';
      let filename = 'cedulas_links.xlsx';
      const m = cd.match(/filename\*?=(?:UTF-8''|")?([^;"']+)/i);
      if (m) {
        try {
          filename = decodeURIComponent(m[1].replace(/"/g, ''));
        } catch {
          filename = m[1];
        }
      }

      await this.saveToDownloads(res.body, filename);

      const total = res.headers.get('X-Total') || '0';
      Swal.fire({ icon: 'success', title: 'Excel descargado', text: `Filas exportadas: ${total}` });
    } catch (err: any) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.status === 0 ? 'CORS o red: no se pudo contactar el servidor.' : 'Falló la descarga del Excel.',
      });
    }
  }
}
