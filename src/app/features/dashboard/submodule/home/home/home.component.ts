import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
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
import { UtilityServiceService } from '../../../../../shared/services/utilityService/utility-service.service';
import { MerchandisingMerchandiseComponent } from '../components/merchandising-merchandise/merchandising-merchandise.component';
import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import {
  HomeService,
  PdfKey,
  ProgresoRow,
  ProgresoPrioridadesAllResponse,
} from '../service/home.service';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { ColumnDefinition } from '../../../../../shared/models/advanced-table-interface';
import * as fontkit from 'fontkit';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFImage, PDFPage, PDFName } from 'pdf-lib';
import { firstValueFrom, from, of } from 'rxjs';
import { concatMap, reduce, catchError } from 'rxjs/operators';

type PdfOption = { key: PdfKey; label: string };
import JSZip from 'jszip';
import QRCode from 'qrcode';

type ProgresoTipoPrioridadRow = {
  pdf: PdfKey;
  tipo: string;
  prioridad: string;
  llevas: number;
  faltan: number;
  total: number;
};

@Component({
  selector: 'app-home',
  standalone: true,
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
    InfoCardComponent,
  ],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
})
export class HomeComponent implements OnInit {
  user: any;

  general = false;
  comercializadora = false;
  admin = false;
  traslado = false;

  isSidebarHidden = false;
  personaContratacion = '';

  // Header
  nombreUsuario = '';
  fechaHoy = '';

  // Slide panel
  activePanel: 'robots' | 'reportes' | 'contratacion' | null = null;
  private readonly panelTitles: Record<string, string> = {
    robots: 'Robots',
    reportes: 'Reportes',
    contratacion: 'Contratación',
  };
  get panelTitle(): string {
    return this.activePanel ? this.panelTitles[this.activePanel] ?? '' : '';
  }

  openPanel(panel: 'robots' | 'reportes' | 'contratacion'): void {
    this.activePanel = panel;
  }

  closePanel(): void {
    this.activePanel = null;
  }

  // ViewChild refs for file inputs
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputResetContratado') fileInputResetRef!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputExcelCandidatos') fileInputCandidatosRef!: ElementRef<HTMLInputElement>;
  @ViewChild('fileInputCarnets') fileInputCarnetsRef!: ElementRef<HTMLInputElement>;

  // Progreso
  isLoadingProgresoAll = false;
  totalRegistros = 0;
  progreso: ProgresoRow[] = [];
  progresoColumns: ColumnDefinition[] = [];
  currentPdfLabel = '—';

  paqueteCtrl = new FormControl<string>('', { nonNullable: true });
  paquetes: string[] = [];

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

    this.nombreUsuario = this.getNombreUsuario() || 'Usuario';
    this.fechaHoy = new Date().toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    // Capitalize first letter
    this.fechaHoy = this.fechaHoy.charAt(0).toUpperCase() + this.fechaHoy.slice(1);

    if (!this.personaContratacion.trim()) {
      this.personaContratacion = this.nombreUsuario;
    }
  }

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

  // =========================================================
  // HISTORIAL BENEFICIOS
  // =========================================================
  extraerHistorialBeneficios(): void {
    const rol = this.user?.rol?.nombre ?? 'SIN-ASIGNAR';
    const correo = (this.user?.correo_electronico ?? '').toString().toLowerCase();

    const autorizadoGlobal =
      rol === 'ADMIN' || rol === 'GERENCIA' || correo === 'mercarflorats@gmail.com';

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
            next: (blob) =>
              this.downloadBlob(blob, `historial_beneficios_${start}_a_${end}.xlsx`),
          });
          return;
        }

        const nombrePersona =
          `${this.user?.datos_basicos?.nombres ?? ''} ${this.user?.datos_basicos?.apellidos ?? ''}`.trim();

        this.homeService.traerHistorialInformePersona(start, end, nombrePersona, true).subscribe({
          next: (blob) =>
            this.downloadBlob(blob, `historial_beneficios_${nombrePersona}_${start}_a_${end}.xlsx`),
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

  // Cargar solicitudes robots (Excel)
  triggerFileInput(): void {
    const el = this.fileInputRef?.nativeElement;
    if (!el) return;
    el.value = '';
    el.click();
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
          void Swal.fire({
            icon: 'error',
            title: 'Formato incorrecto',
            text: 'Falta la columna "Identificación".',
          });
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
          void Swal.fire({
            icon: 'warning',
            title: 'No hay filas válidas',
            text: 'Todas las filas carecen de Identificación.',
          });
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
          },
          error: async (err) => {
            const msg = err?.error?.message || 'No se pudo cargar el Excel.';
            await Swal.fire({ icon: 'error', title: 'Error', text: msg });
          },
        });
      } catch {
        void Swal.fire({
          icon: 'error',
          title: 'Error al procesar',
          text: 'Verifica el formato del archivo.',
        });
      } finally {
        try {
          (evt.target as HTMLInputElement).value = '';
        } catch { }
      }
    };

    reader.readAsArrayBuffer(file);
  }

  // Reset contratado
  triggerFileInputResetContratado(): void {
    const el = this.fileInputResetRef?.nativeElement;
    if (!el) return;
    el.value = '';
    el.click();
  }

  async cargarExcelResetContratado(evt: any): Promise<void> {
    const input = evt?.target as HTMLInputElement;
    const file: File | undefined = input?.files?.[0];

    if (!file) {
      await Swal.fire({ icon: 'error', title: 'Selecciona un archivo' });
      return;
    }

    Swal.fire({
      title: 'Reseteando contratado...',
      text: 'Subiendo Excel y aplicando cambios.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const res = await firstValueFrom(
        this.homeService.bulkResetUltimoProcesoWithFields(file, ['contratado'])
      );

      const body = res?.body || {};
      const counts = body?.counts || {};

      const updated = Number(counts.updated || 0);
      const notFound = Number(counts.not_found || 0);
      const noInterview = Number(counts.no_interview || 0);
      const noProcess = Number(counts.no_process || 0);
      const badRows = Number(counts.bad_rows || 0);

      const detalle =
        `Actualizados: ${updated}\n` +
        `No encontrados: ${notFound}\n` +
        `Sin entrevista: ${noInterview}\n` +
        `Sin proceso: ${noProcess}\n` +
        `Filas inválidas: ${badRows}`;

      await Swal.fire({
        icon: updated > 0 ? 'success' : (notFound + noInterview + noProcess + badRows) > 0 ? 'warning' : 'info',
        title: updated > 0 ? 'Listo' : 'Sin cambios',
        text: detalle,
      });
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.error?.message ||
        err?.error?.detail ||
        'No se pudo procesar el Excel para resetear contratado.';
      await Swal.fire({ icon: 'error', title: 'Error', text: msg });
    } finally {
      try {
        input.value = '';
      } catch { }
    }
  }

  // Descargar Excel candidatos por cédulas
  triggerFileInputExcelCandidatos(): void {
    const el = this.fileInputCandidatosRef?.nativeElement;
    if (!el) return;
    el.value = '';
    el.click();
  }

  async cargarExcelParaExportarCandidatos(evt: any): Promise<void> {
    const input = evt?.target as HTMLInputElement;
    const file: File | undefined = input?.files?.[0];

    if (!file) {
      await Swal.fire({ icon: 'error', title: 'Selecciona un archivo' });
      return;
    }

    Swal.fire({
      title: 'Generando Excel de candidatos...',
      text: 'Leyendo cédulas y consultando al servidor.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const cedulas = await this.extraerCedulasDesdeExcel(file);
      if (!cedulas.length) {
        await Swal.fire({ icon: 'warning', title: 'Sin cédulas', text: 'No se encontraron cédulas válidas en el Excel.' });
        return;
      }

      const persona = this.personaContratacion.trim() || this.getNombreUsuario() || '';

      const res = await firstValueFrom(this.homeService.descargarCandidatosExcel(cedulas, persona));
      if (!res.body) throw new Error('Respuesta vacía');

      const filename = this.getFilenameFromResponse(res) || 'candidatos_export.xlsx';
      await this.saveToDownloads(res.body, filename);

      await Swal.fire({
        icon: 'success',
        title: 'Excel descargado',
        text: `Cédulas procesadas: ${cedulas.length}`,
      });
    } catch (err: any) {
      console.error(err);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.status === 0 ? 'CORS o red: no se pudo contactar el servidor.' : 'Falló la descarga del Excel de candidatos.',
      });
    } finally {
      try {
        input.value = '';
      } catch { }
    }
  }

  /**
   * ✅ Extrae cédulas desde el Excel:
   * - Busca columna por header ("CEDULA/CC/DOCUMENTO/IDENTIFICACION")
   * - si no encuentra header, usa la primera columna
   */
  private async extraerCedulasDesdeExcel(file: File): Promise<string[]> {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array', cellDates: true });

    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) return [];

    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });

    if (!rows.length) return [];

    const headerRow = (rows[0] || []).map(v => String(v ?? '').trim().toUpperCase());
    const targets = ['CEDULA', 'CÉDULA', 'CC', 'DOCUMENTO', 'IDENTIFICACION', 'IDENTIFICACIÓN', 'N° CC', 'NRO CC'];

    let colIdx = -1;
    for (let i = 0; i < headerRow.length; i++) {
      const h = headerRow[i];
      if (!h) continue;
      if (targets.some(t => h.includes(t))) {
        colIdx = i;
        break;
      }
    }
    if (colIdx === -1) colIdx = 0;

    const out: string[] = [];
    const seen = new Set<string>();

    for (let r = 1; r < rows.length; r++) {
      let v = String(rows[r]?.[colIdx] ?? '').trim();
      if (!v) continue;

      // limpia espacios/puntos/comas
      v = v.replace(/\s+/g, '').replace(/[.,]/g, '');

      // deja solo dígitos (tu backend normaliza X, pero aquí mejor enviar solo dígitos)
      v = v.replace(/\D+/g, '');

      if (!v || v.length < 6) continue;

      if (!seen.has(v)) {
        seen.add(v);
        out.push(v);
      }
    }

    return out;
  }

  private getFilenameFromResponse(res: any): string | null {
    const cd = res?.headers?.get?.('Content-Disposition') || res?.headers?.get?.('content-disposition') || '';
    if (!cd) return null;
    const m = cd.match(/filename\*?=(?:UTF-8''|")?([^;"']+)/i);
    if (!m) return null;
    try {
      return decodeURIComponent(String(m[1]).replace(/"/g, '')).trim();
    } catch {
      return String(m[1]).replace(/"/g, '').trim();
    }
  }

  private getNombreUsuario(): string {
    const nombres = (this.user?.datos_basicos?.nombres ?? '').toString().trim();
    const apellidos = (this.user?.datos_basicos?.apellidos ?? '').toString().trim();
    const full = `${nombres} ${apellidos}`.trim();
    return full || '';
  }


  private async fetchAsArrayBufferOrNull(url?: string): Promise<ArrayBuffer | null> {
    if (!url) return null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.arrayBuffer();
    } catch { return null; }
  }






  carnetContext: any = null;

  // Leer Excel para generar carnets
  triggerFileInputCarnets(): void {
    const el = this.fileInputCarnetsRef?.nativeElement;
    if (!el) return;
    el.value = '';
    el.click();
  }

  async cargarExcelCarnets(evt: any): Promise<void> {
    const input = evt?.target as HTMLInputElement;
    const file: File | undefined = input?.files?.[0];

    if (!file) {
      await Swal.fire({ icon: 'error', title: 'Selecciona un archivo' });
      return;
    }

    Swal.fire({
      title: 'Leyendo Excel para carnets...',
      text: 'Validando columnas CÉDULA, CÓDIGO y CENTRO COSTO.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      // 1) Excel -> [{cedula,codigo,centroCosto}]
      const registros = await this.extraerCedulaCodigoDesdeExcel(file);

      if (!registros.length) {
        Swal.close();
        await Swal.fire({
          icon: 'warning',
          title: 'Sin datos válidos',
          text: 'No se encontraron filas con CÉDULA, CÓDIGO y CENTRO COSTO válidos.',
        });
        return;
      }

      // 2) Cédulas únicas (solo para consultar backend 1 vez por cédula)
      const cedulas: string[] = [];
      const seenCed = new Set<string>();
      for (const r of registros) {
        const ced = String(r?.cedula ?? '').trim();
        if (!ced) continue;
        if (seenCed.has(ced)) continue;
        seenCed.add(ced);
        cedulas.push(ced);
      }

      // 3) Lotes para evitar URL muy largo
      const BATCH_SIZE = 250;
      const chunks: string[][] = [];
      for (let i = 0; i < cedulas.length; i += BATCH_SIZE) {
        chunks.push(cedulas.slice(i, i + BATCH_SIZE));
      }

      Swal.update({
        title: 'Consultando candidatos...',
        text: `Consultando ${cedulas.length} cédulas en ${chunks.length} lote(s)...`,
      });

      // 4) Consulta por lotes SECUENCIAL
      const backendItems: any[] = [];
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunk = chunks[idx];

        if (Swal.isVisible()) {
          Swal.update({
            title: 'Consultando candidatos...',
            text: `Lote ${idx + 1}/${chunks.length} (${chunk.length} cédulas)`,
          });
        }

        let resp: any = null;
        try {
          resp = await firstValueFrom(this.homeService.getCandidatosMini(chunk) as any);
        } catch (err) {
          console.error(`❌ Error en batch ${idx + 1}/${chunks.length}`, err);
          resp = null;
        }

        const items = Array.isArray(resp) ? resp : (resp?.ITEMS ?? resp?.items ?? []);
        if (Array.isArray(items) && items.length) backendItems.push(...items);
      }

      // 5) Map por cédula
      const byCedula = new Map<string, any>();
      for (const c of backendItems) {
        const key = String(
          c?.CEDULA ??
          c?.cedula ??
          c?.NUMERO_DOCUMENTO ??
          c?.numero_documento ??
          c?.documentNumber ??
          c?.document_number ??
          ''
        ).trim();

        if (key && !byCedula.has(key)) byCedula.set(key, c);
      }

      // 6) Helper para leer llaves MAYÚSCULAS/minúsculas
      const pickAny = (obj: any, keys: string[]) => {
        for (const k of keys) {
          const v = obj?.[k];
          if (v !== undefined && v !== null && String(v).trim() !== '') return v;
        }
        return '';
      };

      // 7) Une Excel + candidato (centroCosto viene del Excel)
      const registrosEnriquecidos = registros.map((r) => {
        const ced = String(r?.cedula ?? '').trim();
        const candidato = ced ? (byCedula.get(ced) ?? null) : null;
        return { ...r, candidato };
      });

      // 8) FINAL (lo que va directo al PDF)
      //    ✅ CENTRO_COSTO: SIEMPRE del Excel (ignora el del backend)
      const finalRows = registrosEnriquecidos.map((r) => {
        const c = r.candidato || {};
        return {
          CEDULA: String(r?.cedula ?? '').trim(),
          CODIGO: String(r?.codigo ?? '').trim(),

          APELLIDOS: String(pickAny(c, ['APELLIDOS', 'apellidos'])).trim(),
          NOMBRES: String(pickAny(c, ['NOMBRES', 'nombres'])).trim(),
          NOMBRE: String(pickAny(c, ['NOMBRE', 'nombre'])).trim(), // fallback

          FECHA_INGRESO: String(pickAny(c, ['FECHA_INGRESO', 'fecha_ingreso'])).trim(),

          // ✅ del Excel (autoridad)
          CENTRO_COSTO: String(r?.centroCosto ?? '').trim(),

          FAMILIAR_EMERGENCIA_NOMBRE: String(
            pickAny(c, ['FAMILIAR_EMERGENCIA_NOMBRE', 'familiar_emergencia_nombre'])
          ).trim(),
          FAMILIAR_EMERGENCIA_TELEFONO: String(
            pickAny(c, [
              'FAMILIAR_EMERGENCIA_TELEFONO',
              'familiar_emergencia_telefono',
              'TELEFONO_FAMILIAR_EMERGENCIA',
              'telefono_familiar_emergencia',
            ])
          ).trim(),

          DOCUMENTO_89_URL: String(pickAny(c, ['DOCUMENTO_89_URL', 'documento_89_url'])).trim(),
        };
      });

      const encontrados = finalRows.filter(
        (x) => !!x.APELLIDOS || !!x.NOMBRES || !!x.NOMBRE || !!x.FECHA_INGRESO || !!x.CENTRO_COSTO || !!x.DOCUMENTO_89_URL
      ).length;

      this.carnetContext = {
        ARCHIVO: { name: file.name, size: file.size, type: file.type },
        FINAL: {
          TOTAL: finalRows.length,
          ENCONTRADOS: encontrados,
          NO_ENCONTRADOS: finalRows.length - encontrados,
          FILAS: finalRows,
        },
      };

      console.log('🧾 CARNETS | CONTEXTO', {
        ARCHIVO: this.carnetContext.ARCHIVO,
        FINAL: {
          TOTAL: this.carnetContext.FINAL.TOTAL,
          ENCONTRADOS: this.carnetContext.FINAL.ENCONTRADOS,
          NO_ENCONTRADOS: this.carnetContext.FINAL.NO_ENCONTRADOS,
          SAMPLE: finalRows.slice(0, 10),
        },
      });

      await this.generarCarnets(finalRows);
    } catch (err: any) {
      console.error('❌ cargarExcelCarnets error:', err);
      Swal.close();
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.message || 'No se pudo leer el Excel / consultar candidatos-mini.',
      });
    } finally {
      try { input.value = ''; } catch { }
    }
  }

  private async extraerCedulaCodigoDesdeExcel(
    file: File
  ): Promise<Array<{ cedula: string; codigo: string; centroCosto: string }>> {
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array', cellDates: true });

    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) return [];

    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' });
    if (!rows.length) return [];

    const header = (rows[0] || []).map((v) => String(v ?? '').trim());

    const norm = (x: string) =>
      (x || '')
        .replace(/\u00a0|\u2007|\u202f/g, ' ')
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .trim()
        .replace(/\s+/g, ' ')
        .toLowerCase();

    const headerN = header.map((h) => norm(h));

    const idxCedula = headerN.findIndex((h) =>
      ['cedula', 'cédula', 'identificacion', 'identificación', 'documento', 'numero_documento', 'nro documento'].some(
        (k) => h === norm(k) || h.includes(norm(k))
      )
    );

    const idxCodigo = headerN.findIndex((h) =>
      ['codigo', 'código', 'code', 'cod'].some((k) => h === norm(k) || h.includes(norm(k)))
    );

    const idxCentroCosto = headerN.findIndex((h) =>
      ['centro costo', 'centro de costo', 'centro_costo', 'centrocosto', 'ccosto', 'centrocostos'].some(
        (k) => h === norm(k) || h.includes(norm(k))
      )
    );

    if (idxCedula === -1 || idxCodigo === -1 || idxCentroCosto === -1) {
      throw new Error('Faltan headers: el Excel debe tener columnas CÉDULA, CÓDIGO y CENTRO COSTO.');
    }

    const out: Array<{ cedula: string; codigo: string; centroCosto: string }> = [];
    const seen = new Set<string>();

    for (let r = 1; r < rows.length; r++) {
      let cedula = String(rows[r]?.[idxCedula] ?? '').trim();
      let codigo = String(rows[r]?.[idxCodigo] ?? '').trim();
      let centroCosto = String(rows[r]?.[idxCentroCosto] ?? '').trim();

      if (!cedula || !codigo || !centroCosto) continue;

      cedula = cedula.replace(/\s+/g, '').replace(/[.,]/g, '').replace(/\D+/g, '');
      if (!cedula || cedula.length < 6) continue;

      codigo = codigo
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

      centroCosto = centroCosto.replace(/\s+/g, ' ').trim(); // respeta texto, solo normaliza espacios

      const key = `${cedula}||${codigo}||${centroCosto}`;
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({ cedula, codigo, centroCosto });
    }

    return out;
  }


  // =========================================================
  // ✅ GENERAR CARNETS — Refactorizado para máxima compatibilidad (jsPDF)
  // =========================================================
  async generarCarnets(rowsParam?: any[]): Promise<void> {
    try {
      const rows: any[] = Array.isArray(rowsParam) && rowsParam.length ? rowsParam : this.carnetContext?.FINAL?.FILAS ?? [];

      if (!Array.isArray(rows) || rows.length === 0) {
        Swal.close();
        await Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'Primero carga el Excel (cédula + código + centro costo).' });
        return;
      }

      if (!Swal.isVisible()) {
        Swal.fire({
          title: 'Generando carnets...',
          text: `Procesando ${rows.length} registros (9 por PDF)`,
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => Swal.showLoading(),
        });
      } else {
        Swal.update({ title: 'Generando carnets...', text: `Procesando ${rows.length} registros (9 por PDF)` });
        Swal.showLoading();
      }

      const PAGE_W = 612; // pt (8.5 inch)
      const PAGE_H = 792; // pt (11.0 inch)
      const MARGIN = 18;
      const GAP = 12;

      const CARD_W = Math.floor((PAGE_W - 2 * MARGIN - 2 * GAP) / 3);
      const CARD_H = Math.floor((PAGE_H - 2 * MARGIN - 2 * GAP) / 3);

      const BLUE_CORP = '#1E54C7';
      const BLUE_SUBTLE = '#EBFOFA';
      const TEXT_MAIN = '#1A1A1A';
      const TEXT_MUTED = '#737373';
      const WHITE = '#FFFFFF';
      const BLACK = '#000000';

      const bytesCache = new Map<string, Promise<string | null>>(); // Para jsPDF usamos Base64 directamente

      const isHttp = (u: string) => /^https?:\/\//i.test(u);
      const isDataUrl = (u: string) => /^data:image\//i.test(u);
      const normalizeAssetUrl = (u: string) => {
        const sv = String(u ?? '').trim();
        if (!sv) return '';
        if (isHttp(sv) || isDataUrl(sv)) return sv;
        return sv.replace(/^\/+/, '').replace(/^assets\//, '');
      };

      const fetchBase64WithFallback = async (mainUrl: string, alts: string[] = []): Promise<string | null> => {
        const tryFetch = async (u: string) => {
          try {
            const res = await fetch(u);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
              let mime = 'image/jpeg';
              if (u.toLowerCase().endsWith('.png')) mime = 'image/png';
              // Deteccion basica
              const bv = new Uint8Array(arrayBuffer);
              if (bv.length >= 8 && bv[0] === 0x89 && bv[1] === 0x50 && bv[2] === 0x4e && bv[3] === 0x47) mime = 'image/png';
              return `data:${mime};base64,${base64}`;
            }
          } catch { }
          return null;
        };
        let b64 = await tryFetch(mainUrl);
        if (b64) return b64;
        for (const alt of alts) {
          b64 = await tryFetch(alt);
          if (b64) return b64;
        }
        return null;
      };

      const fetchImageBase64 = async (urlOrData?: string): Promise<string | null> => {
        const raw = String(urlOrData ?? '').trim();
        if (!raw) return null;
        if (isDataUrl(raw)) return raw;
        const clean = normalizeAssetUrl(raw);
        if (bytesCache.has(clean)) return await bytesCache.get(clean)!;
        const p = (async () => {
          if (isHttp(raw)) return await fetchBase64WithFallback(raw);
          return await fetchBase64WithFallback(clean, [`assets/${clean}`, `/${clean}`, `./${clean}`]);
        })();
        bytesCache.set(clean, p);
        return await p;
      };

      const buildQrDataUrl = async (payload: string): Promise<string> => {
        const key = String(payload ?? '').trim();
        if (!key) return '';
        try {
          return await (QRCode as any).toDataURL(key, { type: 'image/jpeg', errorCorrectionLevel: 'M', margin: 1, width: 300, color: { light: '#ffffffff' } });
        } catch { return ''; }
      };

      const safeTxt = (txt: any) => {
        let s = String(txt ?? '').trim().toUpperCase();
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // Sin tildes para evitar problemas de fuente
        return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
      };
      const safeTxtMixed = (txt: any) => {
        let s = String(txt ?? '').trim();
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
      }

      // Pre-cargar logo
      const logoB64 = await fetchImageBase64('logos/Logo_TA.png');

      const zip = new JSZip();
      const CHUNK_SIZE = 9;
      const totalPdfs = Math.ceil(rows.length / CHUNK_SIZE);

      for (let fileIdx = 0; fileIdx < totalPdfs; fileIdx++) {
        const chStart = fileIdx * CHUNK_SIZE;
        const chEnd = Math.min(chStart + CHUNK_SIZE, rows.length);
        const chunk = rows.slice(chStart, chEnd);

        Swal.update({
          title: 'Generando carnets...',
          text: `PDF ${fileIdx + 1}/${totalPdfs} (registros ${chStart + 1}-${chEnd})`,
        });

        const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter', compress: true });

        // Cargar todas las imágenes de este chunk en paralelo
        const slotData = [];
        for (let si = 0; si < 9; si++) {
          const rv = chunk[si];
          if (!rv) { slotData.push(null); continue; }
          const fotoUrl = String(rv?.DOCUMENTO_89_URL ?? '').trim();
          const qrKey = `${String(rv?.CEDULA ?? '').trim()}|${String(rv?.CODIGO ?? '').trim()}`;
          const [fotoB64, qrB64] = await Promise.all([
            fetchImageBase64(fotoUrl),
            buildQrDataUrl(qrKey)
          ]);
          slotData.push({ rv, foto: fotoB64, qr: qrB64 });
        }

        // --- PÁGINA 1 (FRONTAL) ---
        for (let si = 0; si < 9; si++) {
          const d = slotData[si];
          if (!d) continue;

          const col = si % 3;
          const row = Math.floor(si / 3);
          const cx = MARGIN + col * (CARD_W + GAP);
          const cy = MARGIN + row * (CARD_H + GAP); // jsPDF usa Y desde arriba (o=top)

          // Bordes
          doc.setDrawColor(BLACK);
          doc.setLineWidth(1.4);
          doc.rect(cx, cy, CARD_W, CARD_H);
          doc.setLineWidth(0.8);
          doc.rect(cx + 3, cy + 3, CARD_W - 6, CARD_H - 6);

          const innerPad = 10;
          const contentX = cx + innerPad;
          const contentW = CARD_W - 2 * innerPad;
          let cursorY = cy + innerPad;

          // Logo
          const HEADER_H = 30;
          if (logoB64) {
            const format = logoB64.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(logoB64, format, contentX + (contentW - 80) / 2, cursorY, 80, HEADER_H); // Logo centrado, max 80x30
          }
          cursorY += HEADER_H + 4;

          // Foto
          const PHOTO_H = CARD_H * 0.36;
          if (d.foto) {
            const format = d.foto.includes('image/png') ? 'PNG' : 'JPEG';
            // Simular contain logic (centrado, aspect ratio)
            // Nota: addImage de jsPDF escala as-is, lo encuadramos fijo sin overstretch.
            try {
              // jsPDF acepta formato base64 nativo
              doc.addImage(d.foto, format, contentX + (contentW - 60) / 2, cursorY, 60, PHOTO_H);
            } catch (e) {
              console.warn('No se pudo incrustar foto en jsPDF');
            }
          } else {
            doc.setFillColor(BLUE_SUBTLE);
            doc.rect(contentX, cursorY, contentW, PHOTO_H, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(TEXT_MUTED);
            doc.text('SIN FOTO', contentX + contentW / 2, cursorY + PHOTO_H / 2, { align: 'center', baseline: 'middle' });
          }
          cursorY += PHOTO_H + 8;

          // Nombres
          const apellidos = safeTxt(d.rv?.APELLIDOS);
          const nombres = safeTxt(d.rv?.NOMBRES || d.rv?.NOMBRE);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9.5);
          doc.setTextColor(TEXT_MAIN);
          doc.text(apellidos, contentX + contentW / 2, cursorY, { align: 'center', maxWidth: contentW });
          cursorY += 10;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.text(nombres, contentX + contentW / 2, cursorY, { align: 'center', maxWidth: contentW });
          cursorY += 8;

          // Dos columnas (QR izquierda, Info Derecha)
          const colQrW = contentW * 0.38;
          const colGap = 5;
          const colDataW = contentW - colQrW - colGap;

          const hAvail = (cy + CARD_H - innerPad) - cursorY;
          const qrSize = Math.min(colQrW, hAvail - 10, 60);
          const qrX = contentX + (colQrW - qrSize) / 2;
          const qrY = cursorY;

          if (d.qr) {
            doc.addImage(d.qr, 'JPEG', qrX, qrY, qrSize, qrSize);
          }

          const cedula = safeTxt(d.rv?.CEDULA);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.text(cedula, contentX + colQrW / 2, qrY + qrSize + 8, { align: 'center', maxWidth: colQrW });

          const dataX = contentX + colQrW + colGap;
          let rowY = cursorY + 6;

          const fields = [
            { l: 'Fecha de Ingreso', v: safeTxtMixed(d.rv?.FECHA_INGRESO) },
            { l: 'Código', v: safeTxtMixed(d.rv?.CODIGO) },
            { l: 'Centro de Costos', v: safeTxtMixed(d.rv?.CENTRO_COSTO) },
          ];

          for (const f of fields) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6);
            doc.setTextColor(TEXT_MUTED);
            doc.text(safeTxt(f.l), dataX, rowY);
            rowY += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(TEXT_MAIN);
            doc.text(f.v, dataX, rowY, { maxWidth: colDataW });
            rowY += 12;
          }
        }

        // --- PÁGINA 2 (REVERSO) ---
        doc.addPage();
        for (let si = 0; si < 9; si++) {
          const d = slotData[si];
          if (!d) continue;

          // Espejo de columna
          const row = Math.floor(si / 3);
          const col = si % 3;
          const backCol = 2 - col;

          const cx = MARGIN + backCol * (CARD_W + GAP);
          const cy = MARGIN + row * (CARD_H + GAP);

          // Bordes
          doc.setDrawColor(BLACK);
          doc.setLineWidth(1.4);
          doc.rect(cx, cy, CARD_W, CARD_H);
          doc.setLineWidth(0.8);
          doc.rect(cx + 3, cy + 3, CARD_W - 6, CARD_H - 6);

          const innerPad = 10;
          const contentX = cx + innerPad;
          const contentW = CARD_W - 2 * innerPad;
          let cursorY = cy + innerPad;

          // Top Info
          if (logoB64) {
            const format = logoB64.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(logoB64, format, contentX + (contentW - 60) / 2, cursorY, 60, 20);
          }
          cursorY += 28;

          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(TEXT_MUTED);
          doc.text('Contacto Coordinador de la', cx + CARD_W / 2, cursorY, { align: 'center' });
          cursorY += 8;
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(BLUE_CORP);
          doc.text('Temporal 3152306148', cx + CARD_W / 2, cursorY, { align: 'center' });
          cursorY += 14;

          doc.setFontSize(9);
          doc.setTextColor(TEXT_MAIN);
          doc.text('ARL', contentX, cursorY);
          doc.setTextColor(BLUE_CORP);
          doc.text('SURA', contentX + contentW, cursorY, { align: 'right' });
          cursorY += 16;

          doc.setFontSize(6);
          doc.setTextColor(BLUE_CORP);
          doc.text('FAMILIAR EN CASO DE EMERGENCIA', cx + CARD_W / 2, cursorY, { align: 'center' });
          cursorY += 6;

          const nm = safeTxt(d.rv?.FAMILIAR_EMERGENCIA_NOMBRE);
          const tl = safeTxt(d.rv?.FAMILIAR_EMERGENCIA_TELEFONO);
          const emStr = [nm, tl].filter(Boolean).join(' - ') || '—';

          doc.setFillColor(BLUE_SUBTLE);
          doc.rect(contentX, cursorY, contentW, 20, 'F');
          doc.setFontSize(7.5);
          doc.setTextColor(TEXT_MAIN);
          doc.text(emStr, cx + CARD_W / 2, cursorY + 12, { align: 'center', maxWidth: contentW - 4 });
          cursorY += 28;

          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.5);
          doc.line(contentX, cursorY, contentX + contentW, cursorY);
          cursorY += 8;

          const legal = 'Este carnet es de uso exclusivo del trabajador. En caso de pérdida, reportar inmediatamente al coordinador de la temporal. El uso indebido de este documento acarreará sanciones disciplinarias.';
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(TEXT_MUTED);
          doc.text(safeTxtMixed(legal), contentX, cursorY, { maxWidth: contentW, align: 'justify' });
        }

        const pdfBlob = doc.output('blob');
        const pdfBytes = await pdfBlob.arrayBuffer();
        zip.file(`carnets_${String(fileIdx + 1).padStart(3, '0')}.pdf`, pdfBytes);
      }

      Swal.update({ title: 'Empaquetando ZIP...', text: `Creando ZIP con ${totalPdfs} PDF(s)` });
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const today = new Date();
      const yy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      await (this as any).saveToDownloads(zipBlob, `carnets_${yy}${mm}${dd}.zip`);

      Swal.close();
      await Swal.fire({ icon: 'success', title: 'Listo', text: `Se generaron ${totalPdfs} PDF(s) y se descargó el ZIP.` });

    } catch (error: any) {
      console.error('❌ Error generando carnets:', error);
      Swal.close();
      await Swal.fire({ icon: 'error', title: 'Error', text: error?.message || 'Ocurrió un error al generar carnets.' });
    }
  }

}

