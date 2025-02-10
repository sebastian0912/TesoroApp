import { Component, OnInit } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
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

@Component({
  selector: 'app-traslados',
  standalone: true,
  imports: [
    InfoCardComponent,
    SharedModule
  ],
  templateUrl: './traslados.component.html',
  styleUrls: ['./traslados.component.css'],
})
export class TrasladosComponent implements OnInit {
  displayedColumns: string[] = [
    'codigo_traslado',
    'estado_del_traslado',
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

  constructor(
    private trasladosService: TrasladosService,
    public dialog: MatDialog,
    private utilityService: UtilityServiceService,
  ) {}

  async ngOnInit(): Promise<void> {
    try {
      this.user = this.utilityService.getUser();
      if (this.user && this.user.correo_electronico == 'traslados18@gmail.com' || this.user.correo_electronico == 'programador.ts@gmail.com') {
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
    }
  }

  async cuantosTraslados() {
    // Cargar otros datos después de que los traslados se hayan cargado
    const cont = await this.trasladosService
      .cuantosTrasladosDisponibles()
      .toPromise();
    this.numTrasladosResponsableNull = cont.count_null_responsables;
  }

  async mostrarTraslados() {
    // Mostrar el modal de "Cargando..."
    Swal.fire({
      icon: 'info',
      title: 'Cargando...',
      html: 'Por favor espera mientras se cargan los datos.',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading(); // Muestra el spinner de carga
      },
    });

    // Cargar otros datos después de que los traslados se hayan cargado
    const cont = await this.trasladosService
      .cuantosTrasladosDisponibles()
      .toPromise();
    this.numTrasladosResponsableNull = cont.count_null_responsables;

    this.numTraslados = 5; // Reiniciar el contador de traslados
    // Esperamos la respuesta directamente usando async/await y el operador pipe sin toPromise
    const response: any = await (
      await this.trasladosService.getTrasladosPorResponsable(this.user.primer_nombre + ' ' + this.user.primer_apellido)
    )
      .pipe(
        catchError((error) => {
          return of([]); // Retorna un arreglo vacío en caso de error
        })
      )
      .toPromise();
    // Filtrar los traslados según el estado
    this.dataSource.data = response.traslados;
    // Actualiza los conteos por estado
    this.updateEstadosCount();
    // Ordenar estados count por cantidad
    this.estadosCount = Object.fromEntries(
      Object.entries(this.estadosCount).sort(([, a], [, b]) => b - a)
    );

    this.numTraslados -= response.total_diferente_de;
    Swal.close(); // Cierra el modal de carga
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

  // Verifica si es un PDF base64 válido
  isBase64PDF(value: string | null | undefined): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    const base64Regex = /^data:application\/pdf;base64,/;
    return base64Regex.test(value.trim());
  }

  // Abre el PDF en base64 en una nueva pestaña
  openBase64PDF(base64: string): void {
    const cleanBase64 = base64.replace(/^data:application\/pdf;base64,/, '');
    try {
      const binaryString = window.atob(cleanBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);

      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      window.open(blobUrl, '_blank');
    } catch (error) {
      Swal.fire('Error', 'Error al abrir el archivo PDF', 'error');
    }
  }

  // Abre el enlace o PDF dependiendo del caso
  openDocument(value: string): void {
    if (this.isUrl(value)) {
      window.open(value, '_blank'); // Abre el link en una nueva pestaña
    } else if (this.isBase64PDF(value)) {
      this.openBase64PDF(value); // Abre el PDF en base64
    } else {
      alert('No disponible'); // Muestra un mensaje si no es válido
    }
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
        height: '550pt',
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

  async verAfiliacion(element: any) {
    try {
      // Obteniendo los datos de la afiliación
      const operarioData: any = await lastValueFrom(
        this.trasladosService.leerAfiliaciones(element.numero_cedula)
      );

      if (operarioData.message === 'No se encontró el número de cédula') {
        Swal.fire(
          'Información',
          'No se encontraron datos de afiliación.',
          'warning'
        );
        return;
      }

      // Verifica si operarioData es un array (se espera un objeto, así que esto sería un error)
      if (Array.isArray(operarioData)) {
        throw new Error('Se esperaba un objeto pero se recibió un arreglo.');
      }

      // Asigna el valor de afiliacion al array this.operario
      this.operario = [operarioData.afiliacion]; // Suponiendo que afiliacion es un objeto
    } catch (error) {
      Swal.fire(
        'Error',
        'Error leyendo afiliaciones, inténtelo nuevamente',
        'error'
      );
      return; // Detener si hay error
    }

    // Abre el modal pasando los datos en formato de array
    this.dialog.open(LeerAdresComponent, {
      minWidth: '50vw',
      height: '500px',
      data: this.operario, // Aquí this.operario será un array, compatible con MatTable
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
      .catch((error) => {});
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
      const response: any = await this.trasladosService.autoasignarTraslado(this.user.primer_nombre + ' ' + this.user.primer_apellido);
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
          if (data.cedula_escaneada_delante) {
            // Mostrar la cédula en PDF si es Base64
            if (this.isBase64PDF(data.cedula_escaneada_delante)) {
              this.openBase64PDF(data.cedula_escaneada_delante);
            } else {
              Swal.fire('Error', 'La cédula no es un PDF válido.', 'error');
            }
          } else {
            Swal.fire('Error', 'No se encontró la cédula escaneada.', 'error');
          }
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
