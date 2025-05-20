import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { HiringService } from '../../service/hiring.service';
import { MatDialog } from '@angular/material/dialog';
import JSZip from 'jszip';
import Swal from 'sweetalert2';
import { VerPdfsComponent } from '../../components/ver-pdfs/ver-pdfs.component';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import saveAs from 'file-saver';
import { PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';


@Component({
  selector: 'app-view-reports',
  imports: [
    SharedModule
  ],
  templateUrl: './view-reports.component.html',
  styleUrl: './view-reports.component.css'
})
export class ViewReportsComponent {
  reportes: any[] = [];
  displayedColumns: string[] = ['fecha', 'nombre', 'sede', 'cantidadContratosTuAlianza', 'cantidadContratosApoyoLaboral', 'cedulas', 'traslados', 'cruce', 'sst', 'nota'];
  dataSource = new MatTableDataSource<any>(); // Table 1 Data Source
  consolidadoFechasFincaDataSource: any[] = [];
  userCorreo: string = '';
  userNombre: string = '';
  filterValues: any = {
    nombre: '',
    sede: ''
  };

  consolidadoDataSource = new MatTableDataSource<any>(); // Table 2 Data Source
  consolidadoDisplayedColumns: string[] = [
    'fecha', 'status', 'sede', 'cantidadContratosTuAlianza',
    'cantidadContratosApoyoLaboral', 'totalIngresos',
    'cedulas', 'traslados', 'sst', 'notas'
  ];

  constructor(
    private hiringService: HiringService,
    public dialog: MatDialog,
    private utilityService: UtilityServiceService,
  ) { }

  async ngOnInit(): Promise<void> {
    const user = await this.hiringService.getUser();
    if (user) {
      this.userCorreo = user.correo_electronico;
      this.userNombre = user.primer_nombre + ' ' + user.primer_apellido;
    }
    this.obtenerReportes();
    this.dataSource.filterPredicate = this.createFilter(); // Ensure filter applies to the first table
  }

  trackByIndex(index: number, item: any): any {
    return index;
  }


  async obtenerReportes(): Promise<void> {
    // Mostrar el swal de cargando
    Swal.fire({
      icon: 'info',
      title: 'Cargando...',
      html: 'Por favor espera mientras se cargan los reportes.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    if (this.userCorreo != "tuafiliacion@tsservicios.co" && this.userCorreo != "programador.ts@gmail.com" && this.userCorreo != "a.seguridad.ts@gmail.com") {
      // Llamar al servicio para obtener los reportes
      this.hiringService.obtenerTodosLosReportes(this.userNombre).subscribe(
        async (response) => {
          console.log(response.reportes);
          // Ocultar el Swal de cargando
          Swal.close();

          this.reportes = response.reportes;
          this.dataSource.data = this.reportes; // Actualiza la tabla principal

        },
        (error) => {
          // Ocultar el Swal de cargando
          Swal.close();

          // Mostrar alerta de error
          Swal.fire({
            icon: 'error',
            title: 'Error al obtener los reportes',
            text: 'Ocurrió un error al obtener los reportes, por favor intenta de nuevo.'
          });
        }
      );
    }
    else {
      // Llamar al servicio para obtener los reportes
      this.hiringService.obtenerTodosLosReportes("todos").subscribe(
        async (response) => {
          // Ocultar el Swal de cargando
          Swal.close();

          this.reportes = response.reportes;
          this.dataSource.data = this.reportes; // Actualiza la tabla principal

          // Espera a que los datos consolidados estén listos
          const consolidado = await this.generateConsolidatedData(this.reportes);
          this.consolidadoDataSource.data = consolidado; // Actualiza la tabla consolidada
        },
        (error) => {
          // Ocultar el Swal de cargando
          Swal.close();

          // Mostrar alerta de error
          Swal.fire({
            icon: 'error',
            title: 'Error al obtener los reportes',
            text: 'Ocurrió un error al obtener los reportes, por favor intenta de nuevo.'
          });
        }
      );
    }

  }



  // Apply filter only for the first table
  applyFilter(filterKey: string, event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    this.filterValues[filterKey] = inputElement.value.trim().toLowerCase();
    this.dataSource.filter = JSON.stringify(this.filterValues); // Trigger the filter
  }

  // Custom filter for filtering by nombre and sede
  createFilter(): (data: any, filter: string) => boolean {
    return (data: any, filter: string): boolean => {
      const searchTerms = JSON.parse(filter);
      const nombreMatches = data.nombre.toLowerCase().includes(searchTerms.nombre);
      const sedeMatches = data.sede.toLowerCase().includes(searchTerms.sede);
      return nombreMatches && sedeMatches; // Return true if both match
    };
  }

  // Modal handling for the PDFs
  openCedulasModal(cedulas: any[]): void {
    const dialogRef = this.dialog.open(VerPdfsComponent, {
      minWidth: '90vw',
      maxHeight: '70vh',
      data: { cedulas: cedulas }
    });

    dialogRef.afterClosed().subscribe(result => {
    });

  }

  // PDF/Excel Document viewing and downloading
  verDocumento(base64: string, fileName: string = 'CruceSubido.xlsx'): void {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const mimeType = base64.split(';')[0].split(':')[1];
    const blob = new Blob([byteArray], { type: mimeType });

    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const downloadLink = document.createElement('a');
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = fileName;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } else {
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl);
    }
  }

  // Function to generate consolidated data for second table
  async generateConsolidatedData(reportes: any[]): Promise<any[]> {
    const consolidado: any[] = [];

    // Traer las sucursales y generar el consolidado
    const sucursalesObservable = await this.utilityService.traerSucursales();

    return new Promise((resolve, reject) => {
      sucursalesObservable.subscribe((data: any) => {
        // Ordenar por nombre las sucursales
        const sucursalesOrdenadas = data.sucursal.sort((a: any, b: any) => a.nombre.localeCompare(b.nombre));

        // Recorrer las sucursales para generar el consolidado
        sucursalesOrdenadas.forEach((sucursal: any) => {
          const reportsForSede = reportes.filter(report => report.sede === sucursal.nombre);
          const totalContratosTuAlianza = reportsForSede.reduce((sum: any, report: { cantidadContratosTuAlianza: any; }) => sum + (report.cantidadContratosTuAlianza || 0), 0);
          const totalContratosApoyoLaboral = reportsForSede.reduce((sum: any, report: { cantidadContratosApoyoLaboral: any; }) => sum + (report.cantidadContratosApoyoLaboral || 0), 0);

          // Filtrar y sumar cédulas solo si no contienen el texto "No se han cargado cédulas"
          const totalCedulas = reportsForSede.reduce((sum: any, report: { cedulas: any; }) => {
            if (report.cedulas !== 'No se han cargado cédulas') {
              return sum + (Array.isArray(report.cedulas) ? report.cedulas.length : 0);
            }
            return sum;
          }, 0);

          // Filtrar y sumar traslados solo si no contienen el texto "No se han cargado traslados"
          const totalTraslados = reportsForSede.reduce((sum: any, report: { traslados: any; }) => {
            if (report.traslados !== 'No se han cargado traslados') {
              return sum + (Array.isArray(report.traslados) ? report.traslados.length : 0);
            }
            return sum;
          }, 0);

          const sstOk = reportsForSede.some((report: { sst: string | null; }) => report.sst !== null && report.sst !== 'No se ha cargado SST');
          const notas = reportsForSede.map((report: { nota: any; }) => report.nota).filter((nota: any) => nota).join(', ');

          // Definir el status de acuerdo a las reglas
          let status = '';

          if (reportsForSede.length === 0) {
            status = 'NO REALIZO REPORTE';
          }
          else if (totalContratosTuAlianza === 0 && totalContratosApoyoLaboral === 0) {
            status = 'NO HUBO CONTRATACION';
          }
          else if (reportsForSede.length > 0 && reportsForSede.length > 0) {
            status = 'REALIZO REPORTE';
          }

          consolidado.push({
            fecha: reportsForSede.length > 0 ? reportsForSede[0].fecha : null,
            sede: sucursal.nombre,
            cantidadContratosTuAlianza: totalContratosTuAlianza,
            cantidadContratosApoyoLaboral: totalContratosApoyoLaboral,
            totalIngresos: totalContratosTuAlianza + totalContratosApoyoLaboral,
            cedulas: totalCedulas,
            traslados: totalTraslados,
            sst: sstOk,
            notas,
            status // Nueva columna status
          });
        });

        resolve(consolidado);
      }, error => {
        reject(error);
      });
    });
  }



  // Helper function to group by sede
  groupBy(array: any[], key: string): any {
    return array.reduce((result, currentValue) => {
      (result[currentValue[key]] = result[currentValue[key]] || []).push(currentValue);
      return result;
    }, {});
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }


  openDateRangeDialog(): void {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, { width: '550px' });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {

        // Mostrar el swal de cargando
        Swal.fire({
          icon: 'info',
          title: 'Cargando...',
          html: 'Por favor espera mientras se cargan los reportes.',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });

        this.hiringService.obtenerReportesPorFechas(result.start, result.end).subscribe(
          async (response) => {
            // Ocultar el Swal de cargando
            Swal.close();

            this.reportes = response.reportes;
            this.dataSource.data = this.reportes; // Actualiza la tabla principal

            // Espera a que los datos consolidados estén listos
            const consolidado = await this.generateConsolidatedData(this.reportes);
            this.consolidadoDataSource.data = consolidado; // Actualiza la tabla consolidada
          },
          (error) => {
            // Ocultar el Swal de cargando
            Swal.close();

            // Mostrar alerta de error
            Swal.fire({
              icon: 'error',
              title: 'Error al obtener los reportes',
              text: 'Ocurrió un error al obtener los reportes, por favor intenta de nuevo.'
            });
          }
        );
      }
    });
  }

  openDateRangeDialog2(): void {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, { width: '550px' });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        const start = result.start;
        const end = result.end;

        // Mostrar Swal de "Cargando"
        Swal.fire({
          icon: 'info',
          title: 'Cargando',
          text: 'Espere mientras se descarga el archivo...',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();  // Mostrar animación de carga
          }
        });

        // Llama al servicio para descargar el archivo Excel
        this.hiringService.obtenerBaseContratacionPorFechas(start, end).subscribe(
          (response: Blob) => {

            const blob = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const fileName = `reporte_contratacion_${start}_a_${end}.xlsx`;

            // Usar FileSaver.js para descargar el archivo
            saveAs(blob, fileName);

            // Cerrar el Swal de "Cargando"
            Swal.close();
          },
          (error) => {
            // Cerrar el Swal y mostrar error
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un error al descargar el archivo.',
            });
          }
        );
      }
    });
  }

  openDateRangeDialog3(): void {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, { width: '550px' });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {
        this.hiringService.obtenerReportesPorFechasCentroCosto(result.start, result.end).subscribe(
          (response: any) => {
            if (response.resultado.total_general === 0) {
              Swal.fire({
                icon: 'warning',
                title: 'No hay reportes',
                text: 'No se encontraron reportes para las fechas seleccionadas.'
              });
              return;
            }
            // Asignar los datos al dataSource de la tabla
            this.consolidadoFechasFincaDataSource = this.formatData(response.resultado.detalles);
          }
        );
      }
    });
  }

  openDateRangeDialog4(): void {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, { width: '550px' });

    dialogRef.afterClosed().subscribe(async (result) => {
      if (result) {

        // Descargar archivo
        this.hiringService.descargarReporteFechaIngresoCentroCostoFincas(result.start, result.end).subscribe(
          (response: Blob) => {
            // Verifica si la respuesta es un archivo binario
            if (response.size === 0) {
              Swal.fire({
                icon: 'warning',
                title: 'No hay reportes',
                text: 'No se encontraron reportes para las fechas seleccionadas.'
              });
              return;
            }

            // Crear un enlace de descarga
            const file = new Blob([response], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(file);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'reporte_centro_costos.xlsx';  // Nombre del archivo
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);  // Liberar el objeto URL
          },
          (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Ocurrió un error al descargar el archivo.',
            });
          }
        );
      }
    });
  }


  // Función para formatear los datos y ordenar las fechas de mayor a menor
  formatData(data: any): any[] {
    const formattedData = [];

    // Obtener las fechas y ordenarlas de mayor a menor
    const fechas = Object.keys(data).sort((a, b) => {
      // Convertir 'dd/mm/yyyy' a objetos Date para compararlas
      const dateA = new Date(a.split('/').reverse().join('-'));
      const dateB = new Date(b.split('/').reverse().join('-'));
      return dateB.getTime() - dateA.getTime(); // Orden descendente
    });

    // Iterar sobre las fechas ya ordenadas
    for (const fecha of fechas) {
      const detalles = data[fecha];
      let isFirstRow = true;

      // Para cada fecha, iterar sobre los centros de costo
      for (const item of detalles) {
        formattedData.push({
          fechaIngreso: isFirstRow ? fecha : '', // Solo muestra la fecha en la primera fila
          centroCosto: item.centro_costo,
          total: item.total
        });
        isFirstRow = false; // Para las siguientes filas de la misma fecha, la fecha queda vacía
      }
    }

    return formattedData;
  }

  descargarCedulasZip() {
    const zip = new JSZip();
    const sedesMap = new Map<string, any[]>();

    // Agrupar cédulas por sede
    this.dataSource.data.forEach((reporte: any) => {
      const sede = reporte.sede || 'Sin_Sede';

      if (Array.isArray(reporte.cedulas)) {
        if (!sedesMap.has(sede)) {
          sedesMap.set(sede, []);
        }
        sedesMap.get(sede)?.push(...reporte.cedulas);
      }
    });

    // Crear carpetas y archivos
    sedesMap.forEach((cedulas, sede) => {
      const carpetaSede = zip.folder(sede);
      cedulas.forEach((cedula: any, index: number) => {
        const nombreArchivo = cedula.file_name || `cedula_${index + 1}.pdf`;
        const base64 = cedula.file_base64;

        if (base64) {
          const blob = this.base64ToBlob(base64);
          carpetaSede?.file(nombreArchivo, blob);
        }
      });
    });

    zip.generateAsync({ type: 'blob' }).then((contenidoZip) => {
      saveAs(contenidoZip, 'cedulas_por_sede.zip');
    });
  }

  base64ToBlob(base64: string): Blob {
    const arr = base64.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
    const bstr = atob(arr[1]);
    const u8arr = new Uint8Array(bstr.length);
    for (let i = 0; i < bstr.length; i++) {
      u8arr[i] = bstr.charCodeAt(i);
    }
    return new Blob([u8arr], { type: mime });
  }

}
