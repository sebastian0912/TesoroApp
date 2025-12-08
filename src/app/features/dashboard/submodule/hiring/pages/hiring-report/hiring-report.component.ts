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
  filesToUpload: Record<string, File[]> = {};

  // Tabla de errores para mostrar en frontend
  erroresValidacion = new MatTableDataSource<any>([]);

  // Flags de validación
  isCruceValidado = false;
  isArlValidado = true;

  // Datos del cruce procesado (filas normalizadas)
  datoscruced: any[] = [];

  // Contadores de contratos
  numeroContratosAlianza = 0;
  numeroContratosApoyoLaboral = 0;

  nombre = '';

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

    await this.manageFechaValidation();

    this.reporteForm.get('esDeHoy')?.valueChanges.subscribe(async () => {
      await this.manageFechaValidation();
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
    });

    // Carga de sedes activas
    try {
      const data: any = await firstValueFrom(this.utilityService.traerSucursales());
      if (!Array.isArray(data)) throw new Error('Respuesta inválida');

      const soloActivas = data.filter((s: any) => s.activa === true);
      const unicas = Array.from(
        new Map(soloActivas.map((s: any) => [s.nombre, s])).values(),
      );
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
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
  }

  private closeSwal(): void {
    Swal.close();
  }

  // ---------------------------------------------------------------------------
  // Validación dinámica de fecha
  // ---------------------------------------------------------------------------

  async manageFechaValidation(): Promise<void> {
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

      // Reset de estado de validación
      this.isCruceValidado = false;
      this.isArlValidado = true;
      this.erroresValidacion.data = [];
      this.datoscruced = [];
    }
  }

  onCheckboxChange(event: any, controlName: string): void {
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

  onFilesSelected(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length > 0) {
      this.filesToUpload[controlName] = files;
      this.updateFileName(files, controlName);

      // Cada vez que cambias archivos relevantes, invalida validaciones previas
      if (['cruceDiario', 'cedulasEscaneadas', 'traslados'].includes(controlName)) {
        this.isCruceValidado = false;
      }
      if (controlName === 'arl') {
        this.isArlValidado = false;
      }
      this.erroresValidacion.data = [];
    }
  }

  onFileSelected(event: Event, controlName: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.filesToUpload[controlName] = [file];
      this.updateFileName([file], controlName);

      if (['cruceDiario', 'cedulasEscaneadas', 'traslados'].includes(controlName)) {
        this.isCruceValidado = false;
      }
      if (controlName === 'arl') {
        this.isArlValidado = false;
      }
      this.erroresValidacion.data = [];
    }
  }

  private updateFileName(files: File[], controlName: string): void {
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
    const dateParts = fecha.split(/\/|-/);

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

    return text.replace(emojiPattern, '');
  };

  excelSerialToJSDate(serial: number): string {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Extracción de datos desde archivos
  // ---------------------------------------------------------------------------

  private async extraerCedulasDelArchivo(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        const bstr = e.target?.result as string;
        const workbook = XLSX.read(bstr, { type: 'binary' });

        try {
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            dateNF: 'dd/mm/yyyy',
          }) as any[];

          // Quitamos encabezados
          json.shift();

          const cedulas: string[] = json
            .map((row: any[]) => {
              const cedula = row[1];
              return cedula
                ? this.removeSpecialCharacters(cedula.toString().replace(/\s/g, ''))
                : '';
            })
            .filter((cedula) => cedula !== '');

          resolve(cedulas);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }

  private async contarALyTAEnColumna(file: File): Promise<{ AL: number; TA: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: ProgressEvent<FileReader>) => {
        const bstr = e.target?.result as string;
        const workbook = XLSX.read(bstr, { type: 'binary' });

        try {
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
            const valor = row[2];
            if (valor === 'AL') {
              alCount++;
            } else if (valor === 'TA') {
              taCount++;
            }
          });

          resolve({ AL: alCount, TA: taCount });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  }

  private extraerCedulasDeArchivos(files: File[]): string[] {
    const cedulas: string[] = [];

    files.forEach((file) => {
      let cedula = '';

      if (file.name.includes(' - ')) {
        cedula = file.name.split(' - ')[0];
      } else if (file.name.includes('-')) {
        cedula = file.name.split('-')[0];
      }

      if (cedula) {
        cedulas.push(cedula.trim());
      }
    });

    return cedulas;
  }

  async ObtenerCedulasEscaneadas(files: File[]): Promise<string[]> {
    return this.extraerCedulasDeArchivos(files);
  }

  async ObtenerCedulasTraslados(files: File[]): Promise<string[]> {
    return this.extraerCedulasDeArchivos(files);
  }

  // Validación EPS de traslados (sin base64 ni subida)
  async validarTrasladosEps(files: File[]): Promise<void> {
    const validEPS = ['nuevaeps', 'saludtotal', 'famisanar'];

    for (const file of files) {
      let cedula = '';
      let eps = '';

      if (file.name.includes(' - ')) {
        [cedula, eps] = file.name.split(' - ');
      } else if (file.name.includes('-')) {
        [cedula, eps] = file.name.split('-');
      } else {
        continue;
      }

      eps = eps.replace('.pdf', '').replace(/\s+/g, '').toLowerCase();

      if (!validEPS.includes(eps)) {
        await Swal.fire(
          'Error',
          `La EPS "${eps}" no es válida. Solo se permiten NUEVA EPS, SALUD TOTAL o FAMISANAR. Por favor, corrija los nombres.`,
          'error',
        );
        throw new Error('EPS inválida en traslados');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Botón VALIDAR (aplica todas las reglas antes de enviar a reportes/Django)
  // ---------------------------------------------------------------------------

  async validarTodo(): Promise<void> {
    // Siempre que validas, resetea estado previo
    this.isCruceValidado = false;
    this.isArlValidado = true;
    this.erroresValidacion.data = [];
    this.datoscruced = [];

    this.showLoading('Cargando...', 'Extrayendo cédulas del archivo');

    try {
      const filesCruce = this.filesToUpload['cruceDiario'];
      if (!filesCruce || filesCruce.length === 0) {
        this.closeSwal();
        await Swal.fire(
          'Error',
          'Debe cargar un archivo de cruce diario antes de validar',
          'error',
        );
        return;
      }
      const fileCruce = filesCruce[0];

      const arlFiles = this.filesToUpload['arl'];
      if (!arlFiles || arlFiles.length === 0) {
        this.closeSwal();
        await Swal.fire('Error', 'Debe cargar un archivo de ARL antes de validar', 'error');
        return;
      }

      const cedulasEscaneadasFiles = this.filesToUpload['cedulasEscaneadas'];
      if (!cedulasEscaneadasFiles || cedulasEscaneadasFiles.length === 0) {
        this.closeSwal();
        await Swal.fire(
          'Error',
          'Debe cargar archivos de cédulas escaneadas antes de validar',
          'error',
        );
        return;
      }

      const cedulasEscaneadas = this.extraerCedulasDeArchivos(cedulasEscaneadasFiles);

      let cedulasTrasladosExtraidas: string[] = [];
      const trasladosFiles = this.filesToUpload['traslados'];

      if (this.reporteForm.get('traslados')?.value) {
        if (!trasladosFiles || trasladosFiles.length === 0) {
          this.closeSwal();
          await Swal.fire(
            'Error',
            'Debe cargar archivos de traslados si seleccionó esa opción',
            'error',
          );
          return;
        }
        // validación adicional de EPS en traslados
        await this.validarTrasladosEps(trasladosFiles);
        cedulasTrasladosExtraidas = this.extraerCedulasDeArchivos(trasladosFiles);
      }

      const cedulasExcel = await this.extraerCedulasDelArchivo(fileCruce);

      // mejor: esperar el conteo y abortar si falla
      try {
        const result = await this.contarALyTAEnColumna(fileCruce);
        this.numeroContratosApoyoLaboral = result.AL;
        this.numeroContratosAlianza = result.TA;
        this.reporteForm.controls['cantidadContratosTuAlianza'].setValue(result.TA);
        this.reporteForm.controls['cantidadContratosApoyoLaboral'].setValue(result.AL);
      } catch {
        this.closeSwal();
        await Swal.fire(
          'Error',
          'Error al contar AL y TA en el archivo de cruce diario',
          'error',
        );
        return;
      }

      const erroresFormateados: { registro: string; errores: any[]; tipo: string }[] = [];

      // Regla 7: cédulas escaneadas que faltan en cruce
      const cedulasFaltantesEnExcel = cedulasEscaneadas.filter(
        (c) => !cedulasExcel.includes(c),
      );
      if (cedulasFaltantesEnExcel.length > 0) {
        cedulasFaltantesEnExcel.forEach((cedula) => {
          erroresFormateados.push({
            registro: '0',
            errores: ['Cédula no encontrada en el Excel: ' + cedula],
            tipo: 'Cédula escaneada',
          });
        });
      }

      // Regla 7 (lado inverso): cédulas en cruce no escaneadas
      const cedulasExtrasEnExcel = cedulasExcel.filter(
        (c) => !cedulasEscaneadas.includes(c),
      );
      if (cedulasExtrasEnExcel.length > 0) {
        cedulasExtrasEnExcel.forEach((cedula) => {
          erroresFormateados.push({
            registro: '0',
            errores: ['Cédula en el Excel pero no escaneada: ' + cedula],
            tipo: 'Cédula escaneada',
          });
        });
      }

      // Regla 8: cédulas de traslados deben existir en cruce
      if (cedulasTrasladosExtraidas.length > 0) {
        const cedulasTrasladosNoEnExcel = cedulasTrasladosExtraidas.filter(
          (c) => !cedulasExcel.includes(c),
        );
        if (cedulasTrasladosNoEnExcel.length > 0) {
          cedulasTrasladosNoEnExcel.forEach((cedula) => {
            erroresFormateados.push({
              registro: '0',
              errores: ['Cédula de traslado no encontrada en el Excel: ' + cedula],
              tipo: 'Traslado',
            });
          });
        }
      }

      // Regla 2: número total de cédulas escaneadas vs Excel
      if (cedulasEscaneadas.length !== cedulasExcel.length) {
        erroresFormateados.push({
          registro: '0',
          errores: [
            `El número de cédulas escaneadas (${cedulasEscaneadas.length}) no coincide con las cédulas del Excel (${cedulasExcel.length}).`,
          ],
          tipo: 'Consistencia',
        });
      }

      if (erroresFormateados.length > 0) {
        this.closeSwal();
        this.erroresValidacion.data = erroresFormateados;

        const tipoErrores = this.reporteForm.get('traslados')?.value
          ? 'Traslado'
          : 'Cruce Diario';

        const payload = {
          errores: this.erroresValidacion.data,
          responsable: this.nombre,
          tipo: tipoErrores,
        };

        this.showLoading(
          'Guardando errores...',
          'Enviando todos los errores para guardar...',
        );

        await this.hiringService.enviarErroresValidacion(payload).then(
          () => {
            this.closeSwal();
            Swal.fire(
              'Error',
              'Se han encontrado errores en el archivo de cruce diario. Por favor, corrija los datos y vuelva a intentarlo.',
              'error',
            );
          },
          () => {
            this.closeSwal();
            Swal.fire('Error', 'Error al guardar los errores.', 'error');
          },
        );
      } else {
        this.closeSwal();
        // marcamos que el cruce está pre-validado a nivel de reglas de cédulas
        this.isCruceValidado = true;

        // Validación profunda contra backend + ARL
        await this.validarCruce();
        // el Swal de éxito o error final se maneja dentro de validarCruce / processArl
      }
    } catch (error) {
      this.closeSwal();
      await Swal.fire(
        'Error',
        'Error al procesar el archivo. Inténtelo de nuevo.',
        'error',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Validación profunda de cruce (lotes + ARL + errores de negocio)
  // ---------------------------------------------------------------------------

  async validarCruce(): Promise<void> {
    this.closeSwal();

    const files = this.filesToUpload['cruceDiario'];

    if (!files || files.length === 0) {
      Swal.fire('Error', 'Debe cargar un archivo antes de validar', 'error');
      return;
    }

    // reset para ejecutar una validación limpia
    this.isCruceValidado = false;
    this.erroresValidacion.data = [];

    this.showLoading('Cargando...', 'Iniciando el proceso de validación');

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const bstr = e.target?.result as string;
      const workbook = XLSX.read(bstr, { type: 'binary' });

      try {
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
          const regex_ddmmyyyy = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
          const regex_mmddyy = /^\d{1,2}\/\d{1,2}\/\d{2}$/;

          if (regex_ddmmyyyy.test(date)) {
            return date;
          } else if (regex_mmddyy.test(date)) {
            const [month, day, year] = date.split('/');
            const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
            return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`;
          }
          return date;
        };

        const indicesFechas = [0, 8, 16, 24, 44, 134];

        const rows: string[][] = json.map((row: any[]) => {
          const completeRow = new Array(195).fill('-');

          row.forEach((cell, index) => {
            if (index < 195) {
              if (
                cell == null ||
                cell === '' ||
                cell === '#N/A' ||
                cell === 'N/A' ||
                cell === '#REF!' ||
                cell === '#¡REF!'
              ) {
                completeRow[index] = '-';
              } else if (index === 11 || index === 1) {
                completeRow[index] = this.removeSpecialCharacters(
                  cell
                    .toString()
                    .replace(/,/g, '')
                    .replace(/\./g, '')
                    .replace(/\s/g, '')
                    .replace(/[^0-9xX]/g, ''),
                );
              } else if (indicesFechas.includes(index)) {
                completeRow[index] = formatDate(
                  this.removeSpecialCharacters(cell.toString()),
                );
              } else {
                completeRow[index] = this.removeSpecialCharacters(cell.toString());
              }
            }
          });

          return completeRow;
        });

        this.datoscruced = rows;

        this.showLoading('Dividiendo los datos en lotes...', 'Por favor, espere...');

        const batchSize = 1500;
        const totalBatches = Math.ceil(rows.length / batchSize);
        let allErrors: any[] = [];

        for (let i = 0; i < totalBatches; i++) {
          const batch = rows.slice(i * batchSize, (i + 1) * batchSize);

          this.showLoading(
            'Validando lote...',
            `Enviando el lote ${i + 1} de ${totalBatches} para validación...`,
          );

          await this.hiringService.subirContratacionValidar(batch).then((response) => {
            if (response.status === 'error') {
              allErrors.push(...response.errores);
            }
          });
        }

        this.showLoading('Procesando errores...', 'Por favor, espere...');

        this.erroresValidacion.data = allErrors;

        await this.proccssArl([this.filesToUpload['arl'][0]]);

        if (allErrors.length > 0) {
          const erroresFormateados: { registro: string; errores: any[] }[] = [];

          for (const [registro, errorObj] of Object.entries(allErrors)) {
            erroresFormateados.push({
              registro: registro,
              errores: (errorObj as any).errores || [],
            });
          }

          const payload = {
            errores: erroresFormateados,
            responsable: this.nombre,
            tipo: 'Documento de Contratación',
          };

          this.showLoading(
            'Enviando errores...',
            'Guardando errores encontrados...',
          );

          await this.hiringService.enviarErroresValidacion(payload).then(
            () => {
              this.closeSwal();
              Swal.fire(
                'Error',
                'Se han encontrado errores en el archivo de cruce diario. Por favor, corrija los datos y vuelva a intentarlo.',
                'error',
              );
            },
            () => {
              this.closeSwal();
              Swal.fire('Error', 'Error al guardar los errores.', 'error');
            },
          );
        } else {
          this.closeSwal();
          this.isCruceValidado = true;

          Swal.fire(
            'Completado',
            'Proceso de validación finalizado correctamente.',
            'success',
          );
        }
      } catch (error) {
        this.closeSwal();
        Swal.fire(
          'Error',
          'Error procesando el archivo. Verifique el formato e intente de nuevo.',
          'error',
        );
      }
    };

    reader.readAsBinaryString(file);
  }

  applyFilter(column: string, event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.erroresValidacion.filter = filterValue.trim().toLowerCase();
  }

  // ---------------------------------------------------------------------------
  // Procesamiento ARL (Regla 9 + generación Excel de resultados ARL)
  // ---------------------------------------------------------------------------

  async processArl(workbook: XLSX.WorkBook): Promise<void> {
    let confirmarErrores = true;

    // cada vez que recalculamos ARL, asumimos válido hasta que se pruebe lo contrario
    this.isArlValidado = true;

    this.showLoading(
      'Cargando...',
      'Procesando archivo de ARL. Por favor, espere unos segundos.',
    );

    try {
      const sheetArl = workbook.Sheets[workbook.SheetNames[0]];

      const dataArl = XLSX.utils.sheet_to_json(sheetArl, {
        header: 1,
        raw: true,
        defval: '',
      }) as any[][];

      const datos = dataArl[0] as string[];

      const dniTrabajadorIndex = datos.indexOf('DNI TRABAJADOR');
      const inicioVigenciaIndex = datos.indexOf('INICIO VIGENCIA');

      if (dniTrabajadorIndex === -1) {
        Swal.fire(
          'Error',
          'No se encontró el encabezado "DNI TRABAJADOR" en el archivo de ARL. Tiene que tener encabezados',
          'error',
        );
      }
      if (inicioVigenciaIndex === -1) {
        Swal.fire(
          'Error',
          'No se encontró el encabezado "INICIO VIGENCIA" en el archivo de ARL. Tiene que tener encabezados',
          'error',
        );
      }

      const rowsArl = dataArl.map((row) => {
        if (row[9] && typeof row[9] === 'number') {
          row[9] = this.excelSerialToJSDate(row[9]);
        }
        return row;
      });
      rowsArl.shift();

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

      const datosMapeados = this.datoscruced.map(
        (cruceRow: any[], index: number) => {
          let cedulaCruce = cruceRow[1];
          const comparativoCruce = cruceRow[8];

          cedulaCruce = cedulaCruce.replace(/\s|\./g, '');

          const filaArl = rowsArl.find((arlRow) => {
            const cedulaArl = (arlRow[dniTrabajadorIndex] || '')
              .toString()
              .replace(/\s|\./g, '');
            return cedulaArl === cedulaCruce;
          });

          let estadoCedula = 'ALERTA NO ESTA EN ARL';
          let estadoFechas = 'SATISFACTORIO';
          let fechaIngresoArl = 'NO DISPONIBLE';
          let fechaIngresoCruce = comparativoCruce || 'NO DISPONIBLE';

          if (filaArl) {
            estadoCedula = 'SATISFACTORIO';
            const comparativoArl = filaArl[inicioVigenciaIndex];

            const formatDateAny = (dateStr: string | number) => {
              if (typeof dateStr === 'number') {
                const excelEpoch = new Date(1899, 11, 30);
                return new Date(excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000);
              }

              if (typeof dateStr === 'string') {
                const normalizedDateStr = dateStr.includes('-')
                  ? dateStr.replace(/-/g, '/')
                  : dateStr;
                const [day, month, year] = normalizedDateStr
                  .split('/')
                  .map(Number);
                return new Date(year, month - 1, day);
              }

              throw new Error('Formato de fecha no reconocido');
            };

            const fechaArl = formatDateAny(comparativoArl);
            const fechaCruce = formatDateAny(comparativoCruce);

            if (fechaArl.getTime() > fechaCruce.getTime()) {
              estadoFechas = 'ALERTA FECHAS NO COINCIDEN';
            }

            fechaIngresoArl = comparativoArl || 'NO DISPONIBLE';
          }

          const resultado: { [key: string]: any } = {
            'Numero de Cedula': cedulaCruce,
            Arl: estadoCedula,
            ARL_FECHAS: estadoFechas,
            'FECHA EN ARL': fechaIngresoArl,
            'FECHA INGRESO SUBIDA CONTRATACION': fechaIngresoCruce,
            Errores: 'OK',
          };

          headers.forEach((header, i) => {
            resultado[header] = cruceRow[i] || 'NO DISPONIBLE';
          });

          const registroErrores = this.erroresValidacion.data.find(
            (err: any) => err.registro == index + 1,
          );
          if (registroErrores && registroErrores.errores.length > 0) {
            confirmarErrores = false;
            resultado['Errores'] = registroErrores.errores.join(', ');
          }

          return resultado;
        },
      );

      const workbookOut = new ExcelJS.Workbook();
      const worksheet = workbookOut.addWorksheet('Datos');

      worksheet.columns = Object.keys(datosMapeados[0]).map((titulo) => ({
        header: titulo,
        key: titulo,
        width: 20,
      }));

      datosMapeados.forEach((dato) => {
        const row = worksheet.addRow(dato);

        if (dato['Arl'] === 'SATISFACTORIO') {
          row.getCell('Arl').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '00FF00' },
          };
        } else if (dato['Arl'] === 'ALERTA NO ESTA EN ARL') {
          this.isArlValidado = false;
          row.getCell('Arl').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0000' },
          };
        }

        if (dato['ARL_FECHAS'] === 'SATISFACTORIO') {
          row.getCell('ARL_FECHAS').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '00FF00' },
          };
        } else if (dato['ARL_FECHAS'] === 'ALERTA FECHAS NO COINCIDEN') {
          this.isArlValidado = false;
          row.getCell('ARL_FECHAS').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0000' },
          };
        }

        if (dato['FECHA EN ARL'] === 'NO DISPONIBLE') {
          row.getCell('FECHA EN ARL').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0000' },
          };
        }

        if (dato['FECHA INGRESO SUBIDA CONTRATACION'] === 'NO DISPONIBLE') {
          row.getCell('FECHA INGRESO SUBIDA CONTRATACION').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF0000' },
          };
        }
      });

      const cedulasNoEncontradas = datosMapeados
        .filter((dato) => dato['Arl'] === 'ALERTA NO ESTA EN ARL')
        .map((dato) => dato['Numero de Cedula']);
      const cedulasWorksheet = workbookOut.addWorksheet('Cédulas No Encontradas');
      cedulasWorksheet.columns = [{ header: 'Cédula', key: 'cedula', width: 20 }];
      cedulasNoEncontradas.forEach((cedula) => {
        cedulasWorksheet.addRow({ cedula });
      });

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
            text: 'Todos los datos de ARL coinciden con el cruce diario',
            heightAuto: false,
          });
        } else {
          Swal.fire({
            icon: 'error',
            title: 'El ARL tiene problemas',
            text: 'Se han encontrado discrepancias en los datos de ARL. Por favor, revise los datos y vuelva a intentarlo.',
            heightAuto: false,
          });
        }
      }, 500);
    } catch (error) {
      this.closeSwal();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al procesar los datos. Por favor, inténtelo de nuevo.',
        confirmButtonText: 'Aceptar',
      });
    }
  }

  async proccssArl(files: File[]): Promise<void> {
    if (!files || files.length === 0) {
      return;
    }

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (e: ProgressEvent<FileReader>) => {
      const bstr = e.target?.result as string;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      await this.processArl(workbook);
    };

    reader.readAsBinaryString(file);
  }

  // ---------------------------------------------------------------------------
  // Envío a Django (sin base64): se arma FormData con metadatos + archivos
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

    // Documentos asociados al reporte (Django: FK + M2M, sin base64)
    const sstFiles = this.filesToUpload['induccionSSO'] ?? [];
    if (sstFiles.length > 0) {
      formData.append('sst_document', sstFiles[0]);
    }

    const cruceFiles = this.filesToUpload['cruceDiario'] ?? [];
    if (cruceFiles.length > 0) {
      formData.append('cruce_document', cruceFiles[0]);
    }

    const cedulasFiles = this.filesToUpload['cedulasEscaneadas'] ?? [];
    cedulasFiles.forEach((file) => {
      formData.append('cedulas', file);
    });

    const trasladosFiles = this.filesToUpload['traslados'] ?? [];
    trasladosFiles.forEach((file) => {
      formData.append('traslados', file);
    });

    return formData;
  }

  // ---------------------------------------------------------------------------
  // Botón ENVIAR (solo cuando todas las reglas se cumplen)
  // ---------------------------------------------------------------------------

  async onSubmit(): Promise<void> {
    this.closeSwal();

    const user = this.utilityService.getUser();

    if (!this.isArlValidado) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Debe validar el archivo ARL antes de enviar.',
        confirmButtonText: 'Aceptar',
      });
      return;
    }

    if (this.reporteForm.get('cruceDiario')?.value && !this.isCruceValidado) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Debe validar el cruce diario antes de enviar.',
        confirmButtonText: 'Aceptar',
      });
      return;
    }

    if (!this.reporteForm.valid) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, complete el formulario correctamente.',
        confirmButtonText: 'Aceptar',
      });
      return;
    }

    // Si no hubo contratos, igual se genera el reporte sin documentos obligatorios
    if (this.reporteForm.get('contratosHoy')?.value !== 'si') {
      // aquí solo aplican las reglas de datos generales
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
      }).then((result) => {
        if (result.isConfirmed) {
          this.router
            .navigateByUrl('/home', { skipLocationChange: true })
            .then(() => {
              this.router.navigate(['/reporte-contratacion']);
            });
        }
      });
    } catch (error) {
      this.closeSwal();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Hubo un problema al enviar el reporte. Inténtelo nuevamente.',
        confirmButtonText: 'Aceptar',
      });
    }
  }
}
