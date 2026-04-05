import {  Component , ChangeDetectionStrategy } from '@angular/core';
import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { IncapacidadService } from '../../services/incapacidad/incapacidad.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { NgClass } from '@angular/common';
import { MatSelectModule } from '@angular/material/select';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// Definimos las claves de tipo de archivo
type ArchivoKeys =
  | 'arl'
  | 'ss'
  | 'reporte_incapacidades'
  | 'movimientos_bancos'
  | 'factura_elite'

interface Archivo {
  filename: ArchivoKeys; // Debe coincidir con una de las definidas en ArchivoKeys
  title: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-subida-archivos-incapacidades',
  standalone: true,
  imports: [
    InfoCardComponent,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    FormsModule,
    MatCardModule
],
  templateUrl: './subida-archivos-incapacidades.component.html',
  // OJO: debe ser 'styleUrls' (en plural)
  styleUrls: ['./subida-archivos-incapacidades.component.css'],
} )
export class SubidaArchivosIncapacidadesComponent {
  isSidebarHidden = false;
  resultsincapacidades: any[] = [];
  resultsarl: any[] = [];
  resultssst: any[] = [];

  user: any;
  correo: any;
  filteredData: any[] = [];
  isSearchded = false;
  overlayVisible = false;
  loaderVisible = false;
  counterVisible = false;

  // Array donde guardaremos los datos parseados
  codigosDiagnosticos: { codigo: string; descripcion: string }[] = [];
  // Listado de archivos esperados
  fileList: Archivo[] = [
    { title: 'Cargar ARL', filename: 'arl' },
    { title: 'Cargar SST', filename: 'ss' },
    {
      title: 'Cargar reporte incapacidades pagas',
      filename: 'reporte_incapacidades',
    },
    { title: 'Cargar movimientos bancos', filename: 'movimientos_bancos' },
    { title: 'Cargar factura Élite', filename: 'factura_elite' },
  ];

  // Configuración para generar y descargar plantillas
  archivos: Record<ArchivoKeys, { nombre: string; headers: string[] }> = {
    arl: {
      nombre: 'arl.xlsx',
      headers: [
        'CONTRATO',
        'EMPRESA',
        'ID EMPRESA',
        'ID TRABAJADOR',
        'SEGUNDO APELLIDO',
        'NOMBRE',
        'SEXO',
        'EPS',
        'AFP',
        'FECHA NACIMIENTO',
        'CARGO',
        'CODIGO SUCURSAL',
        'NOMBRE SUCURSAL',
        'CODIGO CENTRO DE TRABAJO',
        'NOMBRE CENTRO TRABAJO',
        'PORCENTAJE COTIZACION',
        'CÓDIGO ACTIVIDAD ECONÓMICA',
        'DESCRIPCIÓN ACTIVIDAD ECONÓMICA',
        'CIUDAD',
        'FECHA INGRESO',
        'FECHA RETIRO PROGRAMADO',
        'ESTADO COBERTURA',
        'TIPO AFILIADO',
        'TASA DE RIESGO INDEPENDIENTE',
        'TELETRABAJO',
        'TRABAJO REMOTO',
        'TRABAJO EN CASA',
        'TIPO DE COTIZANTE',
      ],
    },
    ss: {
      nombre: 'ss.xlsx',
      headers: [
        'Tipo Id',
        'No. Identificación',
        'Razón Social',
        'Clase Aportante',
        'Tipo Aportante',
        'Fecha de pago',
        'Periodo Pensión',
        'Periodo Salud',
        'Tipo Planilla',
        'Clave',
        'Tipo Id',
        'No. Identificación',
        'Nombre',
        'Ciudad',
        'Depto',
        'Salario',
        'Integral',
        'Tipo Cotizante',
        'Subtipo cotizante',
        'Horas Laboradas',
        'Es Extranjero',
        'Residente Ext.',
        'Fecha Residencia Ext.',
        'Código',
        'Centro de trabajo',
        'Nombre',
        'Código',
        'Dirección',
        'I N G',
        'Fecha ING',
        'R E T',
        'Fecha RET',
        'T A E',
        'T D E',
        'T A P',
        'T D P',
        'V S P',
        'Fecha VSP',
        'V S T',
        'S L N',
        'Inicio SLN',
        'Fin SLN',
        'I G E',
        'Inicio IGE',
        'Fin IGE',
        'L M A',
        'Inicio LMA',
        'Fin LMA',
        'V A C',
        'Inicio VAC',
        'Fin VAC',
        'A V P',
        'V C T',
        'Inicio VCT',
        'Fin VCT',
        'I R L',
        'Inicio IRL',
        'Fin IRL',
        'V I P',
        'C O R',
        'Administradora',
        'Nit',
        'Código',
        'Días',
        'IBC',
        'Tarifa',
        'Aporte',
        'Tarifa empleado',
        'Aporte empleado',
        'FSP',
        'FS',
        'Voluntaria Empleado',
        'Valor no retenido',
        'Total Empleado',
        'Tarifa Empleador',
        'Aporte empleador',
        'Voluntaria Empleador',
        'Total Empleador',
        'Total AFP',
        'AFP Destino',
        'Administradora',
        'Nit',
        'Código',
        'Días',
        'IBC',
        'Tarifa',
        'Aporte',
        'UPC',
        'Tarifa empleado',
        'Aporte empleado',
        'Tarifa Empleador',
        'Aporte empleador',
        'Total EPS',
        'EPS Destino',
        'Administradora',
        'Nit',
        'Código',
        'Días',
        'IBC',
        'Tarifa',
        'Aporte',
        'Administradora',
        'Nit',
        'Código',
        'Días',
        'IBC',
        'Tarifa',
        'Clase Riesgo',
        'Aporte',
        'Días',
        'IBC',
        'Tarifa',
        'Aporte',
        'Tarifa',
        'Aporte',
        'Tarifa',
        'Aporte',
        'Tarifa',
        'Aporte',
        'Exonerado SENA e ICBF',
        'Total Aportes',
      ],
    },
    reporte_incapacidades: {
      nombre: 'reporte_incapacidades.xlsx',
      headers: [
        'temporal',
        'entidad',
        'TIPO_ID_AFILIADO',
        'IDENTIFICACION_AFILIADO',
        'NOMBRES_AFILIADO',
        'NRO_INCAPACIDAD',
        'FECHA_INICIO',
        'FECHA_FÍN',
        'DÍAS_OTORGADOS',
        'CONTINGENCIA',
        'DIAGNÓSTICO',
        'IBL',
        'DÍAS_PAGADOS',
        'VALOR_PAGADO',
        'FECHA_PAGO',
        'NRO_COMPROBANTE_PAGO',
        'GRUPO DE INCAPACIDADES',
      ],
    },
    movimientos_bancos: {
      nombre: 'movimientos_bancos.xlsx',
      headers: [
        'FECHA',
        'TIPO DOC.',
        'NÚMERO DOC.',
        'CUENTA',
        'CONCEPTO',
        'NOMBRE DEL TERCERO',
        'NOMBRE C. DE COSTO',
        'CUENTA BANCARIA',
        'USUARIO',
        'NOMBRE CUENTA',
        'DEBITO',
        'GRUPO DE INCAPACIDADES',
      ],
    },
    factura_elite: {
      nombre: 'factura_elite.xlsx',
      headers: [
        'Grupo',
        'Cedula',
        'Nombres y Apellidos',
        'Fecha Ingreso',
        'Suma de Dias incapacidad enf gral menor a 2d',
        'Suma de Dias Incapacidad enf grl desde 3d',
        'Verificacion Existencia Incapacidad',
        'Arreglo de Incapacidades registradas',
        'Dias Empresa Usuaria',
        'Dias EPS',
        'Confirmacion Dias Empresa Usuaria',
        'Confirmacion Dias EPS',
        'tabla de indicadores',
      ],
    },
  };

  constructor(
    private incapacidadService: IncapacidadService,
    private router: Router
  ) {}

  // Métodos para controlar el overlay y el loader
  toggleSidebar() {
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  playSound(success: boolean): void {
    const audio = new Audio(
      success ? 'Sounds/positivo.mp3' : 'Sounds/negativo.mp3'
    );
    audio.play();
  }

  toggleOverlay(visible: boolean): void {
    this.overlayVisible = visible;
  }

  toggleLoader(visible: boolean, showCounter: boolean = false): void {
    this.loaderVisible = visible;
    this.counterVisible = showCounter;
  }

  // Asigna claves a los datos en función del tipo de archivo
  asignarClaves(data: any[], fileType: string): any[] {
    if (data.length === 0) {
      return []; // Si el archivo está vacío, retorna un array vacío
    }

    const headers = data[0]; // La primera fila contiene los nombres de las columnas
    const rows = data.slice(1); // Omitir la primera fila (encabezados)

    return rows.map((row: any) => {
      const modifiedRow: any = {};

      if (fileType === 'codigos_diagnostico') {
        // Solo asignar "Código" y "Descripción"
        modifiedRow['Código'] = row[0] ?? 'N/A';
        modifiedRow['Descripción'] = row[1] ?? 'N/A';
      } else {
        // Para otros archivos, asignar cada header
        headers.forEach((header: string, index: number) => {
          modifiedRow[header] = row[index] !== null ? row[index] : 'N/A';
        });
      }
      return modifiedRow;
    });
  }

  // Identifica el tipo de archivo según el nombre del archivo
  identifyFileType(fileName: string): ArchivoKeys {
    const lower = fileName.toLowerCase();
    if (lower.includes('arl')) return 'arl';
    // Corregimos: Si es 'ss', devolvemos 'ss', no 'sst'
    if (lower.includes('ss')) return 'ss';
    if (lower.includes('reporte')) return 'reporte_incapacidades';
    if (lower.includes('movimientos')) return 'movimientos_bancos';
    if (lower.includes('factura')) return 'factura_elite';
    // Si no hay coincidencia
    return 'arl'; // o el que quieras como "fallback"
  }

  // Trigger para el input de archivos (botón que abre el diálogo de archivos)
  triggerFileInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.click();
  }

  triggerFileInput2(): void {
    // Cambiamos a 'fileInputDiag'
    const fileInput = document.getElementById(
      'fileInputDiag'
    ) as HTMLInputElement;
    fileInput.click();
  }

  // Carga y procesa los archivos Excel seleccionados
  cargarExcel(event: any): void {
    this.toggleLoader(true, true);
    this.toggleOverlay(true);

    const files = event.target.files;

    if (!files.length) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Por favor seleccione al menos un archivo Excel',
      });
      this.toggleLoader(false);
      this.toggleOverlay(false);
      return;
    }

    const fileNames: { [key: string]: string } = {};
    const fileData: { [key: string]: any[] } = {};
    let filesProcessed = 0;

    // Función para procesar cada archivo
    const processExcelFile = (file: File) => {
      const reader = new FileReader();
      const key = this.identifyFileType(file.name); // Identificar tipo de archivo dinámicamente

      reader.onload = (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {
          type: 'array',
          cellDates: true,
          cellNF: false,
          cellText: false,
        });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convertir la hoja a JSON y usar la primera fila como claves
        const rows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          dateNF: 'dd/mm/yyyy',
        });
        console.log('Rows:', rows);
        // Asignar claves usando los encabezados de la primera fila
        const modifiedRows = this.asignarClaves(rows, key);
        fileNames[key] = file.name;
        fileData[key] = modifiedRows;
        filesProcessed++;

        // Cuando todos los archivos hayan sido procesados...
        if (filesProcessed === files.length) {
          // Llamamos al service que se encarga de la subida
          this.incapacidadService.uploadFiles(fileData, fileNames).subscribe(
            (responses: any[]) => {
              // Verificar si todas las respuestas son exitosas
              const allSuccess = responses.every(
                (resp) => resp.status === 'success'
              );

              if (allSuccess) {
                Swal.fire({
                  icon: 'success',
                  title: 'Éxito',
                  text: 'Todos los archivos han sido cargados correctamente',
                });
              } else {
                // Filtrar respuestas fallidas
                const failedResponses = responses.filter(
                  (r) => r.status !== 'success'
                );
                const messages = failedResponses
                  .map((resp) => resp.message)
                  .join('\n');

                Swal.fire({
                  icon: 'error',
                  title: 'Error',
                  text: `Ocurrieron errores en algunas solicitudes:\n${messages}`,
                });
              }
              this.toggleLoader(false);
              this.toggleOverlay(false);
            },
            (error: any) => {
              Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ha ocurrido un error al cargar los archivos',
              });
              this.toggleLoader(false);
              this.toggleOverlay(false);
            }
          );
        }
      };
      reader.readAsArrayBuffer(file);
    };

    // Iterar sobre cada archivo seleccionado
    for (let i = 0; i < files.length; i++) {
      processExcelFile(files[i]);
    }
    this.resetInput();
  }

  // Genera y descarga la plantilla Excel
  downloadFile(nombreArchivo: ArchivoKeys) {
    const archivo = this.archivos[nombreArchivo];
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Datos');

    // Agregar encabezados
    worksheet.addRow(archivo.headers);

    // Guardar el archivo Excel en el navegador
    workbook.xlsx.writeBuffer().then((data) => {
      const blob = new Blob([data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, archivo.nombre);
    });
  }

  // Cuando se seleccione el archivo Excel, se dispara este método
  onFileChange(event: any): void {
    const file =
      event.target.files && event.target.files.length
        ? event.target.files[0]
        : null;
    if (!file) return; // si el usuario cancela o no selecciona archivo

    const reader = new FileReader();
    reader.onload = (e: any) => {
      // Leemos el contenido en binario
      const data = new Uint8Array(e.target.result);
      // parseamos el workbook con XLSX
      const workbook = XLSX.read(data, { type: 'array' });

      // Tomamos la primera hoja del libro
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // sheet_to_json con header: 1 para obtener arreglo de arreglos
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // quitar la primera fila (encabezados)
      rows.shift();

      this.codigosDiagnosticos = rows.map((row: any) => {
        return {
          codigo: row[0] ?? 'N/A',
          descripcion: row[1] ?? 'N/A',
        };
      });

      console.log('Contenido parseado:', this.codigosDiagnosticos);

      this.incapacidadService
        .actualizarCodigosDiagnostico(this.codigosDiagnosticos)
        .then((response) => {
          console.log('✅ Respuesta recibida:', response); // Imprime la respuesta del servidor

          Swal.fire({
            icon: 'success',
            title: 'Éxito',
            text: `Códigos de diagnóstico actualizados correctamente (${response.count} registros)`, // Muestra la cantidad insertada
          });
        })
        .catch((error) => {
          console.error('❌ Error al actualizar códigos:', error);

          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Hubo un problema al actualizar los códigos de diagnóstico',
          });
        });
    };
    this.resetInput2();
    // Leemos el archivo como ArrayBuffer
    reader.readAsArrayBuffer(file);
  }

  resetInput(): void {
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput.value = '';
  }

  resetInput2(): void {
    // Cambiamos a 'fileInputDiag'
    const fileInput = document.getElementById(
      'fileInputDiag'
    ) as HTMLInputElement;
    fileInput.value = '';
  }
}
