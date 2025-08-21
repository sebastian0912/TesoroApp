import { Component, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { filter, forkJoin, Subject, take, takeUntil } from 'rxjs';
import Swal from 'sweetalert2';
import { VetadosService } from '../../service/vetados/vetados.service';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { EventEmitter, Output } from '@angular/core';
import { HiringService } from '../../service/hiring.service';
import { NavigationEnd, Router } from '@angular/router';
import { EstadoResponse, InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { ColumnDefinition, StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { SharedModule } from '@/app/shared/shared.module';

interface Usuario {
  primer_nombre: string;
  primer_apellido: string;
  rol: string;
  sucursalde: string;
}

interface CandidatoTabla {
  cedula: string;
  nombre_completo: string;
  created_at: string | Date;
}

@Component({
  selector: 'app-search-for-candidate',
  imports: [
    SharedModule,
    StandardFilterTable,
    MatTableModule
  ],
  templateUrl: './search-for-candidate.component.html',
  styleUrl: './search-for-candidate.component.css',
})
export class SearchForCandidateComponent implements OnInit, OnDestroy {
  // arriba del componente o como propiedad private readonly
  yesNoStatusConfig: Record<string, { color: string; background: string }> = {
    'Sí': { color: '#065f46', background: '#d1fae5' },   // verde
    'No': { color: '#991b1b', background: '#fee2e2' },   // rojo
  };

  columns: ColumnDefinition[] = [
    { name: 'cedula', header: 'Número de Cédula', type: 'text', width: '180px' },
    { name: 'nombre_completo', header: 'Nombre Completo', type: 'text' },
    { name: 'created_at', header: 'Fecha de Registro', type: 'date', width: '200px' },

    // Estados del pipeline (chips Sí/No)
    { name: 'pre_registro', header: 'Pre-registro', type: 'status', width: '140px', statusConfig: this.yesNoStatusConfig },
    { name: 'entrevistado', header: 'Entrevistado', type: 'status', width: '140px', statusConfig: this.yesNoStatusConfig },
    { name: 'prueba_tecnica', header: 'Prueba Técnica', type: 'status', width: '150px', statusConfig: this.yesNoStatusConfig },
    { name: 'examenes_medicos', header: 'Exámenes Médicos', type: 'status', width: '160px', statusConfig: this.yesNoStatusConfig },
    { name: 'contratado', header: 'Contratado', type: 'status', width: '130px', statusConfig: this.yesNoStatusConfig },

    { name: 'actions', header: 'Acción', type: 'custom', filterable: false, width: '130px' }
  ];

  registros: Array<{
    cedula: string;
    nombre_completo: string;
    created_at: Date | null;
    pre_registro: 'Sí' | 'No';
    entrevistado: 'Sí' | 'No';
    prueba_tecnica: 'Sí' | 'No';
    examenes_medicos: 'Sí' | 'No';
    contratado: 'Sí' | 'No';
  }> = [];
  /* ──────────  Outputs  ────────── */
  @Output() codigoContratoChange = new EventEmitter<string>();
  @Output() cedulaSeleccionada = new EventEmitter<string>();
  @Output() nombreCompletoChange = new EventEmitter<string>();
  @Output() idInfoEntrevistaAndreaChange = new EventEmitter<number>();

  /* ──────────  Propiedades  ────────── */
  cedula = '';
  observacion = '';
  mostrarObservacion = false;
  procesoValido = false;
  datosSeleccion: any = null;

  sede = '';
  abreviacionSede = '';
  codigoContratoActual = '';

  /* tablas */
  simpleDisplayedColumns = ['cedula', 'nombre_completo', 'created_at', 'acciones'];
  simpleDataSource = new MatTableDataSource<CandidatoTabla>([]);
  displayedColumns: string[] = [
    'cedula', 'nombre_completo', 'clasificacion',
    'descripcion', 'observacion', 'estado', 'sede'
  ];
  dataSource = new MatTableDataSource<any>([]);
  showTable = false;
  filtroCedula: string = '';

  /* diccionario de abreviaciones */
  private readonly abreviaciones: Record<string, string> = {
    ADMINISTRATIVOS: 'ADM', ANDES: 'AND', BOSA: 'BOS', CARTAGENITA: 'CAR',
    FACA_PRIMERA: 'FPR', FACA_PRINCIPAL: 'FPC', FONTIBÓN: 'FON', FORANEOS: 'FOR',
    FUNZA: 'FUN', MADRID: 'MAD', MONTE_VERDE: 'MV', ROSAL: 'ROS',
    SOACHA: 'SOA', SUBA: 'SUB', TOCANCIPÁ: 'TOC', USME: 'USM',
  };
  private destroyed$ = new Subject<void>();


  constructor(
    private vetadosService: VetadosService,
    private seleccionService: SeleccionService,
    private utilityService: UtilityServiceService,
    private hiringService: HiringService,
    private infoVacantesService: InfoVacantesService,
    private router: Router,
  ) { }
  private _procEnCurso = false;

  /* ──────────  Ciclo de vida  ────────── */
  /* ──────────  Ciclo de vida  ────────── */
  ngOnInit(): void {
    this.initUsuarioYAbreviacion();
    this.loadCandidatos();
    /*
        this.utilityService.nextStep
          .pipe(takeUntil(this.destroyed$))
          .subscribe(() => this.onNextStep());
    */
  }

  private async onNextStep(): Promise<void> {
    // Evita reentradas (ciclos) si llega otra emisión mientras procesas
    if (this._procEnCurso) {
      console.debug('[nextStep] ignorado: ya hay proceso en curso');
      return;
    }

    this._procEnCurso = true;
    try {
      if (!this.datosSeleccion) {
        console.warn('[nextStep] datosSeleccion aún no están listos');
        return;
      }

      // Si procesarSeleccion es síncrono, quita el await
      await this.procesarSeleccion(this.datosSeleccion);
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Error inesperado',
        text: 'Error al procesar la selección'
      });
    } finally {
      this._procEnCurso = false;
    }
  }



  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }


  private initUsuarioYAbreviacion(): void {
    const user = this.utilityService.getUser() as Usuario | null;
    if (!user) { return; }

    this.sede = user.sucursalde;
    this.abreviacionSede = this.abreviaciones[this.sede] || this.sede;
  }

  /* ──────────  Escucha de ruta y carga tabla  ────────── */


  /* ──────────  Tabla candidatos  ────────── */
  private loadCandidatos(): void {
    this.seleccionService.getCandidatos().pipe(take(1)).subscribe({
      next: (candidatos: any[] = []) => {
        const sedeLower = (this.sede ?? '').toLowerCase().trim();

        const toDate = (v: any): Date | null => {
          if (!v) return null;
          if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
          const d = new Date(v);
          return isNaN(d.getTime()) ? null : d;
        };

        const boolText = (v: any): 'Sí' | 'No' => (!!v ? 'Sí' : 'No');
        console.log('Candidatos cargados:', candidatos);
        this.registros = candidatos
          .filter(c => ((c.oficina ?? '') as string).toLowerCase().trim() === sedeLower)
          .map(c => ({
            cedula: c.numero ?? '',
            created_at: toDate(c.created_at),
            nombre_completo: [c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido]
              .filter(Boolean)
              .join(' ')
              .trim(),

            // Mapea booleanos del backend a 'Sí'/'No'
            pre_registro: boolText(c.pre_registro),
            entrevistado: boolText(c.entrevistado),
            prueba_tecnica: boolText(c.prueba_tecnica),
            examenes_medicos: boolText(c.examenes_medicos),
            contratado: boolText(c.contratado),
          }));
      },
      error: () => Swal.fire('Error', 'No se pudieron cargar los candidatos.', 'error')
    });
  }

  aplicarFiltroCedula(valor: string): void {
    this.simpleDataSource.filterPredicate = (d, f) =>
      d.cedula?.toString().trim() === f.trim();
    this.simpleDataSource.filter = valor.trim();
  }

  /* ──────────  Acciones sobre cédula  ────────── */
  async seleccionarCedula(cedula: string, nombre: string): Promise<void> {
    try {
      this.cedula = (cedula ?? '').trim();
      this.nombreCompletoChange.emit(nombre);

      // Espera a que se cargue todo (forkJoin dentro de buscarCedula)
      await this.buscarCedula();

      console.log('[seleccionarCedula] datosSeleccion listo:', this.datosSeleccion);

      // 1) Procesar aquí mismo (seguro: ya tienes datosSeleccion)
      if (this.datosSeleccion) {
        this.procesarSeleccion(this.datosSeleccion);
      } else {
        console.warn('No hay datosSeleccion después de buscarCedula');
      }

    } catch (e) {
      console.error('Error en seleccionarCedula:', e);
    }
  }


  async buscarCedula(): Promise<void> {
    if (!this.cedula) return;

    this.cedulaSeleccionada.emit(this.cedula);
    console.log('[buscarCedula] Cédula seleccionada emitida:', this.cedula);

    return new Promise<void>((resolve, reject) => {
      forkJoin({
        candidato: this.infoVacantesService.getVacantesPorNumero(this.cedula),
        seleccion: this.hiringService.traerDatosSeleccion(this.cedula),
        vetado: this.vetadosService.listarReportesVetadosPorCedula(this.cedula)
      })
        .pipe(take(1))
        .subscribe({
          next: ({ vetado, seleccion, candidato }) => {
            try {
              // Vetado
              this.procesarVetado(vetado);

              // Guarda selección (NO proceses aquí; deja que lo haga quien reciba el evento)
              this.datosSeleccion = seleccion ?? null;
              console.log('[buscarCedula] datosSeleccion:', this.datosSeleccion);
              this.procesarSeleccion(this.datosSeleccion);
              // Nombre, id y estado pre_registro (si hay candidato)
              if (Array.isArray(candidato) && candidato.length > 0) {
                const c0 = candidato[0];
                const nombreCompleto = [c0.primer_nombre, c0.segundo_nombre, c0.primer_apellido, c0.segundo_apellido]
                  .filter(Boolean)
                  .join(' ');
                this.nombreCompletoChange.emit(nombreCompleto);
                this.idInfoEntrevistaAndreaChange.emit(c0.id);

                this.infoVacantesService
                  .setEstadoVacanteAplicante(c0.id, 'pre_registro', true)
                  .pipe(take(1))
                  .subscribe({
                    next: (resp: EstadoResponse) =>
                      console.log('✅ pre_registro actualizado:', resp),
                    error: (err) =>
                      console.error('❌ Error actualizando pre_registro', err)
                  });
              }

              resolve();
            } catch (inner) {
              this.procesarError(inner);
              reject(inner);
            }
          },
          error: (e) => {
            this.procesarError(e);
            reject(e);
          }
        });
    });
  }




  /* vetados */
  private procesarVetado(vetado: any[] | null): void {
    if (!vetado?.length) return;
    this.procesoValido = true;
    this.dataSource.data = vetado
      .filter(v => v.categoria)
      .map(v => ({
        cedula: v.cedula,
        nombre_completo: v.nombre_completo,
        clasificacion: v.categoria.clasificacion ?? '',
        descripcion: v.categoria.descripcion ?? '',
        observacion: v.observacion,
        estado: v.estado,
        sede: v.sede,
        autorizado_por: v.autorizado_por
      }));
  }

  /* selección */
  private procesarSeleccion(sel: any): void {
    console.log('Procesando selección:', sel);
    const procs = sel?.procesoSeleccion ?? [];
    if (!procs.length) return;

    const ultimo = procs.reduce((a: { id: number }, b: { id: number }) => b.id > a.id ? b : a);
    const codigoExistente = ultimo.codigo_contrato;

    Swal.fire({
      title: '¡Atención!',
      html: 'Este usuario ya tiene un proceso.<br>¿Deseas crear otro o continuar con este?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Crear otro',
      cancelButtonText: 'Continuar con este'
    }).then(r => {
      if (r.isConfirmed) {
        this.generarNuevoCodigoContrato();
      } else {
        this.codigoContratoActual = codigoExistente; // ✅ ya lo tomas del backend
        console.log('Código de contrato actual:', this.codigoContratoActual);
        this.codigoContratoChange.emit(this.codigoContratoActual);
        this.procesoValido = true;
      }
    });
  }


  private generarNuevoCodigoContrato(): void {
    this.seleccionService.generarCodigoContratacion(this.abreviacionSede, this.cedula)
      .pipe(take(1))
      .subscribe({
        next: r => {
          this.codigoContratoActual = r.nuevo_codigo;
          this.codigoContratoChange.emit(r.nuevo_codigo);
          this.procesoValido = true;
        },
        error: () => Swal.fire('Error', 'No se pudo generar el código', 'error')
      });
  }

  /* errores */
  private procesarError(err: any): void {
    const m = err?.error?.message ?? '';
    if (m.includes('No se encontró el proceso de selección')) {
      Swal.fire('Info', 'El usuario no tiene procesos', 'info')
        .then(() => this.generarNuevoCodigoContrato());
    } else {
      Swal.fire('Atención', 'No se encontró la cédula ingresada', 'warning');
    }
  }

  /* ──────────  Observación  ────────── */
  mostrarCampoObservacion(): void { this.mostrarObservacion = true; }

  enviarObservacion(): void {
    if (!this.observacion.trim()) {
      Swal.fire('Error', 'Debe escribir una observación.', 'error'); return;
    }

    const u = this.utilityService.getUser() as Usuario | null;
    if (!u) { Swal.fire('Error', 'No hay usuario en sesión', 'error'); return; }

    const nombre = `${u.primer_nombre} ${u.primer_apellido} - ${u.rol}`;
    const sedeAbrev = this.abreviaciones[u.sucursalde] || u.sucursalde;

    const reporte = {
      cedula: this.cedula,
      observacion: this.observacion,
      centro_costo_carnet: '',
      reportadoPor: nombre
    };

    this.vetadosService.enviarReporte(reporte, sedeAbrev).pipe(take(1)).subscribe({
      next: () => {
        Swal.fire('Éxito', 'Observación enviada.', 'success');
        this.mostrarObservacion = false;
        this.observacion = '';
      },
      error: () => Swal.fire('Error', 'No se pudo enviar la observación.', 'error')
    });
  }

  /* filtro en tabla vetados */
  applyFilter(ev: Event): void {
    const val = (ev.target as HTMLInputElement).value;
    this.dataSource.filter = val.trim().toLowerCase();
  }



}
