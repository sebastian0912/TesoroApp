import { 
  Component,
  Inject,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy 
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatMenu } from '@angular/material/menu';

import JSZip from 'jszip';
import Swal from 'sweetalert2';
import saveAs from 'file-saver';
import { finalize } from 'rxjs';

import { SharedModule } from '@/app/shared/shared.module';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import {
  VerPdfsComponent,
  ViewerDocument,
} from '../../components/ver-pdfs/ver-pdfs.component';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { HiringService } from '../../service/hiring.service';
import {
  StandardFilterTable,
} from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ReportesService } from '../../service/reportes/reportes.service';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { MatButtonModule } from '@angular/material/button';

type DateRangeAction =
  | 'filterTables'
  | 'exportContratacion'
  | 'generateCentroCostoTable'
  | 'exportFincas';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-view-reports',
  imports: [SharedModule, StandardFilterTable, MatButtonModule],
  templateUrl: './view-reports.component.html',
  styleUrl: './view-reports.component.css',
} )
export class ViewReportsComponent implements OnInit {
  // Evita el error de tipo en [matMenuTriggerFor]="menu"
  @ViewChild(MatMenu) menu!: MatMenu;

  // --------------------------------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------------------------------

  // Tabla 1 – detalle
  reportes: any[] = [];

  // Columnas tabla 1
  reportesColumns: ColumnDefinition[] = [
    {
      name: 'fecha',
      header: 'Fecha',
      type: 'date',
      width: '140px',
      align: 'left',
    },
    {
      name: 'nombre',
      header: 'Persona quien subió',
      type: 'text',
      align: 'left',
    },
    {
      name: 'sede',
      header: 'Sede',
      type: 'text',
      align: 'left',
    },
    {
      name: 'cantidadContratosTuAlianza',
      header: 'Contratos Tu Alianza',
      type: 'number',
      width: '150px',
      align: 'right',
    },
    {
      name: 'cantidadContratosApoyoLaboral',
      header: 'Contratos Apoyo Laboral',
      type: 'number',
      width: '180px',
      align: 'right',
    },
    {
      name: 'nota',
      header: 'Nota',
      type: 'text',
      align: 'left',
    },
    {
      name: 'actions',
      header: 'Documentos',
      type: 'custom',
      width: '280px',
      align: 'center',
      filterable: false,
    },
  ];

  // Tabla 2 – consolidado por oficina
  consolidado: any[] = [];

  // Alias opcional, por si el HTML aún usa [dataSource]="consolidadoDataSource"
  consolidadoDataSource: any[] = [];

  consolidadoColumns: ColumnDefinition[] = [
    {
      name: 'fecha',
      header: 'Fecha',
      type: 'date',
      width: '140px',
      align: 'left',
    },
    {
      name: 'status',
      header: 'Estado',
      type: 'status',
      width: '180px',
      align: 'left',
      statusConfig: {
        'REALIZO REPORTE': {
          color: '#166534',
          background: '#dcfce7',
        },
        'NO HUBO CONTRATACION': {
          color: '#b45309',
          background: '#fef3c7',
        },
      },
    },
    {
      name: 'sede',
      header: 'Oficina',
      type: 'text',
      align: 'left',
    },
    {
      name: 'cantidadContratosTuAlianza',
      header: 'Contratos Tu Alianza',
      type: 'number',
      width: '150px',
      align: 'right',
    },
    {
      name: 'cantidadContratosApoyoLaboral',
      header: 'Contratos Apoyo Laboral',
      type: 'number',
      width: '180px',
      align: 'right',
    },
    {
      name: 'totalIngresos',
      header: 'Total ingresos',
      type: 'number',
      width: '140px',
      align: 'right',
    },
    {
      name: 'cedulas',
      header: 'Cédulas subidas',
      type: 'number',
      width: '140px',
      align: 'right',
    },
    {
      name: 'traslados',
      header: 'Traslados',
      type: 'number',
      width: '120px',
      align: 'right',
    },
    {
      name: 'sst',
      header: 'SST',
      type: 'select',
      options: ['Sí', 'No'],
      width: '80px',
      align: 'center',
    },
    {
      name: 'notas',
      header: 'Notas',
      type: 'text',
      align: 'left',
    },
  ];

  // Tabla 3 – fechas / finca
  consolidadoFechasFincaDataSource: any[] = [];

  userCorreo = '';
  userNombre = '';

  isSidebarHidden = false;
  private isBrowser: boolean;

  private readonly adminEmails = new Set<string>([
    'tuafiliacion@tsservicios.co',
    'programador.ts@gmail.com',
    'a.seguridad.ts@gmail.com',
    'a.sotelotualianza@gmail.com',
    'nominacentral9@gmail.com'
  ]);

  get isAdminReportUser(): boolean {
    const email = (this.userCorreo || '').toLowerCase();
    return this.adminEmails.has(email);
  }

  constructor(
    private readonly hiringService: HiringService,
    private readonly reportesService: ReportesService,
    private readonly dialog: MatDialog,
    private readonly utilityService: UtilityServiceService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  // --------------------------------------------------------------------------------
  // LIFECYCLE
  // --------------------------------------------------------------------------------

  async ngOnInit(): Promise<void> {
    if (!this.isBrowser) return;

    const user = await this.utilityService.getUser();
    if (user) {
      this.userCorreo = user.correo_electronico;
      this.userNombre = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;
    }

    // Día actual por defecto
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    this.loadReportes({ fechaDesde: today, fechaHasta: today });
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
  // DATA – TABLAS 1 y 2 (ReportesService)
  // --------------------------------------------------------------------------------

  private loadReportes(filters?: {
    nombre?: string;
    fechaDesde?: string;
    fechaHasta?: string;
  }): void {
    if (!this.isBrowser) return;

    Swal.fire({
      icon: 'info',
      title: 'Cargando...',
      html: 'Por favor espera mientras se cargan los reportes.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.reportesService.getReportes(filters).subscribe({
      next: ({ reportes, consolidado }) => {
        Swal.close();

        // Tabla 1 – detalle
        this.reportes = reportes ?? [];

        // Tabla 2 – consolidado (solo admins)
        if (this.isAdminReportUser) {
          this.consolidado = (consolidado ?? []).map((item: any) => ({
            ...item,
            // Normalizamos sst a Sí/No
            sst: item.sst ? 'Sí' : 'No',
          }));
          // Alias sincronizado
          this.consolidadoDataSource = this.consolidado;
        } else {
          this.consolidado = [];
          this.consolidadoDataSource = [];
        }
      },
      error: () => {
        Swal.close();
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Ocurrió un error al obtener los reportes.',
        });
      },
    });
  }

  // --------------------------------------------------------------------------------
  // VISOR DE DOCUMENTOS (dialog genérico)
  // --------------------------------------------------------------------------------

  openDocsDialog(title: string, docs: any[] | null | undefined): void {
    if (!this.isBrowser) return;

    const documents: ViewerDocument[] = (docs ?? [])
      .filter((d: any) => !!d?.file_url)
      .map((d: any) => ({
        id: d.id,
        title: d.title,
        type_name: d.type_name,
        file_url: d.file_url,
      }));

    this.dialog.open(VerPdfsComponent, {
      minWidth: '90vw',
      panelClass: 'docs-viewer-dialog',
      data: {
        title,
        documents,
      },
    });
  }

  // --------------------------------------------------------------------------------
  // DATE RANGE – ÚNICO MÉTODO
  // --------------------------------------------------------------------------------

  openDateRangeDialog(action: DateRangeAction): void {
    if (!this.isBrowser) return;

    const dialogRef = this.dialog.open(DateRangeDialogComponent, {
      width: '550px',
    });

    dialogRef.afterClosed().subscribe(
      (result?: { start: string | null; end: string | null }) => {
        if (!result || (!result.start && !result.end)) return;

        const from = result.start ?? '';
        const to = result.end ?? '';

        switch (action) {
          case 'filterTables': {
            this.loadReportes({
              fechaDesde: from || undefined,
              fechaHasta: to || undefined,
            });
            break;
          }

          case 'exportContratacion': {
            Swal.fire({
              title: 'Generando archivo…',
              html: 'Por favor espera',
              allowOutsideClick: false,
              allowEscapeKey: false,
              showConfirmButton: false,
              didOpen: () => Swal.showLoading(),
            });

            this.hiringService
              .obtenerBaseContratacionPorFechas(from, to)
              .pipe(finalize(() => Swal.close()))
              .subscribe({
                next: (blob: Blob) => {
                  if (!blob || (blob as any).size === 0) {
                    Swal.fire({
                      icon: 'warning',
                      title: 'Sin datos',
                      text: 'No se encontraron registros para el rango seleccionado.',
                    });
                    return;
                  }
                  saveAs(
                    blob,
                    `reporte_contratacion_${from || 'sin_desde'}_a_${to || 'sin_hasta'}.xlsx`,
                  );
                },
                error: (err) => {
                  Swal.fire({
                    icon: 'error',
                    title: 'Error al descargar',
                    text:
                      err?.message ??
                      'Ocurrió un error al descargar el archivo.',
                  });
                },
              });
            break;
          }

          case 'generateCentroCostoTable': {
            Swal.fire({
              title: 'Cargando reportes…',
              html: 'Por favor espera',
              allowOutsideClick: false,
              allowEscapeKey: false,
              showConfirmButton: false,
              didOpen: () => Swal.showLoading(),
            });

            this.hiringService
              .obtenerReportesPorFechasCentroCosto(from, to)
              .subscribe({
                next: ({ resultado }) => {
                  const total = resultado?.total_general ?? 0;

                  if (total === 0) {
                    Swal.close();
                    Swal.fire({
                      icon: 'warning',
                      title: 'No hay reportes',
                      text: 'No se encontraron reportes para las fechas seleccionadas.',
                    });
                    return;
                  }

                  const detalles = resultado?.detalles ?? [];
                  this.consolidadoFechasFincaDataSource =
                    this.formatData(detalles);
                  Swal.close();
                },
                error: (err) => {
                  Swal.close();
                  Swal.fire({
                    icon: 'error',
                    title: 'Error al cargar',
                    text:
                      err?.message ??
                      'Ocurrió un error al cargar los reportes.',
                  });
                },
              });
            break;
          }

          case 'exportFincas': {
            Swal.fire({
              title: 'Generando archivo…',
              html: 'Por favor espera mientras se genera el reporte de fincas.',
              allowOutsideClick: false,
              allowEscapeKey: false,
              showConfirmButton: false,
              didOpen: () => Swal.showLoading(),
            });

            this.hiringService
              .descargarReporteFechaIngresoCentroCostoFincas(from, to)
              .pipe(finalize(() => Swal.close()))
              .subscribe({
                next: (blob: Blob) => {
                  // Sin datos
                  if (!blob || blob.size === 0) {
                    Swal.fire({
                      icon: 'warning',
                      title: 'No hay reportes',
                      text: 'No se encontraron reportes de fincas para las fechas seleccionadas.',
                    });
                    return;
                  }

                  // Descarga OK
                  const nombreArchivo = `reporte_fincas_${from || 'sin_desde'}_a_${to || 'sin_hasta'}.xlsx`;
                  saveAs(blob, nombreArchivo);
                },
                error: (err) => {
                  Swal.fire({
                    icon: 'error',
                    title: 'Error al descargar',
                    text:
                      err?.message ??
                      'Ocurrió un error al descargar el reporte de fincas.',
                  });
                },
              });

            break;
          }



        }
      },
    );
  }

  // --------------------------------------------------------------------------------
  // FORMAT DATA – TABLA 3
  // --------------------------------------------------------------------------------

  private formatData(data: any): any[] {
    const fechas = Object.keys(data).sort((a, b) => {
      const dA = new Date(a.split('/').reverse().join('-')).getTime();
      const dB = new Date(b.split('/').reverse().join('-')).getTime();
      return dB - dA;
    });

    const resultado: any[] = [];
    fechas.forEach((fecha) => {
      let first = true;
      data[fecha].forEach((item: any) => {
        resultado.push({
          fechaIngreso: first ? fecha : '',
          centroCosto: item.centro_costo,
          total: item.total,
        });
        first = false;
      });
    });
    return resultado;
  }

  hasAnyDocument(row: any): boolean {
    return (
      (Array.isArray(row?.cedulas) && row.cedulas.length > 0) ||
      (Array.isArray(row?.traslados) && row.traslados.length > 0) ||
      !!row?.cruce_document?.file_url ||
      !!row?.sst_document?.file_url
    );
  }


  // --------------------------------------------------------------------------------
  // ZIP – CÉDULAS POR SEDE (usando file_url)
  // --------------------------------------------------------------------------------

  descargarCedulasZip(): void {
    if (!this.isBrowser) return;

    Swal.fire({
      icon: 'info',
      title: 'Generando ZIP de cédulas',
      html: 'Por favor espera mientras preparamos la descarga.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    // Llamamos al backend SIN filtros (sin fechas)
    this.reportesService
      .downloadCedulasZip()
      .pipe(finalize(() => Swal.close()))
      .subscribe({
        next: (blob: Blob) => {
          if (!blob || blob.size === 0) {
            Swal.fire({
              icon: 'warning',
              title: 'Sin cédulas',
              text: 'No se encontraron documentos de cédula para descargar.',
            });
            return;
          }

          saveAs(blob, 'cedulas_reportes.zip');

          Swal.fire({
            icon: 'success',
            title: 'Descarga lista',
            text: 'El archivo ZIP de cédulas se generó correctamente.',
          });
        },
        error: (err) => {
          // err viene normalizado desde handleError del ReportesService
          Swal.fire({
            icon: 'error',
            title: 'Error al descargar',
            text:
              err?.message ??
              'Ocurrió un error al descargar el ZIP de cédulas.',
          });
        },
      });
  }

}
