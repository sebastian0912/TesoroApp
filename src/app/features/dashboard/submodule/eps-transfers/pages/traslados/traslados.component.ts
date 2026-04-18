import {  Component, OnInit, ViewChild , ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { TrasladosService } from '../../service/traslados.service';
import { catchError } from 'rxjs/operators';
import { lastValueFrom, of } from 'rxjs';
import Swal from 'sweetalert2';
import { EstadosDialogComponent } from '../../components/estados-dialog/estados-dialog.component';
import { TrabajadorComponent } from '../../components/trabajador/trabajador.component';
import { CambiarEstadoComponent } from '../../components/cambiar-estado/cambiar-estado.component';
import { LeerAdresComponent } from '../../components/leer-adres/leer-adres.component';
import { InfoCardComponent } from '../../../../../../shared/components/info-card/info-card.component';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';
import { SharedModule } from '../../../../../../shared/shared.module';
import { ElectronWindowService } from '../../../../../../core/services/electron-window.service';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-traslados',
  imports: [
    InfoCardComponent,
    SharedModule,
    MatPaginatorModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './traslados.component.html',
  styleUrls: ['./traslados.component.css'],
} )
export class TrasladosComponent implements OnInit {
  displayedColumns: string[] = [
    'codigo_traslado',
    'estado_del_traslado',
    'observacion_estado',
    'numero_cedula',
    'solicitud_traslado',
    'cedulas',
    'eps_a_trasladar',
    'actions',
  ];
  estadosCount: { [key: string]: number } = {}; // Asegúrate de que está inicializado como objeto vacío

  dataSource = new MatTableDataSource<any>();
  numTraslados: number = 5;
  numTrasladosResponsableNull: number = 0;
  operario: any = {};
  correos: any[] = [];
  dataLoaded: boolean = false; // Bandera para indicar si los datos están cargados
  istraslados18: boolean = false;
  user: any;
  @ViewChild(MatPaginator) paginator!: MatPaginator; // Obtener el paginador

  constructor(
    private trasladosService: TrasladosService,
    public dialog: MatDialog,
    private utilityService: UtilityServiceService,
    private cdr: ChangeDetectorRef,
    private electronWindow: ElectronWindowService,
  ) { }

  ngAfterViewInit() {
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
    }
  }


  async ngOnInit(): Promise<void> {

    try {
      this.user = this.utilityService.getUser();
      if (this.user && (this.user.correo_electronico == 'traslados18@gmail.com' || this.user.correo_electronico == 'programador.ts@gmail.com')) {
        this.istraslados18 = true;
      }
      // Cargar los traslados y esperar a que se complete
      await this.mostrarTraslados();
    } catch (error) {
      Swal.fire('Error', 'Hubo un problema al cargar los datos.', 'error');
      return;
    } finally {
      this.dataLoaded = true; // Indica que los datos están completamente cargados
      Swal.close(); // Cerrar el modal después de cargar todos los datos
      this.cdr.markForCheck();
    }
  }

  async cuantosTraslados() {
    // Cargar otros datos después de que los traslados se hayan cargado
    const cont = await this.trasladosService
      .cuantosTrasladosDisponibles()
      .toPromise();
    this.numTrasladosResponsableNull = cont.count_null_responsables;
    this.cdr.markForCheck();
  }
  async mostrarTraslados() {
    Swal.fire({
      icon: 'info',
      title: 'Cargando...',
      html: 'Por favor espera mientras se cargan los datos.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      // Obtener número de traslados disponibles
      const cont = await lastValueFrom(this.trasladosService.cuantosTrasladosDisponibles());
      this.numTrasladosResponsableNull = cont.count_null_responsables;

      this.numTraslados = 5; // Reiniciar contador de traslados

      // Obtener traslados por responsable
      const response: any = await lastValueFrom(
        this.trasladosService.getTrasladosPorResponsable(
          `${this.user.datos_basicos.nombres} ${this.user.datos_basicos.apellidos}`
        ).pipe(
          catchError(() => of({ traslados: [], total_diferente_de: 0 })) // Evita errores
        )
      );

      // Cargar los datos en la tabla
      this.dataSource.data = response.traslados;

      // Reasignar paginador y ordenar después de actualizar los datos
      setTimeout(() => {
        this.dataSource.paginator = this.paginator;
      });

      // Actualizar conteo de estados
      this.updateEstadosCount();

      // Ordenar estados por cantidad
      this.estadosCount = Object.fromEntries(
        Object.entries(this.estadosCount).sort(([, a], [, b]) => b - a)
      );

      // Ajustar número de traslados
      this.numTraslados -= response.total_diferente_de;

    } catch (error) {
      Swal.fire('Error', 'No se pudieron cargar los datos.', 'error');
    } finally {
      Swal.close(); // Cerrar modal de carga
      this.cdr.markForCheck();
    }
  }

  updateEstadosCount(): void {
    // Reinicia el conteo
    this.estadosCount = this.dataSource.data.reduce((acc, element) => {
      const estado = element.estado_del_traslado;
      if (estado) {
        acc[estado] = (acc[estado] || 0) + 1;
      }
      return acc;
    }, {} as { [key: string]: number });
  }

  applyFilterByEstado(estado: string): void {
    this.dataSource.filterPredicate = (data: any, filter: string) => {
      return data.estado_del_traslado.trim().toLowerCase() === filter;
    };
    this.dataSource.filter = estado.trim().toLowerCase(); // Aplica el filtro
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  // Verifica si es una URL válida
  isUrl(value: string | null | undefined): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const trimmedValue = value.trim();
    const urlRegex = /^(https?:\/\/[^\s$.?#].[^\s]*)/;
    return urlRegex.test(trimmedValue);
  }

  // Verifica si es un PDF base64 válido (acepta data URL o base64 crudo con prefijo %PDF)
  isBase64PDF(value: string | null | undefined): boolean {
    return this.electronWindow.isPdfBase64(value);
  }

  // Abre el PDF en base64 en una ventana hija de Electron (o pestaña en web).
  openBase64PDF(base64: string): void {
    this.electronWindow.openPdfFromBase64(base64, { title: 'Solicitud de traslado' });
  }

  // Abre el enlace o PDF dependiendo del caso
  openDocument(value: string): void {
    this.electronWindow.openDocument(value, { title: 'Solicitud de traslado' });
  }

  // Método para determinar el texto del botón
  getButtonText(value: string): string {
    if (this.isUrl(value) || this.isBase64PDF(value)) {
      return 'Ver doc';
    } else {
      return 'No disponible';
    }
  }

  cambiarEstado(element: any) {
    this.dialog
      .open(CambiarEstadoComponent, {
        minWidth: '30vw',
        height: '60vh',
        data: element,
      })
      .afterClosed()
      .subscribe((formData: any) => {
        if (formData) {
          this.trasladosService
            .cambiarEstado(
              element.codigo_traslado,
              formData.estado,
              formData.fechaConfirmacion,
              formData.numeroRadicado,
              formData.numeroBeneficiarios,
              formData.observaciones,
              formData.epsTraslado
            )
            .then((response: any) => {
              this.mostrarTraslados();
            })
            .catch((error) => {
              Swal.fire(
                'Error',
                'Error cambiando estado, intentelo nuevamente',
                'error'
              );
            });
        }
      });
  }

  async verTrabajador(element: any) {
    try {
      this.operario = await lastValueFrom(
        await this.utilityService.buscarOperarioPorCedula(
          element.numero_cedula
        )
      );
    } catch (error) {
      Swal.fire(
        'Error',
        'Error buscando trabajador, inténtelo nuevamente',
        'error'
      );
    }

    this.dialog.open(TrabajadorComponent, {
      minWidth: '80vw',
      height: '200pt',
      data: this.operario.data,
    });
  }

  verEstado(element: any) {
    const estadosArray = Object.keys(element.ultimas_actualizaciones).map(
      (key) => ({
        fecha: key,
        estado: element.ultimas_actualizaciones[key],
      })
    );

    this.dialog.open(EstadosDialogComponent, {
      minWidth: '50vw',
      height: '300pt',
      data: { estados: estadosArray },
    });
  }

  cambiarCorreo(element: any) {
    this.trasladosService
      .cambiarCorreo(element.codigo_traslado, this.user.primer_nombre + ' ' + this.user.primer_apellido)
      .then((response: any) => {
        this.mostrarTraslados();
      })
      .catch((error) => { });
  }

  async autoAsignar() {
    if (!this.dataLoaded) {
      Swal.fire(
        'Error',
        'Por favor espera a que todos los datos estén cargados',
        'warning'
      );
      return;
    }

    if (this.numTraslados <= 0) {
      Swal.fire('Error', 'Acaba primero con los traslados que tienes pendientes', 'warning');
      return;
    }

    // Muestra el Swal de carga
    const loadingSwal = Swal.fire({
      title: 'Cargando...',
      icon: 'info',
      text: 'Por favor espera, asignando traslado...',
      didOpen: () => {
        Swal.showLoading(); // Muestra el icono de carga
      },
      allowOutsideClick: false, // Evita que el usuario cierre el modal
      showConfirmButton: false, // Oculta el botón de confirmación
    });

    try {
      const response: any = await this.trasladosService.autoasignarTraslado(this.user.datos_basicos.nombres + ' ' + this.user.datos_basicos.apellidos);
      if (
        response.correo_status === 'Correo actualizado correctamente.' &&
        response.traslado_status === 'Traslado actualizado correctamente.'
      ) {
        Swal.fire({
          title: 'Correo y traslado asignados correctamente',
          icon: 'success',
          confirmButtonText: 'Aceptar'
        }).then(() => {
          this.mostrarTraslados();
        });

      } else {
        Swal.fire(
          'Error',
          'Error autoasignando, intentelo nuevamente',
          'error'
        ).then(() => {
          this.mostrarTraslados();
        });
      }
    } catch (error: any) {
      // Cierra el Swal de carga
      Swal.close();

      if (error.error.error === 'No hay traslados disponibles') {
        Swal.fire('Error', 'No hay traslados disponibles', 'warning').then(
          () => {
            this.mostrarTraslados();
          }
        );
        return;
      } else if (error.error.error === 'No hay correos disponibles') {
        Swal.fire('Error', 'No hay correos disponibles', 'warning').then(() => {
          this.mostrarTraslados();
        });
        return;
      }
    }
  }




  imprimirCedula(codigoTraslado: string): void {
    // Mostrar Swal de carga
    Swal.fire({
      title: 'Cargando...',
      icon: 'info',
      text: 'Obteniendo la cédula escaneada.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.trasladosService.traerCedulaEscaneada(codigoTraslado).subscribe(
      (data: any) => {
        Swal.close();
        const dataUrl: string | undefined = data?.cedula_escaneada_delante;
        const fileUrl: string | undefined = data?.file_url;

        if (dataUrl && this.isBase64PDF(dataUrl)) {
          this.openBase64PDF(dataUrl);
          return;
        }
        if (fileUrl) {
          this.electronWindow.openExternal(fileUrl);
          return;
        }
        Swal.fire('Error', 'No se encontró la cédula escaneada.', 'error');
      },
      (error) => {
        Swal.close(); // Cerrar Swal de carga
        Swal.fire('Error', 'Hubo un problema obteniendo la cédula escaneada.', 'error');
      }
    );
  }

  imprimirSolicitudTraslado(codigoTraslado: string): void {
    // Mostrar Swal de carga
    Swal.fire({
      title: 'Cargando...',
      icon: 'info',
      text: 'Obteniendo la solicitud de traslado.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    this.trasladosService.traerSolicitudPorCodigo(codigoTraslado).subscribe(
      (data: any) => {
        Swal.close();

        if (data[0].solicitud_traslado) {
          // Mostrar la solicitud en PDF si es Base64
          if (this.isBase64PDF(data[0].solicitud_traslado)) {
            this.openBase64PDF(data[0].solicitud_traslado);
          } else {
            Swal.fire('Error', 'La solicitud de traslado no es un PDF válido.', 'error');
          }
        } else {
          Swal.fire('Error', 'No se encontró la solicitud de traslado.', 'error');
        }
      },
      (error) => {
        Swal.close();
        Swal.fire('Error', 'Hubo un problema obteniendo la solicitud de traslado.', 'error');
      }
    );
  }

}
