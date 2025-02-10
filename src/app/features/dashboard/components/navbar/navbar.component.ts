import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { SharedModule } from '../../../../shared/shared.module';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { catchError, filter, finalize } from 'rxjs/operators';
import * as XLSX from 'xlsx'; // Importación para generar Excel
import { DYNAMIC_MENUS, IDynamicMenu } from './menu.config'; // Importamos el menú
import Swal from 'sweetalert2'; // Importación para alertas
import moment from 'moment';
import { TesoreriaService } from '../../service/teroreria/tesoreria.service'; // Importación del servicio
import { DateRangeDialogComponent } from '../../../../shared/components/date-rang-dialog/date-rang-dialog.component';
import { MatDialog } from '@angular/material/dialog';
import { UtilityServiceService } from '../../../../shared/services/utilityService/utility-service.service';
import { AutorizacionesService } from '../../submodule/authorizations/services/autorizaciones/autorizaciones.service';
import { MercadoService } from '../../submodule/market/service/mercado/mercado.service';

@Component({
  selector: 'app-navbar',
  imports: [SharedModule, RouterModule],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.css'],
})
export class NavbarComponent implements OnInit {
  currentRole: string = '';
  isSidebarHidden = false;
  currentRoute: string | undefined;
  activeRoute: string = '';
  public isMenuVisible = true;
  @Output() menuToggle = new EventEmitter<boolean>();

  rolePermissions: any = {};
  menuState: Record<string, boolean> = {};
  dynamicMenus: IDynamicMenu[] = DYNAMIC_MENUS; // Asignamos el menú importado
  empleadosProblemas: any[] = [];
  empleadosSinProblemas: any[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private tesoreriaService: TesoreriaService,
    private utilityService: UtilityServiceService,
    private autorizacionesService: AutorizacionesService,
    private mercadoService: MercadoService,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.initMenuState();
    if (isPlatformBrowser(this.platformId)) {
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const parsedUser = JSON.parse(user);
          const permisos = parsedUser.permissions?.permisos || [];
          const nombres = permisos.map((permiso: any) => permiso.nombre);
          this.updateRolePermissions(nombres);
          this.currentRole = 'ALL_PERMISSIONS';
        } catch (error) {
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo cargar la información del usuario.',
          });
        }
      }
    }

    // Escuchar cambios en la ruta actual
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event: any) => {
        this.currentRoute = event.url;
      });
  }

  initMenuState(): void {
    this.dynamicMenus.forEach((menu) => {
      if (isPlatformBrowser(this.platformId)) {
        this.menuState[menu.key] =
          JSON.parse(localStorage.getItem('menuState') || '{}')[menu.key] ||
          false;
      }
    });
  }

  updateRolePermissions(permissions: string[]): void {
    this.rolePermissions['ALL_PERMISSIONS'] = permissions;
  }

  cerrarSesion(): void {
    localStorage.clear();
    this.initMenuState();
    this.router.navigate(['']);
  }

  hasPermission(option: string): boolean {
    return this.rolePermissions[this.currentRole]?.includes(option) ?? false;
  }

  isActive(path: string): boolean {
    if (!this.currentRoute) return false;
    return (
      this.currentRoute === path || this.currentRoute.startsWith(path + '/')
    );
  }

  toggleSidebar(): void {
    this.isSidebarHidden = !this.isSidebarHidden;
    // si quieres guardar en localStorage, hazlo aquí
    localStorage.setItem('sidebarHidden', this.isSidebarHidden.toString());
  }

  closeSidebar(): void {
    this.isSidebarHidden = true;
    setTimeout(() => {
      this.isSidebarHidden = false;
    }, 200);
  }

  toggleMenu(key: string): void {
    Object.keys(this.menuState).forEach((k) => {
      this.menuState[k] = k === key ? !this.menuState[k] : false;
    });
    this.menuToggle.emit(this.menuState[key]);
    localStorage.setItem('menuState', JSON.stringify(this.menuState));
  }

  menuHasSubMenus(menu: { subMenus?: any[] }): boolean {
    return (
      menu.subMenus?.some((subMenu: any) =>
        this.hasPermission(subMenu.permission)
      ) ?? false
    );
  }

  executeAction(action?: string): void {
    if (!action) return;

    const actionsRequiringFile = ['addWorkers', 'deleteWorkers', 'updateWorkersData','bulkUploadMarketsWithCode', 'bulkUploadMarketsWithoutCode'];

    if (actionsRequiringFile.includes(action)) {
      this.selectFile().then((file) => {
        if (file) {
          this.processFile(file, action);
        } else {
          this.showWarning('Debe seleccionar un archivo para continuar.');
        }
      });
    } else if (action === 'extractBaseData') {
      this.extraerDatosBase();
    }
    else if (action === 'resetValues') {
      this.resetearValoresQuincena();
    }
    else if (['extractStoreData', 'extractCodesToDo'].includes(action)) {
      this.openDateRangeDialog(action);
    }
    else {
      this.showError('Acción no válida.');
    }
  }


  private processFile(file: File, action: string): void {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        switch (action) {

          case 'addWorkers':
            this.processInsertarEmpleados(workbook);
            break;
          case 'deleteWorkers':
            this.processEliminarEmpleados(workbook);
            break;
          case 'updateWorkersData':
            this.processActualizarSaldos(workbook);
            break;
          case 'bulkUploadMarketsWithCode':
            this.processMercadoAutorizaciones(workbook);
            break;
          case 'bulkUploadMarketsWithoutCode':
            this.processMercadoAutorizacionesSinCod(workbook);
            break;

          default:
            this.showError('Acción no válida.');
        }
      } catch (error) {
        this.showError('Error al procesar el archivo.');
      }
    };
    reader.readAsArrayBuffer(file);
  }



  private selectFile(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx, .xls'; // Solo archivos Excel
      input.onchange = (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0] || null;
        resolve(file);
      };
      input.click();
    });
  }


  private processInsertarEmpleados(workbook: XLSX.WorkBook): void {
    // ✅ Mostrar mensaje de carga mientras se procesa
    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espere mientras se insertan los empleados.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 4,  // Omitir las primeras 4 filas
        raw: true, // Mantener los valores originales
        defval: ''
      });

      if (!data || data.length === 0) {
        Swal.close();
        this.showError('El archivo está vacío o no tiene datos válidos.');
        return;
      }

      const processedRows = (data as any[][]).map(row =>
        row.map((cell, index) => (index === 3 ? this.normalizeDate(cell) : cell))
      );

      // ✅ Guardar los datos procesados
      this.guardarDatos(processedRows);

      // ✅ Ocultar el mensaje de carga y mostrar éxito
      Swal.close();
      this.showSuccess('Empleados insertados correctamente.');

    } catch (error) {
      Swal.close();
      this.showError('Ocurrió un error inesperado al procesar el archivo.');
    }
  }


  private normalizeDate(date: any): string {
    if (typeof date === 'number') {
      return moment(this.excelSerialToJSDate(date)).format('DD-MM-YY');
    }

    const formats = ['DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY'];
    for (const format of formats) {
      const parsedDate = moment(date, format, true);
      if (parsedDate.isValid()) {
        return parsedDate.format('DD-MM-YY');
      }
    }

    return date; // Si no se puede normalizar, devolver el valor original
  }

  private excelSerialToJSDate(serial: number): Date {
    const utcDaysSinceUnixEpoch = serial - 25567;
    const utcDate = new Date(utcDaysSinceUnixEpoch * 86400000);

    // Ajustar a zona horaria de Bogotá (UTC-5)
    return new Date(utcDate.getTime() - (utcDate.getTimezoneOffset() * 60000) - 86400000);
  }

  private guardarDatos(datos: any[][]): void {
    this.tesoreriaService.añadirEmpleado(datos).then(response => {
      this.handleResponse(response);
    }).catch(() => {
      this.showError('Ocurrió un error al guardar los datos.');
    });
  }

  private handleResponse(response: any): void {
    if (response.message === 'success') {
      this.showSuccess('Los datos se han procesado correctamente.');
    } else {
      this.showError('Ocurrió un error al procesar los datos.');
    }
  }






  /* Eliminar empleados */

  private async processEliminarEmpleados(workbook: XLSX.WorkBook): Promise<void> {
    const result = await Swal.fire({
      title: '¿Está seguro de que desea eliminar los empleados seleccionados?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar empleados',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      // ✅ Mostrar mensaje de carga mientras se procesa
      Swal.fire({
        title: 'Procesando...',
        icon: 'info',
        text: 'Por favor, espere mientras se eliminan los empleados.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 1,
        raw: true, // Leer valores originales
        defval: ''
      });

      if (!data || data.length === 0) {
        Swal.close();
        this.showError('El archivo está vacío o no tiene datos válidos.');
        return;
      }

      const cedulas: string[] = (data as any[][]).map(row => row[0].toString().replace(/[.,]/g, ''));
      const base = await this.tesoreriaService.traerDatosbaseGeneral();

      this.empleadosSinProblemas = [];
      this.empleadosProblemas = [];

      for (const cedula of cedulas) {
        try {
          const response = await this.tesoreriaService.traerDatosBase(base, cedula);
          if (response.length === 1) {
            this.empleadosSinProblemas.push(response[0]);
          } else {
            this.empleadosProblemas.push({ cedula, mensaje: "No se encuentra en la base de datos" });
          }
        } catch (error) {
          this.empleadosProblemas.push({ cedula, mensaje: "Error al consultar la base de datos" });
        }
      }

      for (const empleado of this.empleadosSinProblemas) {
        if (this.tesoreriaService.verificaInfo(empleado)) {
          try {
            await this.tesoreriaService.eliminarEmpleados(empleado.numero_de_documento);
          } catch (error) {
            this.empleadosProblemas.push({
              cedula: empleado.numero_de_documento,
              mensaje: "Error al eliminar el empleado"
            });
          }
        } else {
          this.empleadosProblemas.push({
            cedula: empleado.numero_de_documento,
            mensaje: "No puede ser eliminado porque aún tiene deudas pendientes"
          });
        }
      }

      if (this.empleadosProblemas.length > 0) {
        this.generateExcelFile();
      }

      // ✅ Ocultar el mensaje de carga y mostrar éxito
      Swal.close();
      this.showSuccess('Proceso de eliminación completado.');

    } catch (error) {
      Swal.close();
      this.showError('Ocurrió un error inesperado al procesar los empleados.');
    }
  }



  private generateExcelFile(): void {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['Cédula', 'Mensaje']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Empleados con problemas');

    this.empleadosProblemas.forEach((empleado) => {
      XLSX.utils.sheet_add_aoa(ws, [[empleado.cedula, empleado.mensaje]], { origin: -1 });
    });

    XLSX.writeFile(wb, 'empleados_con_problemas.xlsx');

    this.showWarning('Se generó un archivo con los empleados que no se pudieron eliminar.');
  }




  /*---------------------------------*/
  extraerDatosBase(): void {
    // ✅ Mostrar mensaje de carga mientras se procesa
    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espere mientras se extraen los datos.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.tesoreriaService.traerDatosbaseGeneral().then((response) => {
      if (!response || response.length === 0) {
        Swal.close();
        this.showError('No hay datos disponibles para exportar.');
        return;
      }

      // ✅ Ordenar por fecha de ingreso
      // ✅ Ordenar por fecha de ingreso
      response.sort((a: any, b: any) => {
        const serialA = this.parseDate(a.ingreso);
        const serialB = this.parseDate(b.ingreso);
        return serialA - serialB; // Comparar los seriales numéricos directamente
      });


      // ✅ Crear estructura de datos para Excel
      const dataArray: any[][] = [];

      // ✅ Agregar encabezados personalizados
      dataArray.push(['', '', '', '', '', '', '', 'ANTERIOR', '', 'PARA DESCONTAR', '', '', '', '', '', '', '', '', '', 'PARA HACER', '', '', '', '', '', '', '', '']);
      dataArray.push([
        'CÓDIGO', 'CÉDULA', 'NOMBRE', 'INGRESO', 'TEMPORAL', 'FINCA', 'SALARIO', 'SALDOS', 'FONDOS',
        'MERCADOS', 'CUOTAS MERCADOS', 'PRÉSTAMO PARA DESCONTAR', 'CUOTAS PRÉSTAMOS PARA DESCONTAR',
        'CASINO', 'ANCHETAS', 'CUOTAS ANCHETAS', 'FONDO', 'CARNET', 'SEGURO FUNERARIO',
        'PRÉSTAMO PARA HACER', 'CUOTAS PRÉSTAMO PARA HACER', 'ANTICIPO LIQUIDACIÓN', 'CUENTAS'
      ]);

      // ✅ Agregar datos al array
      response.forEach((docData: any) => {
        const formattedDate = this.parseDate(docData.ingreso);
        const codigoValue = this.formatTextValue(docData.codigo);
        const numeroDocumentoValue = this.formatTextValue(docData.numero_de_documento);

        dataArray.push([
          codigoValue,
          numeroDocumentoValue,
          docData.nombre,
          formattedDate, // Serial de fecha para Excel
          docData.temporal,
          docData.finca,
          this.toNumber(docData.salario),
          this.toNumber(docData.saldos),
          this.toNumber(docData.fondos),
          this.toNumber(docData.mercados),
          this.toNumber(docData.cuotasMercados),
          this.toNumber(docData.prestamoParaDescontar),
          this.toNumber(docData.cuotasPrestamosParaDescontar),
          this.toNumber(docData.casino),
          this.toNumber(docData.valoranchetas),
          this.toNumber(docData.cuotasAnchetas),
          this.toNumber(docData.fondo),
          docData.carnet, // Mantener como texto
          this.toNumber(docData.seguroFunerario),
          this.toNumber(docData.prestamoParaHacer),
          this.toNumber(docData.cuotasPrestamoParahacer),
          this.toNumber(docData.anticipoLiquidacion),
          this.toNumber(docData.cuentas)
        ]);
      });


      // ✅ Crear hoja de cálculo y libro de Excel
      const ws = XLSX.utils.aoa_to_sheet(dataArray);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'DatosBase');

      // ✅ Aplicar formato de fecha a la columna "Ingreso" (columna 4)
      this.applyDateFormat(ws, 3);

      // ✅ Generar y descargar el archivo
      XLSX.writeFile(wb, `DatosBase.xlsx`);

      // ✅ Ocultar mensaje de carga y mostrar éxito
      Swal.close();
      this.showSuccess('Datos extraídos correctamente.');

    }).catch(() => {
      Swal.close();
      this.showError('Ocurrió un error al extraer los datos, inténtelo de nuevo.');
    });
  }


  private applyDateFormat(ws: XLSX.WorkSheet, columnIndex: number): void {
    const range = XLSX.utils.decode_range(ws['!ref'] || '');
    for (let row = range.s.r + 2; row <= range.e.r; row++) { // Saltar encabezados
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: columnIndex });
      if (ws[cellAddress] && !isNaN(ws[cellAddress].v)) {
        ws[cellAddress].t = 'n'; // Tipo de celda: número (fecha serial en Excel)
        ws[cellAddress].z = 'dd/mm/yyyy'; // Formato de fecha
      }
    }
  }



  private parseDate(dateString: string): number {
    if (!dateString) return NaN; // Si la fecha está vacía, devolver NaN

    const parts = dateString.split('-');
    if (parts.length !== 3) return NaN; // Si el formato no es correcto, devolver NaN

    let [day, month, year] = parts;

    // ✅ Asegurar que los días y meses tengan dos dígitos
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    // ✅ Convertir año de 2 dígitos a 4 dígitos
    if (year.length === 2) {
      year = `20${year}`;
    }

    // ✅ Crear fecha en formato estándar
    const date = new Date(`${year}-${month}-${day}`);

    // ✅ Convertir a serial de Excel
    if (!isNaN(date.getTime())) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      return (date.getTime() - excelEpoch.getTime()) / (1000 * 60 * 60 * 24);
    }

    return NaN;
  }





  private toNumber(value: any): number {
    return isNaN(value) || value === '' || value === null ? 0 : Number(value);
  }

  private formatTextValue(value: any): string | number {
    return isNaN(value) ? value : Number(value);
  }

  private setTextCell(row: any, cellIndex: number, value: any): void {
    if (typeof value === 'string') {
      row.getCell(cellIndex).value = { formula: `"${value}"` };
    }
  }

  /* Actualizar saldos */
  async processActualizarSaldos(workbook: XLSX.WorkBook): Promise<void> {
    const result = await Swal.fire({
      title: '¿Está seguro de que desea actualizar los saldos de los empleados?',
      text: 'Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, actualizar saldos',
      cancelButtonText: 'Cancelar'
    });

    if (!result.isConfirmed) return;

    try {
      //  Mostrar mensaje de carga mientras se procesa
      Swal.fire({
        title: 'Procesando...',
        icon: 'info',
        text: 'Por favor, espere mientras se actualizan los saldos.',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });


      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 1,
        raw: true, // Leer valores originales
        defval: ''
      });

      if (!data || data.length === 0) {
        Swal.close();
        this.showError('El archivo está vacío o no tiene datos válidos.');
        return;
      }

      const rows: any[][] = data as any[][];

      const cedulas: string[] = rows.map(row => row[0]?.toString().replace(/[.,]/g, ''));

      const base = await this.tesoreriaService.traerDatosbaseGeneral();

      this.empleadosSinProblemas = [];
      this.empleadosProblemas = [];

      //  Verificar si los empleados existen en la base de datos
      for (const cedula of cedulas) {
        try {
          const response = await this.tesoreriaService.traerDatosBase(base, cedula);
          if (response.length === 1) {
            this.empleadosSinProblemas.push(response[0]);
          } else {
            this.empleadosProblemas.push({ cedula, mensaje: "No se encuentra en la base de datos" });
          }
        } catch (error) {
          this.empleadosProblemas.push({ cedula, mensaje: "Error al consultar la base de datos" });
        }
      }

      //  Actualizar los saldos de los empleados sin problemas
      for (const empleado of rows) {
        try {
          await this.tesoreriaService.actualizarEmpleado(empleado[0], empleado[1]);
        } catch (error) {
          this.empleadosProblemas.push({ cedula: empleado[0], mensaje: 'Error al actualizar' });
        }
      }

      //  Ocultar el mensaje de carga y mostrar éxito
      Swal.close();


      if (this.empleadosProblemas.length > 0) {
        this.generateExcelFile();
        this.showWarning('Se generó un archivo con los empleados que tuvieron problemas en la actualización.');
      } else {
        this.showSuccess('Saldos actualizados correctamente.');
      }

      // ✅ Limpiar arreglos
      this.empleadosProblemas = [];
      this.empleadosSinProblemas = [];

    } catch (error) {
      Swal.close();
      this.showError('Ocurrió un error inesperado al actualizar los saldos.');
    }
  }



  resetearValoresQuincena(): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'Esta acción reiniciará todos los valores de la quincena. No se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, reiniciar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        Swal.fire({
          title: 'Reiniciando valores...',
          text: 'Por favor, espere mientras se procesan los datos.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        this.tesoreriaService.resetearValoresQuincena()
          .then((response) => {
            Swal.close(); // ✅ Cerrar el mensaje de carga

            if (response.message === 'success') {
              this.showSuccess('Los valores se han reiniciado correctamente.');
            } else {
              this.showError('Ocurrió un error al reiniciar los valores, inténtelo de nuevo.');
            }
          })
          .catch(() => {
            Swal.close();
            this.showError('Ocurrió un error inesperado al reiniciar los valores.');
          });
      }
    });
  }


  // Extraer datos tienda detalle*/
  private openDateRangeDialog(action: string): void {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, {
      width: '400px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.handleDateRangeResult(action, result);
      } else {
        this.showWarning('Selección de rango cancelada.');
      }
    });
  }

  private handleDateRangeResult(action: string, dateRange: any): void {
    if (action === 'extractStoreData') {
      this.procesarExtractStoreData(dateRange);
    } else if (action === 'extractCodesToDo') {
      this.procesarExtractCodesToDo(dateRange);
    }
  }

  private procesarExtractStoreData(dateRange: { start: string, end: string }): void {
    // Mostrar el mensaje de carga antes de iniciar la petición
    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espere mientras se extraen los datos.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.tesoreriaService.traerHistorialPorFecha(dateRange.start, dateRange.end)
      .pipe(
        catchError((error) => {
          this.showError('Ocurrió un error al extraer los datos.');
          return [];
        }),
        finalize(() => {
          Swal.close(); // Cerrar el mensaje de carga cuando termine el proceso
        })
      )
      .subscribe((response: any) => {
        if (!response || !response.historial) {
          this.showWarning('No hay datos disponibles para exportar.');
          return;
        }

        // Filtrar compras en tienda
        const filteredHistorial = response.historial.filter((entry: any) =>
          entry.conceptoEjecutado?.startsWith('Compra tienda')
        );

        if (filteredHistorial.length === 0) {
          this.showWarning('No hay datos disponibles para exportar.');
          return;
        }

        this.showSuccess('Datos extraídos correctamente.');
        this.exportAsExcelFile(filteredHistorial, 'Historial_Informe_Tesoreria');
      });
  }

  private procesarExtractCodesToDo(dateRange: any): void {
    // Mostrar el mensaje de carga antes de iniciar la petición
    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espere mientras se extraen los datos.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    const startDate = new Date(dateRange.start + 'T00:00:00'); // Forzar la zona horaria local
    const endDate = new Date(dateRange.end + 'T23:59:59'); // Ajustar para incluir todo el día

    this.utilityService.traerAutorizaciones().subscribe(
      (data) => {
        if (!data || !data.codigo || data.codigo.length === 0) {
          this.showWarning('No hay datos disponibles para exportar.');
          return;
        }

        // Convertir fechas de result a formato 'YYYY-MM-DD'
        const formattedStartDate = startDate.toISOString().split('T')[0];
        const formattedEndDate = endDate.toISOString().split('T')[0];

        // Filtrar por fechas
        let filteredData = data.codigo.filter(
          (entry: any) => entry.fechaGenerado >= formattedStartDate && entry.fechaGenerado <= formattedEndDate
        );

        // Filtrar por código que contenga "OR"
        filteredData = filteredData.filter((entry: any) => entry.codigo.includes('OR'));

        if (filteredData.length === 0) {
          this.showWarning('No hay datos disponibles para exportar.');
          return;
        }

        this.showSuccess('Datos extraídos correctamente.');
        this.exportAsExcelFile(filteredData, 'Historial_Informe_Codigos_OR');
      },
      (error) => {
        this.showError('Ocurrió un error al extraer los datos.');
      }
    );
  }


  /**
   * Extrae el lugar de compra desde el campo `conceptoEjecutado`.
   */
  private filterAndExtractPlace(historial: any[]): any[] {
    return historial.map(entry => {
      if (entry.conceptoEjecutado?.startsWith('Compra tienda')) {
        const lugarMatch = entry.conceptoEjecutado.match(/de\s([^,]*)|en\s([^,]*)/);
        if (lugarMatch) {
          const lugar = lugarMatch[1] || lugarMatch[2];
          return { ...entry, lugar };
        }
      }
      return entry;
    });
  }

  /**
   * Exporta los datos a un archivo Excel utilizando únicamente `xlsx`.
   */
  async processMercadoAutorizaciones(workbook: XLSX.WorkBook): Promise<void> {
    let codigoOH: string = '';
    let concepto: string = '';

    // Mostrar el mensaje de carga antes de iniciar la operación
    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espere mientras se ejecuta el proceso.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 1,
        raw: true, // Leer los valores originales
        defval: ''
      });

      const rows: any[][] = data as any[][];
      const cedulas: string[] = rows.map(row => row[0].toString().replace(/[.,]/g, ''));

      const base = await this.tesoreriaService.traerDatosbaseGeneral();
      let autorizaciones: any = await this.utilityService.traerAutorizaciones().toPromise();
      autorizaciones = autorizaciones.codigo;

      // Procesar los datos para saber si se pueden actualizar
      for (const cedula of cedulas) {
        try {
          const response = await this.tesoreriaService.traerDatosBase(base, cedula);
          if (response.length === 1) {
            this.empleadosSinProblemas.push(response[0]);
          } else {
            this.empleadosProblemas.push({ cedula, mensaje: "No se encuentra" });
          }
        } catch (error) {
          this.empleadosProblemas.push({ cedula, mensaje: "Error al procesar la cédula" });
        }
      }

      const correoUsuario = this.utilityService.getUser().correo_electronico;
      const rolUsuario = this.utilityService.getUser().rol;
      let sumaPrestamos;
      let datosOperario;

      // Procesar los códigos para ver si existen
      for (const row of rows) {
        const codigo = autorizaciones.find((codigo: { codigo: string; }) => codigo.codigo === row[2]);

        if (!codigo) {
          this.empleadosProblemas.push({ cedula: row[0], mensaje: 'No se encuentra el código' });
          continue;
        } else if (!codigo.estado) {
          this.empleadosProblemas.push({ cedula: row[0], mensaje: 'El código no está activo' });
          continue;
        } else if (codigo.cedulaQuienPide !== String(row[0])) {
          this.empleadosProblemas.push({ cedula: row[0], mensaje: 'La cédula no coincide con el código' });
          continue;
        }

        const operariosResponse = await this.autorizacionesService.traerOperarios(row[0]).toPromise();
        datosOperario = operariosResponse.datosbase[0];
        sumaPrestamos = await this.autorizacionesService.traerSaldoPendiente(datosOperario);

        if (correoUsuario !== "tuafiliacion@tsservicios.co" && rolUsuario !== "GERENCIA") {
          if (!this.autorizacionesService.verificarCondiciones(datosOperario, parseInt(row[1]), sumaPrestamos, "mercado")) {
            this.empleadosProblemas.push({ cedula: row[0], mensaje: 'No cumple con las condiciones' });
            continue;
          }
        }

        codigoOH = 'MOH' + Math.floor(Math.random() * 1000000);
        concepto = 'Compra tienda de ' + this.utilityService.getUser().primer_nombre + ' ' + this.utilityService.getUser().primer_apellido;

        try {
          const response = await this.mercadoService.ejecutarMercadoTienda(
            row[2],
            row[0],
            row[1],
            codigoOH,
            concepto,
            codigo.historial_id
          );

          if (response.message !== "Actualización exitosa") {
            this.empleadosProblemas.push({ cedula: row[0], mensaje: 'Error en la actualización' });
          }

        } catch (error) {
          this.empleadosProblemas.push({ cedula: row[0], mensaje: 'Error durante el proceso' });
        }
      }

      // Si hay empleados con problemas, generar el archivo Excel y mostrar advertencia
      if (this.empleadosProblemas.length > 0) {
        this.generateExcelFile();
        this.showError('Se encontraron problemas con algunos empleados. Se ha generado un archivo Excel.');
      } else {
        this.showSuccess('El proceso se completó exitosamente.');
      }

    } catch (error) {
      this.showError('Ocurrió un error inesperado durante el proceso.');
    } finally {
      // Cerrar la alerta de carga cuando finalice el proceso
      Swal.close();
    }

    // Limpiar los arreglos solo después de generar el Excel
    this.empleadosProblemas = [];
    this.empleadosSinProblemas = [];
  }




  async processMercadoAutorizacionesSinCod(workbook: XLSX.WorkBook): Promise<void> {
    let codigoOH: string = '';
    let codigoMOH: string = '';
    let conceptoMOH: string = '';

    // Mostrar el mensaje de carga antes de iniciar la operación
    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Por favor, espere mientras se ejecuta el proceso.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        range: 1,
        raw: true, // Leer los valores originales
        defval: ''
      });

      const rows: any[][] = data as any[][];
      const cedulas: string[] = rows.map(row => row[0].toString().replace(/[.,]/g, ''));

      const base = await this.tesoreriaService.traerDatosbaseGeneral();
      let autorizaciones: any = await this.utilityService.traerAutorizaciones().toPromise();
      autorizaciones = autorizaciones.codigo;

      // Procesar los datos para saber si se pueden actualizar
      for (const cedula of cedulas) {
        try {
          const response = await this.tesoreriaService.traerDatosBase(base, cedula);
          if (response.length === 1) {
            this.empleadosSinProblemas.push(response[0]);
          } else {
            this.empleadosProblemas.push({ cedula, mensaje: "No se encuentra" });
          }
        } catch (error) {
          this.empleadosProblemas.push({ cedula, mensaje: "Error al procesar" });
        }
      }

      let correoUsuario = '';
      let rolUsuario = '';
      let user = this.utilityService.getUser();
      if (user) {
        rolUsuario = user.rol;
        correoUsuario = user.correo_electronico;
      }
      let sumaPrestamos;
      let datosOperario;

      // Procesar los códigos para ver si existen
      for (const row of rows) {
        try {
          codigoOH = 'M' + Math.floor(Math.random() * 1000000);
          codigoMOH = 'MOH' + Math.floor(Math.random() * 1000000);

          const operariosResponse = await this.autorizacionesService.traerOperarios(row[0]).toPromise();
          datosOperario = operariosResponse.datosbase[0];
          sumaPrestamos = await this.autorizacionesService.traerSaldoPendiente(datosOperario);

          if (correoUsuario !== "tuafiliacion@tsservicios.co" && rolUsuario !== "GERENCIA") {
            if (!this.autorizacionesService.verificarCondiciones(datosOperario, parseInt(row[1]), sumaPrestamos, "mercado")) {
              this.empleadosProblemas.push({ cedula: row[0], mensaje: 'No cumple con las condiciones' });
              continue;
            }
          }

          // Cuando el comercio es NO
          const historialData = await this.autorizacionesService.escribirHistorial(
            row[0],
            row[1],
            2,
            "Autorizacion de Mercado",
            codigoOH,
            user.primer_nombre + ' ' + user.primer_apellido
          );

          const historial_id = historialData.historial_id;

          await this.autorizacionesService.escribirCodigo(
            row[0],
            row[1],
            codigoOH,
            String(2),
            "Autorizacion de Mercado",
            historial_id,
            user.primer_nombre + ' ' + user.primer_apellido,
            user.numero_de_documento
          );

          const response = await this.mercadoService.ejecutarMercadoTienda(
            codigoOH,
            row[0],
            row[1],
            codigoMOH,
            conceptoMOH,
            historial_id
          );

          if (response.message !== "Actualización exitosa") {
            this.empleadosProblemas.push({ cedula: row[0], mensaje: 'Error en la actualización' });
          }

        } catch (error) {
          this.empleadosProblemas.push({ cedula: row[0], mensaje: 'Error durante el proceso' });
        }
      }

      // Si hay empleados con problemas, generar el archivo Excel y mostrar advertencia
      if (this.empleadosProblemas.length > 0) {
        this.generateExcelFile();
        this.showError('Se encontraron problemas con algunos empleados. Se ha generado un archivo Excel.');
      } else {
        this.showSuccess('El préstamo ha sido cargado exitosamente.');
      }

    } catch (error) {
      this.showError('Ocurrió un error inesperado durante el proceso.');
    } finally {
      // Cerrar la alerta de carga cuando finalice el proceso
      Swal.close();
    }

    // Limpiar los arreglos solo después de generar el Excel
    this.empleadosProblemas = [];
    this.empleadosSinProblemas = [];
  }




  /**
 * Exporta los datos a un archivo Excel utilizando únicamente `xlsx`.
 */
  private exportAsExcelFile(historial: any[], fileName: string): void {
    if (!historial || historial.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Advertencia',
        text: 'No hay datos disponibles para exportar.'
      });
      return;
    }

    const filteredHistorial = this.filterAndExtractPlace(historial);

    try {
      // Crear un nuevo libro de trabajo y una hoja de cálculo
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(filteredHistorial);

      // Agregar la hoja al libro
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial');

      // Guardar el archivo directamente con `xlsx`
      const fileNameWithTimestamp = `${fileName}_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileNameWithTimestamp);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Ocurrió un error al exportar los datos.'
      });
    }
  }


  private showSuccess(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Éxito',
      text: message
    });
  }


  private showWarning(message: string): void {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: message
    });
  }

  private showError(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message
    });
  }







}
