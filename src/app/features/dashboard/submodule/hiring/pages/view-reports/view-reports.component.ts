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
import { finalize, firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-view-reports',
  imports: [
    SharedModule
  ],
  templateUrl: './view-reports.component.html',
  styleUrl: './view-reports.component.css'
})
export class ViewReportsComponent {
  // --------------------------------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------------------------------
  reportes: any[] = [];
  displayedColumns: string[] = [
    'fecha',
    'nombre',
    'sede',
    'cantidadContratosTuAlianza',
    'cantidadContratosApoyoLaboral',
    'cedulas',
    'traslados',
    'cruce',
    'sst',
    'nota'
  ];
  dataSource = new MatTableDataSource<any>();
  consolidadoFechasFincaDataSource: any[] = [];
  userCorreo = '';
  userNombre = '';
  filterValues: any = { nombre: '', sede: '' };

  consolidadoDataSource = new MatTableDataSource<any>();
  consolidadoDisplayedColumns: string[] = [
    'fecha',
    'status',
    'sede',
    'cantidadContratosTuAlianza',
    'cantidadContratosApoyoLaboral',
    'totalIngresos',
    'cedulas',
    'traslados',
    'sst',
    'notas'
  ];

  isSidebarHidden = false;
  private isBrowser: boolean;

  constructor(
    private hiringService: HiringService,
    public dialog: MatDialog,
    private utilityService: UtilityServiceService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // --------------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------------
  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return; // 🚫 Evitar ejecución en SSR

    const user = await this.utilityService.getUser();
    if (user) {
      this.userCorreo = user.correo_electronico;
      this.userNombre = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;
    }

    this.obtenerReportes();
    this.dataSource.filterPredicate = this.createFilter();
  }

  // --------------------------------------------------------------------------------
  // TEMPLATE HELPERS
  // --------------------------------------------------------------------------------
  trackByIndex(index: number): number {
    return index;
  }

  isArray(value: any): boolean {
    return Array.isArray(value);
  }

  toggleSidebar(): void {
    if (!this.isBrowser) return;
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  // --------------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------------
  private async obtenerReportes(): Promise<void> {
    if (!this.isBrowser) return;

    Swal.fire({
      icon: 'info',
      title: 'Cargando...',
      html: 'Por favor espera mientras se cargan los reportes.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    const todosLosReportes$ =
      this.userCorreo !== 'tuafiliacion@tsservicios.co' &&
        this.userCorreo !== 'programador.ts@gmail.com' &&
        this.userCorreo !== 'A.SEGURIDAD.TS@GMAIL.COM' &&
        this.userCorreo !== 'a.sotelotualianza@gmail.com'
        ? this.hiringService.obtenerTodosLosReportes(this.userNombre)
        : this.hiringService.obtenerTodosLosReportes('todos');

    todosLosReportes$.subscribe({
      next: async (response) => {
        Swal.close();
        this.reportes = response.reportes;
        this.dataSource.data = this.reportes;

        if (
          this.userCorreo === 'tuafiliacion@tsservicios.co' ||
          this.userCorreo === 'programador.ts@gmail.com' ||
          this.userCorreo === 'A.SEGURIDAD.TS@GMAIL.COM' ||
          this.userCorreo === 'a.sotelotualianza@gmail.com'
        ) {
          this.consolidadoDataSource.data = await this.generateConsolidatedData(this.reportes);
        }
      },
      error: () => {
        Swal.close();
        Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al obtener los reportes.' });
      }
    });
  }

  // --------------------------------------------------------------------------------
  // FILTERS
  // --------------------------------------------------------------------------------
  applyFilter(filterKey: 'nombre' | 'sede', event: Event): void {
    if (!this.isBrowser) return;
    const input = event.target as HTMLInputElement;
    this.filterValues[filterKey] = input.value.trim().toLowerCase();
    this.dataSource.filter = JSON.stringify(this.filterValues);
  }

  private createFilter(): (data: any, filter: string) => boolean {
    return (data, filter) => {
      const searchTerms = JSON.parse(filter);
      return (
        data.nombre.toLowerCase().includes(searchTerms.nombre) &&
        data.sede.toLowerCase().includes(searchTerms.sede)
      );
    };
  }

  // --------------------------------------------------------------------------------
  // MODALS & DOCUMENT VIEWERS (solo en navegador)
  // --------------------------------------------------------------------------------
  openCedulasModal(cedulas: any[]): void {
    if (!this.isBrowser) return;
    this.dialog.open(VerPdfsComponent, {
      minWidth: '90vw',
      maxHeight: '70vh',
      data: { cedulas }
    });
  }

  verDocumento(base64: string, fileName = 'CruceSubido.xlsx'): void {
    if (!this.isBrowser) return;

    const [meta, data] = base64.split(',');
    const mimeType = meta.split(';')[0].split(':')[1];
    const byteCharacters = atob(data);
    const byteArray = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteArray[i] = byteCharacters.charCodeAt(i);

    const blob = new Blob([byteArray], { type: mimeType });

    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      window.open(URL.createObjectURL(blob));
    }
  }

  // --------------------------------------------------------------------------------
  // CONSOLIDATED DATA
  // --------------------------------------------------------------------------------
  private async generateConsolidatedData(reportes: any[]): Promise<any[]> {
    const consolidado: any[] = [];

    // Traer sucursales como array (soporta array directo o {sucursal: [...]})
    const data = await firstValueFrom(this.utilityService.traerSucursales());
    const sucursalesArr = Array.isArray(data) ? data : (data?.sucursal ?? []);
    const sucursales = [...sucursalesArr].sort(
      (a: any, b: any) => (a?.nombre ?? '').localeCompare(b?.nombre ?? '')
    );

    for (const sucursal of sucursales) {
      const reportsForSede = (reportes ?? []).filter(
        (r: any) => (r?.sede ?? '') === (sucursal?.nombre ?? '')
      );

      const sum = (key: string) =>
        reportsForSede.reduce(
          (s: number, r: any) => s + (Number(r?.[key]) || 0),
          0
        );

      const totalTuA = sum('cantidadContratosTuAlianza');
      const totalApoyo = sum('cantidadContratosApoyoLaboral');
      const totalCedulas = reportsForSede.reduce(
        (s: number, r: any) => s + (Array.isArray(r?.cedulas) ? r.cedulas.length : 0),
        0
      );
      const totalTraslados = reportsForSede.reduce(
        (s: number, r: any) => s + (Array.isArray(r?.traslados) ? r.traslados.length : 0),
        0
      );

      let status = 'REALIZO REPORTE';
      if (reportsForSede.length === 0) status = 'NO REALIZO REPORTE';
      else if (totalTuA === 0 && totalApoyo === 0) status = 'NO HUBO CONTRATACION';

      consolidado.push({
        fecha: reportsForSede[0]?.fecha ?? null,
        sede: sucursal?.nombre ?? '',
        cantidadContratosTuAlianza: totalTuA,
        cantidadContratosApoyoLaboral: totalApoyo,
        totalIngresos: totalTuA + totalApoyo,
        cedulas: totalCedulas,
        traslados: totalTraslados,
        sst: reportsForSede.some((r: any) => r?.sst && r.sst !== 'No se ha cargado SST'),
        notas: reportsForSede.map((r: any) => r?.nota).filter(Boolean).join(', '),
        status
      });
    }

    return consolidado;
  }

  // --------------------------------------------------------------------------------
  // DATE RANGE DIALOGS (solo en navegador)
  // --------------------------------------------------------------------------------
openDateRangeDialog(): void {
  if (!this.isBrowser) return;

  this.launchDateDialog(({ start, end }) => {

    // Swal de carga SIN timer
    Swal.fire({
      title: 'Cargando reportes…',
      html: 'Por favor espera',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading(); // icono/animación de carga
      }
    });

    this.hiringService.obtenerReportesPorFechas(start, end).subscribe({
      next: async ({ reportes }) => {
        try {
          this.reportes = reportes;
          this.dataSource.data = reportes;
          this.consolidadoDataSource.data = await this.generateConsolidatedData(reportes);
        } finally {
          Swal.close(); // cerrar al terminar TODO (incluido el await)
        }
      },
      error: (err) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar',
          text: err?.message ?? 'Ocurrió un error. Intenta de nuevo.'
        });
      }
    });

  });
}

openDateRangeDialog2(): void {
  if (!this.isBrowser) return;

  this.launchDateDialog(({ start, end }) => {
    Swal.fire({
      title: 'Generando archivo…',
      html: 'Por favor espera',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    this.hiringService
      .obtenerBaseContratacionPorFechas(start, end)
      .pipe(finalize(() => Swal.close()))
      .subscribe({
        next: (blob: Blob) => {
          if (!blob || (blob as any).size === 0) {
            Swal.fire({
              icon: 'warning',
              title: 'Sin datos',
              text: 'No se encontraron registros para el rango seleccionado.'
            });
            return;
          }
          const fmt = (d: any) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
          saveAs(blob, `reporte_contratacion_${fmt(start)}_a_${fmt(end)}.xlsx`);
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Error al descargar',
            text: err?.message ?? 'Ocurrió un error al descargar el archivo.'
          });
        }
      });
  });
}

openDateRangeDialog3(): void {
  if (!this.isBrowser) return;

  this.launchDateDialog(({ start, end }) => {
    Swal.fire({
      title: 'Cargando reportes…',
      html: 'Por favor espera',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    this.hiringService.obtenerReportesPorFechasCentroCosto(start, end).subscribe({
      next: ({ resultado }) => {
        const total = resultado?.total_general ?? 0;

        if (total === 0) {
          Swal.close(); // cerrar loader ANTES del warning
          Swal.fire({
            icon: 'warning',
            title: 'No hay reportes',
            text: 'No se encontraron reportes para las fechas seleccionadas.'
          });
          return;
        }

        const detalles = resultado?.detalles ?? [];
        this.consolidadoFechasFincaDataSource = this.formatData(detalles);

        Swal.close(); // cerrar al terminar OK
      },
      error: (err) => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error al cargar',
          text: err?.message ?? 'Ocurrió un error al cargar los reportes.'
        });
      }
    });
  });
}

openDateRangeDialog4(): void {
  if (!this.isBrowser) return;

  this.launchDateDialog(({ start, end }) => {
    // Loader sin timer
    Swal.fire({
      title: 'Generando archivo…',
      html: 'Por favor espera',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    this.hiringService
      .descargarReporteFechaIngresoCentroCostoFincas(start, end)
      .pipe(finalize(() => Swal.close()))
      .subscribe({
        next: (blob: Blob) => {
          // Cerrar loader antes de warnings
          if (!blob || blob.size === 0) {
            Swal.close();
            Swal.fire({
              icon: 'warning',
              title: 'No hay reportes',
              text: 'No se encontraron reportes para las fechas seleccionadas.'
            });
            return;
          }

          // (Opcional) validar content-type si tu backend lo envía
          // if (blob.type && !blob.type.includes(
          //   'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          // )) { ... }

          const fmt = (d: any) => d instanceof Date ? d.toISOString().slice(0, 10) : String(d);
          saveAs(blob, `reporte_centro_costos_${fmt(start)}_a_${fmt(end)}.xlsx`);
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Error al descargar',
            text: err?.message ?? 'Ocurrió un error al descargar el archivo.'
          });
        }
      });
  });
}

  private launchDateDialog(callback: (result: any) => void): void {
    const dialogRef = this.dialog.open(DateRangeDialogComponent, { width: '550px' });
    dialogRef.afterClosed().subscribe(result => {
      if (result) callback(result);
    });
  }

  // --------------------------------------------------------------------------------
  // FORMAT DATA
  // --------------------------------------------------------------------------------
  private formatData(data: any): any[] {
    const fechas = Object.keys(data).sort((a, b) => {
      const dA = new Date(a.split('/').reverse().join('-')).getTime();
      const dB = new Date(b.split('/').reverse().join('-')).getTime();
      return dB - dA;
    });

    const resultado: any[] = [];
    fechas.forEach(fecha => {
      let first = true;
      data[fecha].forEach((item: any) => {
        resultado.push({
          fechaIngreso: first ? fecha : '',
          centroCosto: item.centro_costo,
          total: item.total
        });
        first = false;
      });
    });
    return resultado;
  }

  // --------------------------------------------------------------------------------
  // ZIP DOWNLOAD (solo en navegador)
  // --------------------------------------------------------------------------------
  async descargarCedulasZip(): Promise<void> {
    if (!this.isBrowser) return;

    const zip = new JSZip();
    const sedesMap = new Map<string, any[]>();

    this.dataSource.data.forEach((reporte: any) => {
      const sede = reporte.sede || 'Sin_Sede';
      if (Array.isArray(reporte.cedulas)) {
        sedesMap.has(sede)
          ? sedesMap.get(sede)!.push(...reporte.cedulas)
          : sedesMap.set(sede, [...reporte.cedulas]);
      }
    });

    sedesMap.forEach((cedulas, sede) => {
      const carpeta = zip.folder(sede)!;
      cedulas.forEach((cedula: any, idx: number) => {
        const nombre = cedula.file_name || `cedula_${idx + 1}.pdf`;
        const blob = this.base64ToBlob(cedula.file_base64);
        carpeta.file(nombre, blob);
      });
    });

    const contenidoZip = await zip.generateAsync({ type: 'blob' });
    saveAs(contenidoZip, 'cedulas_por_sede.zip');
  }

  private base64ToBlob(base64: string): Blob {
    const [head, data] = base64.split(',');
    const mime = /:(.*?);/.exec(head)?.[1] || 'application/octet-stream';
    const byteCharacters = atob(data);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) byteNumbers[i] = byteCharacters.charCodeAt(i);
    return new Blob([byteNumbers], { type: mime });
  }
}
