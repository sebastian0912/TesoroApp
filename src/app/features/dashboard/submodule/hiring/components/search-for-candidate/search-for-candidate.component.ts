import { Component, OnDestroy, OnInit } from '@angular/core';
import { firstValueFrom, map, Subject, take } from 'rxjs';
import Swal from 'sweetalert2';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';

import { VetadosService } from '../../service/vetados/vetados.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

import { EventEmitter, Output } from '@angular/core';
import { ColumnDefinition, StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { SharedModule } from '@/app/shared/shared.module';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';

/* ========== Fila que muestra StandardFilterTable ========== */
type RegistroUI = {
  turno: number | null;
  cedula: string;
  nombre_completo: string;
  created_at: string | Date;
  raw: any; // objeto completo para el botón OK
};

@Component({
  selector: 'app-search-for-candidate',
  imports: [
    SharedModule,
    StandardFilterTable,
    MatTableModule,
    MatButtonModule
  ],
  templateUrl: './search-for-candidate.component.html',
  styleUrl: './search-for-candidate.component.css',
})
export class SearchForCandidateComponent implements OnInit, OnDestroy {
  readonly yesNoStatusConfig: Record<string, { color: string; background: string }> = {
    'Sí': { color: '#065f46', background: '#d1fae5' },
    'No': { color: '#991b1b', background: '#fee2e2' },
  };

  // Columnas del StandardFilterTable (agrego 'turno')
  columns: ColumnDefinition[] = [
    { name: 'actions', header: 'Acción', type: 'custom', filterable: false, width: '80px', stickyStart: true },
    { name: 'turno', header: 'Turno', type: 'text', width: '90px' },
    { name: 'cedula', header: 'Número de Cédula', type: 'text', width: '180px' },
    { name: 'nombre_completo', header: 'Nombre Completo', type: 'text' },
    { name: 'created_at', header: 'Fecha de Registro', type: 'date', width: '200px' },
  ];

  // AHORA sí: esto es lo que lee tu <app-standard-filter-table [data]="registros">
  registros: RegistroUI[] = [];

  /* ──────────  Outputs  ────────── */
  @Output() codigoContratoChange = new EventEmitter<string>();
  @Output() cedulaSeleccionada = new EventEmitter<string>();
  @Output() nombreCompletoChange = new EventEmitter<string>();
  @Output() idInfoEntrevistaAndreaChange = new EventEmitter<number>();
  // objetos completos
  @Output() candidatoSeleccionado = new EventEmitter<any>();

  /* ──────────  Propiedades  ────────── */
  cedula = '';
  observacion = '';
  mostrarObservacion = false;
  procesoValido = false;
  datosSeleccion: any = null;
  sede = '';

  /* Material table secundaria (no usada por tu HTML actual, la dejo por si la necesitas) */
  simpleDisplayedColumns = ['turno', 'cedula', 'nombre_completo', 'created_at', 'ok'];

  /* Tabla vetados (se mantiene) */
  displayedColumns: string[] = [
    'cedula', 'nombre_completo', 'clasificacion',
    'descripcion', 'observacion', 'estado', 'sede'
  ];
  dataSource = new MatTableDataSource<any>([]);
  showTable = false;
  filtroCedula: string = '';

  private destroyed$ = new Subject<void>();

  constructor(
    private vetadosService: VetadosService,
    private utilityService: UtilityServiceService,
    private registroProcesoContratacion: RegistroProcesoContratacion
  ) { }

  /* ──────────  Ciclo de vida  ────────── */
  async ngOnInit(): Promise<void> {
    await this.initUsuarioYAbreviacion();
    this.loadCandidatos();
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private async initUsuarioYAbreviacion(): Promise<void> {
    try {
      const user: any = await this.utilityService.getUser();
      this.sede = user?.sede?.nombre ?? '';
    } catch {
      this.sede = '';
    }
  }

  /* ──────────  Cargar candidatos en 'registros'  ────────── */
  private loadCandidatos(): void {
    const normalize = (s: string) =>
      (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

    const sedeFilter = (c: any): boolean => {
      if (!this.sede) return true;
      const entrevistas: any[] = Array.isArray(c.entrevistas) ? c.entrevistas : [];
      const ordered = entrevistas.slice().sort(
        (a, b) => new Date(b?.created_at ?? 0).getTime() - new Date(a?.created_at ?? 0).getTime()
      );
      const oficina = ordered.find(e => !!e?.oficina)?.oficina ?? '';
      return normalize(oficina) === normalize(this.sede);
    };

    const getTurno = (c: any): number | null => {
      const entrevistas: any[] = Array.isArray(c.entrevistas) ? c.entrevistas : [];
      const entrevistasOrdenadas = entrevistas.slice().sort(
        (a, b) => new Date(b?.created_at ?? 0).getTime() - new Date(a?.created_at ?? 0).getTime()
      );
      const abierta = entrevistasOrdenadas.find(e =>
        e?.proceso && e.proceso.rechazado === false && e.proceso.contratado === false && e.proceso.turno != null
      );
      if (abierta?.proceso?.turno != null) return abierta.proceso.turno;
      const cualquiera = entrevistasOrdenadas.find(e => e?.proceso?.turno != null);
      return cualquiera?.proceso?.turno ?? null;
    };

    const fullName = (c: any): string =>
      [c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    this.registroProcesoContratacion
      .listCandidatosFull({ ordering: '-created_at' })
      .pipe(take(1))
      .subscribe({
        next: (candidatos: any[] = []) => {
          const rows: RegistroUI[] = candidatos
            .filter(sedeFilter)
            .map((c) => ({
              turno: getTurno(c),
              cedula: String(c.numero_documento ?? '').trim(),
              nombre_completo: fullName(c),
              created_at: c.created_at ?? '',
              raw: c,
            }))
            .sort(
              (a, b) =>
                new Date(b.created_at ?? 0).getTime() -
                new Date(a.created_at ?? 0).getTime()
            );

          // AQUÍ llenamos lo que usa tu StandardFilterTable
          this.registros = rows;

        },
        error: () => Swal.fire('Error', 'No se pudieron cargar los candidatos.', 'error'),
      });
  }

  /* Botón OK (solo console.log del objeto completo) */
  onOk(row: RegistroUI): void {
    this.candidatoSeleccionado.emit(row.raw);
  }

  buscarCandidato(): void {
    this.cedula = this.cedula.trim();

    this.registroProcesoContratacion.getCandidatoPorDocumento(this.cedula, true).pipe(take(1)).subscribe({
      next: (candidato) => {
        if (!candidato) {
          this.candidatoSeleccionado.emit(null);
          Swal.fire('No encontrado', 'No se encontró un candidato con esa cédula.', 'info');
          return;
        }
        this.candidatoSeleccionado.emit(candidato);
      },
      error: () => Swal.fire('Error', 'Error al buscar el candidato.', 'error')
    });
  }

  async buscarCedula(): Promise<void> {
    if (!this.cedula) return;

    this.cedulaSeleccionada.emit(this.cedula);

    try {
      const vetado = await firstValueFrom(
        this.vetadosService.listarReportesVetadosPorCedula(this.cedula).pipe(take(1))
      );
      this.procesarVetado(vetado);
    } catch {
      Swal.fire('Error', 'Error inesperado al consultar la cédula.', 'error');
    }
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
        clasificacion: v.categoria?.clasificacion ?? '',
        descripcion: v.categoria?.descripcion ?? '',
        observacion: v.observacion,
        estado: v.estado,
        sede: v.sede,
        autorizado_por: v.autorizado_por
      }));
  }

  /* ──────────  Observación  ────────── */
  mostrarCampoObservacion(): void {
    console.log('mostrarCampoObservacion()');
    this.mostrarObservacion = true;
  }

  enviarObservacion(): void {
    if (!this.observacion.trim()) {
      Swal.fire('Error', 'Debe escribir una observación.', 'error');
      return;
    }

    this.utilityService.getUser().then((u: any) => {
      if (!u) {
        Swal.fire('Error', 'No hay usuario en sesión', 'error');
        return;
      }

      const nombre = `${u?.datos_basicos?.nombres ?? ''} ${u?.datos_basicos?.apellidos ?? ''} - ${u?.rol?.nombre ?? ''}`.trim();
      const sedeNombre = u?.sede?.nombre ?? '';

      const reporte = {
        cedula: this.cedula,
        observacion: this.observacion.trim(),
        centro_costo_carnet: '',
        reportadoPor: nombre
      };

      this.vetadosService.enviarReporte(reporte, sedeNombre).pipe(take(1)).subscribe({
        next: () => {
          Swal.fire('Éxito', 'Observación enviada.', 'success');
          this.mostrarObservacion = false;
          this.observacion = '';
        },
        error: () => Swal.fire('Error', 'No se pudo enviar la observación.', 'error')
      });
    });
  }
}
