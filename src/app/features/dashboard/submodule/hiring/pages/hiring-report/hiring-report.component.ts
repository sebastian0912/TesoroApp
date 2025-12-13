import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { MatTableDataSource } from '@angular/material/table';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';

import { SharedModule } from '@/app/shared/shared.module';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { HiringService } from '../../service/hiring.service';
import { ReportesService } from '../../service/reportes/reportes.service';

import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as FileSaver from 'file-saver';
import { firstValueFrom } from 'rxjs';

type UploadControl =
  | 'cedulasEscaneadas'
  | 'cruceDiario'
  | 'arl'
  | 'induccionSSO'
  | 'traslados';

@Component({
  selector: 'app-hiring-report',
  imports: [SharedModule, MatDatepickerModule, MatCheckboxModule, MatNativeDateModule],
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

  // Contadores de contratos
  numeroContratosAlianza = 0;
  numeroContratosApoyoLaboral = 0;

  nombre = '';

  private readonly BLOCKED_FILES = new Set(['thumbs.db', 'desktop.ini', '.ds_store']);

  constructor(
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly utilityService: UtilityServiceService,
    private readonly hiringService: HiringService,
    private readonly reportesService: ReportesService,
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

      // si cambia a "no", resetea flags para no bloquear envíos no-aplicables
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

      this.sedes = unicas.sort((a: any, b: any) =>
        a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
      );
    } catch {
      Swal.fire('Error', 'No se pudieron cargar las sedes', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers generales
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

  private closeSwal(): void {
    Swal.close();
  }

  /**
   * Convierte a Promise tanto Promises como Observables (por si algún día cambias tu service).
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
    }
  }

  onFilesSelected(event: Event, controlName: UploadControl): void {
    const input = event.target as HTMLInputElement;
    const raw = input.files ? Array.from(input.files) : [];

    // permite seleccionar el mismo archivo dos veces
    input.value = '';

    if (!raw.length) return;

    const { allowed, ignored } = this.filterFilesByControl(raw, controlName);

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

  private filterFilesByControl(
    files: File[],
    controlName: UploadControl,
  ): { allowed: File[]; ignored: File[] } {
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

      // induccionSSO: por defecto PDF (puedes ampliar si necesitas)
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

  excelSerialToJSDate(serial: number): string {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
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

    // Quitamos encabezados
    json.shift();

    // Tu lógica: cédula en columna 2 (index 1)
    return json
      .map((row: any[]) => this.onlyDigits(row?.[1]))
      .filter((c) => c !== '');
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

    // Tu lógica: AL/TA en columna 3 (index 2)
    json.forEach((row: any[]) => {
      const valor = (row?.[2] ?? '').toString().trim();
      if (valor === 'AL') alCount++;
      else if (valor === 'TA') taCount++;
    });

    return { AL: alCount, TA: taCount };
  }

  private extractCedulaFromFilename(filename: string): string | null {
    const name = (filename ?? '').trim();
    const lower = name.toLowerCase();

    if (!name) return null;
    if (this.BLOCKED_FILES.has(lower)) return null;
    if (!lower.endsWith('.pdf')) return null;

    // Sin extensión
    const base = name.replace(/\.pdf$/i, '').trim();

    // acepta:
    //  1051660630 - SALUD TOTAL
    //  1051660630-SALUD TOTAL
    //  1051660630 SALUD TOTAL
    const match = base.match(/^\s*([0-9]{6,15})\s*(?:[-_ ]\s*.*)?$/);
    if (!match) return null;

    return match[1].trim();
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

  // Validación EPS de traslados (sin base64 ni subida)
  async validarTrasladosEps(files: File[]): Promise<void> {
    const validEPS = new Set(['nuevaeps', 'saludtotal', 'famisanar']);

    for (const file of files ?? []) {
      const name = (file?.name ?? '').trim();
      const lower = name.toLowerCase();

      if (this.BLOCKED_FILES.has(lower)) continue;
      if (!lower.endsWith('.pdf')) continue;

      const base = name.replace(/\.pdf$/i, '').trim();

      // separadores posibles: " - " o "-"
      let parts: string[] = [];
      if (base.includes(' - ')) parts = base.split(' - ');
      else if (base.includes('-')) parts = base.split('-');

      if (parts.length < 2) continue;

      let eps = (parts[1] ?? '').toString().replace(/\s+/g, '').toLowerCase();
      eps = eps.replace(/[^a-z]/g, ''); // deja letras

      if (!validEPS.has(eps)) {
        await Swal.fire(
          'Error',
          `La EPS "${parts[1]}" no es válida. Solo se permiten NUEVA EPS, SALUD TOTAL o FAMISANAR. Corrija los nombres del PDF.`,
          'error',
        );
        throw new Error('EPS inválida en traslados');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Botón VALIDAR (aplica reglas antes de enviar a reportes/Django)
  // ---------------------------------------------------------------------------

  async validarTodo(): Promise<void> {
    // reset de estado previo
    this.isCruceValidado = false;
    this.isArlValidado = false;
    this.erroresValidacion.data = [];
    this.datoscruced = [];

    this.showLoading('Cargando...', 'Extrayendo cédulas y validando archivos...');

    try {
      const cruceChecked = !!this.reporteForm.get('cruceDiario')?.value;
      const arlChecked = !!this.reporteForm.get('arl')?.value;
      const trasladosChecked = !!this.reporteForm.get('traslados')?.value;

      const filesCruce = this.filesToUpload.cruceDiario ?? [];
      if (cruceChecked && filesCruce.length === 0) {
        this.closeSwal();
        await Swal.fire('Error', 'Debe cargar un archivo de cruce diario antes de validar', 'error');
        return;
      }

      const arlFiles = this.filesToUpload.arl ?? [];
      if (arlChecked && arlFiles.length === 0) {
        this.closeSwal();
        await Swal.fire('Error', 'Debe cargar un archivo de ARL antes de validar', 'error');
        return;
      }

      const cedulasEscaneadasFiles = this.filesToUpload.cedulasEscaneadas ?? [];
      if (this.reporteForm.get('cedulasEscaneadas')?.value && cedulasEscaneadasFiles.length === 0) {
        this.closeSwal();
        await Swal.fire('Error', 'Debe cargar archivos de cédulas escaneadas antes de validar', 'error');
        return;
      }

      // cédulas desde PDFs (aquí ya NO entran Thumbs.db por el filtro de selección)
      const cedulasEscaneadas = this.extraerCedulasDeArchivos(cedulasEscaneadasFiles);

      let cedulasTrasladosExtraidas: string[] = [];
      const trasladosFiles = this.filesToUpload.traslados ?? [];

      if (trasladosChecked) {
        if (trasladosFiles.length === 0) {
          this.closeSwal();
          await Swal.fire('Error', 'Debe cargar archivos de traslados si seleccionó esa opción', 'error');
          return;
        }
        await this.validarTrasladosEps(trasladosFiles);
        cedulasTrasladosExtraidas = this.extraerCedulasDeArchivos(trasladosFiles);
      }

      // Excel cruce
      let cedulasExcel: string[] = [];
      if (cruceChecked) {
        const fileCruce = (this.filesToUpload.cruceDiario ?? [])[0];
        cedulasExcel = await this.extraerCedulasDelArchivo(fileCruce);

        const result = await this.contarALyTAEnColumna(fileCruce);
        this.numeroContratosApoyoLaboral = result.AL;
        this.numeroContratosAlianza = result.TA;
        this.reporteForm.controls['cantidadContratosTuAlianza'].setValue(result.TA);
        this.reporteForm.controls['cantidadContratosApoyoLaboral'].setValue(result.AL);
      }

      const erroresFormateados: { registro: string; errores: any[]; tipo: string }[] = [];

      if (cruceChecked) {
        // Regla: cédulas escaneadas que faltan en cruce
        const cedulasFaltantesEnExcel = cedulasEscaneadas.filter((c) => !cedulasExcel.includes(c));
        cedulasFaltantesEnExcel.forEach((cedula) => {
          erroresFormateados.push({
            registro: '0',
            errores: ['Cédula no encontrada en el Excel: ' + cedula],
            tipo: 'Cédula escaneada',
          });
        });

        // Regla inversa: cédulas en cruce no escaneadas
        const cedulasExtrasEnExcel = cedulasExcel.filter((c) => !cedulasEscaneadas.includes(c));
        cedulasExtrasEnExcel.forEach((cedula) => {
          erroresFormateados.push({
            registro: '0',
            errores: ['Cédula en el Excel pero no escaneada: ' + cedula],
            tipo: 'Cédula escaneada',
          });
        });

        // Regla: traslados deben existir en cruce
        if (cedulasTrasladosExtraidas.length > 0) {
          const cedulasTrasladosNoEnExcel = cedulasTrasladosExtraidas.filter(
            (c) => !cedulasExcel.includes(c),
          );
          cedulasTrasladosNoEnExcel.forEach((cedula) => {
            erroresFormateados.push({
              registro: '0',
              errores: ['Cédula de traslado no encontrada en el Excel: ' + cedula],
              tipo: 'Traslado',
            });
          });
        }

        // Regla: total de cédulas escaneadas vs Excel
        if (cedulasEscaneadas.length !== cedulasExcel.length) {
          erroresFormateados.push({
            registro: '0',
            errores: [
              `El número de cédulas escaneadas (${cedulasEscaneadas.length}) no coincide con las cédulas del Excel (${cedulasExcel.length}).`,
            ],
            tipo: 'Consistencia',
          });
        }
      }

      if (erroresFormateados.length > 0) {
        this.closeSwal();
        this.erroresValidacion.data = erroresFormateados;

        const tipoErrores = trasladosChecked ? 'Traslado' : 'Cruce Diario';
        const payload = {
          errores: this.erroresValidacion.data,
          responsable: this.nombre,
          tipo: tipoErrores,
        };

        this.showLoading('Guardando errores...', 'Enviando todos los errores para guardar...');

        try {
          // ✅ FIX: no firstValueFrom(Promise)
          await this.toPromise(this.hiringService.enviarErroresValidacion(payload));
          this.closeSwal();
          await Swal.fire('Error', 'Se han encontrado errores. Corrija los datos y vuelva a intentarlo.', 'error');
        } catch {
          this.closeSwal();
          await Swal.fire('Error', 'Error al guardar los errores.', 'error');
        }
        return;
      }

      this.closeSwal();

      // pre-validación OK
      this.isCruceValidado = cruceChecked ? true : false;

      // Validación profunda (cruce + ARL)
      if (cruceChecked) {
        await this.validarCruce();
      } else if (arlChecked) {
        // Si no hay cruce pero sí ARL, al menos procesa ARL
        await this.proccssArl([arlFiles[0]]);
      }
    } catch {
      this.closeSwal();
      await Swal.fire('Error', 'Error al procesar. Inténtelo de nuevo.', 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Validación profunda de cruce (lotes + ARL + errores de negocio)
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

    // reset para ejecutar una validación limpia
    this.isCruceValidado = false;
    this.erroresValidacion.data = [];

    this.showLoading('Cargando...', 'Iniciando el proceso de validación');

    try {
      const file = files[0];
      const workbook = await this.readWorkbook(file);

      this.showLoading('Leyendo el archivo Excel...', 'Por favor, espere...');

      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        dateNF: 'dd/mm/yyyy',
      }) as any[];

      // Quitamos encabezados
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

      const rows: string[][] = json.map((row: any[]) => {
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

          if (index === 11 || index === 1) {
            completeRow[index] = this.onlyDigits(cell);
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

      this.datoscruced = rows;

      this.showLoading('Dividiendo los datos en lotes...', 'Por favor, espere...');

      const batchSize = 1500;
      const totalBatches = Math.ceil(rows.length / batchSize);
      const allErrors: any[] = [];

      for (let i = 0; i < totalBatches; i++) {
        const batch = rows.slice(i * batchSize, (i + 1) * batchSize);

        this.showLoading(
          'Validando lote...',
          `Enviando el lote ${i + 1} de ${totalBatches} para validación...`,
        );

        // ✅ FIX: no firstValueFrom(Promise)
        const response: any = await this.toPromise(this.hiringService.subirContratacionValidar(batch));
        if (response?.status === 'error' && Array.isArray(response?.errores)) {
          allErrors.push(...response.errores);
        }
      }

      this.erroresValidacion.data = allErrors;

      // Procesa ARL (si aplica) y genera el Excel ARL
      if (arlChecked && arlFiles.length > 0) {
        await this.proccssArl([arlFiles[0]]);
      }

      if (allErrors.length > 0) {
        const payload = {
          errores: allErrors,
          responsable: this.nombre,
          tipo: 'Documento de Contratación',
        };

        this.showLoading('Enviando errores...', 'Guardando errores encontrados...');

        try {
          // ✅ FIX: no firstValueFrom(Promise)
          await this.toPromise(this.hiringService.enviarErroresValidacion(payload));
          this.closeSwal();
          await Swal.fire(
            'Error',
            'Se han encontrado errores en el cruce diario. Corrija y vuelva a intentar.',
            'error',
          );
        } catch {
          this.closeSwal();
          await Swal.fire('Error', 'Error al guardar los errores.', 'error');
        }
        return;
      }

      this.closeSwal();
      this.isCruceValidado = true;

      await Swal.fire('Completado', 'Proceso de validación finalizado correctamente.', 'success');
    } catch {
      this.closeSwal();
      await Swal.fire(
        'Error',
        'Error procesando el archivo. Verifique el formato e intente de nuevo.',
        'error',
      );
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
        const cedulaCruce = this.onlyDigits(cruceRow?.[1]);
        const comparativoCruce = cruceRow?.[8];

        const filaArl = rowsArl.find((arlRow) => {
          const cedulaArl = this.onlyDigits(arlRow?.[dniTrabajadorIndex]);
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

        const registroErrores = (this.erroresValidacion.data ?? []).find(
          (err: any) => err?.registro == index + 1,
        );
        if (
          registroErrores &&
          Array.isArray(registroErrores.errores) &&
          registroErrores.errores.length > 0
        ) {
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

      // ✅ FIX TS2322: tipa Fill correctamente (no "string")
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

        if (dato['Arl'] === 'SATISFACTORIO') row.getCell('Arl').fill = green;
        else {
          this.isArlValidado = false;
          row.getCell('Arl').fill = red;
        }

        if (dato['ARL_FECHAS'] === 'SATISFACTORIO') row.getCell('ARL_FECHAS').fill = green;
        else {
          this.isArlValidado = false;
          row.getCell('ARL_FECHAS').fill = red;
        }

        if (dato['FECHA EN ARL'] === 'NO DISPONIBLE') {
          this.isArlValidado = false;
          row.getCell('FECHA EN ARL').fill = red;
        }

        if (dato['FECHA INGRESO SUBIDA CONTRATACION'] === 'NO DISPONIBLE') {
          this.isArlValidado = false;
          row.getCell('FECHA INGRESO SUBIDA CONTRATACION').fill = red;
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
  // Envío a Django (FormData): metadatos + archivos
  // ---------------------------------------------------------------------------

  private buildReporteFormData(user: any): FormData {
    const formData = new FormData();
    const formValue = this.reporteForm.value;

    const sedeNombre = formValue.sede?.nombre ?? formValue.sede ?? '';
    formData.append('sede', sedeNombre);

    // Si es de hoy, se envía fecha actual; si no, la seleccionada
    if (formValue.esDeHoy === 'true') {
      formData.append('fecha', new Date().toISOString());
    } else if (formValue.fecha instanceof Date) {
      formData.append('fecha', formValue.fecha.toISOString());
    }

    formData.append(
      'cantidadContratosTuAlianza',
      (formValue.cantidadContratosTuAlianza ?? 0).toString(),
    );
    formData.append(
      'cantidadContratosApoyoLaboral',
      (formValue.cantidadContratosApoyoLaboral ?? 0).toString(),
    );

    if (formValue.notas) {
      formData.append('nota', formValue.notas);
    }

    const nombreResponsable =
      user && user.datos_basicos
        ? `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`
        : this.nombre;

    formData.append('nombre', nombreResponsable);

    const isBlocked = (name: string) => this.BLOCKED_FILES.has((name ?? '').trim().toLowerCase());
    const isPdfName = (name: string) => (name ?? '').toLowerCase().trim().endsWith('.pdf');

    // Documentos asociados al reporte (sin base64)
    const sstFiles = this.filesToUpload.induccionSSO ?? [];
    if (sstFiles.length > 0 && !isBlocked(sstFiles[0].name) && isPdfName(sstFiles[0].name)) {
      formData.append('sst_document', sstFiles[0]);
    }

    const cruceFiles = this.filesToUpload.cruceDiario ?? [];
    if (cruceFiles.length > 0 && !isBlocked(cruceFiles[0].name)) {
      formData.append('cruce_document', cruceFiles[0]);
    }

    const cedulasFiles = (this.filesToUpload.cedulasEscaneadas ?? []).filter(
      (f) => f && !isBlocked(f.name) && isPdfName(f.name),
    );
    cedulasFiles.forEach((file) => {
      // aquí ya van SOLO PDFs válidos y SIN Thumbs.db
      formData.append('cedulas', file);
    });

    const trasladosFiles = (this.filesToUpload.traslados ?? []).filter(
      (f) => f && !isBlocked(f.name) && isPdfName(f.name),
    );
    trasladosFiles.forEach((file) => {
      formData.append('traslados', file);
    });

    return formData;
  }

  // ---------------------------------------------------------------------------
  // Botón ENVIAR (solo cuando reglas se cumplen)
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
}
