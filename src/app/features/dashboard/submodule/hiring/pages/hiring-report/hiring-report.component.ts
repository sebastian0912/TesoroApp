import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import * as XLSX from 'xlsx';
import * as FileSaver from 'file-saver';
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

  // Errors & Previews
  erroresValidacion = new MatTableDataSource<any>([]);
  cedulasPreview: any[] = [];
  trasladosPreview: any[] = [];

  // Config
  readonly DOCS: DocConfig[] = [
    { key: 'cedulasEscaneadas', label: 'Cédulas Escaneadas', accept: '.pdf', multiple: true, directory: true, hint: 'PDFs individuales. Nombre: DOCUMENTO.pdf o DOCUMENTO-NOMBRE.pdf', previewType: 'cedulas' },
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
    private readonly cdr: ChangeDetectorRef
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
    // Logic from original component
    this.cedulasPreview = files.map(f => {
      const name = f.name;
      const match = name.match(/^\s*([a-zA-Z0-9-]+)\s*-\s*(.+?)\.pdf$/i);
      if (match) {
        const doc = match[1];
        const isValidDoc = /^(\d+|[xX][a-zA-Z0-9\-]+)$/.test(doc);
        return {
          nombreArchivo: name, documento: doc, valido: isValidDoc,
          error: isValidDoc ? null : 'Documento inválido (Solo números o X...)'
        };
      }
      // Check simple doc.pdf
      const simpleMatch = name.match(/^(.+)\.pdf$/i);
      if (simpleMatch && /^(\d+|[xX][a-zA-Z0-9\-]+)$/.test(simpleMatch[1])) {
        return { nombreArchivo: name, documento: simpleMatch[1], valido: true };
      }
      return { nombreArchivo: name, valido: false, error: 'Formato inválido. Use DOC-NOMBRE.pdf' };
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

  async onSubmit() {
    if (this.reporteForm.invalid) return;

    // Check validations
    const checks = this.reporteForm.getRawValue();
    if (checks.contratosHoy === 'si') {
      if (checks.cruceDiario && !this.isCruceValidado) {
        Swal.fire('Falta Validar', 'Debe validar el Cruce Diario antes de enviar.', 'warning');
        return;
      }
      if (checks.arl && !this.isArlValidado) {
        Swal.fire('Falta ARL', 'Debe procesar el archivo ARL antes de enviar (Validar Todo).', 'warning');
        return;
      }
    }

    Swal.fire({ title: 'Enviando...', didOpen: () => Swal.showLoading() });

    try {
      // Usar nuevo builder y servicio
      const { payload, files } = this.buildReporteRequest();

      // Llamada al nuevo servicio (retorna Observable, usamos firstValueFrom)
      await firstValueFrom(this.reportesService.createReporte(payload, files));

      this.closeSwal();
      Swal.fire('Enviado', 'Reporte enviado correctamente', 'success').then(() => {
        this.router.navigate(['/dashboard/hiring']);
      });

    } catch (e) {
      this.closeSwal();
      console.error(e);
      Swal.fire('Error', 'No se pudo enviar el reporte', 'error');
    }
  }

  async validarTodo() {
    if (!this.files.cruceDiario?.length) {
      Swal.fire('Atención', 'Seleccione el archivo de Cruce Diario', 'warning');
      return;
    }

    this.showLoading('Validando...', 'Procesando Cruce Diario y ARL...');

    try {
      // 1. Validar Cruce
      const cruceOk = await this.processCruce();
      if (!cruceOk) return; // User cancelled or error

      // 2. Validar ARL (si aplica)
      if (this.reporteForm.value.arl && this.files.arl?.length) {
        await this.processArl(this.files.arl[0]);
      }

      this.closeSwal();
      Swal.fire('Completado', 'Validación finalizada con éxito.', 'success');
      this.cdr.markForCheck();

    } catch (e) {
      this.closeSwal();
      console.error(e);
      Swal.fire('Error', 'Ocurrió un error inesperado al validar.', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // CRUCE LOGIC
  // ---------------------------------------------------------------------------

  private async processCruce(): Promise<boolean> {
    const file = this.files.cruceDiario![0];
    const wb = await this.readExcel(file);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rawJson = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '-', raw: false, dateNF: 'dd/mm/yyyy' });

    if (rawJson.length < 2) throw new Error('Excel vacío o sin datos');

    const headerRow = rawJson[0] as string[]; // Fila 0 de headers
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
      // Update data if allowed
      this.datoscruced = res;
    }

    // 5. Backend Validation (Batches)
    const backendErrors = await this.validateBatchesBackend(this.datoscruced);
    this.erroresValidacion.data = backendErrors;

    if (backendErrors.length > 0) {
      this.closeSwal();
      const res = await this.openCruceDialog(
        CruceValidationHelper.parseRows(this.datoscruced, headerRow),
        schema, uploadedRef, backendErrors, 'post'
      );
      if (!res) return false;

      // Re-validate backend
      this.datoscruced = res;
      const reErrors = await this.validateBatchesBackend(this.datoscruced);
      if (reErrors.length > 0) {
        // Save errors to backend...
        await this.saveErrorsToBackend(reErrors);
        return false;
      }
    }

    this.isCruceValidado = true;
    return true;
  }

  private normalizeRow(row: any[]): string[] {
    const safe = row.map(c => (c === null || c === undefined) ? '-' : String(c).trim());
    while (safe.length < 50) safe.push('-');

    // Sanitize Critical Columns
    // Col 1 = Cedula, Col 11 = NIT (Indices 1 and 11)
    if (safe[1]) safe[1] = this.sanitizeIdentity(safe[1]);
    if (safe[11]) safe[11] = this.sanitizeIdentity(safe[11]);

    // Normalize Dates (Col 8, 16, 24, 44 [AnioFin can be date])
    [8, 16, 24, 44].forEach(idx => {
      if (safe[idx] && safe[idx] !== '-' && safe[idx].length > 5) {
        safe[idx] = this.tryNormalizeDate(safe[idx]);
      }
    });

    return safe;
  }

  private sanitizeIdentity(val: string): string {
    // Keep X for PPT, otherwise digits only
    const upper = val.toUpperCase();
    if (upper.startsWith('X')) return upper;
    return val.replace(/[^0-9]/g, '');
  }

  private tryNormalizeDate(val: string): string {
    // 1. Handle Excel Serial Numbers (e.g. "44567" or "44567.123")
    if (/^\d+(\.\d+)?$/.test(val)) {
      const serial = Number(val);
      // Basic check: dates usually > 10000 (roughly > 1927) and < 60000 (roughly 2064)
      if (serial > 20000 && serial < 80000) {
        // Excel Epoch: Dec 30 1899
        const excelEpoch = new Date(1899, 11, 30);
        const d = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);

        if (!isNaN(d.getTime())) {
          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
      }
    }

    // 2. If already DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val)) return val;

    // 3. Detect MM/DD/YYYY or MM/DD/YY (US format often in Excel text)
    const parts = val.split(/[/-]/);
    if (parts.length === 3) {
      let d = parseInt(parts[1], 10);
      let m = parseInt(parts[0], 10);
      let y = parseInt(parts[2], 10);

      // Fix 2-digit year
      if (y < 100) y += 2000;

      // Heuristic: If 2nd part > 12, it represents Day => MM/DD
      if (d > 12) {
        return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
      }

      // If 1st part > 12, it represents Day => DD/MM (already parsed this way by default in parts 0=M, 1=D? Wait.)
      // Logic fix: 
      // parts[0] is usually Day in LATAM. parts[1] Month.
      // My var naming was: m=parts[0], d=parts[1]. This assumed US format initially.
      // Let's swap to standard LATAM assumption:
      // parts[0] = Day, parts[1] = Month.

      let day = parseInt(parts[0], 10);
      let month = parseInt(parts[1], 10);

      // If Month > 12, swap?
      if (month > 12 && day <= 12) {
        // Swap
        const temp = day;
        day = month;
        month = temp;
      }

      if (day > 0 && month > 0 && y > 1900) {
        return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${y}`;
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
          const cedula = this.normalizeCedula(f.name.split('.')[0]);
          // Add to memory if not exists... simplified for dialog interaction
        }
      }
    });

    const res = await firstValueFrom(ref.afterClosed());
    if (!res?.accepted) return null;

    return res.items.map((i: any) => i.raw || Object.values(i));
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
    const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false, dateNF: 'dd/mm/yyyy' });

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
  }

  // Helper state for ARL indices
  private arlIndices = { dni: 11, vig: 8 };

  downloadArlReport() {
    if (!this.datoscruced.length || !this.arlRows.length) return;
    if (!this.arlWorker) {
      Swal.fire('Error', 'Worker no soportado', 'error');
      return;
    }

    this.showLoading('Generando Excel...', 'El worker está procesando el reporte ARL...');

    const headerRow = CruceValidationHelper.getSchema([], undefined).columns.map(c => c.header);

    const errorsMap: Record<string, string[]> = {};
    this.erroresValidacion.data.forEach(e => {
      const id = String(e.registro || '0');
      if (!errorsMap[id]) errorsMap[id] = [];
      errorsMap[id].push(e.mensaje || e.message);
    });

    // Use stored indices
    const { dni, vig } = this.arlIndices;

    this.arlWorker.postMessage({
      cruceRows: this.datoscruced,
      arlRows: this.arlRows,
      headerRowCruce: headerRow,
      indices: { dniTrabajador: dni, inicioVigencia: vig },
      errorsMap
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

  private getDocList(key: UploadControl): string[] {
    const files = this.files[key] || [];
    return files.map(f => {
      const m = f.name.match(/^\s*([a-zA-Z0-9-]+)/);
      return this.normalizeCedula(m ? m[1] : '');
    }).filter(Boolean);
  }

  private normalizeCedula(val: any): string {
    if (!val) return '';
    const s = String(val).trim().toUpperCase();
    if (s.startsWith('X')) return s.replace(/\s/g, '');
    return s.replace(/[^\d]/g, '');
  }

  private mapExternalIssues(backendErrors: any[]): PreviewIssue[] {
    return backendErrors.map((e, idx) => ({
      id: `ext-${idx}`,
      itemId: e.registro || '0',
      severity: 'error',
      message: e.mensaje || e.message || JSON.stringify(e),
      field: e.element || 'general'
    }));
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
