import { SharedModule } from '@/app/shared/shared.module';
import { Component, OnInit } from '@angular/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { HiringService } from '../../service/hiring.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';
import * as FileSaver from 'file-saver';
import { Router } from '@angular/router';
import { MatNativeDateModule } from '@angular/material/core'; // ¡importante!

@Component({
  selector: 'app-hiring-report',
  imports: [
    SharedModule,
    MatDatepickerModule,
    MatCheckboxModule,
    MatNativeDateModule, // Asegúrate de importar el módulo nativo de fecha

  ],
  templateUrl: './hiring-report.component.html',
  styleUrl: './hiring-report.component.css'
})
export class HiringReportComponent implements OnInit {
  reporteForm!: FormGroup;
  sedes: any[] = [];

  cedulasEscaneadasFileName: string = '';
  cruceDiarioFileName: string = '';
  induccionSSOFileName: string = '';
  trasladosFileName: string = '';
  arlFileName: string = '';

  filesToUpload: { [key: string]: File[] } = {};
  erroresValidacion = new MatTableDataSource<any>([]);

  isCruceValidado: boolean = false; // Bandera para el estado de validación del cruce
  datoscruced: any[] = [];
  // Variables para almacenar archivos en base64 y sus nombres
  cedulasBase64: { file_name: string; file_base64: string }[] = [];
  trasladosBase64: { file_name: string; file_base64: string }[] = [];
  cruceBase64: string = '';
  sstBase64: string = '';
  arlBase64: string = '';
  numeroContratosAlianza: number = 0;
  numeroContratosApoyoLaboral: number = 0;
  isArlValidado: boolean = true;
  nombre: string = '';
  processingErrors: string[] = [];


  constructor(
    private fb: FormBuilder,
    private router: Router,
    private utilityService: UtilityServiceService,
    private hiringService: HiringService
  ) {
    this.reporteForm = this.fb.group({
      cantidadContratosTuAlianza: [0],
      cantidadContratosApoyoLaboral: [0],
    });
  }

  async ngOnInit() {
    // Inicialización del formulario reactivo
    this.reporteForm = this.fb.group({
      sede: [null, Validators.required],
      esDeHoy: ['false'], // Inicializamos la lista desplegable con "false" (No)
      fecha: [null], // La validación se aplica condicionalmente
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
    if (user) {
      this.nombre = user.primer_nombre + ' ' + user.primer_apellido;
    }

    // Validación inicial del campo 'fecha' según el valor de 'esDeHoy'
    await this.manageFechaValidation();

    // Observador para 'esDeHoy' para actualizar la validación de 'fecha'
    this.reporteForm.get('esDeHoy')?.valueChanges.subscribe(async () => {
      await this.manageFechaValidation(); // Actualiza la validación cuando cambia el estado del checkbox
    });

    // Observador para el campo 'contratosHoy' para activar o desactivar validaciones
    this.reporteForm.get('contratosHoy')?.valueChanges.subscribe((value) => {
      if (value === 'si') {
        this.reporteForm
          .get('cedulasEscaneadas')
          ?.setValidators(Validators.required);
        this.reporteForm.get('arl')?.setValidators(Validators.required);
        this.reporteForm.get('cruceDiario')?.setValidators(Validators.required);
      } else {
        this.reporteForm.get('cedulasEscaneadas')?.clearValidators();
        this.reporteForm.get('arl')?.clearValidators();
        this.reporteForm.get('cruceDiario')?.clearValidators();
      }
      this.reporteForm.get('cedulasEscaneadas')?.updateValueAndValidity();
      this.reporteForm.get('arl')?.updateValueAndValidity();
      this.reporteForm.get('cruceDiario')?.updateValueAndValidity();
    });

    // Cargar sucursales
    const sucursalesObservable = await this.utilityService.traerSucursales();
    if (sucursalesObservable) {
      sucursalesObservable.subscribe((data: any) => {
        if (data && Array.isArray(data.sucursal)) {
          const sucursalesUnicas = data.sucursal.filter(
            (item: any, index: number, self: any[]) =>
              index === self.findIndex((t) => t.nombre === item.nombre)
          );
          this.sedes = sucursalesUnicas.sort((a: any, b: any) =>
            a.nombre.localeCompare(b.nombre)
          );
        } else {
          Swal.fire('Error', 'No se pudieron cargar las sedes', 'error');
        }
      });
    }
  }


  // Gestión dinámica de la validación de 'fecha'
  async manageFechaValidation() {
    const esDeHoy = this.reporteForm.get('esDeHoy')?.value;

    if (esDeHoy === 'true') {
      // Si es "Sí", quitamos la validación de fecha
      this.reporteForm.get('fecha')?.clearValidators();
      this.reporteForm.get('fecha')?.setValue(null); // Reiniciamos el valor si es necesario
    } else {
      // Si es "No", la fecha es obligatoria
      this.reporteForm.get('fecha')?.setValidators(Validators.required);
    }

    // Actualizamos la validación del campo fecha
    this.reporteForm.get('fecha')?.updateValueAndValidity();
    this.reporteForm.updateValueAndValidity(); // Aseguramos que el formulario se revalide completamente
  }

  onContratosHoyChange(event: any) {
    if (event.value === 'si') {
      // Mostrar los campos adicionales
    } else {
      // Reiniciar los campos adicionales
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
    }
  }

  onCheckboxChange(event: any, controlName: string) {
    this.reporteForm.get(controlName)?.setValue(event.checked);
    if (!event.checked) {
      this.filesToUpload[controlName] = [];
      this.updateFileName([], controlName);
    }
  }

  onFilesSelected(event: any, controlName: string) {
    const files = Array.from(event.target.files) as File[];
    if (files.length > 0) {
      this.filesToUpload[controlName] = files;
      this.updateFileName(files, controlName);
    }
  }

  onFileSelected(event: any, controlName: string) {
    const file = event.target.files[0]; // Asegúrate de que se seleccionó un archivo
    if (file) {
      this.updateFileName([file], controlName); // Actualizar el nombre del archivo mostrado
      this.filesToUpload[controlName] = [file]; // Guardar el archivo seleccionado en filesToUpload
    }
  }

  updateFileName(files: File[], controlName: string) {
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

  convertToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  }

  async processCedulasEscaneadas(files: File[]) {
    for (const file of files) {
      const base64 = await this.convertToBase64(file);
      let cedula = '';

      // Intentar dividir por ' - ' primero, luego por '-' si falla
      if (file.name.includes(' - ')) {
        cedula = file.name.split(' - ')[0];
      } else if (file.name.includes('-')) {
        cedula = file.name.split('-')[0];
      } else {
        continue; // Salta este archivo si no cumple con el formato esperado
      }

      // Añadir a la lista de archivos en base64 con el nombre original
      this.cedulasBase64.push({ file_name: file.name, file_base64: base64 });

      const data = {
        numero_cedula: cedula.trim(), // Eliminar espacios adicionales
        cedula_escaneada_delante: base64,
      };

      await this.hiringService.cargarCedula(data);
      await this.delay(100); // Espera de 100 ms
    }
  }

  async processTraslados(files: File[]) {
    // Lista de EPS válidas (en formato normalizado sin espacios)
    const validEPS = ['nuevaeps', 'saludtotal', 'famisanar'];

    for (const file of files) {
      let cedula = '';
      let eps = '';

      // Intentar dividir por ' - ' primero, luego por '-' si falla
      if (file.name.includes(' - ')) {
        [cedula, eps] = file.name.split(' - ');
      } else if (file.name.includes('-')) {
        [cedula, eps] = file.name.split('-');
      } else {
        continue; // Salta este archivo si no cumple con el formato esperado
      }

      // Normalizar EPS eliminando '.pdf', espacios adicionales y convirtiendo a minúsculas sin espacios
      eps = eps.replace('.pdf', '').replace(/\s+/g, '').toLowerCase();

      // Validar si la EPS normalizada es válida
      if (!validEPS.includes(eps)) {
        Swal.fire(
          'Error',
          `La EPS "${eps}" no es válida. Solo se permiten NUEVA EPS, SALUD TOTAL o FAMISANAR. Por favor, corrija los nombres.`,
          'error'
        );
        this.isCruceValidado = false;
        return;
      }

      const base64 = await this.convertToBase64(file);

      // Añadir a la lista de traslados en base64 con el nombre original
      this.trasladosBase64.push({ file_name: file.name, file_base64: base64 });
      const data = {
        numero_cedula: cedula.trim(), // Eliminar espacios adicionales
        eps_a_trasladar: eps.toUpperCase(), // Convertir de nuevo a mayúsculas para mostrar uniformidad
        solicitud_traslado: base64,
      };

      await this.hiringService.enviarTraslado(data);
    }
  }

  corregirFecha(fecha: string): string {
    const dateParts = fecha.split(/\/|-/);

    if (dateParts.length === 3) {
      let day = dateParts[0];
      let month = dateParts[1];
      let year = dateParts[2];

      // Convertir año corto a largo
      if (year.length === 2) {
        const currentYear = new Date().getFullYear();
        const century = Math.floor(currentYear / 100);
        year = (year >= '50' ? century - 1 : century) + year;
      }

      // Asegurar que el día y el mes sean de dos dígitos
      day = day.padStart(2, '0');
      month = month.padStart(2, '0');

      // Retornar fecha en formato dd/mm/yyyy
      return `${day}/${month}/${year}`;
    }

    return fecha; // Retornar la fecha sin cambios si no coincide con el patrón
  }

  removeSpecialCharacters = (text: string): string => {
    // Expresión regular ampliada para eliminar cualquier emoji, pictogramas y símbolos especiales
    const emojiPattern =
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F7E0}-\u{1F7EF}]/gu;

    return text.replace(emojiPattern, '');
  };

  private async extraerCedulasDelArchivo(file: File): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const bstr: string = e.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });

        try {
          const sheetName = workbook.SheetNames[0]; // Asumiendo que quieres la primera hoja
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            dateNF: 'dd/mm/yyyy',
          });
          json.shift(); // Eliminar el encabezado, si lo tiene

          // Obtener todas las cédulas de la columna 1 (índice 0)
          const cedulas: string[] = (json as any[])
            .map((row: any[]) => {
              const cedula = row[1]; // Columna de índice 0
              return cedula
                ? this.removeSpecialCharacters(
                  cedula.toString().replace(/\s/g, '')
                )
                : '';
            })
            .filter((cedula) => cedula !== ''); // Filtrar cédulas vacías

          resolve(cedulas);
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsBinaryString(file);
    });
  }

  private async contarALyTAEnColumna(
    file: File
  ): Promise<{ AL: number; TA: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e: any) => {
        const bstr: string = e.target.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });

        try {
          const sheetName = workbook.SheetNames[0]; // Asumiendo que quieres la primera hoja
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            raw: false,
            dateNF: 'dd/mm/yyyy',
          });
          json.shift(); // Eliminar el encabezado, si lo tiene

          let alCount = 0;
          let taCount = 0;

          // Recorrer cada fila y contar AL y TA en la columna 2 (índice 1)
          (json as any[]).forEach((row: any[]) => {
            const valor = row[2]; // Columna de índice 1
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

      reader.readAsBinaryString(file);
    });
  }

  private extraerCedulasDeArchivos(files: File[]): string[] {
    const cedulas: string[] = [];

    files.forEach((file) => {
      let cedula = '';

      // Intentar dividir por ' - ' primero, luego por '-'
      if (file.name.includes(' - ')) {
        cedula = file.name.split(' - ')[0];
      } else if (file.name.includes('-')) {
        cedula = file.name.split('-')[0];
      }

      if (cedula) {
        cedulas.push(cedula.trim()); // Agregar cédula a la lista, eliminando espacios
      }
    });

    return cedulas;
  }

  async ObtenerCedulasEscaneadas(files: File[]) {
    const cedulas = this.extraerCedulasDeArchivos(files);

    // Aquí puedes hacer lo que necesites con las cédulas extraídas
    return cedulas;
  }

  async ObtenerCedulasTraslados(files: File[]) {
    const cedulas = this.extraerCedulasDeArchivos(files);

    // Aquí puedes hacer lo que necesites con las cédulas extraídas
    return cedulas;
  }

  async validarTodo() {
    // Mostrar el modal de carga
    const loadingSwal = Swal.fire({
      icon: 'info',
      title: 'Cargando...',
      text: 'Extrayendo cédulas del archivo',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      // Verificar si se ha subido un archivo para el cruce diario
      const files = this.filesToUpload['cruceDiario'];
      if (!files || files.length === 0) {
        Swal.close(); // Cerrar el Swal de carga antes de mostrar el error
        await Swal.fire(
          'Error',
          'Debe cargar un archivo de cruce diario antes de validar',
          'error'
        );
        return;
      }
      const file = files[0]; // Archivo de cruce diario

      // Validar que ARL esté cargado
      const arlFiles = this.filesToUpload['arl'];
      if (!arlFiles || arlFiles.length === 0) {
        Swal.close(); // Cerrar el Swal de carga antes de mostrar el error
        await Swal.fire(
          'Error',
          'Debe cargar un archivo de ARL antes de validar',
          'error'
        );
        return;
      }

      // Verificar si se han subido cédulas escaneadas
      const cedulasEscaneadas = this.filesToUpload['cedulasEscaneadas'];
      if (!cedulasEscaneadas || cedulasEscaneadas.length === 0) {
        Swal.close(); // Cerrar el Swal de carga antes de mostrar el error
        await Swal.fire(
          'Error',
          'Debe cargar archivos de cédulas escaneadas antes de validar',
          'error'
        );
        return;
      }
      const cedulas = this.extraerCedulasDeArchivos(cedulasEscaneadas);

      // Si el checkbox de traslados está marcado, procesar las cédulas de traslados
      let cedulasTrasladosExtraidas: string[] = [];
      if (this.reporteForm.get('traslados')?.value) {
        const cedulasTraslados = this.filesToUpload['traslados'];
        if (!cedulasTraslados || cedulasTraslados.length === 0) {
          Swal.close(); // Cerrar el Swal de carga antes de mostrar el error
          await Swal.fire(
            'Error',
            'Debe cargar archivos de traslados si seleccionó esa opción',
            'error'
          );
          return;
        }
        cedulasTrasladosExtraidas =
          this.extraerCedulasDeArchivos(cedulasTraslados);
      }

      // Extraer cédulas del archivo Excel de cruce diario
      const cedulasExcel = await this.extraerCedulasDelArchivo(file);

      // Contar AL y TA en la columna 2 del archivo de cruce diario
      this.contarALyTAEnColumna(file)
        .then((result) => {
          this.reporteForm.controls['cantidadContratosTuAlianza'].setValue(
            result.TA
          );
          this.reporteForm.controls['cantidadContratosApoyoLaboral'].setValue(
            result.AL
          );
        })
        .catch((error) => {
          Swal.close(); // Cerrar el Swal de carga antes de mostrar el error
          Swal.fire(
            'Error',
            'Error al contar AL y TA en el archivo de cruce diario',
            'error'
          );
        });

      let mensaje = '';
      let consoleOutput = '';
      const erroresFormateados: {
        registro: string;
        errores: any[];
        tipo: string;
      }[] = []; // Para acumular todos los errores

      // Validación 1: Las cédulas escaneadas deben estar en el Excel (cédulas en escaneadas pero no en Excel)
      const cedulasFaltantesEnExcel = cedulas.filter(
        (c) => !cedulasExcel.includes(c)
      );
      if (cedulasFaltantesEnExcel.length > 0) {
        mensaje += `Faltan en el cruce diario las siguientes cédulas escaneadas: ${cedulasFaltantesEnExcel.join(
          ', '
        )}.\n`;
        consoleOutput += `Cédulas escaneadas faltantes en el Excel: ${cedulasFaltantesEnExcel.join(
          ', '
        )}.\n`;

        // Formatear los errores de cruce diario
        cedulasFaltantesEnExcel.forEach((cedula) => {
          erroresFormateados.push({
            registro: '0',
            errores: [
              'Cédula no encontrada en el Excel la cedula es la: ' + cedula,
            ],
            tipo: 'Cedula escaneada',
          });
        });
      }

      // Validación 2: Las cédulas del Excel que no están en las cédulas escaneadas (cédulas en Excel pero no en escaneadas)
      const cedulasExtrasEnExcel = cedulasExcel.filter(
        (c) => !cedulas.includes(c)
      );
      if (cedulasExtrasEnExcel.length > 0) {
        mensaje += `El cruce diario contiene las siguientes cédulas adicionales que no fueron escaneadas: ${cedulasExtrasEnExcel.join(
          ', '
        )}.\n`;
        consoleOutput += `Cédulas adicionales en el Excel: ${cedulasExtrasEnExcel.join(
          ', '
        )}.\n`;

        // Formatear los errores de cruce diario
        cedulasExtrasEnExcel.forEach((cedula) => {
          erroresFormateados.push({
            registro: '0',
            errores: [
              'Cédula en el Excel pero no escaneada la cedula es la: ' + cedula,
            ],
            tipo: 'Cedula escaneada',
          });
        });
      }

      // Validación 3: Las cédulas de traslados deben estar en el Excel (solo si se seleccionó traslados)
      if (cedulasTrasladosExtraidas.length > 0) {
        const cedulasTrasladosNoEnExcel = cedulasTrasladosExtraidas.filter(
          (c) => !cedulasExcel.includes(c)
        );
        if (cedulasTrasladosNoEnExcel.length > 0) {
          mensaje += `Las cédulas de los traslados que no están en el cruce diario: ${cedulasTrasladosNoEnExcel.join(
            ', '
          )}.\n`;
          consoleOutput += `Cédulas de los traslados faltantes en el Excel: ${cedulasTrasladosNoEnExcel.join(
            ', '
          )}.\n`;

          // Formatear los errores de traslados
          cedulasTrasladosNoEnExcel.forEach((cedula) => {
            erroresFormateados.push({
              registro: '0',
              errores: [
                'Cédula de traslado no encontrada en el Excel la cedula es la :' +
                cedula,
              ],
              tipo: 'Traslado',
            });
          });
        }
      }

      // Validación 4: La cantidad de cédulas escaneadas debe coincidir con las del Excel
      if (cedulas.length !== cedulasExcel.length) {
        mensaje += `El número de cédulas escaneadas (${cedulas.length}) no coincide con las cédulas del Excel (${cedulasExcel.length}).\n`;
        consoleOutput += `Diferencia en número de cédulas: Número de cédulas escaneadas (${cedulas.length}) vs número de cédulas en el Excel (${cedulasExcel.length}).\n`;
      }

      // Si hay errores, almacenarlos en this.erroresValidacion.data y luego enviarlos
      if (erroresFormateados.length > 0) {
        Swal.close(); // Asegurarse de cerrar el Swal de carga antes de mostrar el resultado

        // Guardar los errores en this.erroresValidacion.data
        this.erroresValidacion.data = erroresFormateados;

        // Identificar el tipo de errores para enviar
        const tipoErrores = this.reporteForm.get('traslados')?.value
          ? 'Traslado'
          : 'Cruce Diario';

        let payload = {
          errores: this.erroresValidacion.data, // Aquí los errores ya almacenados
          responsable: 'Nombre del Responsable', // Cambia esto dinámicamente si es necesario
          tipo: tipoErrores, // Se envía el tipo de error correcto
        };

        Swal.update({ text: 'Enviando todos los errores para guardar...' });

        // Enviar los errores almacenados
        await this.hiringService.enviarErroresValidacion(payload).then(
          () => {
            Swal.close();
            Swal.fire(
              'Error',
              'Se han encontrado errores en el archivo de cruce diario. Por favor, corrija los datos y vuelva a intentarlo.',
              'error'
            );
          },
          (error) => {
            Swal.close();
            Swal.fire('Error', 'Error al guardar los errores.', 'error');
          }
        );
      } else {
        Swal.close();
        this.isCruceValidado = true;

        // Validar el cruce diario
        await this.validarCruce();

        await Swal.fire({
          icon: 'success',
          title: 'Validación exitosa',
          text: 'Todas las cédulas coinciden con el cruce diario',
          heightAuto: false,
        });
      }
    } catch (error) {
      Swal.close(); // Asegurarse de cerrar el Swal de carga antes de mostrar el error
      await Swal.fire(
        'Error',
        'Error al procesar el archivo. Inténtelo de nuevo.',
        'error'
      );
    }
  }

  async validarCruce() {
    // Cierra cualquier posible alerta abierta
    Swal.close();

    const files = this.filesToUpload['cruceDiario'];

    if (!files || files.length === 0) {
      Swal.fire('Error', 'Debe cargar un archivo antes de validar', 'error');
      return;
    }

    // Primer mensaje: "Iniciando el proceso"
    Swal.fire({
      icon: 'info',
      title: 'Cargando...',
      text: 'Iniciando el proceso de validación',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    const file = files[0];
    const reader = new FileReader();

    reader.onload = async (e: any) => {
      const bstr: string = e.target.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });

      try {
        // Cierra el Swal anterior y abre uno nuevo
        Swal.close();
        Swal.fire({
          icon: 'info',
          title: 'Leyendo el archivo Excel...',
          text: 'Por favor, espere...',
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          dateNF: 'dd/mm/yyyy',
        });
        // Quitamos el encabezado
        json.shift();

        // Función para formatear fechas
        const formatDate = (date: string): string => {
          const regex_ddmmyyyy = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
          const regex_mmddyy = /^\d{1,2}\/\d{1,2}\/\d{2}$/;

          if (regex_ddmmyyyy.test(date)) {
            return date;
          } else if (regex_mmddyy.test(date)) {
            const [month, day, year] = date.split('/');
            const fullYear =
              parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
            return `${day.padStart(2, '0')}/${month.padStart(
              2,
              '0'
            )}/${fullYear}`;
          }
          return date;
        };

        const indicesFechas = [0, 8, 16, 24, 44, 134];

        // Transformamos cada fila del Excel
        const rows: string[][] = (json as any[][]).map((row: any[]) => {
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
                // Ejemplo: quitar comas, puntos, espacios y dejar solo números o x/X
                completeRow[index] = this.removeSpecialCharacters(
                  cell
                    .toString()
                    .replace(/,/g, '')
                    .replace(/\./g, '')
                    .replace(/\s/g, '')
                    .replace(/[^0-9xX]/g, '')
                );
              } else if (indicesFechas.includes(index)) {
                completeRow[index] = formatDate(
                  this.removeSpecialCharacters(cell.toString())
                );
              } else {
                completeRow[index] = this.removeSpecialCharacters(
                  cell.toString()
                );
              }
            }
          });

          return completeRow;
        });

        this.datoscruced = rows;

        // Cierra el swal anterior y abre uno nuevo indicando división en lotes
        Swal.close();
        Swal.fire({
          icon: 'info',
          title: 'Dividiendo los datos en lotes...',
          text: 'Por favor, espere...',
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        const batchSize = 1500;
        const totalBatches = Math.ceil(rows.length / batchSize);
        let allErrors: any[] = [];

        // Procesamos por lotes
        for (let i = 0; i < totalBatches; i++) {
          const batch = rows.slice(i * batchSize, (i + 1) * batchSize);

          // Cierra el swal anterior y abre uno nuevo para cada lote
          Swal.close();
          Swal.fire({
            icon: 'info',
            title: 'Validando lote...',
            text: `Enviando el lote ${i + 1
              } de ${totalBatches} para validación...`,
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          await this.hiringService
            .subirContratacionValidar(batch)
            .then((response) => {
              if (response.status === 'error') {
                allErrors.push(...response.errores);
              }
            });
        }

        // Cierra el swal anterior y abre uno nuevo para "Procesando errores..."
        Swal.close();
        Swal.fire({
          icon: 'info',
          title: 'Procesando errores...',
          text: 'Por favor, espere...',
          allowOutsideClick: false,
          showConfirmButton: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        // Guardamos los errores en nuestra estructura
        this.erroresValidacion.data = allErrors;

        // Luego, validar la ARL (asumiendo tienes la lógica en proccssArl)
        await this.proccssArl([this.filesToUpload['arl'][0]]);

        // Evaluamos si hay errores
        if (allErrors.length > 0) {
          // Formatear errores para el backend
          const erroresFormateados = [];

          for (const [registro, errorObj] of Object.entries(allErrors)) {
            erroresFormateados.push({
              registro: registro,
              errores: errorObj.errores || [],
            });
          }

          let payload = {
            errores: erroresFormateados,
            responsable: this.nombre,
            tipo: 'Documento de Contratación',
          };

          // Cierra el swal y abre uno nuevo "Enviando todos los errores..."
          Swal.close();
          Swal.fire({
            icon: 'info',
            title: 'Enviando errores...',
            text: 'Guardando errores encontrados...',
            allowOutsideClick: false,
            showConfirmButton: false,
            didOpen: () => {
              Swal.showLoading();
            },
          });

          await this.hiringService.enviarErroresValidacion(payload).then(
            () => {
              Swal.close();
              Swal.fire(
                'Error',
                'Se han encontrado errores en el archivo de cruce diario. Por favor, corrija los datos y vuelva a intentarlo.',
                'error'
              );
            },
            (error) => {
              Swal.close();
              Swal.fire('Error', 'Error al guardar los errores.', 'error');
            }
          );
        } else {
          // Si no hubo errores
          Swal.close();
          this.isCruceValidado = true;

          Swal.fire(
            'Completado',
            'Proceso de validación finalizado correctamente.',
            'success'
          );
        }
      } catch (error) {
        Swal.close();
        Swal.fire(
          'Error',
          'Error procesando el archivo. Verifique el formato e intente de nuevo.',
          'error'
        );
      }
    };

    reader.readAsBinaryString(file);
  }

  applyFilter(column: string, event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.erroresValidacion.filter = filterValue.trim().toLowerCase();
  }

  async processArl(workbook: XLSX.WorkBook): Promise<void> {
    let confirmarErrores = true;

    this.arlBase64 = await this.convertToBase64(this.filesToUpload['arl'][0]);

    Swal.fire({
      title: 'Cargando...',
      icon: 'info',
      text: 'Procesando archivo de ARL. Por favor, espere unos segundos.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      // Asumiendo que dataArl ya está definido como en tu código
      const sheetArl = workbook.Sheets[workbook.SheetNames[0]];

      const dataArl = XLSX.utils.sheet_to_json(sheetArl, {
        header: 1,

        raw: true,
        defval: '',
      });

      // Extraer encabezados de la primera fila
      const datos = dataArl[0] as string[];

      // Buscar las posiciones de los encabezados
      const dniTrabajadorIndex = datos.indexOf('DNI TRABAJADOR');

      const inicioVigenciaIndex = datos.indexOf('INICIO VIGENCIA');

      // Validar si se encontraron
      if (dniTrabajadorIndex == -1) {
        Swal.fire(
          'Error',
          'No se encontró el encabezado "DNI TRABAJADOR" en el archivo de ARL. Tiene que tener encabezados',
          'error'
        );
      }
      if (inicioVigenciaIndex == -1) {
        Swal.fire(
          'Error',
          'No se encontró el encabezado "INICIO VIGENCIA" en el archivo de ARL. Tiene que tener encabezados',
          'error'
        );
      }

      // Continuar con el mapeo de filas, si es necesario
      const rowsArl = (dataArl as any[][]).map((row) => {
        if (row[9] && typeof row[9] === 'number') {
          row[9] = this.excelSerialToJSDate(row[9]);
        }
        return row;
      });
      // Eliminar la primera fila (encabezados)
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

            const formatDate = (dateStr: string | number) => {
              if (typeof dateStr === 'number') {
                // Si es un número, se interpreta como una fecha en formato Excel
                const excelEpoch = new Date(1899, 11, 30); // Base para fechas en Excel
                return new Date(
                  excelEpoch.getTime() + dateStr * 24 * 60 * 60 * 1000
                );
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

            const fechaArl = formatDate(comparativoArl);
            const fechaCruce = formatDate(comparativoCruce);

            // Comparar fechas
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
            Errores: 'OK', // Inicializamos con "OK" por defecto
          };

          headers.forEach((header, index) => {
            resultado[header] = cruceRow[index] || 'NO DISPONIBLE';
          });

          const registroErrores = this.erroresValidacion.data.find(
            (err: any) => err.registro == index + 1
          );
          if (registroErrores && registroErrores.errores.length > 0) {
            confirmarErrores = false;
            resultado['Errores'] = registroErrores.errores.join(', ');
          }

          return resultado;
        }
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
      const cedulasWorksheet = workbookOut.addWorksheet(
        'Cédulas No Encontradas'
      );
      cedulasWorksheet.columns = [
        { header: 'Cédula', key: 'cedula', width: 20 },
      ];
      cedulasNoEncontradas.forEach((cedula) => {
        cedulasWorksheet.addRow({ cedula });
      });

      workbookOut.xlsx.writeBuffer().then((buffer) => {
        const blob = new Blob([buffer], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        FileSaver.saveAs(blob, 'ReporteARL.xlsx');
      });
      // Cerrar el Swal de carga
      Swal.close();

      // Mostrar el Swal de éxito después de cerrar el anterior
      setTimeout(() => {
        if (this.isArlValidado) {
          Swal.fire({
            icon: 'success',
            title: 'Validación exitosa',
            text: 'Todos los datos de ARL coinciden con el cruce diario',
            heightAuto: false,
          });
          Swal.close();
        } else {
          Swal.fire({
            icon: 'error',
            title: 'El arl tiene problemas',
            text: 'Se han encontrado discrepancias en los datos de ARL. Por favor, revise los datos y vuelva a intentarlo. Si tiene errores en la base tambien se mostraran',
            heightAuto: false,
          });
          Swal.close();
        }
      }, 500);
    } catch (error) {
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al procesar los datos. Por favor, inténtelo de nuevo.',
        confirmButtonText: 'Aceptar',
      });
    }
  }

  excelSerialToJSDate(serial: number): string {
    const utc_days = Math.floor(serial - 25569);
    const date = new Date(utc_days * 86400 * 1000);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async processFileList(files: File[]) {
    for (const file of files) {
      await this.processFile(file);
    }
  }

  async processFile(file: File) {
    try {
      const base64 = await this.convertToBase64(file);

      // Compara el nombre del archivo para identificar si es el archivo de inducción SSO
      const induccionSSOFile = this.filesToUpload['induccionSSO']?.[0];
      if (file.name === induccionSSOFile?.name) {
        this.sstBase64 = base64;
      }
    } catch (error) {
      this.processingErrors.push('archivo');
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `Ocurrió un error al procesar el archivo, inténtelo de nuevo.`,
      });
    }
  }

  async processExcelFiles(files: File[]) {
    for (const file of files) {
      await this.processExcel(file); // Asegurarse de que cada archivo se procese completamente antes de pasar al siguiente
    }
  }

  async proccssArl(files: File[]) {
    for (const file of files) {
      await this.processExcelFileaRL(file);
    }
  }

  async processExcel(file: File) {
    const bstr: string = await this.readFileAsBinaryString(file); // Esperar hasta que se lea el archivo como cadena binaria
    const workbook = XLSX.read(bstr, { type: 'binary' });
    await this.processContratacion(workbook); // Esperar hasta que termine el procesamiento del archivo
  }

  // Convertir FileReader en promesa para poder utilizar await
  readFileAsBinaryString(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        resolve(e.target.result);
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsBinaryString(file);
    });
  }

  async processExcelFileaRL(file: File) {
    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const bstr: string = e.target.result;
      const workbook = XLSX.read(bstr, { type: 'binary' });
      await this.processArl(workbook);
    };
    reader.readAsBinaryString(file);
  }

  async processContratacion(workbook: XLSX.WorkBook): Promise<void> {
    let response: any;

    // Copiar el Excel en base64
    this.cruceBase64 = await this.convertToBase64(
      this.filesToUpload['cruceDiario'][0]
    );

    try {
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        dateNF: 'dd/mm/yyyy',
      });
      json.shift(); // Eliminar la fila de encabezados si es necesario

      const formatDate = (date: string): string => {
        const regex_ddmmyyyy = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        const regex_mmddyy = /^\d{1,2}\/\d{1,2}\/\d{2}$/;

        if (regex_ddmmyyyy.test(date)) {
          return date;
        } else if (regex_mmddyy.test(date)) {
          const [month, day, year] = date.split('/');
          const fullYear = parseInt(year, 10) < 50 ? `20${year}` : `19${year}`;
          return `${day.padStart(2, '0')}/${month.padStart(
            2,
            '0'
          )}/${fullYear}`;
        }
        return date;
      };

      const indicesFechas = [0, 8, 16, 24, 44, 134];

      const rows: string[][] = (json as any[][]).map((row: any[]) => {
        const completeRow = new Array(195).fill('-'); // Inicializar la fila con un array vacío de 195 elementos

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
                  .replace(/,/g, '') // Elimina comas
                  .replace(/\./g, '') // Elimina puntos
                  .replace(/\s/g, '') // Elimina espacios
                  .replace(/[^0-9xX]/g, '') // Elimina todo excepto números y 'x' o 'X'
              );
            } else if (index === 3) {
              completeRow[index] = this.removeSpecialCharacters(
                cell
                  .toString()
                  .replace(/,/g, '') // Elimina comas
                  .replace(/\./g, '') // Elimina puntos
                  .replace(/\s/g, '') // Elimina espacios
              );
            } else if (indicesFechas.includes(index)) {
              completeRow[index] = formatDate(
                this.removeSpecialCharacters(cell.toString())
              );
            } else {
              completeRow[index] = this.removeSpecialCharacters(
                cell.toString()
              );
            }
          }
        });

        return completeRow;
      });

      this.datoscruced = rows; // Guardar los datos procesados

      // Esperar a la respuesta de la subida del archivo
      response = await this.hiringService.subirContratacion(rows);

      // Manejar respuesta
      if (response.message !== 'success') {
        this.processingErrors.push('Cruce diario Excel');
      }
    } catch (error) {
      this.processingErrors.push('Cruce diario Excel');
    }
  }

  async generateErrorExcel(errores: any[]): Promise<void> {
    const worksheetData = [['Registro', 'Campo', 'Error']];

    errores.forEach((error: any) => {
      worksheetData.push([error.registro, error.campo, error.error]);
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const workbook: XLSX.WorkBook = {
      Sheets: { Errores: worksheet },
      SheetNames: ['Errores'],
    };

    const excelBuffer: any = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });

    this.saveAsExcelFile(excelBuffer, 'Errores_Contratacion');
  }

  saveAsExcelFile(buffer: any, fileName: string): void {
    const data: Blob = new Blob([buffer], { type: 'application/octet-stream' });
    const url: string = window.URL.createObjectURL(data);

    const link: HTMLAnchorElement = document.createElement('a');
    link.href = url;
    link.download = `${fileName}.xlsx`;
    link.click();

    window.URL.revokeObjectURL(url);
  }

  isExcelDate(serial: number): boolean {
    return serial > 25569 && serial < 2958465;
  }

  excelSerialToJSDate2(serial: number): string {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const day = date.getUTCDate().toString().padStart(2, '0');
    const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  async onSubmit() {
    // Cerrar cualquier alerta que haya quedado abierta
    Swal.close();

    // Obtenemos la información del usuario
    const user = await this.hiringService.getUser();

    // Validaciones previas a la carga
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

    // Verificamos si el formulario es válido
    if (this.reporteForm.valid) {
      // Si se seleccionó "sí" para contratosHoy
      if (this.reporteForm.get('contratosHoy')?.value === 'si') {
        this.processingErrors = [];

        // Definimos los procesos a ejecutar
        const processes = [
          {
            key: 'cedulasEscaneadas',
            name: 'Cédulas Escaneadas',
            process: this.processCedulasEscaneadas.bind(this),
          },
          {
            key: 'cruceDiario',
            name: 'Cruce diario Excel',
            process: this.processExcelFiles.bind(this),
          },
          {
            key: 'induccionSSO',
            name: 'Inducción en SST',
            process: this.processFileList.bind(this),
          },
          {
            key: 'traslados',
            name: 'Traslados',
            process: this.processTraslados.bind(this),
          },
        ];

        // Ejecutamos todos los procesos en paralelo
        const processPromises = processes.map(async ({ key, name, process }) => {
          if (this.reporteForm.get(key)?.value) {
            const files = this.filesToUpload[key];
            try {
              Swal.fire({
                icon: 'info',
                title: 'Procesando',
                html: 'Por favor, espere...',
                allowOutsideClick: false,
                didOpen: () => {
                  Swal.showLoading();
                },
              });
              await process(files);
            } catch (error) {
              this.processingErrors.push(name);
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: `Ocurrió un error al procesar ${name}. Por favor, inténtelo de nuevo.`,
                confirmButtonText: 'Aceptar',
              });
            }
          }
        });

        await Promise.all(processPromises);

        // Si hubo errores en alguno de los procesos, los mostramos (pero se continúa el flujo)
        if (this.processingErrors.length > 0) {
          Swal.fire({
            icon: 'error',
            title: 'Errores durante la carga',
            html: `Ocurrieron errores al procesar los siguientes elementos:
                  <ul>${this.processingErrors
                .map((err) => `<li>${err}</li>`)
                .join('')}</ul>`,
            confirmButtonText: 'Aceptar',
          });
        }

        // Cerramos el Swal de "Procesando" antes de mostrar el siguiente
        Swal.close();

        try {
          // ================================
          // AQUÍ DEFINIMOS reporteData
          // ================================
          const reporteData = {
            sede: this.reporteForm.get('sede')?.value.nombre,
            fecha: this.reporteForm.get('fecha')?.value,
            contratosHoy: this.reporteForm.get('contratosHoy')?.value,
            cantidadContratosTuAlianza:
              this.reporteForm.get('cantidadContratosTuAlianza')?.value || 0,
            cantidadContratosApoyoLaboral:
              this.reporteForm.get('cantidadContratosApoyoLaboral')?.value || 0,
            nota: this.reporteForm.get('notas')?.value,
            // Estas variables base64 se van llenando en los métodos "process..."
            // Asegúrate de que estén actualizadas correctamente.
            cedulas:
              this.cedulasBase64.length > 0
                ? this.cedulasBase64
                : 'No se han cargado las cédulas.',
            traslados:
              this.trasladosBase64.length > 0
                ? this.trasladosBase64
                : 'No se han cargado traslados.',
            cruce:
              this.cruceBase64 !== ''
                ? this.cruceBase64
                : 'No se ha cargado el cruce.',
            sst:
              this.sstBase64 !== ''
                ? this.sstBase64
                : 'No se ha cargado la inducción SST.',
            nombre: `${user.primer_nombre} ${user.primer_apellido}`,
            arl:
              this.arlBase64 !== ''
                ? this.arlBase64
                : 'No se ha cargado el archivo ARL.',
          };

          // Enviamos el reporte
          await this.hiringService.cargarReporte(reporteData);

          Swal.fire({
            icon: 'success',
            title: 'Reporte enviado',
            text: 'El reporte se ha enviado correctamente.',
            confirmButtonText: 'Aceptar',
          }).then((result) => {
            if (result.isConfirmed) {
              // Navegación de ejemplo al finalizar
              this.router
                .navigateByUrl('/home', { skipLocationChange: true })
                .then(() => {
                  this.router.navigate(['/reporte-contratacion']);
                });
            }
          });
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al enviar el reporte. Inténtelo nuevamente.',
            confirmButtonText: 'Aceptar',
          });
        }
      } else {
        // Si contratosHoy !== 'si'

        // Cerramos el loader
        Swal.close();

        // Preparamos la data para el reporte
        const reporteData = {
          sede: this.reporteForm.get('sede')?.value.nombre,
          fecha: this.reporteForm.get('fecha')?.value,
          contratosHoy: this.reporteForm.get('contratosHoy')?.value,
          cantidadContratosTuAlianza:
            this.reporteForm.get('cantidadContratosTuAlianza')?.value || 0,
          cantidadContratosApoyoLaboral:
            this.reporteForm.get('cantidadContratosApoyoLaboral')?.value || 0,
          nota: this.reporteForm.get('notas')?.value,
          cedulas:
            this.cedulasBase64.length > 0
              ? this.cedulasBase64
              : 'No se han cargado las cédulas.',
          traslados:
            this.trasladosBase64.length > 0
              ? this.trasladosBase64
              : 'No se han cargado traslados.',
          cruce:
            this.cruceBase64 !== ''
              ? this.cruceBase64
              : 'No se ha cargado el cruce.',
          sst:
            this.sstBase64 !== ''
              ? this.sstBase64
              : 'No se ha cargado la inducción SST.',
          nombre: `${user.primer_nombre} ${user.primer_apellido}`,
          arl:
            this.arlBase64 !== ''
              ? this.arlBase64
              : 'No se ha cargado el archivo ARL.',
        };

        try {
          // Enviamos el reporte
          await this.hiringService.cargarReporte(reporteData);

          Swal.fire({
            icon: 'success',
            title: 'Reporte enviado',
            text: 'El reporte se ha enviado correctamente.',
            confirmButtonText: 'Aceptar',
          }).then((result) => {
            if (result.isConfirmed) {
              // Navegación de ejemplo al finalizar
              this.router
                .navigateByUrl('/home', { skipLocationChange: true })
                .then(() => {
                  this.router.navigate(['/reporte-contratacion']);
                });
            }
          });
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al enviar el reporte. Inténtelo nuevamente.',
            confirmButtonText: 'Aceptar',
          });
        }
      }
    } else {
      // Si el formulario no es válido
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor, complete el formulario correctamente.',
        confirmButtonText: 'Aceptar',
      });
    }
  }

}
