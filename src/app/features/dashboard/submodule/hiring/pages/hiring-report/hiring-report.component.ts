import { CruceValidationHelper, CruceRow } from './cruce-validation.helper';
import {
  PreviewDialogData,
  PreviewDialogResult,
  PreviewIssue,
  PreviewSchema
} from 'src/app/shared/model/validation-preview';

type UploadControl = 'cedulasEscaneadas' | 'cruceDiario' | 'arl' | 'induccionSSO' | 'traslados';
type ErrorRow = { registro: string; errores: any[]; tipo: string };

// ==========================
// Preview Dialog (tipos mínimos - estructurales)
// ==========================
import { Component, OnInit } from '@angular/core';
import { Title, Meta } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { MatTableDataSource } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { SharedModule } from '@/app/shared/shared.module';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { HiringService } from '../../service/hiring.service';
import { ReportesService } from '../../service/reportes/reportes.service';

import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as FileSaver from 'file-saver';
import { firstValueFrom } from 'rxjs';
import { ValidationPreviewDialogComponent } from '@/app/shared/components/validation-preview-dialog/validation-preview-dialog.component';
import { CedulaPreviewItem } from '../../components/cedulas-preview/cedulas-preview.component';
import { TrasladoPreviewItem } from '../../components/traslados-preview/traslados-preview.component';

import { FilePreviewDialogComponent } from '../../components/file-preview-dialog/file-preview-dialog.component';

@Component({
  selector: 'app-hiring-report',
  imports: [
    SharedModule,
    MatDatepickerModule,
    MatCheckboxModule,
    MatNativeDateModule,
    MatDialogModule,
  ],
  templateUrl: './hiring-report.component.html',
  styleUrl: './hiring-report.component.css',
})
export class HiringReportComponent implements OnInit {
  reporteForm!: FormGroup;
  sedes: any[] = [];

  // Nombres visibles en los inputs
  cedulasEscaneadasFileName = '';
  cruceDiarioFileName = '';
  induccionSSOFileName = '';
  trasladosFileName = '';
  arlFileName = '';

  // Archivos seleccionados por tipo
  filesToUpload: Partial<Record<UploadControl, File[]>> = {};

  // Tabla de errores para mostrar en frontend
  erroresValidacion = new MatTableDataSource<any>([]);

  // Flags de validación
  isCruceValidado = false;
  isArlValidado = false;

  // Datos del cruce procesado (filas normalizadas)
  datoscruced: any[] = [];

  // Datos de Previsualización (NUEVO)
  cedulasPreview: CedulaPreviewItem[] = [];
  trasladosPreview: TrasladoPreviewItem[] = [];

  // Contadores de contratos
  numeroContratosAlianza = 0;
  numeroContratosApoyoLaboral = 0;

  nombre = '';

  // UI State for previews (collapsible blocks)
  previewOpenState: Record<string, boolean> = {
    cedulas: false,
    traslados: false
  };

  private readonly BLOCKED_FILES = new Set(['thumbs.db', 'desktop.ini', '.ds_store']);

  // EPS permitidas (canonical sin espacios)
  private readonly EPS_ALLOWED = new Map<string, string>([
    ['saludtotal', 'SALUDTOTAL'],
    ['nuevaeps', 'NUEVAEPS'],
  ]);

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly utilityService: UtilityServiceService,
    private readonly hiringService: HiringService,
    private readonly reportesService: ReportesService,
    private readonly dialog: MatDialog, // ✅ Preview dialog
  ) {
    // Inicial mínimo para evitar undefined antes de ngOnInit
    this.reporteForm = this.fb.group({
      cantidadContratosTuAlianza: [0],
      cantidadContratosApoyoLaboral: [0],
    });
  }

  async ngOnInit(): Promise<void> {
    this.reporteForm = this.fb.group({
      sede: [null, Validators.required],
      esDeHoy: ['false'],
      fecha: [null],
      contratosHoy: ['', Validators.required],

      cedulasEscaneadas: [false],
      cruceDiario: [false],
      arl: [false],
      induccionSSO: [false],
      traslados: [false],

      cantidadContratosTuAlianza: [null],
      cantidadContratosApoyoLaboral: [null],
      notas: [''],
    });

    const user = this.utilityService.getUser();
    if (user?.datos_basicos) {
      this.nombre = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;
    }

    this.manageFechaValidation();

    this.reporteForm.get('esDeHoy')?.valueChanges.subscribe(() => {
      this.manageFechaValidation();
    });

    this.reporteForm.get('contratosHoy')?.valueChanges.subscribe((value) => {
      if (value === 'si') {
        this.reporteForm.get('cedulasEscaneadas')?.setValidators(Validators.requiredTrue);
        this.reporteForm.get('arl')?.setValidators(Validators.requiredTrue);
        this.reporteForm.get('cruceDiario')?.setValidators(Validators.requiredTrue);
      } else {
        this.reporteForm.get('cedulasEscaneadas')?.clearValidators();
        this.reporteForm.get('arl')?.clearValidators();
        this.reporteForm.get('cruceDiario')?.clearValidators();
      }
      this.reporteForm.get('cedulasEscaneadas')?.updateValueAndValidity();
      this.reporteForm.get('arl')?.updateValueAndValidity();
      this.reporteForm.get('cruceDiario')?.updateValueAndValidity();

      if (value !== 'si') {
        this.isCruceValidado = false;
        this.isArlValidado = false;
      }
    });

    // Carga de sedes activas
    try {
      const data: any = await firstValueFrom(this.utilityService.traerSucursales());
      if (!Array.isArray(data)) throw new Error('Respuesta inválida');

      const soloActivas = data.filter((s: any) => s.activa === true);
      const unicas = Array.from(new Map(soloActivas.map((s: any) => [s.nombre, s])).values());

      this.sedes = unicas.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
    } catch {
      Swal.fire('Error', 'No se pudieron cargar las sedes', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers Swal (loading + progress)
  // ---------------------------------------------------------------------------

  private showLoading(title: string, text: string): void {
    Swal.fire({
      icon: 'info',
      title,
      text,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
      heightAuto: false,
    });
  }

  private openProgress(title: string, subtitle: string, current: number, total: number): void {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;

    Swal.fire({
      icon: 'info',
      title,
      html: `
        <div style="text-align:left; margin-top:6px;">
          <div id="swalProgressSubtitle" style="font-size:13px; opacity:.85; margin-bottom:10px;">
            ${subtitle}
          </div>

          <div style="width:100%; height:12px; background:rgba(0,0,0,.08); border-radius:999px; overflow:hidden;">
            <div id="swalProgressBar" style="height:12px; width:${pct}%; background:#3085d6;"></div>
          </div>

          <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:12px; opacity:.9;">
            <span id="swalProgressDetail">${current} / ${total}</span>
            <b id="swalProgressPct">${pct}%</b>
          </div>
        </div>
      `,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      heightAuto: false,
    });
  }

  private updateProgress(subtitle: string, current: number, total: number): void {
    const pct = total > 0 ? Math.round((current / total) * 100) : 0;
    const container = Swal.getHtmlContainer();
    if (!container) return;

    const bar = container.querySelector('#swalProgressBar') as HTMLElement | null;
    const detail = container.querySelector('#swalProgressDetail') as HTMLElement | null;
    const pctEl = container.querySelector('#swalProgressPct') as HTMLElement | null;
    const sub = container.querySelector('#swalProgressSubtitle') as HTMLElement | null;

    if (bar) bar.style.width = `${pct}%`;
    if (detail) detail.textContent = `${current} / ${total}`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (sub) sub.textContent = subtitle;
  }

  private closeSwal(): void {
    Swal.close();
  }

  /**
   * Convierte a Promise tanto Promises como Observables.
   * - Si trae .subscribe => Observable => firstValueFrom
   * - Si no => Promise/valor => await normal
   */
  private async toPromise<T>(input: any): Promise<T> {
    if (input && typeof input.subscribe === 'function') {
      return (await firstValueFrom(input)) as T;
    }
    return (await input) as T;
  }

  // ---------------------------------------------------------------------------
  // Validación dinámica de fecha
  // ---------------------------------------------------------------------------

  manageFechaValidation(): void {
    const esDeHoy = this.reporteForm.get('esDeHoy')?.value;

    if (esDeHoy === 'true') {
      this.reporteForm.get('fecha')?.clearValidators();
      this.reporteForm.get('fecha')?.setValue(null);
    } else {
      this.reporteForm.get('fecha')?.setValidators(Validators.required);
    }

    this.reporteForm.get('fecha')?.updateValueAndValidity();
    this.reporteForm.updateValueAndValidity();
  }

  // ---------------------------------------------------------------------------
  // Manejo de checkboxes y archivos
  // ---------------------------------------------------------------------------

  onContratosHoyChange(event: any): void {
    if (event.value !== 'si') {
      this.reporteForm.patchValue({
        cedulasEscaneadas: false,
        cruceDiario: false,
        arl: false,
        induccionSSO: false,
        traslados: false,
        cantidadContratosTuAlianza: null,
        cantidadContratosApoyoLaboral: null,
        notas: '',
      });

      this.filesToUpload = {};
      this.cedulasEscaneadasFileName = '';
      this.cruceDiarioFileName = '';
      this.induccionSSOFileName = '';
      this.trasladosFileName = '';
      this.arlFileName = '';

      this.isCruceValidado = false;
      this.isArlValidado = false;

      this.erroresValidacion.data = [];
      this.datoscruced = [];
      this.cedulasPreview = [];
      this.trasladosPreview = [];
    }
  }

  onCheckboxChange(event: any, controlName: UploadControl): void {
    this.reporteForm.get(controlName)?.setValue(event.checked);

    if (!event.checked) {
      this.filesToUpload[controlName] = [];
      this.updateFileName([], controlName);

      if (['cruceDiario', 'cedulasEscaneadas', 'traslados'].includes(controlName)) {
        this.isCruceValidado = false;
      }
      if (controlName === 'arl') {
        this.isArlValidado = false;
      }

      this.erroresValidacion.data = [];

      if (controlName === 'cedulasEscaneadas') this.cedulasPreview = [];
      if (controlName === 'traslados') this.trasladosPreview = [];
    }
  }

  onFilesSelected(event: Event, controlName: UploadControl): void {
    const input = event.target as HTMLInputElement;
    const raw = input.files ? Array.from(input.files) : [];

    // permite seleccionar el mismo archivo dos veces
    input.value = '';

    if (!raw.length) return;

    const { allowed } = this.filterFilesByControl(raw, controlName);

    if (!allowed.length) {
      this.filesToUpload[controlName] = [];
      this.updateFileName([], controlName);
      return;
    }

    this.filesToUpload[controlName] = allowed;
    this.updateFileName(allowed, controlName);

    if (['cruceDiario', 'cedulasEscaneadas', 'traslados'].includes(controlName)) {
      this.isCruceValidado = false;
    }
    if (controlName === 'arl') {
      this.isArlValidado = false;
    }

    // Generar previews y validar inmediatamente
    if (controlName === 'cedulasEscaneadas') {
      this.generateCedulasPreview(allowed);
      this.checkAndShowPreviewErrors(this.cedulasPreview, 'Cédulas');
    } else if (controlName === 'traslados') {
      this.generateTrasladosPreview(allowed);
      this.checkAndShowPreviewErrors(this.trasladosPreview, 'Traslados');
    }

    this.erroresValidacion.data = [];
  }

  onFileSelected(event: Event, controlName: UploadControl): void {
    const input = event.target as HTMLInputElement;
    const raw = input.files?.[0];

    input.value = '';

    if (!raw) return;

    const { allowed, ignored } = this.filterFilesByControl([raw], controlName);

    if (ignored.length) {
      console.warn('Ignorados:', ignored.map((f) => f.name));
      Swal.fire({
        icon: 'info',
        title: 'Archivo ignorado',
        text: `Se ignoró: ${ignored[0].name}.`,
        heightAuto: false,
      });
    }

    if (!allowed.length) {
      this.filesToUpload[controlName] = [];
      this.updateFileName([], controlName);
      return;
    }

    this.filesToUpload[controlName] = allowed;
    this.updateFileName(allowed, controlName);

    if (['cruceDiario', 'cedulasEscaneadas', 'traslados'].includes(controlName)) {
      this.isCruceValidado = false;
    }
    if (controlName === 'arl') {
      this.isArlValidado = false;
    }

    this.erroresValidacion.data = [];
  }

  private filterFilesByControl(files: File[], controlName: UploadControl): { allowed: File[]; ignored: File[] } {
    const allowed: File[] = [];
    const ignored: File[] = [];

    const lower = (s: string) => (s ?? '').trim().toLowerCase();
    const isBlocked = (name: string) => this.BLOCKED_FILES.has(lower(name));
    const ext = (name: string) => lower(name).split('.').pop() || '';

    const isPdf = (f: File) => ext(f.name) === 'pdf' || lower(f.type) === 'application/pdf';
    const isExcelLike = (f: File) => ['xlsx', 'xls', 'csv'].includes(ext(f.name));

    for (const f of files) {
      if (!f?.name) {
        ignored.push(f);
        continue;
      }

      if (isBlocked(f.name)) {
        ignored.push(f);
        continue;
      }

      // REGLAS POR TIPO (clave para NO mandar Thumbs.db / basura al backend)
      if (controlName === 'cedulasEscaneadas' || controlName === 'traslados') {
        if (!isPdf(f)) ignored.push(f);
        else allowed.push(f);
        continue;
      }

      if (controlName === 'cruceDiario' || controlName === 'arl') {
        if (!isExcelLike(f)) ignored.push(f);
        else allowed.push(f);
        continue;
      }

      if (controlName === 'induccionSSO') {
        if (!isPdf(f)) ignored.push(f);
        else allowed.push(f);
        continue;
      }

      allowed.push(f);
    }

    return { allowed, ignored };
  }

  private updateFileName(files: File[], controlName: UploadControl): void {
    const fileNames = files.map((file) => file.name).join(', ');
    switch (controlName) {
      case 'cedulasEscaneadas':
        this.cedulasEscaneadasFileName = fileNames;
        break;
      case 'cruceDiario':
        this.cruceDiarioFileName = fileNames;
        break;
      case 'arl':
        this.arlFileName = fileNames;
        break;
      case 'induccionSSO':
        this.induccionSSOFileName = fileNames;
        break;
      case 'traslados':
        this.trasladosFileName = fileNames;
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Utilidades para Excel / texto
  // ---------------------------------------------------------------------------

  corregirFecha(fecha: string): string {
    const dateParts = (fecha ?? '').split(/\/|-/);

    if (dateParts.length === 3) {
      let [day, month, year] = dateParts;

      if (year.length === 2) {
        const currentYear = new Date().getFullYear();
        const century = Math.floor(currentYear / 100);
        year = (year >= '50' ? century - 1 : century) + year;
      }

      day = day.padStart(2, '0');
      month = month.padStart(2, '0');

      return `${day}/${month}/${year}`;
    }

    return fecha;
  }

  removeSpecialCharacters = (text: string): string => {
    const emojiPattern =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F7E0}-\u{1F7EF}]/gu;

    return (text ?? '').replace(emojiPattern, '');
  };

  private onlyDigits(value: any): string {
    return this.removeSpecialCharacters(String(value ?? ''))
      .replace(/[^\d]/g, '')
      .trim();
  }

  /**
   * ✅ Mantiene X/x al inicio (ej: X1234567)
   * ✅ Tolera notación científica (ej: 1.005851505E+9)
   */
  private normalizeCedula(value: any): string {
    if (value == null) return '';

    if (typeof value === 'number' && Number.isFinite(value)) {
      const asInt = Math.trunc(value);
      return String(asInt);
    }

    let raw = this.removeSpecialCharacters(String(value ?? '')).trim();
    if (!raw || raw === '-') return '';

    const sci = raw.replace(/\s+/g, '');
    if (/^[\d.]+e[+-]?\d+$/i.test(sci)) {
      const n = Number(sci);
      if (Number.isFinite(n)) {
        raw = String(Math.trunc(n));
      }
    }

    const compact = raw.replace(/\s+/g, '');
    const hasX = /^x/i.test(compact);
    const digits = compact.replace(/[^\d]/g, '');

    if (!digits) return '';
    return hasX ? `X${digits}` : digits;
  }

  /** Para enviar al backend cuando NO debe ir la X (si lo necesitas en otro flujo) */
  private cedulaToDigits(value: any): string {
    const c = this.normalizeCedula(value);
    return c.startsWith('X') ? c.slice(1) : c;
  }

  excelSerialToJSDate(serial: number): string {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  // ---------------------------------------------------------------------------
  // Normalización nombres PDF antes de enviar (DOC - algo / Traslado DOC - EPS)
  // ---------------------------------------------------------------------------

  private normEpsToken(value: string): string {
    return (value ?? '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '')
      .replace(/[^a-z]/g, '');
  }

  private safeRenameFile(original: File, newName: string): File {
    try {
      return new File([original], newName, {
        type: original.type,
        lastModified: original.lastModified,
      });
    } catch {
      return original;
    }
  }


  /**
   * Detecta EPS permitida en nombre de traslado.
   * Acepta variaciones: "SALUD TOTAL", "SALUDTOTAL", "NUEVA EPS", "NUEVAEPS"
   * Devuelve canonical: "SALUDTOTAL" | "NUEVAEPS"
   */
  private extractEpsFromTrasladoName(filename: string): string | null {
    const name = (filename ?? '').trim();
    const lower = name.toLowerCase();

    if (!name) return null;
    if (this.BLOCKED_FILES.has(lower)) return null;
    if (!lower.endsWith('.pdf')) return null;

    const base = name.replace(/\.pdf$/i, '').trim();
    const parts = base
      .split('-')
      .map((p) => p.trim())
      .filter(Boolean);

    // parts[0] = doc, el resto puede ser EPS o basura extra
    for (const p of parts.slice(1)) {
      const key = this.normEpsToken(p);
      const canonical = this.EPS_ALLOWED.get(key);
      if (canonical) return canonical;
    }
    return null;
  }

  private prepareCedulasFilesForBackend(files: File[]): { files: File[]; errors: ErrorRow[] } {
    const out: File[] = [];
    const errors: ErrorRow[] = [];

    for (const f of files ?? []) {
      const doc = this.extractDocumentoFromPdfName(f?.name ?? '');
      if (!doc) {
        errors.push({
          registro: f?.name ?? 'SIN NOMBRE',
          errores: ['Nombre inválido. Use: DOCUMENTO - NOMBRE.pdf (o DOCUMENTO.pdf).'],
          tipo: 'Cédulas (nombre inválido)',
        });
        continue;
      }
      out.push(this.safeRenameFile(f, `${doc}.pdf`));
    }

    return { files: out, errors };
  }

  private prepareTrasladosFilesForBackend(files: File[]): { files: File[]; errors: ErrorRow[] } {
    const out: File[] = [];
    const errors: ErrorRow[] = [];

    for (const f of files ?? []) {
      const doc = this.extractDocumentoFromPdfName(f?.name ?? '');
      if (!doc) {
        errors.push({
          registro: f?.name ?? 'SIN NOMBRE',
          errores: ['Nombre inválido. Use: DOCUMENTO-EPS.pdf (ej: 1005851505-SALUD TOTAL.pdf).'],
          tipo: 'Traslados (documento inválido)',
        });
        continue;
      }

      const eps = this.extractEpsFromTrasladoName(f?.name ?? '');
      if (!eps) {
        errors.push({
          registro: f?.name ?? 'SIN NOMBRE',
          errores: ['EPS inválida/no encontrada. Permitidas: SALUD TOTAL, NUEVA EPS. Ej: 1005851505-SALUD TOTAL.pdf'],
          tipo: 'Traslados (EPS inválida)',
        });
        continue;
      }

      out.push(this.safeRenameFile(f, `${doc}-${eps}.pdf`));
    }

    return { files: out, errors };
  }

  // ---------------------------------------------------------------------------
  // Lectura de Excel (ArrayBuffer)
  // ---------------------------------------------------------------------------

  private async readWorkbook(file: File): Promise<XLSX.WorkBook> {
    const buffer = await file.arrayBuffer();
    return XLSX.read(buffer, { type: 'array' });
  }

  // ---------------------------------------------------------------------------
  // Extracción de datos desde archivos
  // ---------------------------------------------------------------------------

  private async extraerCedulasDelArchivo(file: File): Promise<string[]> {
    const workbook = await this.readWorkbook(file);

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const json = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      dateNF: 'dd/mm/yyyy',
    }) as any[];

    json.shift();

    return json.map((row: any[]) => this.normalizeCedula(row?.[1])).filter((c) => c !== '');
  }

  private async contarALyTAEnColumna(file: File): Promise<{ AL: number; TA: number }> {
    const workbook = await this.readWorkbook(file);

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    const json = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      dateNF: 'dd/mm/yyyy',
    }) as any[];

    json.shift();

    let alCount = 0;
    let taCount = 0;

    json.forEach((row: any[]) => {
      const valor = (row?.[2] ?? '').toString().trim();
      if (valor === 'AL') alCount++;
      else if (valor === 'TA') taCount++;
    });

    return { AL: alCount, TA: taCount };
  }

  private extractCedulaFromFilename(filename: string): string | null {
    // ✅ ahora soporta "DOC - nombre.pdf"
    return this.extractDocumentoFromPdfName(filename);
  }

  private extraerCedulasDeArchivos(files: File[]): string[] {
    return (files ?? [])
      .map((f) => this.extractCedulaFromFilename(f?.name ?? ''))
      .filter((c): c is string => !!c);
  }

  async ObtenerCedulasEscaneadas(files: File[]): Promise<string[]> {
    return this.extraerCedulasDeArchivos(files);
  }

  async ObtenerCedulasTraslados(files: File[]): Promise<string[]> {
    return this.extraerCedulasDeArchivos(files);
  }

  // ✅ Validación EPS de traslados (tabla + envío)
  private validarTrasladosEps(files: File[]): ErrorRow[] {
    const errors: ErrorRow[] = [];

    for (const file of files ?? []) {
      const name = (file?.name ?? '').trim();
      const lower = name.toLowerCase();

      if (!name) continue;
      if (this.BLOCKED_FILES.has(lower)) continue;
      if (!lower.endsWith('.pdf')) {
        errors.push({
          registro: name,
          errores: ['No es un archivo PDF.'],
          tipo: 'Traslado EPS',
        });
        continue;
      }

      const doc = this.extractDocumentoFromPdfName(name);
      // Validar que tenga documento Y que sea válido (números o X)
      if (!doc || !/^[0-9xX]+$/.test(doc)) {
        errors.push({
          registro: name,
          errores: ['Nombre inválido. Use: DOCUMENTO-EPS.pdf (ej: 1005851505-SALUD TOTAL.pdf). El documento puede contener numeros y X.'],
          tipo: 'Traslado EPS',
        });
        continue;
      }

      const eps = this.extractEpsFromTrasladoName(name);
      if (!eps) {
        errors.push({
          registro: name,
          errores: ['EPS inválida/no encontrada. Permitidas: SALUD TOTAL, NUEVA EPS.'],
          tipo: 'Traslado EPS',
        });
      }
    }
    return errors;
  }

  private generateCedulasPreview(files: File[]): void {
    const preview: CedulaPreviewItem[] = [];

    // Regex global para capturar: (Grupo 1: Documento) - (Grupo 2: Resto).pdf
    // Permitimos caracteres variados en Grupo 1 para luego validarlos estrictamente.
    const regex = /^\s*([a-zA-Z0-9-]+)\s*-\s*(.+?)\.pdf$/i;

    // Validación estricta: Solo números O (X/x + números/letras/guiones)
    // ^\d+$  => solo números
    // ^[xX]... => X seguido de alfanuméricos/guiones
    const strictDocRegex = /^(\d+|[xX][a-zA-Z0-9\-]+)$/;

    for (const file of files) {
      const name = file.name;
      const match = name.match(regex);

      if (match) {
        const docPart = match[1];
        const namePart = match[2];

        if (strictDocRegex.test(docPart)) {
          preview.push({
            nombreArchivo: name,
            documento: docPart,
            nombre: namePart,
            esValido: true
          });
        } else {
          preview.push({
            nombreArchivo: name,
            documento: docPart,
            nombre: namePart,
            esValido: false,
            error: 'Documento inválido. Solo se permiten números o comenzar con X (ej: 12345 o X12345).'
          });
        }
      } else {
        let error = 'Formato inválido. Debe ser: "DOCUMENTO - NOMBRE.pdf"';
        if (!name.toLowerCase().endsWith('.pdf')) error = 'No es un archivo PDF';

        preview.push({
          nombreArchivo: name,
          documento: '',
          nombre: '',
          esValido: false,
          error
        });
      }
    }

    this.cedulasPreview = preview;
  }

  // Helper para extraer documento (usado en validación de traslados y otros)
  private extractDocumentoFromPdfName(filename: string): string | null {
    // Reutilizamos la misma lógica estricta: (DOC) - (RESTO).pdf
    const regex = /^\s*([a-zA-Z0-9-]+)\s*-\s*(.+?)\.pdf$/i;
    const match = filename.match(regex);
    if (!match) return null;

    const docPart = match[1];
    const strictDocRegex = /^(\d+|[xX][a-zA-Z0-9\-]+)$/;
    if (!strictDocRegex.test(docPart)) return null;

    return docPart;
  }

  private generateTrasladosPreview(files: File[]): void {
    const preview: TrasladoPreviewItem[] = [];

    for (const file of files) {
      const name = file.name;
      // Validación básica de PDF
      if (!name.toLowerCase().endsWith('.pdf')) {
        preview.push({
          nombreArchivo: name,
          documento: '',
          eps: '',
          esValido: false,
          error: 'No es un archivo PDF'
        });
        continue;
      }

      // Lógica de parsing para Traslados (Documento - EPS)
      // Usamos split('-') para ser consistentes con la lógica de negocio, pero validando estrictamente
      const baseName = name.slice(0, -4); // remove .pdf
      const parts = baseName.split('-');

      if (parts.length < 2) {
        preview.push({
          nombreArchivo: name,
          documento: '',
          eps: '',
          esValido: false,
          error: 'Formato inválido. Falta el guión separador (-)'
        });
        continue;
      }

      // Asumimos documento es la primera parte, EPS la segunda (o ultima?)
      // La regla de negocio dice: Documento - EPS
      const docRaw = parts[0].trim();
      const epsRaw = parts.slice(1).join('-').trim(); // Join back in case EPS has hyphens? Unlikely but safe.

      // Validar Documento (solo digitos o X)
      if (!/^[0-9xX]+$/.test(docRaw)) {
        preview.push({
          nombreArchivo: name,
          documento: docRaw,
          eps: epsRaw,
          esValido: false,
          error: 'El documento debe contener solo números o la letra X'
        });
        continue;
      }

      // Validar EPS (Normalizada)
      const epsNormalized = this.normEpsToken(epsRaw);
      const epsCanonical = this.EPS_ALLOWED.get(epsNormalized);

      if (epsCanonical) {
        preview.push({
          nombreArchivo: name,
          documento: docRaw,
          eps: epsCanonical, // Mostrar el nombre bonito (SALUDTOTAL)
          esValido: true
        });
      } else {
        preview.push({
          nombreArchivo: name,
          documento: docRaw,
          eps: epsRaw,
          esValido: false,
          error: `EPS desconocida (${epsRaw}). Use: SALUDTOTAL o NUEVAEPS`
        });
      }
    }

    this.trasladosPreview = preview;
  }

  // ---------------------------------------------------------------------------
  // Preview Dialog (Cruce)
  // ---------------------------------------------------------------------------


  private checkAndShowPreviewErrors(items: any[], type: string): void {
    const invalid = items.filter((i) => !i.esValido);
    if (invalid.length > 0) {
      const errorHtml = invalid
        .map(
          (i) =>
            `<li style="text-align: left; margin-bottom: 8px;">
              <strong>${i.nombreArchivo}</strong>: <span style="color: #d32f2f;">${i.error || 'Error desconocido'}</span>
            </li>`
        )
        .join('');

      Swal.fire({
        icon: 'error',
        title: `Errores en ${type}`,
        html: `
          <p class="mb-2">Se encontraron <strong>${invalid.length}</strong> archivo(s) con errores:</p>
          <ul style="max-height: 300px; overflow-y: auto; padding-left: 20px; text-align: left;">
            ${errorHtml}
          </ul>
          <p class="mt-2 text-sm text-muted">Corrija los nombres de archivo y vuelva a intentarlo.</p>
        `,
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#d32f2f',
        width: '500px'
      });
    }
  }

  private buildExternalIssuesFromBackend(allErrors: any[]): PreviewIssue[] {
    const out: PreviewIssue[] = [];

    for (let i = 0; i < (allErrors ?? []).length; i++) {
      const e = allErrors[i];
      const itemId = String(e?.registro ?? e?.rowIndex ?? e?.itemId ?? '0');

      const msgs = Array.isArray(e?.errores) ? e.errores : [e?.message ?? e?.mensaje ?? 'Error'];

      for (let j = 0; j < msgs.length; j++) {
        out.push({
          id: `ext:${itemId}:${i}:${j}`,
          itemId,
          severity: 'error',
          message: String(msgs[j]),
          field: e?.field ?? e?.campo ?? undefined,
          meta: e,
        });
      }
    }

    return out;
  }

  private createUploadHandler(items: CruceRow[], uploadedRef?: { cedulas: string[]; traslados: string[] }) {
    return async (file: File, itemId: string) => {
      // 1. Buscamos la fila correspondiente
      const row = items.find((r) => r._id === itemId);
      if (!row) return;

      // 2. Validamos coincidencia (Cedula vs PDF Name)
      const docPdf = this.extractDocumentoFromPdfName(file.name);
      if (!docPdf) {
        await Swal.fire('Error', 'El nombre del archivo no tiene un formato válido (DOC - NOMBRE.pdf).', 'error');
        return;
      }

      const cedulaExcel = this.normalizeCedula(row.cedula);
      const cedulaPdf = this.normalizeCedula(docPdf);

      // Permitimos si son iguales
      if (cedulaPdf !== cedulaExcel) {
        await Swal.fire(
          'Error',
          `El archivo subido (${cedulaPdf}) no coincide con la cédula del registro (${cedulaExcel}).`,
          'error'
        );
        return;
      }

      // 3. Agregamos a la lista global (cedulasEscaneadas)
      // Asumimos que la acción "upload-pdf" es para Cedulas (por ahora)
      const current = this.filesToUpload['cedulasEscaneadas'] ?? [];

      // Evitar duplicados
      if (current.some(f => f.name === file.name)) {
        // Ya existe, no hacemos nada (o avisamos)
      } else {
        this.filesToUpload['cedulasEscaneadas'] = [...current, file];
      }

      // 4. Actualizamos el ref local para revalidación inmediata
      if (uploadedRef) {
        // Si no está ya incluido
        if (!uploadedRef.cedulas.includes(cedulaPdf)) {
          uploadedRef.cedulas.push(cedulaPdf);
        }
      }

      // 5. Toast success
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true,
      });
      Toast.fire({ icon: 'success', title: 'Archivo cargado correctamente.' });
    };
  }

  private async openCrucePreviewDialog(
    rows: string[][],
    headerRow: string[],
    uploadedRef?: { cedulas: string[]; traslados: string[] },
    backendErrors: any[] = [],
  ): Promise<{ ok: boolean; rows: string[][] }> {
    const items = CruceValidationHelper.parseRows(rows, headerRow);
    const schema = CruceValidationHelper.getSchema(headerRow, uploadedRef);
    const externalIssues = backendErrors.length ? this.buildExternalIssuesFromBackend(backendErrors) : [];

    const phase = backendErrors.length > 0 ? 'post' : 'pre';

    const ref = this.dialog.open(ValidationPreviewDialogComponent as any, {
      width: 'min(1200px, 96vw)',
      maxWidth: '96vw',
      height: '90vh',
      disableClose: true,
      data: {
        schema,
        items,
        phase,
        externalIssues,
        title: phase === 'post' ? 'Reporte de Errores (Backend)' : 'Validación Preliminar',
        subtitle: phase === 'post' ? 'Corrige los datos y reintenta.' : 'Revisa las inconsistencias antes de enviar.',
        uploadHandler: this.createUploadHandler(items, uploadedRef),
      } satisfies PreviewDialogData<CruceRow, any>,
    });

    const res = (await firstValueFrom(ref.afterClosed())) as PreviewDialogResult<{ rows: string[][] }> | undefined;

    if (!res?.accepted) return { ok: false, rows };

    // ✅ soporta ambos estilos de retorno: result.rows o items con raw
    const fixedRows =
      (res.result as any)?.rows ??
      (Array.isArray(res.items)
        ? (res.items as any[]).map((it) => (it?.raw ? it.raw : it))
        : rows);

    // Normaliza: garantizamos string[][]
    const normalized = (fixedRows ?? []).map((r: any) => (Array.isArray(r) ? r.map((c) => String(c ?? '-')) : []));

    return { ok: true, rows: normalized };
  }

  // ---------------------------------------------------------------------------
  // Botón VALIDAR
  // ---------------------------------------------------------------------------

  async validarTodo(): Promise<void> {
    this.closeSwal();
    // Reutilizamos la lógica completa dentro de validarCruce, que ahora incluye pre-validación.
    await this.validarCruce();
  }

  // ---------------------------------------------------------------------------
  // Validación profunda de cruce (lotes + progress) + Preview dialog
  // ---------------------------------------------------------------------------

  async validarCruce(): Promise<void> {
    this.closeSwal();

    const files = this.filesToUpload.cruceDiario ?? [];
    if (files.length === 0) {
      await Swal.fire('Error', 'Debe cargar un archivo antes de validar', 'error');
      return;
    }

    const arlChecked = !!this.reporteForm.get('arl')?.value;
    const arlFiles = this.filesToUpload.arl ?? [];

    this.isCruceValidado = false;
    this.erroresValidacion.data = [];

    this.showLoading('Cargando...', 'Iniciando el proceso de validación');

    try {
      const file = files[0];
      const workbook = await this.readWorkbook(file);

      this.showLoading('Leyendo el archivo Excel...', 'Por favor, espere...');

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const headerRow = (XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0 }) as string[][])[0];

      const json = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        dateNF: 'dd/mm/yyyy',
      }) as any[];

      json.shift();

      const formatDate = (date: string): string => {
        const value = (date ?? '').toString().trim();
        const regex_ddmmyyyy = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        const regex_mmddyy = /^\d{1,2}\/\d{1,2}\/\d{2}$/;

        if (regex_ddmmyyyy.test(value)) return value;

        if (regex_mmddyy.test(value)) {
          const [month, day, year] = value.split('/');
          const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
          return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`;
        }

        return value;
      };

      const indicesFechas = [0, 8, 16, 24, 44, 134];

      let rows: string[][] = json.map((row: any[]) => {
        const completeRow = new Array(195).fill('-');

        row.forEach((cell, index) => {
          if (index >= 195) return;

          if (
            cell == null ||
            cell === '' ||
            cell === '#N/A' ||
            cell === 'N/A' ||
            cell === '#REF!' ||
            cell === '#¡REF!'
          ) {
            completeRow[index] = '-';
            return;
          }

          // preserva X/x en cruce (columnas de cédula)
          if (index === 11 || index === 1) {
            completeRow[index] = this.normalizeCedula(cell);
            return;
          }

          if (indicesFechas.includes(index)) {
            completeRow[index] = formatDate(this.removeSpecialCharacters(cell.toString()));
            return;
          }

          completeRow[index] = this.removeSpecialCharacters(cell.toString());
        });

        return completeRow;
      });

      const cruceRows = CruceValidationHelper.parseRows(rows, headerRow);

      const uploadedRef = {
        cedulas: (this.filesToUpload['cedulasEscaneadas'] ?? []).map((f: File) => this.normalizeCedula(f.name.split('.')[0])),
        traslados: (this.filesToUpload['traslados'] ?? []).map((f: File) => this.normalizeCedula(f.name.split('.')[0]))
      };

      const schema = CruceValidationHelper.getSchema(headerRow, uploadedRef);

      this.datoscruced = rows;

      // ==========================================
      // CONTAR AL / TA (Columna 2 - TEM)
      // ==========================================
      let alCount = 0;
      let taCount = 0;

      rows.forEach((row) => {
        // La columna 2 es TEM según CruceValidationHelper.COL_TEM
        const val = (row[2] ?? '').toString().trim().toUpperCase();
        if (val === 'AL') alCount++;
        else if (val === 'TA') taCount++;
      });

      this.reporteForm.patchValue({
        cantidadContratosApoyoLaboral: alCount,
        cantidadContratosTuAlianza: taCount,
      });

      const batchSize = 1500;

      const runValidateBatches = async (inputRows: string[][]): Promise<any[]> => {
        const totalBatches = Math.ceil(inputRows.length / batchSize);
        const allErrors: any[] = [];

        this.openProgress('Validando lotes...', 'Preparando envío de lotes...', 0, totalBatches);

        for (let i = 0; i < totalBatches; i++) {
          const batch = inputRows.slice(i * batchSize, (i + 1) * batchSize);
          this.updateProgress(`Validando lote ${i + 1} de ${totalBatches}...`, i + 1, totalBatches);

          const response: any = await this.toPromise(this.hiringService.subirContratacionValidar(batch));
          if (response?.status === 'error' && Array.isArray(response?.errores)) {
            allErrors.push(...response.errores);
          }
        }

        return allErrors;
      };

      // 0) Pre-validación local (Frontend: Consistencia + Filas)
      // Si hay problemas locales, mostramos el diálogo ANTES de ir al backend.
      const localIssues = [
        ...(schema.validateItem ? cruceRows.flatMap(r => schema.validateItem!(r)) : []),
        ...(schema.validateAll ? schema.validateAll(cruceRows) : [])
      ].filter(i => i.severity === 'error'); // Solo bloqueamos si hay errores

      if (localIssues.length > 0) {
        this.closeSwal();
        const res = await this.openCrucePreviewDialog(rows, headerRow, uploadedRef, []);
        if (!res.ok) {
          // Usuario canceló
          return;
        }
        // Usuario corrigió y confirmó
        rows = res.rows;
        this.datoscruced = rows;
      }

      // 1) Validación Backend
      let allErrors = await runValidateBatches(rows);
      this.erroresValidacion.data = allErrors;

      // 2) Si hay errores: abrir preview para corregir y revalidar
      if (allErrors.length > 0) {
        this.closeSwal();

        const dialogRef = this.dialog.open(ValidationPreviewDialogComponent, {
          data: {
            schema: schema,
            items: cruceRows,
            phase: 'pre',
            title: 'Validación Inicial (Frontend)',
            subtitle: 'Se encontraron errores de formato o consistencia. Corríjalos para continuar.',
            uploadHandler: this.createUploadHandler(cruceRows, uploadedRef),
          },
          width: 'min(1280px, 96vw)',
          maxWidth: '96vw',
          height: 'min(860px, 92vh)',
          maxHeight: '92vh',
          panelClass: 'vp-dialog',
          autoFocus: false,
          restoreFocus: true,
          disableClose: true,
        });

        const result = await firstValueFrom(dialogRef.afterClosed());
        if (!result || !result.accepted) {
          this.erroresValidacion.data = allErrors;
          return;
        }

        // Update rows with corrected data
        rows = result.result;
        this.datoscruced = rows;

        // Revalidación
        allErrors = await runValidateBatches(rows);
        this.erroresValidacion.data = allErrors;

        if (allErrors.length > 0) {
          // ✅ ahora sí: guardamos errores en backend como antes
          const payload = {
            errores: allErrors,
            responsable: this.nombre,
            tipo: 'Documento de Contratación',
          };

          this.showLoading('Enviando errores...', 'Guardando errores encontrados...');

          try {
            await this.toPromise(this.hiringService.enviarErroresValidacion(payload));
            this.closeSwal();
            await Swal.fire('Error', 'Aún hay errores tras corregir. Corrija y vuelva a intentar.', 'error');
          } catch {
            this.closeSwal();
            await Swal.fire('Error', 'Error al guardar los errores.', 'error');
          }
          return;
        }
      }

      // ✅ si llegamos aquí: cruce OK
      this.closeSwal();
      this.isCruceValidado = true;

      // Procesa ARL (solo si el cruce ya quedó OK)
      if (arlChecked && arlFiles.length > 0) {
        await this.proccssArl([arlFiles[0]]);
      }

      await Swal.fire('Completado', 'Proceso de validación finalizado correctamente.', 'success');
    } catch {
      this.closeSwal();
      await Swal.fire('Error', 'Error procesando el archivo. Verifique el formato e intente de nuevo.', 'error');
    }
  }

  applyFilter(_column: string, event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.erroresValidacion.filter = (filterValue ?? '').trim().toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // Procesamiento ARL (Regla 9 + generación Excel de resultados ARL)
  // ---------------------------------------------------------------------------

  private parseDateAny(value: any): Date | null {
    if (value == null || value === '' || value === '-') return null;

    if (typeof value === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      return new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    }

    const str = String(value).trim();
    if (!str) return null;

    const normalized = str.includes('-') ? str.replace(/-/g, '/') : str;
    const parts = normalized.split('/').map((p) => p.trim());
    if (parts.length !== 3) return null;

    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y) return null;

    return new Date(y, m - 1, d);
  }

  async processArl(workbook: XLSX.WorkBook): Promise<void> {
    let confirmarErrores = true;
    this.isArlValidado = true;

    this.showLoading('Cargando...', 'Procesando archivo de ARL. Por favor, espere...');

    try {
      const sheetArl = workbook.Sheets[workbook.SheetNames[0]];

      const dataArl = XLSX.utils.sheet_to_json(sheetArl, {
        header: 1,
        raw: true,
        defval: '',
      }) as any[][];

      if (!dataArl.length) {
        this.isArlValidado = false;
        this.closeSwal();
        await Swal.fire('Error', 'El archivo ARL está vacío.', 'error');
        return;
      }

      const headerRow = (dataArl[0] ?? []).map((h) => (h ?? '').toString().trim());
      const dniTrabajadorIndex = headerRow.indexOf('DNI TRABAJADOR');
      const inicioVigenciaIndex = headerRow.indexOf('INICIO VIGENCIA');

      if (dniTrabajadorIndex === -1 || inicioVigenciaIndex === -1) {
        this.isArlValidado = false;
        this.closeSwal();
        await Swal.fire(
          'Error',
          'El archivo ARL debe tener encabezados e incluir "DNI TRABAJADOR" y "INICIO VIGENCIA".',
          'error',
        );
        return;
      }

      const rowsArl = dataArl
        .slice(1)
        .map((row) => {
          const copy = [...row];
          const v = copy[inicioVigenciaIndex];
          if (typeof v === 'number') {
            copy[inicioVigenciaIndex] = this.excelSerialToJSDate(v);
          }
          return copy;
        })
        .filter((r) => r && r.length);

      const headers = [
        'Fecha de firma de contrato',
        'N° CC',
        'TEM',
        'Código',
        'Empresa Usuaria y Centro de Costo',
        'Tipo de Documento de Identidad',
        'Ingreso,(ing) No Ingres , Sin Confirmar, Cambio de contrato',
        'Cargo (Operario de... y/oficios varios)',
        'Fecha de Ingreso',
        'Descripción de la Obra / Motivo Temporada/// Cambia cada mes',
        'Salario S.M.M.L.V.',
        'Número de Identificación Trabajador',
        'Primer Apellido Trabajador',
        'Segundo Apellido Trabajador',
        'Primer Nombre Trabajador',
        'Segundo Nombre Trabajador',
        'Fecha de Nacimiento (DD/MM/AAAA) Trabajador',
        'Sexo (F - M) Trabajador',
        'Estado civil (SO-UL - CA-SE-VI) Trabajador',
        'Dirección de residencia Trabajador',
        'Barrio Trabajador',
        'Teléfono móvil Trabajador',
        'Correo electrónico E-mail Trabajador',
        'Ciudad de Residencia Trabajador',
        'Fecha Expedición CC Trabajador',
        'Municipio Expedición CC Trabajador',
        'Departamento Expedición CC Trabajador',
        'Lugar de Nacimiento Municipio Trabajador',
        'Lugar de Nacimiento Departamento Trabajador',
        'Rh Trabajador',
        'Zurdo/ Diestro Trabajador',
        'EPS Trabajador',
        'AFP Trabajador',
        'AFC Trabajador',
        'Centro de costo Para el Carné Trabajador',
        'Persona que hace Contratación',
        'Edad Apropiada v',
        'Escolaridad (1-11) Trabajador',
        'Técnico Trabajador',
        'Tecnólogo Trabajador',
        'Universidad Trabajador',
        'Especialización Trabajador',
        'Otros Trabajador',
        'Nombre Institución Trabajador',
        'Año de Finalización Trabajador',
        'Título Obtenido Trabajador',
        'Chaqueta Trabajador',
        'Pantalón Trabajador',
        'Camisa Trabajador',
        'Calzado Trabajador',
        'Familiar en caso de Emergencia',
        'Parentesco Emergencia',
        'Dirección Emergencia',
        'Barrio Emergencia',
        'Teléfono Emergencia',
        'Ocupación Emergencia',
        'Nombre Pareja',
        'Vive Si/No Pareja',
        'Ocupación Pareja',
        'Dirección Pareja',
        'Teléfono Pareja',
        'Barrio Pareja',
        'No de Hijos Dependientes',
        'Nombre Hijo 1',
        'Sexo Hijo 1',
        'Fecha Nacimiento Hijo 1',
        'No de Documento de Identidad Hijo 1',
        'Estudia o Trabaja Hijo 1',
        'Curso Hijo 1',
        'Nombre Hijo 2',
        'Sexo Hijo 2',
        'Fecha Nacimiento Hijo 2',
        'No de Documento de Identidad Hijo 2',
        'Estudia o trabaja Hijo 2',
        'Curso Hijo 2',
        'Nombre Hijo 3',
        'Sexo Hijo 3',
        'Fecha Nacimiento Hijo 3',
        'No de Documento de Identidad Hijo 3',
        'Estudia o trabaja Hijo 3',
        'Curso Hijo 3',
        'Nombre Hijo 4',
        'Sexo Hijo 4',
        'Fecha Nacimiento Hijo 4',
        'No de Documento de Identidad Hijo 4',
        'Estudia o trabaja Hijo 4',
        'Curso Hijo 4',
        'Nombre Hijo 5',
        'Sexo Hijo 5',
        'Fecha Nacimiento Hijo 5',
        'No de Documento de Identidad Hijo 5',
        'Estudia o trabaja Hijo 5',
        'Curso Hijo 5',
        'Nombre Hijo 6',
        'Sexo Hijo 6',
        'Fecha Nacimiento Hijo 6',
        'No de Documento de Identidad Hijo 6',
        'Estudia o trabaja Hijo 6',
        'Curso Hijo 6',
        'Nombre Hijo 7',
        'Sexo Hijo 7',
        'Fecha Nacimiento Hijo 7',
        'No de Documento de Identidad Hijo 7',
        'Estudia o trabaja Hijo 7',
        'Curso Hijo 7',
        'Nombre Padre',
        'Vive Si/No Padre',
        'Ocupación Padre',
        'Dirección Padre',
        'Teléfono Padre',
        'Barrio/Municipio Padre',
        'Nombre Madre',
        'Vive Si/No Madre',
        'Ocupación Madre',
        'Dirección Madre',
        'Teléfono Madre',
        'Barrio/Municipio Madre',
        'Nombre Referencia Personal 1',
        'Teléfono Referencia Personal 1',
        'Ocupación Referencia Personal 1',
        'Nombre Referencia Personal 2',
        'Teléfono Referencia Personal 2',
        'Ocupación Referencia Personal 2',
        'Nombre Referencia Familiar 1',
        'Teléfono Referencia Familiar 1',
        'Ocupación Referencia Familiar 1',
        'Nombre Referencia Familiar 2',
        'Teléfono Referencia Familiar 2',
        'Ocupación Referencia Familiar 2',
        'Nombre Empresa Experiencia Laboral 1',
        'Dirección Empresa Experiencia Laboral 1',
        'Teléfonos Experiencia Laboral 1',
        'Nombre Jefe Inmediato Experiencia Laboral 1',
        'AREA DE EXPERIENCIA Experiencia Laboral 1',
        'Fecha de Retiro Experiencia Laboral 1',
        'Motivo Retiro Experiencia Laboral 1',
        'Nombre Empresa Experiencia Laboral 2',
        'Dirección Empresa Experiencia Laboral 2',
        'Teléfonos Experiencia Laboral 2',
        'Nombre Jefe Inmediato Experiencia Laboral 2',
        'Cargo del Trabajador Experiencia Laboral 2',
        'Fecha de Retiro Experiencia Laboral 2',
        'Motivo Retiro Experiencia Laboral 2',
        'Nombre del Carnet',
        'Desea Plan Funerario',
        'Número Cuenta/Celular',
        'Número Tarjeta/Tipo de Cuenta',
        'Clave para Asignar',
        'Examen Salud Ocupacional',
        'Apto para el Cargo? Sí o No',
        'EXAMEN DE SANGRE',
        'PLANILLA FUMIGACION',
        'Otros Examenes2 (Nombre)',
        'VACUNA COVID',
        'Nombre de la EPS afiliada',
        'EPS A TRASLADAR',
        'Nombre de AFP Afiliado 01',
        'AFP A TRASLADAR',
        'Afiliación Caja de compensación',
        'Nombre de AFP Afiliado 02',
        'Revisión de Fecha de Ingreso ARL',
        'Confirmación de los Ingresos Envío de correos a las Fincas a diario Confirmacion hasta las 12:30',
        'Fecha confirmación Ingreso a las Empresas Usuarias',
        'Afiliación enviada con fecha (Coomeva-Nueva Eps - Sura - S.O.S - Salud Vida -Compensar - Famisanar',
        'Revisión Personal Confirmado Empresas Usuarias VS Nómina los días 14 y los días 29 de cada Mes',
        'Referenciación Personal 1',
        'Referenciación Personal 2',
        'Referenciación Familiar 1',
        'Referenciación Familiar 2',
        'Referenciación Experiencia Laboral 1',
        'Referenciación Experiencia Laboral 2',
        'Revisión Registraduria (Fecha entrega CC)',
        'COMO SE ENTERO DEL EMPLEO',
        'Tiene Experiencia laboral ?',
        'Empresas de flores que ha trabajado (Separarlas con ,)',
        '¿En que area?',
        'Describa paso a paso como es su labora (ser lo mas breve posible)',
        'Califique su rendimiento',
        '¿Por que se da esta auto calificación?',
        'Hace cuanto vive en la zona',
        'Tipo de vivienda',
        'Con quien Vive',
        'Estudia Actualmente',
        'Personas a cargo',
        'Numero de hijosacargo',
        'Quien los cuida?',
        'Como es su relacion Familiar',
        'Segun su Experiencia y desempeño laboral por que motivos lo han felicitado',
        'Ha tenido algun malentendido o situacion conflictiva en algun trabajo, Si si en otro especificar por que:',
        'Esta dispuesto a realizar actividades diferentes al cargo :',
        'Mencione una experiencia significativa en su trabajo',
        'Que proyecto de vida tiene de aqui a 3 años',
        'La vivienda es:',
        '¿Cuál es su motivación?',
        'OBSERVACIONES',
      ];

      const datosMapeados = this.datoscruced.map((cruceRow: any[], index: number) => {
        const cedulaCruce = this.normalizeCedula(cruceRow?.[1]);
        const comparativoCruce = cruceRow?.[8];

        const filaArl = rowsArl.find((arlRow) => {
          const cedulaArl = this.normalizeCedula(arlRow?.[dniTrabajadorIndex]);
          return cedulaArl === cedulaCruce;
        });

        let estadoCedula = 'ALERTA NO ESTA EN ARL';
        let estadoFechas = 'SATISFACTORIO';
        let fechaIngresoArl: any = 'NO DISPONIBLE';
        let fechaIngresoCruce: any = comparativoCruce || 'NO DISPONIBLE';

        if (filaArl) {
          estadoCedula = 'SATISFACTORIO';

          const comparativoArl = filaArl?.[inicioVigenciaIndex];
          const fechaArl = this.parseDateAny(comparativoArl);
          const fechaCruce = this.parseDateAny(comparativoCruce);

          if (!fechaArl || !fechaCruce) {
            estadoFechas = 'ALERTA FECHA NO DISPONIBLE';
          } else if (fechaArl.getTime() > fechaCruce.getTime()) {
            estadoFechas = 'ALERTA FECHAS NO COINCIDEN';
          }

          fechaIngresoArl = comparativoArl || 'NO DISPONIBLE';
        }

        const resultado: { [key: string]: any } = {
          'Numero de Cedula': cedulaCruce || 'NO DISPONIBLE',
          Arl: estadoCedula,
          ARL_FECHAS: estadoFechas,
          'FECHA EN ARL': fechaIngresoArl,
          'FECHA INGRESO SUBIDA CONTRATACION': fechaIngresoCruce,
          Errores: 'OK',
        };

        headers.forEach((header, i) => {
          resultado[header] = cruceRow?.[i] ?? 'NO DISPONIBLE';
        });

        const registroErrores = (this.erroresValidacion.data ?? []).find((err: any) => err?.registro == index + 1);
        if (registroErrores && Array.isArray(registroErrores.errores) && registroErrores.errores.length > 0) {
          confirmarErrores = false;
          resultado['Errores'] = registroErrores.errores.join(', ');
        }

        return resultado;
      });

      const workbookOut = new ExcelJS.Workbook();
      const worksheet = workbookOut.addWorksheet('Datos');

      worksheet.columns = Object.keys(datosMapeados[0] ?? {}).map((titulo) => ({
        header: titulo,
        key: titulo,
        width: 22,
      }));

      const green: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF00FF00' },
      };

      const red: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF0000' },
      };

      datosMapeados.forEach((dato) => {
        const row = worksheet.addRow(dato);

        if (dato['Arl'] === 'SATISFACTORIO') (row.getCell('Arl') as any).fill = green;
        else {
          this.isArlValidado = false;
          (row.getCell('Arl') as any).fill = red;
        }

        if (dato['ARL_FECHAS'] === 'SATISFACTORIO') (row.getCell('ARL_FECHAS') as any).fill = green;
        else {
          this.isArlValidado = false;
          (row.getCell('ARL_FECHAS') as any).fill = red;
        }

        if (dato['FECHA EN ARL'] === 'NO DISPONIBLE') {
          this.isArlValidado = false;
          (row.getCell('FECHA EN ARL') as any).fill = red;
        }

        if (dato['FECHA INGRESO SUBIDA CONTRATACION'] === 'NO DISPONIBLE') {
          this.isArlValidado = false;
          (row.getCell('FECHA INGRESO SUBIDA CONTRATACION') as any).fill = red;
        }
      });

      const cedulasNoEncontradas = datosMapeados
        .filter((dato) => dato['Arl'] === 'ALERTA NO ESTA EN ARL')
        .map((dato) => dato['Numero de Cedula']);

      const cedulasWorksheet = workbookOut.addWorksheet('Cédulas No Encontradas');
      cedulasWorksheet.columns = [{ header: 'Cédula', key: 'cedula', width: 20 }];
      cedulasNoEncontradas.forEach((cedula) => cedulasWorksheet.addRow({ cedula }));

      const buffer = await workbookOut.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      FileSaver.saveAs(blob, 'ReporteARL.xlsx');

      this.closeSwal();

      setTimeout(() => {
        if (this.isArlValidado && confirmarErrores) {
          Swal.fire({
            icon: 'success',
            title: 'Validación exitosa',
            text: 'Los datos de ARL coinciden con el cruce diario.',
            heightAuto: false,
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'El ARL tiene problemas',
            text: 'Se encontraron discrepancias. Revise el ReporteARL.xlsx.',
            heightAuto: false,
          });
        }
      }, 400);
    } catch {
      this.isArlValidado = false;
      this.closeSwal();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al procesar ARL. Inténtelo nuevamente.',
        confirmButtonText: 'Aceptar',
        heightAuto: false,
      });
    }
  }

  async proccssArl(files: File[]): Promise<void> {
    if (!files || files.length === 0) return;

    const file = files[0];
    const workbook = await this.readWorkbook(file);
    await this.processArl(workbook);
  }

  // ---------------------------------------------------------------------------
  // Envío a Django (FormData): metadatos + archivos (renombrados)
  // ---------------------------------------------------------------------------

  private buildReporteFormData(user: any): FormData {
    const formData = new FormData();
    const formValue = this.reporteForm.value;

    const sedeNombre = formValue.sede?.nombre ?? formValue.sede ?? '';
    formData.append('sede', sedeNombre);

    if (formValue.esDeHoy === 'true') {
      formData.append('fecha', new Date().toISOString());
    } else if (formValue.fecha instanceof Date) {
      formData.append('fecha', formValue.fecha.toISOString());
    }

    formData.append('cantidadContratosTuAlianza', (formValue.cantidadContratosTuAlianza ?? 0).toString());
    formData.append('cantidadContratosApoyoLaboral', (formValue.cantidadContratosApoyoLaboral ?? 0).toString());

    if (formValue.notas) {
      formData.append('nota', formValue.notas);
    }

    const nombreResponsable =
      user && user.datos_basicos ? `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}` : this.nombre;

    formData.append('nombre', nombreResponsable);

    const isBlocked = (name: string) => this.BLOCKED_FILES.has((name ?? '').trim().toLowerCase());
    const isPdfName = (name: string) => (name ?? '').toLowerCase().trim().endsWith('.pdf');

    // Documentos asociados al reporte
    const sstFiles = this.filesToUpload.induccionSSO ?? [];
    if (sstFiles.length > 0 && !isBlocked(sstFiles[0].name) && isPdfName(sstFiles[0].name)) {
      formData.append('sst_document', sstFiles[0]);
    }

    const cruceFiles = this.filesToUpload.cruceDiario ?? [];
    if (cruceFiles.length > 0 && !isBlocked(cruceFiles[0].name)) {
      formData.append('cruce_document', cruceFiles[0]);
    }

    // ✅ Cédulas renombradas: DOCUMENTO.pdf
    const cedulasRaw = (this.filesToUpload.cedulasEscaneadas ?? []).filter(
      (f) => f && !isBlocked(f.name) && isPdfName(f.name),
    );
    const cedPrep = this.prepareCedulasFilesForBackend(cedulasRaw);
    cedPrep.files.forEach((file) => formData.append('cedulas', file));

    // ✅ Traslados renombrados: DOCUMENTO-EPS.pdf (EPS canonical)
    const trasladosRaw = (this.filesToUpload.traslados ?? []).filter(
      (f) => f && !isBlocked(f.name) && isPdfName(f.name),
    );
    const traPrep = this.prepareTrasladosFilesForBackend(trasladosRaw);
    traPrep.files.forEach((file) => formData.append('traslados', file));

    return formData;
  }

  // ---------------------------------------------------------------------------
  // Botón ENVIAR
  // ---------------------------------------------------------------------------

  async onSubmit(): Promise<void> {
    this.closeSwal();

    const user = this.utilityService.getUser();

    const arlChecked = !!this.reporteForm.get('arl')?.value;
    const cruceChecked = !!this.reporteForm.get('cruceDiario')?.value;

    if (arlChecked && !this.isArlValidado) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Debe validar el archivo ARL antes de enviar.',
        confirmButtonText: 'Aceptar',
        heightAuto: false,
      });
      return;
    }

    if (cruceChecked && !this.isCruceValidado) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Debe validar el cruce diario antes de enviar.',
        confirmButtonText: 'Aceptar',
        heightAuto: false,
      });
      return;
    }

    if (!this.reporteForm.valid) {
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, complete el formulario correctamente.',
        confirmButtonText: 'Aceptar',
        heightAuto: false,
      });
      return;
    }

    // ✅ Validación final de nombres antes de enviar al backend + renombrado
    const isPdfName = (name: string) => (name ?? '').toLowerCase().trim().endsWith('.pdf');
    const isBlocked = (name: string) => this.BLOCKED_FILES.has((name ?? '').trim().toLowerCase());

    const cedulasChecked = !!this.reporteForm.get('cedulasEscaneadas')?.value;
    const trasladosChecked = !!this.reporteForm.get('traslados')?.value;

    const cedulasRaw = (this.filesToUpload.cedulasEscaneadas ?? []).filter(
      (f) => f && !isBlocked(f.name) && isPdfName(f.name),
    );
    const trasladosRaw = (this.filesToUpload.traslados ?? []).filter(
      (f) => f && !isBlocked(f.name) && isPdfName(f.name),
    );

    const cedPrep = cedulasChecked ? this.prepareCedulasFilesForBackend(cedulasRaw) : { files: [], errors: [] };
    const traPrep = trasladosChecked ? this.prepareTrasladosFilesForBackend(trasladosRaw) : { files: [], errors: [] };

    const nameErrors = [...cedPrep.errors, ...traPrep.errors];
    if (nameErrors.length) {
      this.erroresValidacion.data = nameErrors;
      await Swal.fire({
        icon: 'error',
        title: 'Archivos con formato inválido',
        text: 'Revisa la tabla de errores y renombra los PDFs antes de enviar.',
        confirmButtonText: 'Aceptar',
        heightAuto: false,
      });
      return;
    }

    try {
      const formData = this.buildReporteFormData(user);

      this.showLoading('Enviando reporte...', 'Por favor, espere...');

      await firstValueFrom(this.reportesService.createReporte(formData));

      this.closeSwal();

      Swal.fire({
        icon: 'success',
        title: 'Reporte enviado',
        text: 'El reporte se ha enviado correctamente.',
        confirmButtonText: 'Aceptar',
        heightAuto: false,
      }).then((result) => {
        if (result.isConfirmed) {
          this.router.navigateByUrl('/home', { skipLocationChange: true }).then(() => {
            this.router.navigate(['/reporte-contratacion']);
          });
        }
      });
    } catch {
      this.closeSwal();
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al enviar el reporte. Inténtelo nuevamente.',
        confirmButtonText: 'Aceptar',
        heightAuto: false,
      });
    }
  }

  openPreview(Type: 'cedulas' | 'traslados'): void {
    const data: any = {
      title: Type === 'cedulas' ? 'Cédulas Cargadas' : 'Traslados Cargados',
      items: Type === 'cedulas' ?
        this.cedulasPreview.map(p => ({ name: p.nombreArchivo, valid: p.esValido, error: p.error })) :
        this.trasladosPreview.map(p => ({ name: p.nombreArchivo, valid: p.esValido, error: p.error }))
    };

    /**
     * Correction:
     * CedulaPreviewItem / TrasladoPreviewItem use:
     * - nombreArchivo
     * - esValido
     */

    this.dialog.open(FilePreviewDialogComponent, {
      width: '600px',
      data: data
    });
  }

  togglePreview(key: string): void {
    if (this.previewOpenState[key] !== undefined) {
      this.previewOpenState[key] = !this.previewOpenState[key];
    }
  }
}
