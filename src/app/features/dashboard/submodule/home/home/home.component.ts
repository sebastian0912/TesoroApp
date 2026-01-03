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
import { REFERENCIAS_A, REFERENCIAS_F } from '@/app/shared/model/const';

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

type PdfOption = { key: PdfKey; label: string };

// ✅ Tabla que realmente te importa (tipo, prioridad, llevas, cuantos)
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
  ) {}

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
    } catch (_) {}

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
        } catch {}
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
      } catch {}
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
      } catch {}
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
}
