import { Component, LOCALE_ID, OnDestroy, OnInit } from '@angular/core';
import { filter, forkJoin, map, Subject, take, takeUntil, tap } from 'rxjs';
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

type BackendCandidato = {
  id: number;
  numero: string;
  oficina?: string | null;
  primer_nombre?: string | null;
  segundo_nombre?: string | null;
  primer_apellido?: string | null;
  segundo_apellido?: string | null;
  created_at?: string | Date | null;
  pre_registro?: boolean | null;
  entrevistado?: boolean | null;
  prueba_tecnica?: boolean | null;
  examenes_medicos?: boolean | null;
  contratado?: boolean | null;
};

type RegistroRow = {
  id: number;
  cedula: string;
  created_at: Date | null;
  created_at_label: string;
  nombre_completo: string;
  pre_registro: 'Sí' | 'No';
  entrevistado: 'Sí' | 'No';
  prueba_tecnica: 'Sí' | 'No';
  examenes_medicos: 'Sí' | 'No';
  contratado: 'Sí' | 'No';
};
type RowLike = RegistroRow | CandidatoTabla;

// Puedes dejar este tipo dentro o fuera de la clase
type ProcesoSeleccion = { id: number; codigo_contrato?: string | number | null };

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

  /* ──────────  Ciclo de vida  ────────── */
  ngOnInit(): void {
    this.initUsuarioYAbreviacion();
    this.loadCandidatos();
  }


  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  private initUsuarioYAbreviacion(): void {
    const user = this.utilityService.getUser() as Usuario | null;
    if (!user) { return; }

    this.sede = user.sucursalde;
  }

  /* ──────────  Escucha de ruta y carga tabla  ────────── */


  /* ──────────  Tabla candidatos  ────────── */
  private loadCandidatos(): void {
    const yesNo = (v: any): 'Sí' | 'No' => (v ? 'Sí' : 'No');
    const toDate = (v: any): Date | null => {
      if (!v) return null;
      if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
      const d = new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };
    const normalize = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

    const sedeFilter = (c: BackendCandidato): boolean => {
      if (!this.sede) return true; // si no hay sede, no filtramos
      const sOf = normalize(String(c.oficina ?? ''));
      const sWanted = normalize(String(this.sede ?? ''));
      return sOf === sWanted;
    };

    const fullName = (c: BackendCandidato) =>
      [c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

    const formatCo = (d: Date | null): string =>
      d
        ? d.toLocaleString('es-CO', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'America/Bogota',
        })
        : '—';

    this.seleccionService
      .getCandidatos()
      .pipe(
        take(1),
        map((candidatos: BackendCandidato[] = []) =>
          candidatos
            .filter(sedeFilter)
            .map<RegistroRow>((c) => {
              // imprimir candidatos
              const dt = toDate(c.created_at);
              return {
                id: c.id,
                cedula: String(c.numero ?? ''),
                created_at: dt,
                created_at_label: formatCo(dt),
                nombre_completo: fullName(c),
                pre_registro: yesNo(c.pre_registro),
                entrevistado: yesNo(c.entrevistado),
                prueba_tecnica: yesNo(c.prueba_tecnica),
                examenes_medicos: yesNo(c.examenes_medicos),
                contratado: yesNo(c.contratado),
              };
            })
            // Ordena por fecha (más reciente primero). Cambia a (a-b) para más antiguos primero.
            .sort((a, b) => {
              const ta = a.created_at?.getTime() ?? 0;
              const tb = b.created_at?.getTime() ?? 0;
              return tb - ta;
            })
        ),
        tap((rows) => console.log('Registros procesados para la tabla:', rows))

      )
      .subscribe({
        next: (rows) => (this.registros = rows),
        error: () => Swal.fire('Error', 'No se pudieron cargar los candidatos.', 'error'),
      });
  }

  aplicarFiltroCedula(valor: string): void {
    this.simpleDataSource.filterPredicate = (d, f) =>
      d.cedula?.toString().trim() === f.trim();
    this.simpleDataSource.filter = valor.trim();
  }

  /* ──────────  Acciones sobre cédula  ────────── */
  async seleccionarCedula(row: RowLike): Promise<void> {
    try {
      const cedula = String(row?.cedula ?? '').trim();
      const nombre = String(row?.nombre_completo ?? '').trim();

      if (!cedula) {
        Swal.fire({ icon: 'warning', title: 'Sin cédula', text: 'La fila no contiene cédula.' });
        return;
      }

      // Set locals
      this.cedula = cedula;

      // Emitimos el nombre que ya viene en la fila
      if (nombre) this.nombreCompletoChange.emit(nombre);

      // Si la fila trae id (caso RegistroRow), lo emitimos y marcamos pre_registro=true
      if ('id' in row && typeof row.id === 'number' && Number.isFinite(row.id)) {
        this.idInfoEntrevistaAndreaChange.emit(row.id);

        this.infoVacantesService
          .setEstadoVacanteAplicante(row.id, 'pre_registro', true)
          .pipe(take(1))
          .subscribe({
            next: () => this.loadCandidatos(),
            error: () =>
              Swal.fire('Error', 'No se pudo actualizar el estado de pre_registro', 'error')
          });
      }

      // Continúa con el flujo estándar (consulta vetados, etc.)
      await this.buscarCedula(); // <- si aquí también emites nombre, puedes quitar esa emisión para evitar duplicado.
    } catch {
      Swal.fire({
        icon: 'error',
        title: 'Error inesperado',
        text: 'Error al seleccionar la cédula'
      });
    }
  }

  buscarEntrevistaAndrea(): void {
    this.infoVacantesService.getVacantesPorNumero(this.cedula).subscribe({
      next: (resultado) => {
        const entrevista = resultado?.[0];
        this.cedula = entrevista.numero;
        this.cedulaSeleccionada.emit(this.cedula);
        this.nombreCompletoChange.emit(entrevista.primer_nombre + ' ' + (entrevista.segundo_nombre ?? '') + ' ' + entrevista.primer_apellido + ' ' + (entrevista.segundo_apellido ?? ''));
        this.idInfoEntrevistaAndreaChange.emit(entrevista.id);
        this.buscarCedula();
      },
      error: () => {
        Swal.fire('Error', 'No se pudo obtener la entrevista', 'error');
      }
    });
  }


  async buscarCedula(): Promise<void> {
    if (!this.cedula) return;

    this.cedulaSeleccionada.emit(this.cedula);

    return new Promise<void>((resolve, reject) => {
      forkJoin({
        vetado: this.vetadosService.listarReportesVetadosPorCedula(this.cedula)
      })
        .pipe(take(1))
        .subscribe({
          next: ({ vetado }) => {
            try {
              // Vetado
              this.procesarVetado(vetado);

              resolve();
            } catch (inner) {
              Swal.fire('Error', 'Error inesperado', 'error');
              reject(inner);
            }
          },
          error: (e) => {
            Swal.fire('Error', 'Error inesperado', 'error');
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


  /**
   * Devuelve el primer codigo_contrato NO vacío al recorrer por id DESC.
   * Si ninguno tiene código, retorna null y también el maxId del arreglo.
   */
  private getUltimoCodigoValido(procs: ProcesoSeleccion[]): { codigo: string | null; maxId: number } {
    const ordenados = [...procs].sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
    const maxId = ordenados.length ? (ordenados[0].id ?? 0) : 0;

    for (const p of ordenados) {
      const cod = (p.codigo_contrato ?? '').toString().trim();
      if (cod !== '') return { codigo: cod, maxId };
    }
    return { codigo: null, maxId };
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
