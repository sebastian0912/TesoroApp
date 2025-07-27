import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { FormControl } from '@angular/forms';
import { debounceTime } from 'rxjs';
import Swal from 'sweetalert2';
import { ActivosService } from '../../service/activos/activos.service';
import * as XLSX from 'xlsx';

@Component({
  selector: 'app-income',
  imports: [
    SharedModule,
    InfoCardComponent
  ],
  templateUrl: './income.component.html',
  styleUrl: './income.component.css'
})
export class IncomeComponent {
  clavesActivos = ['numero_cedula', 'codigo_contrato', 'nombre_finca'];
  clavesRetiros = ['numero_cedula', 'codigo_contrato', 'fecha_fin'];
  fincasPermitidas = [
    'HMVE SAS',
    'AGROIDEA',
    'FLORES EL REBAÑO',
    'MELODY FLOWERS',
    'FLORES SAGARO',
    'BMC',
    'FLORES DEL RIO',
    'AGRICOLA CARDENAL',
    'FLORES IPANEMA',
    'TURFLOR',
    'FLORES SAN JUAN',
    'AGROINDUSTRIAL DON EUSEBIO',
    'FLORES DE LOS ANDES',
    'CAFARCOL',
    'CASA DENTAL',
    'MARIBEL BALLESTEROS',
    'DANIELA LEON',
    'DELI POLLO',
    'FALCON FARMS',
    'FRUITSFULL COMPANY',
    'C.I. JARDINES DE LOS ANDES SAS',
    'VALMAR PRODUCTORA SAS',
    'AMANCAY SAS',
    'C.I. CALAFATE SAS',
    'FLORES CAMPO VERDE SAS',
  ];
  tipoArchivo: string | null = null;
  isSidebarHidden = false;
  activos: any[] = [];
  inactivos: any[] = [];
  activosFiltrados: any[] = [];
  inactivosFiltrados: any[] = [];
  searchControl = new FormControl('');

  constructor(private activosService: ActivosService) {}

  ngOnInit(): void {
    this.loadOperarios();
  }

  loadOperarios(): void {
    this.activosService.listarActivos().subscribe({
      next: (response) => {
        console.log('Activos:', response);
        this.activos = response.activos.map((a: any) => ({
          ...a,
          mostrarDetalles: false,
        }));
        this.inactivos = response.inactivos.map((i: any) => ({
          ...i,
          mostrarDetalles: false,
        }));

        // Inicializar los datos filtrados con todos los operarios
        this.activosFiltrados = [...this.activos];
        this.inactivosFiltrados = [...this.inactivos];

        // Suscribirse al input de búsqueda
        this.searchControl.valueChanges
          .pipe(debounceTime(300))
          .subscribe((term: any) => {
            this.filtrarOperarios(term);
          });
      },
      error: (error) => {
        console.error('Error al listar los activos:', error);
      },
    });
  }

  filtrarOperarios(term: string): void {
    const filtro = term?.toLowerCase().trim() || '';

    // Filtrar activos
    this.activosFiltrados = this.activos.filter(
      (op) =>
        op.numero_cedula.includes(filtro) ||
        op.nombre_completo.toLowerCase().includes(filtro)
    );

    // Filtrar inactivos
    this.inactivosFiltrados = this.inactivos.filter(
      (op) =>
        op.numero_cedula.includes(filtro) ||
        op.nombre_completo.toLowerCase().includes(filtro)
    );
  }

  toggleSidebar(): void {
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  triggerFileInput(tipo: string): void {
    this.tipoArchivo = tipo;
    const fileInput = document.querySelector<HTMLInputElement>('#fileInput');
    if (fileInput) {
      fileInput.click();
    }
  }

  resetFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = ''; // Para permitir volver a cargar el mismo archivo
  }

  asignarClaves(rows: any[]): any[] {
    if (!rows || rows.length < 2) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'El archivo no contiene suficientes filas para procesar.',
      });
      return [];
    }

    let clavesSeleccionadas: string[];
    if (this.tipoArchivo === 'activos') {
      clavesSeleccionadas = this.clavesActivos;
    } else if (this.tipoArchivo === 'retiros') {
      clavesSeleccionadas = this.clavesRetiros;
    } else {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se reconoce el tipo de archivo a procesar.',
      });
      return [];
    }

    // Excluir la primera fila (encabezados)
    const dataRows = rows.slice(1);

    // Validación previa de todas las filas
    const nombreFincaIndex = clavesSeleccionadas.indexOf('nombre_finca');
    if (nombreFincaIndex !== -1) {
      const errores: string[] = []; // Acumular errores
      for (let i = 0; i < dataRows.length; i++) {
        const fila = dataRows[i];
        const nombreFinca = fila[nombreFincaIndex];
        if (nombreFinca && !this.fincasPermitidas.includes(nombreFinca.trim())) {
          errores.push(`Fila ${i + 2}: "${nombreFinca}" no está en la lista de fincas permitidas.`);
        }
      }

      // Si hay errores, mostrar alerta y detener el proceso
      if (errores.length > 0) {
        Swal.fire({
          icon: 'error',
          title: 'Errores encontrados',
          html: `Se encontraron los siguientes problemas:<br><ul>${errores
            .map((error) => `<li>${error}</li>`)
            .join('')}</ul>`,
        });
        return []; // Detenemos el proceso
      }
    }

    // Transformación de datos si no hay errores
    return dataRows.map((fila: any[]) => {
      const obj: any = {};
      clavesSeleccionadas.forEach((clave, index) => {
        let value = fila[index];

        if (this.tipoArchivo === 'retiros' && clave === 'fecha_fin') {
          value = this.convertirFechaExcel(value);
        }

        obj[clave] = value !== undefined ? value : null;
      });
      return obj;
    });
  }


  cargarExcel(event: any): void {
    if (!this.tipoArchivo) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se ha especificado el tipo de archivo a cargar.',
      });
      return;
    }

    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se seleccionó ningún archivo.',
      });
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      if (!e.target?.result) return;

      const data = new Uint8Array(e.target.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      // Obtenemos las filas en formato de arreglos
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // quitar filas vacías

      console.log('Datos crudos:', rows);
      const modifiedRows = this.asignarClaves(rows);
      console.log('Datos modificados:', modifiedRows);
      // Verificar si hubo errores y detener el flujo
      if (!modifiedRows || modifiedRows.length === 0) {
        console.warn('El procesamiento fue detenido debido a errores.');
        return;
      }

      this.activosService
        .cargarDatos(this.tipoArchivo as 'activos' | 'retiros', modifiedRows)
        .subscribe({
          next: (response) => {
            Swal.fire({
              icon: 'success',
              title: 'Éxito',
              text: 'Los datos se han cargado correctamente.',
            });
            console.log('Respuesta del backend:', response);
            this.loadOperarios();
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un error al cargar los datos. Por favor, inténtalo de nuevo.',
            });
            console.error('Error al cargar los datos:', error);
          },
        });

      this.resetFileInput(event);
    };
    this.resetFileInput(event);
    reader.readAsArrayBuffer(file);
  }

  /**
   * Convierte un número serial de Excel o una fecha al formato "dd/mm/yyyy"
   * usando la función de la librería 'xlsx' para evitar desfases.
   */
  convertirFechaExcel(serialOrDate: any): string {
    if (!serialOrDate) return '';

    let fecha: Date;

    // Caso 1: Es un número, se asume que es un serial de Excel
    if (typeof serialOrDate === 'number') {
      const dateObj = XLSX.SSF.parse_date_code(serialOrDate, {
        date1904: false,
      });
      if (!dateObj) return ''; // Si no se pudo parsear
      // dateObj = { y: 2025, m: 2, d: 2, H: 0, M: 0, s: 0 }
      fecha = new Date(dateObj.y, dateObj.m - 1, dateObj.d);
    }
    // Caso 2: Ya es una fecha de tipo Date
    else if (serialOrDate instanceof Date) {
      fecha = serialOrDate;
    }
    // Caso 3: Intentar parsear como texto
    else {
      fecha = new Date(serialOrDate);
    }

    // Formatear la fecha a dd/mm/yyyy
    const dia = fecha.getDate().toString().padStart(2, '0');
    const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = fecha.getFullYear();

    return `${dia}/${mes}/${anio}`;
  }
}
