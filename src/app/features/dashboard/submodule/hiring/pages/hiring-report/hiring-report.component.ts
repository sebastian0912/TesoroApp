import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy, NgZone, ApplicationRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
import * as ExcelJS from 'exceljs';
import Swal from 'sweetalert2';

// Models & Shared
import { SharedModule } from '@/app/shared/shared.module';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { CommonModule } from '@angular/common';

import { ValidationPreviewDialogComponent } from '@/app/shared/components/validation-preview-dialog/validation-preview-dialog.component';
import {
  PreviewIssue
} from 'src/app/shared/model/validation-preview';

import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { HiringService } from '../../service/hiring.service';
import { CruceValidationHelper, CruceRow } from './cruce-validation.helper';
import { ReportesService } from '../../service/reportes/reportes.service';

// Tipos definidos localmente o importados
type UploadControl = 'cedulasEscaneadas' | 'cruceDiario' | 'arl' | 'induccionSSO' | 'traslados';

interface ReportForm {
  sede: FormControl<any>;
  esDeHoy: FormControl<string>;
  fecha: FormControl<Date | null>;
  contratosHoy: FormControl<string>;

  // Archivos (Checkboxes)
  cedulasEscaneadas: FormControl<boolean>;
  cruceDiario: FormControl<boolean>;
  arl: FormControl<boolean>;
  induccionSSO: FormControl<boolean>;
  traslados: FormControl<boolean>;

  // Counts & Notes
  cantidadContratosTuAlianza: FormControl<number | null>;
  cantidadContratosApoyoLaboral: FormControl<number | null>;
  notas: FormControl<string>;
}

interface DocConfig {
  key: UploadControl;
  label: string;
  accept: string;
  multiple: boolean;
  directory: boolean;
  hint: string;
  previewType?: 'cedulas' | 'traslados';
}

@Component({
  selector: 'app-hiring-report',
  standalone: true,
  imports: [
    CommonModule,
    SharedModule,
    ReactiveFormsModule,
    MatDatepickerModule,
    MatCheckboxModule,
    MatNativeDateModule,
    MatDialogModule,
  ],
  templateUrl: './hiring-report.component.html',
  styleUrls: ['./hiring-report.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HiringReportComponent implements OnInit, OnDestroy {

  // Typed Form
  reporteForm!: FormGroup<ReportForm>;

  // Data
  sedes: any[] = [];
  nombre = '';

  // File State
  files: Partial<Record<UploadControl, File[]>> = {};
  fileNames: Partial<Record<UploadControl, string>> = {};

  // Validation Flags
  isCruceValidado = false;
  isArlValidado = false;

  // Processed Data
  datoscruced: string[][] = []; // Rows normalizadas del cruce
  arlRows: any[][] = []; // Rows leídas del ARL
  private cruceHeaderRow: string[] = []; // Headers originales del cruce

  // Errors & Previews
  erroresValidacion = new MatTableDataSource<any>([]);
  cedulasPreview: any[] = [];
  trasladosPreview: any[] = [];
  arlErrors: { cedula: string; error: string }[] = [];

  // Config
  readonly DOCS: DocConfig[] = [
    { key: 'cedulasEscaneadas', label: 'Cédulas Escaneadas', accept: '.pdf', multiple: true, directory: true, hint: 'PDFs individuales. Nombre: DOCUMENTO-Nombre.pdf o DOCUMENTO-algo.pdf', previewType: 'cedulas' },
    { key: 'cruceDiario', label: 'Cruce Diario (Excel)', accept: '.xls,.xlsx', multiple: false, directory: false, hint: 'Excel del día. Columna 3 define si es AL o TA.' },
    { key: 'arl', label: 'Archivo ARL (Excel)', accept: '.xls,.xlsx', multiple: false, directory: false, hint: 'Reporte descargado de ARL. Debe contener "DNI TRABAJADOR".' },
    { key: 'induccionSSO', label: 'Inducción SST', accept: '.pdf', multiple: false, directory: false, hint: 'Constancia de inducción grouping.' },
    { key: 'traslados', label: 'Traslados', accept: '.pdf', multiple: true, directory: true, hint: 'PDFs traslados EPS. Nombre: DOCUMENTO-EPS.pdf', previewType: 'traslados' },
  ];

  private readonly BLOCKED_FILES = new Set<string>(['thumbs.db', 'desktop.ini', '.ds_store']);
  private readonly destroy$ = new Subject<void>();

  // Worker para ARL
  private arlWorker: Worker | undefined;

  constructor(
    private readonly fb: FormBuilder,
    private readonly utilityService: UtilityServiceService,
    private readonly hiringService: HiringService,
    private readonly reportesService: ReportesService, // Inyectado
    private readonly dialog: MatDialog,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
    private readonly zone: NgZone,
    private readonly appRef: ApplicationRef
  ) {
    this.initWorker();
  }

  ngOnInit(): void {
    this.initForm();
    this.loadUser();
    this.loadSedes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.terminateWorker();
  }

  // ---------------------------------------------------------------------------
  // INIT & WORKER
  // ---------------------------------------------------------------------------

  private initWorker() {
    if (typeof Worker !== 'undefined') {
      try {
        this.arlWorker = new Worker(new URL('./arl-export.worker', import.meta.url));
        this.arlWorker.onmessage = ({ data }) => {
          if (data.success) {
            this.handleWorkerSuccess(data.fileData);
          } else {
            this.handleWorkerError(data.error);
          }
        };
      } catch (e) {
        console.warn('Worker init failed', e);
      }
    }
  }

  private terminateWorker() {
    this.arlWorker?.terminate();
  }

  private initForm() {
    this.reporteForm = this.fb.group<ReportForm>({
      sede: new FormControl(null, Validators.required),
      esDeHoy: new FormControl('false', { nonNullable: true }),
      fecha: new FormControl(null),
      contratosHoy: new FormControl('', { validators: [Validators.required], nonNullable: true }),

      cedulasEscaneadas: new FormControl(false, { nonNullable: true }),
      cruceDiario: new FormControl(false, { nonNullable: true }),
      arl: new FormControl(false, { nonNullable: true }),
      induccionSSO: new FormControl(false, { nonNullable: true }),
      traslados: new FormControl(false, { nonNullable: true }),

      cantidadContratosTuAlianza: new FormControl(null),
      cantidadContratosApoyoLaboral: new FormControl(null),
      notas: new FormControl('', { nonNullable: true }),
    });

    // Validaciones reactivas
    this.reporteForm.controls.esDeHoy.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(val => {
      if (val === 'true') {
        this.reporteForm.controls.fecha.clearValidators();
        this.reporteForm.controls.fecha.setValue(null);
      } else {
        this.reporteForm.controls.fecha.setValidators(Validators.required);
      }
      this.reporteForm.controls.fecha.updateValueAndValidity();
    });

    this.reporteForm.controls.contratosHoy.valueChanges.pipe(takeUntil(this.destroy$)).subscribe(val => {
      this.handleContratosChange(val);
      this.cdr.markForCheck();
    });
  }

  private async loadUser() {
    const user = this.utilityService.getUser();
    if (user?.datos_basicos) {
      this.nombre = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;
      this.cdr.markForCheck();
    }
  }

  private async loadSedes() {
    try {
      const data: any = await firstValueFrom(this.utilityService.traerSucursales());
      if (Array.isArray(data)) {
        this.sedes = data
          .filter(s => s.activa)
          .sort((a, b) => a.nombre.localeCompare(b.nombre));
        this.cdr.markForCheck();
      }
    } catch (e) {
      console.error('Error cargando sedes', e);
    }
  }

  // ---------------------------------------------------------------------------
  // GETTERS & UI HELPERS
  // ---------------------------------------------------------------------------

  get totalFilesLoaded(): number {
    return Object.values(this.fileNames).filter(Boolean).length;
  }

  get isFormValid(): boolean {
    return this.reporteForm.valid;
  }

  get showValidateButton(): boolean {
    return this.reporteForm.controls.contratosHoy.value === 'si';
  }

  // ---------------------------------------------------------------------------
  // FILE HANDLING
  // ---------------------------------------------------------------------------

  onCheckboxChange(checked: boolean, key: UploadControl) {
    this.reporteForm.get(key)?.setValue(checked);
    if (!checked) {
      this.clearFile(key);
    }
    this.cdr.markForCheck();
  }

  onFileSelect(event: Event, key: UploadControl) {
    const input = event.target as HTMLInputElement;
    const rawFiles = input.files ? Array.from(input.files) : [];
    input.value = ''; // Reset input

    if (!rawFiles.length) return;

    // Filter Files
    const allowed: File[] = [];
    const ignored: string[] = [];

    for (const f of rawFiles) {
      const lower = f.name.toLowerCase();
      if (this.BLOCKED_FILES.has(lower)) continue;

      const ext = lower.split('.').pop() || '';

      // Rules based on key
      const isExcel = ['xls', 'xlsx', 'csv'].includes(ext);
      const isPdf = ext === 'pdf';

      if (['cedulasEscaneadas', 'induccionSSO', 'traslados'].includes(key) && !isPdf) {
        ignored.push(f.name); continue;
      }
      if (['cruceDiario', 'arl'].includes(key) && !isExcel) {
        ignored.push(f.name); continue;
      }

      allowed.push(f);
    }

    if (ignored.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Archivos ignorados',
        text: `Algunos archivos no son válidos: ${ignored.slice(0, 3).join(', ')}...`
      });
    }

    if (allowed.length > 0) {
      // Set files
      this.files[key] = allowed;
      this.fileNames[key] = allowed.length > 1 ? `${allowed.length} archivos` : allowed[0].name;

      // Reset invalidation states
      if (['cruceDiario', 'cedulasEscaneadas', 'traslados'].includes(key)) this.isCruceValidado = false;
      if (key === 'arl') this.isArlValidado = false;

      // Direct Previews
      if (key === 'cedulasEscaneadas') this.generateCedulasPreview(allowed);
      if (key === 'traslados') this.generateTrasladosPreview(allowed);
    }

    this.cdr.markForCheck();
  }

  private clearFile(key: UploadControl) {
    delete this.files[key];
    delete this.fileNames[key];

    if (key === 'cedulasEscaneadas') this.cedulasPreview = [];
    if (key === 'traslados') this.trasladosPreview = [];

    if (['cruceDiario', 'cedulasEscaneadas', 'traslados'].includes(key)) this.isCruceValidado = false;
    if (key === 'arl') this.isArlValidado = false;
  }

  private handleContratosChange(val: string) {
    if (val !== 'si') {
      // Reset all logic
      ['cedulasEscaneadas', 'cruceDiario', 'arl', 'induccionSSO', 'traslados'].forEach(k => {
        this.reporteForm.get(k)?.setValue(false);
        this.clearFile(k as UploadControl);
      });
      this.reporteForm.patchValue({
        cantidadContratosTuAlianza: null,
        cantidadContratosApoyoLaboral: null,
        notas: ''
      });
      this.datoscruced = [];
      this.arlRows = [];
    }
  }

  // ---------------------------------------------------------------------------
  // LOGIC & PREVIEWS
  // ---------------------------------------------------------------------------

  openPreview(type: 'cedulas' | 'traslados') {
    const items = type === 'cedulas' ? this.cedulasPreview : this.trasladosPreview;
    this.checkAndShowPreviewErrors(items, type, true);
  }

  private generateCedulasPreview(files: File[]) {
    this.cedulasPreview = files.map(f => {
      const name = f.name;

      // 1. Try "DOC - NOMBRE.pdf" or "DOC-NOMBRE.pdf" or "DOC NOMBRE.pdf"
      // Capture group 1: The ID (alphanumeric + optional chars)
      // Capture group 2: The rest (Name)
      // We accept separators: space, dash, underscore
      const match = name.match(/^\s*([a-zA-Z0-9]+)\s*[-_\s]\s*(.+?)\.pdf$/i);

      let doc = '';
      if (match) {
        doc = match[1];
      } else {
        // 2. Fallback: Check if file is just "DOC.pdf"
        const simpleMatch = name.match(/^\s*([a-zA-Z0-9]+)\s*\.pdf$/i);
        if (simpleMatch) {
          doc = simpleMatch[1];
        }
      }

      // 3. Validate extracted doc
      if (doc) {
        // Normalize: remove spaces inside if it starts with X
        const normalized = this.normalizeIdentity(doc);
        const isValidDoc = /^(\d+|X[a-zA-Z0-9]+)$/i.test(normalized);

        return {
          nombreArchivo: name,
          documento: normalized, // Important: pass normalized doc to preview/validation
          valido: isValidDoc,
          error: isValidDoc ? null : 'Documento inválido (Solo números o X...)'
        };
      }

      return { nombreArchivo: name, valido: false, error: 'Formato inválido. Use CEDULA-NOMBRE.pdf' };
    });
  }

  private generateTrasladosPreview(files: File[]) {
    this.trasladosPreview = files.map(f => {
      const name = f.name;
      if (!name.toLowerCase().endsWith('.pdf')) return { nombreArchivo: name, valido: false, error: 'No PDF' };
      const parts = name.slice(0, -4).split('-');
      if (parts.length < 2) return { nombreArchivo: name, valido: false, error: 'Falta guión (-)' };
      const doc = parts[0].trim();
      const startEps = parts.slice(1).join('-').trim(); // Raw EPS part

      if (!/^[0-9xX]+$/.test(doc)) return { nombreArchivo: name, valido: false, error: 'Doc inválido' };

      // EPS Check
      const epsCanonical = this.resolveEps(startEps);
      return {
        nombreArchivo: name, documento: doc, eps: epsCanonical || startEps, valido: !!epsCanonical,
        error: !!epsCanonical ? null : 'EPS Desconocida. Use SALUD TOTAL o NUEVA EPS'
      };
    });
  }

  private resolveEps(raw: string): string | null {
    const normalized = raw.toLowerCase().replace(/[^a-z]/g, '');
    if (['saludtotal', 'salud total'].includes(normalized)) return 'SALUDTOTAL';
    if (['nuevaeps', 'nueva eps'].includes(normalized)) return 'NUEVAEPS';
    return null;
  }

  private checkAndShowPreviewErrors(items: any[], type: string, forceShow = false) {
    const invalid = items.filter(i => !i.valido);
    if (invalid.length > 0 || forceShow) {
      const html = invalid.length
        ? `<ul style="text-align:left; max-height:300px; overflow:auto;">${invalid.map(i => `<li><b>${i.nombreArchivo}</b>: ${i.error}</li>`).join('')}</ul>`
        : '<p class="text-success">Todos los archivos parecen correctos.</p>';

      Swal.fire({
        title: `${type === 'cedulas' ? 'Cédulas' : 'Traslados'}`,
        html,
        icon: invalid.length ? 'error' : 'success'
      });
    }
  }

  // ---------------------------------------------------------------------------
  // MAIN ACTION: VALIDAR TODO
  // ---------------------------------------------------------------------------

  public isValidatingAll = false;

  async onSubmit() {
    if (this.reporteForm.invalid) return;

    // Check validations
    const checks = this.reporteForm.getRawValue();
    if (checks.contratosHoy === 'si') {
      if (checks.cruceDiario && !this.isCruceValidado) {
        Swal.fire('Falta Validar', 'Debe validar el Cruce Diario antes de enviar.', 'warning');
        return;
      }
      if (checks.arl && this.arlErrors.length > 0) {
        Swal.fire('Errores ARL', `Hay ${this.arlErrors.length} error(es) en la validación ARL. Revise la tabla de errores.`, 'error');
        return;
      }
      if (checks.arl && !this.isArlValidado) {
        Swal.fire('Falta ARL', 'Debe procesar el archivo ARL antes de enviar. (Validar Todo)', 'warning');
        return;
      }
    }

    Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });

    try {
      const { payload, files } = this.buildReporteRequest();
      await firstValueFrom(this.reportesService.createReporte(payload, files));

      this.closeSwal();
      Swal.fire('Enviado', 'Reporte enviado correctamente', 'success').then(() => {
        this.router.navigate(['/dashboard/hiring/hiring-report']);
      });

    } catch (e) {
      this.closeSwal();
      console.error(e);
      Swal.fire('Error', 'No se pudo enviar el reporte', 'error');
    }
  }

  async validarTodo() {
    if (this.isValidatingAll) return;

    if (!this.files.cruceDiario?.length) {
      Swal.fire('Atención', 'Seleccione el archivo de Cruce Diario', 'warning');
      return;
    }

    // Explicitly run inside zone for state update
    this.zone.run(() => {
      this.isValidatingAll = true;
      this.cdr.detectChanges();
    });

    this.showLoading('Validando...', 'Procesando Cruce Diario y ARL...');

    try {
      // 1. Validar Cruce
      const cruceOk = await this.processCruce();

      if (!cruceOk) {
        // processCruce returns false if cancelled OR if critical errors remain
        return;
      }

      // 2. Validar ARL (si aplica)
      if (this.reporteForm.controls.arl.value && this.files.arl?.length) {
        await this.processArl(this.files.arl[0]);
      }

      this.closeSwal();
      // Success Swal removed per request

    } catch (e) {
      this.closeSwal();
      console.error(e);
      Swal.fire('Error', 'Ocurrió un error inesperado al validar.', 'error');
    } finally {
      // Ensure UI update happens in next tick to avoid conflicts with Swal closing
      this.zone.run(() => {
        setTimeout(() => {
          this.isValidatingAll = false;
          this.cdr.markForCheck(); // Mark for check
          this.cdr.detectChanges(); // Force check
        }, 100);
      });
    }
  }

  // ---------------------------------------------------------------------------
  // CRUCE LOGIC
  // ---------------------------------------------------------------------------

  private async processCruce(): Promise<boolean> {
    const file = this.files.cruceDiario![0];
    const wb = await this.readExcel(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawJson = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '-', raw: true });

    if (rawJson.length < 2) throw new Error('Excel vacío o sin datos');

    const headerRow = rawJson[0] as string[]; // Fila 0 de headers
    this.cruceHeaderRow = headerRow; // Guardar para uso posterior (ARL report)
    const dataRows = rawJson.slice(1) as any[][];

    // 1. Normalizar filas
    this.datoscruced = dataRows.map(row => this.normalizeRow(row));

    // 2. COUNT AL/TA (Requirement)
    let al = 0, ta = 0;
    this.datoscruced.forEach(r => {
      const tem = (r[2] || '').toUpperCase().trim(); // Col 2 = TEM
      if (tem === 'AL') al++;
      else if (tem === 'TA') ta++;
    });
    this.reporteForm.patchValue({ cantidadContratosApoyoLaboral: al, cantidadContratosTuAlianza: ta });

    // 3. Pre-Validation (Frontend)
    const cruceRows = CruceValidationHelper.parseRows(this.datoscruced, headerRow);
    const uploadedRef = {
      cedulas: this.getDocList('cedulasEscaneadas'),
      traslados: this.getDocList('traslados')
    };
    const schema = CruceValidationHelper.getSchema(headerRow, uploadedRef);

    const issues = [
      ...(schema.validateItem ? cruceRows.flatMap(r => schema.validateItem!(r)) : []),
      ...(schema.validateAll ? schema.validateAll(cruceRows) : [])
    ].filter(i => i.severity === 'error');

    // 4. Dialog if local issues
    if (issues.length > 0) {
      this.closeSwal();
      const res = await this.openCruceDialog(cruceRows, schema, uploadedRef, [], 'pre');
      if (!res) return false; // Cancelled
      this.datoscruced = res;
    }

    // 5. Backend Validation
    const backendErrors = await this.validateBatchesBackend(this.datoscruced);
    this.erroresValidacion.data = backendErrors;

    const blockingErrors = backendErrors.filter(e => {
      let rawMsg = e.mensaje || e.message || (Array.isArray(e.errores) ? e.errores.join('. ') : '');
      if (!rawMsg) rawMsg = JSON.stringify(e);
      let fieldVal = e.element || 'general';
      if (rawMsg.toLowerCase().includes('correo') || rawMsg.toLowerCase().includes('email')) fieldVal = 'email';
      return !this.isBackendWarning(rawMsg, fieldVal);
    });

    if (backendErrors.length > 0) {
      this.closeSwal();

      // Snapshot for comparison
      const originalData = this.datoscruced;

      const res = await this.openCruceDialog(
        CruceValidationHelper.parseRows(this.datoscruced, headerRow),
        schema, uploadedRef, backendErrors, 'post'
      );
      if (!res) return false; // Cancelled

      // Local Comparison Function (Robust string[][])
      const hasChanged = (d1: string[][], d2: string[][]): boolean => {
        if (d1.length !== d2.length) return true;
        for (let i = 0; i < d1.length; i++) {
          if (d1[i].length !== d2[i].length) return true;
          for (let j = 0; j < d1[i].length; j++) {
            if (String(d1[i][j]) !== String(d2[i][j])) return true;
          }
        }
        return false;
      };

      const changed = hasChanged(originalData, res);

      if (changed) {
        // Data changed, MUST re-validate
        this.showLoading('Revalidando...', 'Verificando correcciones con el servidor...');
        this.datoscruced = res;
        const reErrors = await this.validateBatchesBackend(this.datoscruced);

        // Check new blocking errors
        const newBlocking = reErrors.filter(e => {
          let rawMsg = e.mensaje || e.message || (Array.isArray(e.errores) ? e.errores.join('. ') : '');
          if (!rawMsg) rawMsg = JSON.stringify(e);
          let fieldVal = e.element || 'general';
          if (rawMsg.toLowerCase().includes('correo') || rawMsg.toLowerCase().includes('email')) fieldVal = 'email';
          return !this.isBackendWarning(rawMsg, fieldVal);
        });

        if (newBlocking.length > 0) {
          await this.saveErrorsToBackend(newBlocking);
          this.erroresValidacion.data = newBlocking;
          return false;
        }
      } else {
        // Data unchanged
        // Should we assume warnings allow continuation? 
        // YES, if blockingErrors was 0, it means we only had warnings initially.
        // If blockingErrors > 0, we still have blocking errors and they weren't fixed (since data didn't change).
        if (blockingErrors.length > 0) {
          await this.saveErrorsToBackend(blockingErrors);
          // Ensure we show the errors even if we don't re-fetch
          this.erroresValidacion.data = blockingErrors;
          return false;
        }
        // If blockingErrors == 0, we proceed directly.
      }
    }

    this.isCruceValidado = true;
    return true;
  }

  private normalizeRow(row: any[]): string[] {
    const safe = row.map(c => (c === null || c === undefined) ? '-' : String(c).trim());
    while (safe.length < 56) safe.push('-');

    // Sanitize Critical Columns
    // Col 1 = Cedula, Col 11 = NIT (Indices 1 and 11)
    if (safe[1]) safe[1] = this.normalizeIdentity(safe[1]);
    if (safe[11]) safe[11] = this.normalizeIdentity(safe[11]);

    // Normalize Dates (Col 8, 16, 24, 44 [AnioFin can be date])
    [8, 16, 24, 44].forEach(idx => {
      if (safe[idx] && safe[idx] !== '-' && safe[idx].length >= 4) {
        safe[idx] = this.tryNormalizeDate(safe[idx]);
      }
    });

    return safe;
  }

  /* sanitizeIdentity - removed, use normalizeIdentity */


  private tryNormalizeDate(val: string): string {
    // 1. Handle Excel Serial Numbers (e.g. "44567" or "44567.123")
    if (/^\d+(\.\d+)?$/.test(val)) {
      const serial = Number(val);
      if (serial > 20000 && serial < 80000) {
        // Excel epoch is Jan 1, 1900, but falsely treats 1900 as a leap year.
        // Therefore, dates after Feb 28, 1900 can be treated as if the epoch was Dec 30, 1899.
        // We use UTC to prevent timezone offsets from pushing midnight backwards into the previous day.
        const ms = Date.UTC(1899, 11, 30) + (serial * 24 * 60 * 60 * 1000);
        const d = new Date(ms);
        if (!isNaN(d.getTime())) {
          return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
        }
      }
    }

    // 2. If already valid DD/MM/YYYY (4 digits year)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) return val;

    // 3. Robust Parse for DD/MM/YY or DD-MM-YYYY
    const parts = val.split(/[/-]/);
    if (parts.length === 3) {
      // Assume DD/MM/YYYY for LATAM
      let d = parseInt(parts[0], 10);
      let m = parseInt(parts[1], 10);
      let y = parseInt(parts[2], 10);

      // Validate assumption: if month > 12 and day <= 12, swap (US format detection)
      if (m > 12 && d <= 12) {
        const temp = d;
        d = m;
        m = temp;
      }

      // Handle 2-digit years
      if (y < 100) {
        // Pivot logic:
        // If year is less than 30, assume 20xx (2000-2029)
        // If year is 30 or more, assume 19xx (1930-1999)
        // This covers birthdates (1994) and modern dates (2025)
        y += (y < 30 ? 2000 : 1900);
      }

      // Basic validity check
      if (d > 0 && d <= 31 && m > 0 && m <= 12 && y > 1900) {
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      }
    }
    return val;
  }

  private async openCruceDialog(items: CruceRow[], schema: any, uploadRef: any, externalErrors: any[], phase: 'pre' | 'post'): Promise<string[][] | null> {
    const ref = this.dialog.open(ValidationPreviewDialogComponent, {
      width: '95vw', maxWidth: '95vw', height: '90vh', disableClose: true,
      data: {
        schema, items, phase,
        externalIssues: this.mapExternalIssues(externalErrors),
        title: phase === 'pre' ? 'Validación Preliminar' : 'Errores del Backend',
        subtitle: 'Revise los datos antes de continuar.',
        uploadHandler: async (f: File) => {
          // Simple handler for adding file to existing list
          const cedula = this.normalizeIdentity(f.name.split('.')[0]);
          // Add to memory if not exists... simplified for dialog interaction
        }
      }
    });


    const res = await firstValueFrom(ref.afterClosed());
    if (!res?.accepted) return null;

    // Use raw array if available to prevent field reordering or loss
    return res.items.map((i: any) => Array.isArray(i.raw) ? i.raw : (Array.isArray(i) ? i : []));
  }

  private async validateBatchesBackend(rows: string[][]): Promise<any[]> {
    const BATCH = 1500;
    const errors: any[] = [];
    const chunks = Math.ceil(rows.length / BATCH);

    for (let i = 0; i < chunks; i++) {
      this.updateSwalProgress(`Validando lote ${i + 1}/${chunks}`, i + 1, chunks);
      const chunk = rows.slice(i * BATCH, (i + 1) * BATCH);
      // Fix: Service method returns Promise<any>, removed firstValueFrom
      const res: any = await this.hiringService.subirContratacionValidar(chunk);
      if (res?.status === 'error' && Array.isArray(res.errores)) {
        errors.push(...res.errores);
      }
    }
    return errors;
  }

  private async saveErrorsToBackend(errors: any[]) {
    try {
      const payload = { errores: errors, responsable: this.nombre, tipo: 'Documento de Contratación' };
      // Fix: Service method returns Promise<any>, removed firstValueFrom
      await this.hiringService.enviarErroresValidacion(payload);
      Swal.fire('Error', 'Aún hay errores tras corregir. Se han guardado los reportes.', 'error');
    } catch {
      Swal.fire('Error', 'Error al guardar los errores.', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // ARL PROCESSING (WORKER)
  // ---------------------------------------------------------------------------

  private async processArl(file: File) {
    const wb = await this.readExcel(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: true });

    if (data.length < 2) throw new Error('ARL vacío');

    const headers = data[0].map(h => String(h).toUpperCase().trim());
    const idxDni = headers.findIndex(h => h.includes('DNI') && h.includes('TRABAJADOR'));
    const idxVig = headers.findIndex(h => h.includes('INICIO') && h.includes('VIGENCIA'));

    if (idxDni === -1 || idxVig === -1) {
      Swal.fire('Error ARL', 'No se encuentran columnas DNI TRABAJADOR o INICIO VIGENCIA', 'error');
      this.isArlValidado = false;
      return;
    }

    // Store dynamic indices in class (requires defining them)
    // For now we will pass them to download function indirectly or just Recalculate/Store.
    // Let's store them in class scope to be safe, or just rely on finding them again/cleaning now.

    // SANITIZE DNI COLUMN (User Requirement: Remove special chars from col 11)
    // We use dynamic idxDni found.
    const rawRows = data.slice(1);
    this.arlRows = rawRows.map(row => {
      const val = row[idxDni];
      if (val) {
        // Remove all non-alphanumeric
        const clean = String(val).replace(/[^a-zA-Z0-9]/g, '');
        row[idxDni] = clean;
      }
      return row;
    });

    // Save indices for later use
    this.arlIndices = { dni: idxDni, vig: idxVig };

    this.isArlValidado = true;

    // Recolectar errores ARL inmediatamente para mostrar en la UI
    this.collectArlErrors();
    this.cdr.markForCheck();
  }

  private collectArlErrors() {
    this.arlErrors = [];
    if (!this.datoscruced.length || !this.arlRows.length) return;

    const { dni, vig } = this.arlIndices;

    // Indexar ARL por cédula
    const arlMap = new Map<string, any[]>();
    this.arlRows.forEach(row => {
      const cedula = this.normalizeIdentity(row[dni]);
      if (cedula) arlMap.set(cedula, row);
    });

    // Comparar cada fila del cruce contra ARL
    this.datoscruced.forEach(cruceRow => {
      const cedula = this.normalizeIdentity(cruceRow[1]);
      const fechaIngreso = cruceRow[8];
      const arlRow = arlMap.get(cedula);

      if (!arlRow) {
        this.arlErrors.push({ cedula, error: 'No existe en ARL' });
      } else {
        // Comparar fechas
        const dCruce = CruceValidationHelper.parseDate(fechaIngreso);
        let dArl: Date | null = null;
        const rawFechaArl = arlRow[vig];
        const strArl = String(rawFechaArl || '').trim();

        if (strArl.includes('/')) {
          dArl = CruceValidationHelper.parseDate(strArl);
        } else if (strArl.includes('-')) {
          const parts = strArl.split('-');
          if (parts[0].length === 4) {
            dArl = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          } else {
            dArl = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          }
        } else if (typeof rawFechaArl === 'number') {
          const ms = Date.UTC(1899, 11, 30) + (rawFechaArl * 24 * 60 * 60 * 1000);
          const d = new Date(ms);
          // CruceValidationHelper.parseDate returns local midnight Date(Y, M, D).
          // We must match it exactly, so we build a local midnight Date from the UTC Y/M/D.
          if (!isNaN(d.getTime())) {
            dArl = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          }
        }

        const fmtArl = dArl && !isNaN(dArl.getTime())
          ? `${String(dArl.getDate()).padStart(2, '0')}/${String(dArl.getMonth() + 1).padStart(2, '0')}/${dArl.getFullYear()}`
          : strArl;

        if (!dCruce || !dArl || isNaN(dArl.getTime()) || dCruce.getTime() !== dArl.getTime()) {
          this.arlErrors.push({ cedula, error: `Fecha de ingreso (${fechaIngreso}) diferente a fecha ARL (${fmtArl})` });
        }
      }
    });
  }

  // Helper state for ARL indices
  private arlIndices = { dni: 11, vig: 8 };

  downloadArlReport() {
    if (!this.datoscruced.length || !this.arlRows.length) return;

    const headerRow = this.cruceHeaderRow.length > 0
      ? this.cruceHeaderRow
      : CruceValidationHelper.getSchema([], undefined).columns.map(c => c.header);

    const errorsMap: Record<string, string[]> = {};
    this.erroresValidacion.data.forEach(e => {
      const id = String(e.registro || '0');
      if (!errorsMap[id]) errorsMap[id] = [];
      errorsMap[id].push(e.mensaje || e.message);
    });

    const { dni, vig } = this.arlIndices;

    const workerData = {
      cruceRows: this.datoscruced,
      arlRows: this.arlRows,
      headerRowCruce: headerRow,
      indices: { dniTrabajador: dni, inicioVigencia: vig },
      errorsMap
    };

    if (this.arlWorker) {
      // Worker disponible (browser estándar)
      this.showLoading('Generando Excel...', 'El worker está procesando el reporte ARL...');
      this.arlWorker.postMessage(workerData);
    } else {
      // Fallback inline (Electron o entornos sin soporte de Worker)
      this.showLoading('Generando Excel...', 'Procesando el reporte ARL...');
      setTimeout(() => {
        try {
          this.generateArlInline(workerData);
        } catch (e) {
          this.closeSwal();
          console.error(e);
          Swal.fire('Error', 'Falló la generación del Excel ARL: ' + e, 'error');
        }
      }, 100);
    }
  }

  private generateArlInline(data: any) {
    const { cruceRows, arlRows, headerRowCruce, indices, errorsMap } = data;

    // Indexar ARL
    const arlMap = new Map<string, any[]>();
    arlRows.forEach((row: any[]) => {
      const cedula = this.normalizeIdentity(row[indices.dniTrabajador]);
      if (cedula) arlMap.set(cedula, row);
    });

    // Headers de salida
    const outputHeaders = ['Numero de Cedula', 'Arl', 'ARL_FECHAS', 'FECHA EN ARL', 'FECHA INGRESO SUBIDA CONTRATACION', 'Errores', ...headerRowCruce];
    const outputData: any[][] = [outputHeaders];

    cruceRows.forEach((cruceRow: string[]) => {
      const cedulaCruce = this.normalizeIdentity(cruceRow[1]);
      const fechaIngresoCruce = cruceRow[8];
      const arlRow = arlMap.get(cedulaCruce);

      let estadoArl = 'NO', estadoFechas = 'NO', fechaEnArl = 'SIN DATA';

      if (arlRow) {
        estadoArl = 'SI';
        const rawFechaArl = arlRow[indices.inicioVigencia];
        const dCruce = CruceValidationHelper.parseDate(fechaIngresoCruce);
        let dArl: Date | null = null;

        const strArl = String(rawFechaArl || '').trim();
        if (strArl.includes('/')) {
          dArl = CruceValidationHelper.parseDate(strArl);
        } else if (typeof rawFechaArl === 'number') {
          const ms = Date.UTC(1899, 11, 30) + (rawFechaArl * 24 * 60 * 60 * 1000);
          const d = new Date(ms);
          if (!isNaN(d.getTime())) {
            dArl = new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
          }
        } else if (strArl.includes('-')) {
          const parts = strArl.split('-');
          if (parts[0].length === 4) {
            // YYYY-MM-DD
            dArl = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          } else {
            // DD-MM-YYYY
            dArl = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
          }
        }

        if (dArl && !isNaN(dArl.getTime())) {
          const dd = String(dArl.getDate()).padStart(2, '0');
          const mm = String(dArl.getMonth() + 1).padStart(2, '0');
          fechaEnArl = `${dd}/${mm}/${dArl.getFullYear()}`;
        } else {
          fechaEnArl = strArl || 'SIN DATA';
        }

        if (dCruce && dArl && !isNaN(dArl.getTime()) && dCruce.getTime() === dArl.getTime()) {
          estadoFechas = 'SI';
        }
      }

      const erroresPrevios = errorsMap[cedulaCruce] ? errorsMap[cedulaCruce].join('; ') : '';
      outputData.push([cedulaCruce, estadoArl, estadoFechas, fechaEnArl, fechaIngresoCruce, erroresPrevios, ...cruceRow]);
    });

    // Recolectar errores ARL para mostrar en la UI
    this.arlErrors = [];
    for (let i = 1; i < outputData.length; i++) {
      const row = outputData[i];
      const cedula = row[0];
      const arl = row[1];
      const arlFechas = row[2];
      if (arl === 'NO') {
        this.arlErrors.push({ cedula, error: 'No existe en ARL' });
      } else if (arlFechas === 'NO') {
        this.arlErrors.push({ cedula, error: `Fecha de ingreso (${row[4]}) diferente a fecha ARL (${row[3]})` });
      }
    }

    // Generar Excel con ExcelJS (soporte de estilos)
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Reporte ARL');

    // Agregar filas
    outputData.forEach((row, rowIdx) => {
      const excelRow = ws.addRow(row);
      if (rowIdx === 0) {
        // Header styling
        excelRow.eachCell(cell => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E1F2' } };
        });
      } else {
        // Columna B (Arl) = col 2, Columna C (ARL_FECHAS) = col 3
        const cellArl = excelRow.getCell(2);
        const cellFechas = excelRow.getCell(3);

        const redFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
        const whiteFont: Partial<ExcelJS.Font> = { color: { argb: 'FFFFFFFF' }, bold: true };

        if (cellArl.value === 'NO') {
          cellArl.fill = redFill;
          cellArl.font = whiteFont;
        }
        if (cellFechas.value === 'NO') {
          cellFechas.fill = redFill;
          cellFechas.font = whiteFont;
        }
      }
    });

    // Anchos de columna
    ws.getColumn(1).width = 18;  // Cedula
    ws.getColumn(2).width = 8;   // ARL
    ws.getColumn(3).width = 14;  // ARL_FECHAS
    ws.getColumn(4).width = 18;  // FECHA EN ARL
    ws.getColumn(5).width = 18;  // FECHA INGRESO
    ws.getColumn(6).width = 45;  // Errores

    // Escribir archivo
    wb.xlsx.writeBuffer().then(buffer => {
      this.handleWorkerSuccess(buffer);
      this.cdr.markForCheck();
    });
  }

  private handleWorkerSuccess(fileData: any) {
    this.closeSwal();
    const blob = new Blob([fileData], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    FileSaver.saveAs(blob, `Reporte_ARL_${new Date().getTime()}.xlsx`);
    Swal.fire('Éxito', 'Reporte ARL descargado', 'success');
  }

  private handleWorkerError(err: string) {
    this.closeSwal();
    Swal.fire('Error Worker', 'Falló la generación del excel: ' + err, 'error');
  }

  // ---------------------------------------------------------------------------
  // UTILS
  // ---------------------------------------------------------------------------

  private async readExcel(file: File): Promise<XLSX.WorkBook> {
    const buffer = await file.arrayBuffer();
    return XLSX.read(buffer, { type: 'array' });
  }

  private showLoading(title: string, text: string) {
    Swal.fire({
      title, text, icon: 'info', allowOutsideClick: false, didOpen: () => Swal.showLoading()
    });
  }

  private updateSwalProgress(msg: string, cur: number, total: number) {
    if (Swal.isVisible()) {
      const content = Swal.getHtmlContainer();
      if (content) content.textContent = `${msg} (${Math.round(cur / total * 100)}%)`;
    }
  }

  private closeSwal() {
    Swal.close();
  }

  private normalizeIdentity(val: any): string {
    if (!val) return '';
    const s = String(val).trim().toUpperCase();
    if (s.startsWith('X')) {
      // Remove spaces and dots for special IDs
      return s.replace(/\./g, '').replace(/\s/g, '');
    }
    // Only digits for normal IDs
    return s.replace(/[^\d]/g, '');
  }

  /* 
   * DEPRECATED: merged into normalizeIdentity
   * private normalizeCedula...
   * private sanitizeIdentity...
   */

  private getDocList(key: UploadControl): string[] {
    const files = this.files[key] || [];
    return files.map(f => {
      // Improved regex to capture the leading ID part
      const m = f.name.match(/^\s*([a-zA-Z0-9]+)/);
      return this.normalizeIdentity(m ? m[1] : '');
    }).filter(Boolean);
  }

  // ... checkAndShowPreviewErrors ...

  private isBackendWarning(msg: string, field?: string): boolean {
    if (!msg) return false;
    const lower = msg.toLowerCase();

    // Palabras clave para duplicados
    const duplicateKeywords = [
      'ya está en uso', 'ya esta en uso', 'ya se encuentra en uso',
      'ya existe', 'ya se encuentra registrado',
      'duplicad', 'duplicate', 'unique', 'constraint',
      'already exists', 'already in use'
    ];

    // Palabras clave para advertencias generales
    const warningKeywords = [
      'opcional', 'recomendado', 'sugerencia',
      'advertencia', 'warning', 'informativo'
    ];

    return duplicateKeywords.some(kw => lower.includes(kw))
      || warningKeywords.some(kw => lower.includes(kw));
  }

  private mapExternalIssues(backendErrors: any[]): PreviewIssue[] {
    return backendErrors.map((e, idx) => {
      // Backend "registro" is 1-based index
      let r = String(e.registro || '0');

      if (!r.startsWith('row-')) {
        const val = parseInt(r, 10);
        if (!isNaN(val) && val > 0) {
          r = `row-${val - 1}`;
        } else {
          r = `row-${r}`;
        }
      }

      // 1. Extract raw message
      let rawMsg = e.mensaje || e.message;
      if (!rawMsg && Array.isArray(e.errores)) {
        rawMsg = e.errores.join('. ');
      }
      if (!rawMsg) rawMsg = JSON.stringify(e);

      // 2. Clean Message & Infer Field
      let finalMsg = rawMsg;
      let fieldVal = e.element || 'general';

      const lowerMsg = rawMsg.toLowerCase();
      if (lowerMsg.includes('correo') || lowerMsg.includes('email')) {
        fieldVal = 'email';
        finalMsg = rawMsg.replace(/El campo \(Correo electrónico\) contiene '[^']+',\s*/i, '');
      }

      const isWarn = this.isBackendWarning(finalMsg, fieldVal);

      return {
        id: `ext-${idx}`,
        itemId: r,
        severity: isWarn ? 'warn' : 'error',
        message: finalMsg,
        field: fieldVal
      };
    });
  }

  private buildReporteRequest() {
    const val = this.reporteForm.getRawValue();

    // Mapping files
    const sst = this.files.induccionSSO?.[0] || null;
    const cruce = this.files.cruceDiario?.[0] || null;
    const cedulas = this.files.cedulasEscaneadas || [];
    const traslados = this.files.traslados || [];

    // Mapping Payload
    const payload = {
      nombre: this.nombre || 'Reporte',
      sede: val.sede?.nombre || null,
      fecha: (val.esDeHoy === 'true' || !val.fecha)
        ? new Date().toISOString()
        : val.fecha.toISOString(),
      cantidadContratosTuAlianza: val.cantidadContratosTuAlianza ?? null,
      cantidadContratosApoyoLaboral: val.cantidadContratosApoyoLaboral ?? null,
      nota: val.notas?.trim() || null
    };

    return {
      payload,
      files: {
        sst_document: sst,
        cruce_document: cruce,
        cedulas: cedulas.length ? cedulas : undefined,
        traslados: traslados.length ? traslados : undefined
      }
    };
  }
}
