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
import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
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

  // ✅ si quieres pasar "persona" al reporte candidatos:
  // (puedes setearlo desde UI si luego lo agregas)
  personaContratacion = '';

  // ===== PROGRESO (ALL JSON CACHE) =====
  isLoadingProgresoAll = false;
  totalRegistros = 0;

  progreso: ProgresoRow[] = [];
  progresoColumns: ColumnDefinition[] = [];
  currentPdfLabel = '—';

  // ====== (esto ya no se usa en el HTML nuevo, pero lo dejo por si lo usas en otros lados) ======
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

    // default persona contratación (si no la defines desde UI)
    if (!this.personaContratacion.trim()) {
      this.personaContratacion = this.getNombreUsuario() || '';
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

  // =========================================================
  // 1) CARGAR SOLICITUDES ROBOTS (EXCEL) - EXISTENTE
  // =========================================================
  triggerFileInput(): void {
    const input = document.getElementById('fileInput') as HTMLInputElement | null;
    if (!input) return;
    input.value = '';
    input.click();
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

  // =========================================================
  // 2) DESCARGAR EXCEL (CÉDULA + LINK) - EXISTENTE
  // =========================================================
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





  // =========================================================
  // 3) RESET CONTRATADO - EXISTENTE
  // =========================================================
  triggerFileInputResetContratado(): void {
    const input = document.getElementById('fileInputResetContratado') as HTMLInputElement | null;
    if (!input) return;
    input.value = '';
    input.click();
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

  // =========================================================
  // ✅ 4) NUEVO: DESCARGAR EXCEL CANDIDATOS (POR CÉDULAS)
  //  - Card: triggerFileInputExcelCandidatos()
  //  - Input: fileInputExcelCandidatos
  // =========================================================
  triggerFileInputExcelCandidatos(): void {
    const input = document.getElementById('fileInputExcelCandidatos') as HTMLInputElement | null;
    if (!input) return;
    input.value = '';
    input.click();
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






// ✅ Déjalo como propiedad del componente (arriba, junto a tus flags)
carnetContext: any = null;

// =========================================================
// ✅ 5) LEER EXCEL (CEDULA + CODIGO + CENTRO COSTO) PARA GENERAR CARNETS
// =========================================================
triggerFileInputCarnets(): void {
  const input = document.getElementById('fileInputCarnets') as HTMLInputElement | null;
  if (!input) return;
  input.value = '';
  input.click();
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
    try { input.value = ''; } catch {}
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
// ✅ GENERAR CARNETS (IMAGEN/QR OK) + FONT SIZE 6 + APELLIDOS/NOMBRES
// =========================================================
async generarCarnets(rowsParam?: any[]): Promise<void> {
  try {
    const rows: any[] =
      Array.isArray(rowsParam) && rowsParam.length ? rowsParam : this.carnetContext?.FINAL?.FILAS ?? [];

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

    const bytesCache = new Map<string, Promise<ArrayBuffer | null>>();
    const qrCache = new Map<string, Promise<string>>();

    const isHttp = (u: string) => /^https?:\/\//i.test(u);
    const isDataUrl = (u: string) => /^data:image\//i.test(u);

    const normalizeUrl = (u: string) => {
      const s = String(u ?? '').trim();
      if (!s) return '';
      if (isHttp(s) || isDataUrl(s)) return s;

      const clean = s.replace(/^\/+/, '');
      if (clean.startsWith('assets/')) return clean;
      return `assets/${clean}`;
    };

    const dataUrlToBytes = (dataUrl: string): ArrayBuffer | null => {
      try {
        const [meta, b64] = dataUrl.split(',');
        if (!meta || !b64) return null;
        const bin = atob(b64);
        const len = bin.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
        return bytes.buffer;
      } catch {
        return null;
      }
    };

    const detectImageType = (ab: ArrayBuffer): 'png' | 'jpg' | null => {
      const b = new Uint8Array(ab);
      if (
        b.length >= 8 &&
        b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
        b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
      ) return 'png';
      if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
      return null;
    };

    const fetchBytesOrNull = async (urlOrData?: string): Promise<ArrayBuffer | null> => {
      const raw = String(urlOrData ?? '').trim();
      if (!raw) return null;

      if (isDataUrl(raw)) return dataUrlToBytes(raw);

      const url = normalizeUrl(raw);
      if (!url) return null;

      if (bytesCache.has(url)) return await bytesCache.get(url)!;

      const p = (async () => {
        try {
          const ab = await this.fetchAsArrayBufferOrNull(url);
          if (ab) return ab;
        } catch {}

        if (!isHttp(raw) && !raw.startsWith('assets/') && !isDataUrl(raw)) {
          try {
            const ab2 = await this.fetchAsArrayBufferOrNull(raw);
            if (ab2) return ab2;
          } catch {}
        }
        return null;
      })();

      bytesCache.set(url, p);
      return await p;
    };

    const embedImageOrNull = async (pdfDoc: PDFDocument, urlOrData?: string) => {
      const ab = await fetchBytesOrNull(urlOrData);
      if (!ab) return null;

      const kind = detectImageType(ab);
      if (!kind) return null;

      try {
        const u8 = new Uint8Array(ab);
        return kind === 'png' ? await pdfDoc.embedPng(u8) : await pdfDoc.embedJpg(u8);
      } catch {
        return null;
      }
    };

    const setButtonImageSafe = async (pdfDoc: PDFDocument, form: any, buttonName: string, urlOrData?: string) => {
      const img = await embedImageOrNull(pdfDoc, urlOrData);
      if (!img) return false;
      try {
        form.getButton(buttonName).setImage(img);
        return true;
      } catch {
        return false;
      }
    };

    const FONT_SIZE = 6;

    const setTextSafe = (form: any, fieldName: string, value: any, font?: any) => {
      try {
        const tf = form.getTextField(fieldName);
        tf.setText(String(value ?? '').trim());
        try { tf.setFontSize(FONT_SIZE); } catch {}
        try { if (font) tf.updateAppearances(font); } catch {}
      } catch {}
    };

    const buildQrDataUrl = async (payload: string): Promise<string> => {
      const key = String(payload ?? '').trim();
      if (!key) return '';

      if (qrCache.has(key)) return await qrCache.get(key)!;

      const p = (async () => {
        try {
          return await QRCode.toDataURL(key, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
        } catch {
          return '';
        }
      })();

      qrCache.set(key, p);
      return await p;
    };

    // PDF base + fuente
    const pdfUrl = 'Docs/formulario_carnets.pdf';
    const basePdf = await this.fetchAsArrayBufferOrNull(pdfUrl);
    if (!basePdf) throw new Error('No se pudo cargar el PDF base (Docs/formulario_carnets.pdf).');

    const fontBytes = await this.fetchAsArrayBufferOrNull('fonts/Roboto-Regular.ttf');

    const zip = new JSZip();
    const CHUNK_SIZE = 9;
    const totalPdfs = Math.ceil(rows.length / CHUNK_SIZE);

    for (let fileIdx = 0; fileIdx < totalPdfs; fileIdx++) {
      const start = fileIdx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, rows.length);
      const chunk = rows.slice(start, end);

      Swal.update({
        title: 'Generando carnets...',
        text: `PDF ${fileIdx + 1}/${totalPdfs} (registros ${start + 1}-${end})`,
      });

      const pdfDoc = await PDFDocument.load(basePdf);
      pdfDoc.registerFontkit(fontkit as any);

      const customFont = fontBytes ? await pdfDoc.embedFont(fontBytes) : undefined;
      const form = pdfDoc.getForm();

      // Fijos (size 6)
      setTextSafe(form, 'coordinador1', 'Contacto Coordinador de la', customFont);
      setTextSafe(form, 'coordinador2', 'Temporal 3152306148', customFont);

      for (let slot = 1; slot <= 9; slot++) {
        const r = chunk[slot - 1];

        if (!r) {
          setTextSafe(form, `fecha_ingreso${slot}`, '', customFont);
          setTextSafe(form, slot === 3 ? 'codigo_contrat3' : `codigo_contrato${slot}`, '', customFont);
          setTextSafe(form, `centro_costo${slot}`, '', customFont);
          setTextSafe(form, `cedula${slot}`, '', customFont);
          setTextSafe(form, `emer1_${slot}`, '', customFont);
          setTextSafe(form, `emer2_${slot}`, '', customFont);

          // ✅ nuevos
          setTextSafe(form, `apellidos1_${slot}`, '', customFont);
          setTextSafe(form, `nombres2_${slot}`, '', customFont);
          continue;
        }

        const cedula = String(r?.CEDULA ?? '').trim();
        const codigo = String(r?.CODIGO ?? '').trim();

        const apellidos = String(r?.APELLIDOS ?? '').trim();
        const nombres = String(r?.NOMBRES ?? '').trim();
        const nombreFull = String(r?.NOMBRE ?? '').trim();

        const fechaIngreso = String(r?.FECHA_INGRESO ?? '').trim();

        // ✅ viene del Excel (ya fue armado así en finalRows)
        const centroCosto = String(r?.CENTRO_COSTO ?? '').trim();

        const emerNombre = String(r?.FAMILIAR_EMERGENCIA_NOMBRE ?? '').trim();
        const emerTel = String(r?.FAMILIAR_EMERGENCIA_TELEFONO ?? '').trim();

        const fotoUrl = String(r?.DOCUMENTO_89_URL ?? '').trim();
        const qrPayload = `${cedula}|${codigo}`;
        const qrDataUrl = await buildQrDataUrl(qrPayload);

        // ✅ IMÁGENES (como tu versión que sí funciona)
        await setButtonImageSafe(pdfDoc, form, `foto${slot}_af_image`, fotoUrl);
        await setButtonImageSafe(pdfDoc, form, `qr${slot}_af_image`, qrDataUrl);

        // Textos (size 6)
        setTextSafe(form, `fecha_ingreso${slot}`, fechaIngreso, customFont);

        const contratoField = slot === 3 ? 'codigo_contrat3' : `codigo_contrato${slot}`;
        setTextSafe(form, contratoField, codigo, customFont);

        setTextSafe(form, `centro_costo${slot}`, centroCosto, customFont);
        setTextSafe(form, `cedula${slot}`, cedula, customFont);
        setTextSafe(form, `emer1_${slot}`, emerNombre, customFont);
        setTextSafe(form, `emer2_${slot}`, emerTel, customFont);

        // ✅ campos separados
        setTextSafe(form, `apellidos1_${slot}`, apellidos, customFont);
        setTextSafe(form, `nombres2_${slot}`, (nombres || nombreFull), customFont);
      }

      // ✅ deja esto (igual que tu versión que sí funciona)
      try { if (customFont) form.updateFieldAppearances(customFont); } catch {}
      try { form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch {} }); } catch {}
      try { form.flatten(); } catch {}

      const pdfBytes = await pdfDoc.save();
      zip.file(`carnets_${String(fileIdx + 1).padStart(3, '0')}.pdf`, pdfBytes);
    }

    Swal.update({ title: 'Empaquetando ZIP...', text: `Creando ZIP con ${totalPdfs} PDF(s)` });

    const zipBlob = await zip.generateAsync({ type: 'blob' });

    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');

    await this.saveToDownloads(zipBlob, `carnets_${y}${m}${d}.zip`);

    Swal.close();
    await Swal.fire({ icon: 'success', title: 'Listo', text: `Se generaron ${totalPdfs} PDF(s) y se descargó el ZIP.` });
  } catch (error: any) {
    console.error('❌ Error generando carnets:', error);
    Swal.close();
    await Swal.fire({ icon: 'error', title: 'Error', text: error?.message || 'Ocurrió un error al generar carnets.' });
  }
}



}
