import { Component, OnInit, ViewChild } from '@angular/core';
import { ActiveAuthorizationsComponent } from '../components/active-authorizations/active-authorizations.component';
import { TerminatedTransfersComponent } from '../components/terminated-transfers/terminated-transfers.component';
import { MerchandisingMerchandiseComponent } from '../components/merchandising-merchandise/merchandising-merchandise.component';
import { HomeService } from '../service/home.service';
import { MatDialog } from '@angular/material/dialog';
import { UtilityServiceService } from '../../../../../shared/services/utilityService/utility-service.service';
import { catchError, forkJoin, of } from 'rxjs';
import Swal from 'sweetalert2';
import { CommonModule, NgIf } from '@angular/common';
import { InfoCardComponent } from '../../../../../shared/components/info-card/info-card.component';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatSort } from '@angular/material/sort';
import { RobotsService } from '../../hiring/service/robots/robots.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

@Component({
  selector: 'app-home',
  imports: [
    ActiveAuthorizationsComponent,
    TerminatedTransfersComponent,
    MerchandisingMerchandiseComponent,
    InfoCardComponent,
    NgIf,
    MatCardModule,
    CommonModule,
    MatIconModule,
    MatTableModule
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent implements OnInit {
  user: any;
  numeroempleados = 0;
  numeroautorizaciones_sin_efectuar = 0;
  numeroCoordinadores = 0;
  numeroTiendas = 0;
  general = false;
  comercializadora = false;
  admin = false;
  traslado = false;

  constructor(
    private dialog: MatDialog,
    private utilityService: UtilityServiceService,
    private homeService: HomeService,
        private robotsService: RobotsService,

  ) { }

  ngOnInit(): void {
    this.initializeUserRoles();
    this.fetchInitialData();

        this.robotsService.consultarEstadosRobotsPendientesGenerales()
      .pipe(catchError(error => { console.error('Error fetching data', error); return of([]); }))
      .subscribe((data: any[]) => {
        if (data.length > 0) {
          this.displayedPaqueteColumns = Object.keys(data[0]);
          const prioridadIndex = this.displayedPaqueteColumns.indexOf('prioridad');
          if (prioridadIndex !== -1 && !this.displayedPaqueteColumns.includes('descargar')) {
            this.displayedPaqueteColumns.splice(prioridadIndex + 1, 0, 'descargar');
          }
        }
        this.paquetesDataSource.data = data;
      });

    this.robotsService.consultarEstadosRobotsPendientesPorOficina()
      .pipe(catchError(error => { console.error('Error fetching data', error); return of([]); }))
      .subscribe((data: any[]) => {
        const processedData = this.transformData(data);
        this.displayedColumns = ['pendiente', 'Total', ...processedData.columns];
        this.dataSource.data = processedData.rows;
      });
  }

  private initializeUserRoles(): void {
    this.user = this.utilityService.getUser();
    if (!this.user || this.user.rol.nombre === 'SIN-ASIGNAR') {
      this.general = false;
      this.comercializadora = false;
      this.traslado = false;
      this.admin = false;
      return;
    }

    this.general = this.user.rol.nombre !== 'GERENCIA' && this.user.rol.nombre !== 'TRASLADOS';
    this.comercializadora = this.user.rol.nombre === 'COMERCIALIZADORA' || this.user.rol.nombre === 'ADMIN' || this.user.correo_electronico === 'tuafiliacion@tsservicios.co';
    this.traslado = this.user.rol.nombre === 'TRASLADOS' || this.user.rol.nombre === 'ADMIN' || this.user.correo_electronico === 'tuafiliacion@tsservicios.co';
    this.admin = this.user.rol.nombre === 'GERENCIA' || this.user.rol.nombre === 'ADMIN';
  }

  private async fetchInitialData(): Promise<void> {
    if (!this.general) return;

    Swal.fire({
      title: 'Cargando...',
      text: 'Por favor, espere',
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    this.fetchGeneralData();
  }

  private fetchGeneralData(): void {
    forkJoin({
      empleados: this.homeService.traerEmpleados().pipe(catchError(() => of({ datosbase: [] }))),
      usuarios: this.homeService.traerUsuarios().pipe(catchError(() => of([]))),
    }).subscribe(
      ({ empleados, usuarios }) => {
        this.numeroempleados = empleados.datosbase.filter((worker: any) => worker.activo).length;

        this.numeroCoordinadores = this.homeService.contarRol(usuarios, 'COORDINADOR');
        this.numeroTiendas = this.homeService.contarRol(usuarios, 'TIENDA');
        Swal.close();
      },
      () => {
        Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'No se pudo cargar la información',
        });
      }
    );
  }

    displayedColumns: string[] = [];
  dataSource = new MatTableDataSource<any>();
  @ViewChild(MatSort) sort!: MatSort;
  isSidebarHidden = false;
  paquetesDataSource = new MatTableDataSource<any>();
  displayedPaqueteColumns: string[] = [];
  robotsHome: boolean = false;


  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
  }

  transformData(data: any[]): { columns: string[], rows: any[] } {
    const columns: string[] = [];
    const pendientesSet = new Set<string>();

    data.forEach(item => {
      if (item.oficina) {
        columns.push(item.oficina);
        Object.keys(item).forEach(key => {
          if (key !== 'oficina') pendientesSet.add(key);
        });
      }
    });

    const rows = Array.from(pendientesSet).map(pendiente => {
      const row: any = { pendiente };
      let totalFila = 0;
      data.forEach(item => {
        if (item.oficina) {
          const valor = item[pendiente] ?? 0;
          row[item.oficina] = valor;
          totalFila += valor;
        }
      });
      row['Total'] = totalFila;
      return row;
    });

    return { columns, rows };
  }

  getTotalForColumn(column: string): number {
    return this.dataSource.data.reduce((sum, row) => sum + (row[column] ?? 0), 0);
  }

  getTotalForPaqueteColumn(column: string): number {
    return this.paquetesDataSource.data.reduce((sum, row) => sum + (row[column] ?? 0), 0);
  }

  onDropPaquete(event: CdkDragDrop<any[]>) {
    const data = this.paquetesDataSource.data;
    const prevIndex = event.previousIndex;
    const currIndex = event.currentIndex;

    if (prevIndex === currIndex) return;

    const prioridadA = data[prevIndex].prioridad;
    const prioridadB = data[currIndex].prioridad;

    const paqueteA = data[prevIndex].paquete;
    const paqueteB = data[currIndex].paquete;

    data[prevIndex].prioridad = prioridadB;
    data[currIndex].prioridad = prioridadA;

    moveItemInArray(data, prevIndex, currIndex);
    this.paquetesDataSource.data = [...data];

    forkJoin([
      this.robotsService.actualizarPrioridad(paqueteA, prioridadB),
      this.robotsService.actualizarPrioridad(paqueteB, prioridadA)
    ]).subscribe({
      next: () => Swal.fire('Éxito', 'Prioridades actualizadas', 'success'),
      error: () => Swal.fire('Error', 'No se pudo actualizar la prioridad', 'error')
    });
  }
/*
  descargarZip(paquete: string): void {
    Swal.fire({
      title: '¿Deseas unir los archivos PDF en uno solo?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, unir PDF',
      cancelButtonText: 'No, descargar separados'
    }).then(result => {
      if (result.isConfirmed) {
        this.abrirDialogOrden(paquete);
      } else {
        this.descargarZipConUnion(paquete, false);
      }
    });
  }*/
/*
  abrirDialogOrden(paquete: string): void {
    const antecedentes = [
      { id: 3, name: 'PROCURADURIA' },
      { id: 4, name: 'CONTRALORIA' },
      { id: 5, name: 'OFAC' },
      { id: 6, name: 'POLICIVOS' },
      { id: 7, name: 'ADRES' },
      { id: 8, name: 'SISBEN' },
      { id: 9, name: 'FONDO_PENSION' },
      { id: 10, name: 'MEDIDAS_CORRECTIVAS' },
      { id: 11, name: 'AFP' },
      { id: 12, name: 'RAMA_JUDICIAL' }
    ];

    const dialogRef = this.dialog.open(OrdenUnionDialogComponent, {
      width: '400px',
      data: { antecedentes }
    });

    dialogRef.afterClosed().subscribe((ordenSeleccionado: number[] | null) => {
      if (ordenSeleccionado) {
        this.descargarZipConUnion(paquete, true, ordenSeleccionado);
      }
    });
  }
*/
  descargarZipConUnion(paquete: string, unir: boolean, orden: number[] = []): void {
    Swal.fire({
      title: 'Preparando descarga...',
      text: 'Esto puede tardar unos segundos',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.robotsService.descargarZipPaquete(paquete, unir, orden).subscribe({
      next: (blob: Blob) => {
        Swal.close();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paquete_${paquete}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        Swal.close();
        Swal.fire('Error', 'No se pudo descargar el archivo.', 'error');
      }
    });
  }
}
