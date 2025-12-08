import { Component, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';

import JSZip from 'jszip';
import Swal from 'sweetalert2';
import saveAs from 'file-saver';
import { finalize } from 'rxjs';

import { SharedModule } from '@/app/shared/shared.module';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { VerPdfsComponent, ViewerDocument } from '../../components/ver-pdfs/ver-pdfs.component';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { HiringService } from '../../service/hiring.service';
import { ReportesService } from '../../service/reportes/reportes.service';

type DateRangeAction =
  | 'filterTables'
  | 'exportContratacion'
  | 'generateCentroCostoTable'
  | 'exportFincas';

@Component({
  selector: 'app-view-reports',
  imports: [SharedModule],
  templateUrl: './view-reports.component.html',
  styleUrl: './view-reports.component.css',
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
    'nota',
  ];
  dataSource = new MatTableDataSource<any>();

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
    'notas',
  ];

  // Tabla 3 – fechas / finca
  consolidadoFechasFincaDataSource: any[] = [];

  userCorreo = '';
  userNombre = '';
  filterValues: any = { nombre: '', sede: '' };

  isSidebarHidden = false;
  private isBrowser: boolean;

  private readonly adminEmails = new Set<string>([
    'tuafiliacion@tsservicios.co',
    'programador.ts@gmail.com',
    'a.seguridad.ts@gmail.com',
    'a.sotelotualianza@gmail.com',
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

        // Tabla 1
        this.reportes = reportes;
        this.dataSource.data = reportes;

        // Tabla 2 (solo para usuarios admin de reportes)
        if (this.isAdminReportUser) {
          this.consolidadoDataSource.data = consolidado ?? [];
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
  // FILTERS TABLA 1
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
        (data.nombre || '').toLowerCase().includes(searchTerms.nombre) &&
        (data.sede || '').toLowerCase().includes(searchTerms.sede)
      );
    };
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
      width: '90vw',
      maxWidth: '100vw',
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

    const dialogRef = this.dialog.open(DateRangeDialogComponent, { width: '550px' });

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
                  this.consolidadoFechasFincaDataSource = this.formatData(detalles);
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
              html: 'Por favor espera',
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
                  if (!blob || blob.size === 0) {
                    Swal.fire({
                      icon: 'warning',
                      title: 'No hay reportes',
                      text:
                        'No se encontraron reportes para las fechas seleccionadas.',
                    });
                    return;
                  }

                  saveAs(
                    blob,
                    `reporte_centro_costos_${from || 'sin_desde'}_a_${to || 'sin_hasta'}.xlsx`,
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

  // --------------------------------------------------------------------------------
  // ZIP – CÉDULAS POR SEDE (usando file_url)
  // --------------------------------------------------------------------------------
  async descargarCedulasZip(): Promise<void> {
    if (!this.isBrowser) return;

    const zip = new JSZip();
    const sedesMap = new Map<string, any[]>();

    // Agrupar por sede
    this.dataSource.data.forEach((reporte: any) => {
      const sede = reporte.sede || 'Sin_Sede';
      if (Array.isArray(reporte.cedulas) && reporte.cedulas.length > 0) {
        const current = sedesMap.get(sede) ?? [];
        current.push(...reporte.cedulas);
        sedesMap.set(sede, current);
      }
    });

    const fetchPromises: Promise<void>[] = [];

    sedesMap.forEach((cedulas, sede) => {
      const folder = zip.folder(sede)!;

      cedulas.forEach((doc: any, idx: number) => {
        if (!doc.file_url) return;

        const fileUrl: string = doc.file_url;
        const safeTitle =
          (doc.title as string | undefined)?.replace(/[^\w\-\.]+/g, '_') ??
          '';
        const nameFromUrl = fileUrl.split('/').pop() ?? '';
        const fileName =
          safeTitle ||
          nameFromUrl ||
          `cedula_${idx + 1}.pdf`;

        const p = fetch(fileUrl)
          .then((res) => res.blob())
          .then((blob) => {
            folder.file(fileName, blob);
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error('Error descargando archivo', fileUrl, err);
          });

        fetchPromises.push(p);
      });
    });

    await Promise.all(fetchPromises);

    const contenidoZip = await zip.generateAsync({ type: 'blob' });
    saveAs(contenidoZip, 'cedulas_por_sede.zip');
  }
}
