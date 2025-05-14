import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin, take } from 'rxjs';
import Swal from 'sweetalert2';
import { VetadosService } from '../../service/vetados/vetados.service';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { MatTableDataSource } from '@angular/material/table';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { EventEmitter, Output } from '@angular/core';
import { HiringService } from '../../service/hiring.service';

@Component({
  selector: 'app-search-for-candidate',
  imports: [
    SharedModule,
    FormsModule
  ],
  templateUrl: './search-for-candidate.component.html',
  styleUrl: './search-for-candidate.component.css'
})
export class SearchForCandidateComponent {
  [x: string]: any;
  @Output() codigoContratoChange  = new EventEmitter<string>();
  @Output() cedulaSeleccionada = new EventEmitter<string>();
  codigoContratoActual: string = '';
  sede: string = '';
  // Datos del formulario
  cedula: string = '';
  observacion: string = '';

  // UI flags
  mostrarObservacion: boolean = false;
  procesoValido: boolean = false;

  // Tabla
  dataSource: any;
  displayedColumns!: string[];

  constructor(
    private vetadosService: VetadosService,
    private seleccionService: SeleccionService,
    private utilityService: UtilityServiceService,
    private contratacionService: HiringService
  ) { }

  /**
   * Buscar por cédula si está vetado o no.
   * Si no lo está, permite generar código de contrato.
   */
  async buscarCedula(): Promise<void> {
    // 1 Emitimos la cédula al padre
    this.cedulaSeleccionada.emit(this.cedula);

    forkJoin({
      seleccion: this.contratacionService.traerDatosSeleccion(this.cedula),
      vetado: this.vetadosService.listarReportesVetadosPorCedula(this.cedula)
    })
      .pipe(take(1))
      .subscribe({
        next: ({ vetado, seleccion }) => {
          this.procesarVetado(vetado);
          this.procesarSeleccion(seleccion);
        },
        error: (err) => this.procesarError(err)
      });
  }

  /* ---------- Funciones auxiliares ---------- */

  private procesarVetado(vetado: any[] | null): void {
    if (!Array.isArray(vetado) || vetado.length === 0) {
      return;
    }

    this.procesoValido = true;

    const data = vetado
      .filter(item => item.categoria)                              // solo con categoría
      .map(item => ({
        cedula: item.cedula,
        nombre_completo: item.nombre_completo,
        clasificacion: item.categoria?.clasificacion ?? '',
        descripcion: item.categoria?.descripcion ?? '',
        observacion: item.observacion,
        estado: item.estado,
        sede: item.sede,
        autorizado_por: item.autorizado_por
      }));

    this.dataSource = new MatTableDataSource(data);
    this.displayedColumns = [
      'cedula', 'nombre_completo', 'clasificacion',
      'descripcion', 'observacion', 'estado', 'sede'
    ];
  }

  private procesarSeleccion(seleccion: any): void {
    const procesos = seleccion?.procesoSeleccion;

    // 1️⃣  Si no hay procesos, salimos
    if (!Array.isArray(procesos) || procesos.length === 0) { return; }

    // 2️⃣  Obtenemos el proceso con id mayor
    const ultimoProceso = procesos.reduce(
      (max, curr) => (curr.id > max.id ? curr : max),
      procesos[0]
    );
    const codigoExistente = ultimoProceso.codigo_contrato;

    // 3️⃣  Diálogo de decisión
    Swal.fire({
      title: '¡Atención!',
      html: `Este usuario ya tiene un proceso con el código <b>${codigoExistente}</b>.<br>
             ¿Deseas crear otro o continuar con este?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Crear otro',
      cancelButtonText: 'Continuar con este'
    }).then(result => {
      if (result.isConfirmed) {
        this.generarNuevoCodigoContrato();
      } else {
        // Continuar con el existente
        this.codigoContratoActual = codigoExistente;          // guarda el valor
        this.codigoContratoChange.emit(codigoExistente);      // emite al padre
        this.procesoValido = true;
      }
    });
  }


  private generarNuevoCodigoContrato(): void {
    this.seleccionService.generarCodigoContratacion(this.sede, this.cedula)
      .pipe(take(1))
      .subscribe({
        next: ({ codigo_contrato }) => {
          this.codigoContratoActual = codigo_contrato;            // guarda
          this.codigoContratoChange.emit(codigo_contrato);        // emite
          this.procesoValido = true;

          Swal.fire({
            title: '¡Código de contrato generado!',
            text : `El nuevo código es ${codigo_contrato}`,
            icon : 'success',
            confirmButtonText: 'Ok'
          });
        },
        error: () => Swal.fire({
          title: 'Error',
          text : 'No se pudo generar el nuevo código de contrato',
          icon : 'error'
        })
      });
  }

  private procesarError(err: any): void {
    const mensaje = err?.error?.message ?? '';

    if (mensaje === 'No se encontró el proceso de selección para la cédula proporcionada') {
      // No hay proceso → generamos uno nuevo
      Swal.fire({
        title: 'Info',
        text: 'El usuario no tiene procesos. Se generará un nuevo código de contrato.',
        icon: 'info',
        confirmButtonText: 'Ok'
      }).then(result => {
        if (result.isConfirmed) {
          this.generarNuevoCodigoContrato();
        }
      });
    } else {
      // La cédula ni siquiera existe en la BD
      Swal.fire({
        title: 'Atención',
        text: 'No se encontró la cédula ingresada. Debe llenar el formulario antes de continuar.',
        icon: 'warning',
        confirmButtonText: 'Ok'
      });
    }
  }


  /**
   * Mostrar campo para observación adicional
   */
  mostrarCampoObservacion(): void {
    this.mostrarObservacion = true;
  }

  /**
   * Enviar observación del candidato
   */
  async enviarObservacion(): Promise<void> {
    if (!this.observacion.trim()) {
      Swal.fire('Error', 'Debe escribir una observación antes de enviar.', 'error');
      return;
    }

    let nombre = '';
    await this.utilityService.getUser().then((data: any) => {
      if (data) {
        nombre = `${data.primer_nombre} ${data.primer_apellido} - ${data.rol}`;
        this.sede = data.sucursalde;

        const abreviaciones: { [key: string]: string } = {
          'ADMINISTRATIVOS': 'ADM',
          'ANDES': 'AND',
          'BOSA': 'BOS',
          'CARTAGENITA': 'CAR',
          'FACA_PRIMERA': 'FPR',
          'FACA_PRINCIPAL': 'FPC',
          'FONTIBÓN': 'FON',
          'FORANEOS': 'FOR',
          'FUNZA': 'FUN',
          'MADRID': 'MAD',
          'MONTE_VERDE': 'MV',
          'ROSAL': 'ROS',
          'SOACHA': 'SOA',
          'SUBA': 'SUB',
          'TOCANCIPÁ': 'TOC',
          'USME': 'USM',
        };

        this.sede = abreviaciones[this.sede] || this.sede;
      }
    });

    const reporte = {
      cedula: this.cedula,
      observacion: this.observacion,
      centro_costo_carnet: "",
      reportadoPor: nombre
    };

    this.vetadosService.enviarReporte(reporte, this.sede).subscribe((response: any) => {
      if (response) {
        Swal.fire('Observación Enviada', `Su observación ha sido enviada: ${this.observacion}`, 'success');
        this.mostrarObservacion = false;
        this.observacion = '';
      } else {
        Swal.fire('Error', 'Ocurrió un error al enviar la observación', 'error');
      }
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
}
