import { Component, OnDestroy, OnInit } from '@angular/core';
import { firstValueFrom, map, Subject, take } from 'rxjs';
import Swal from 'sweetalert2';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';

import { VetadosService } from '../../service/vetados/vetados.service';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';

import { EventEmitter, Output } from '@angular/core';
import { ColumnDefinition, StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { SharedModule } from '@/app/shared/shared.module';

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
  // Config de chips Sí/No
  readonly yesNoStatusConfig: Record<string, { color: string; background: string }> = {
    'Sí': { color: '#065f46', background: '#d1fae5' },   // verde
    'No': { color: '#991b1b', background: '#fee2e2' },   // rojo
  };

  // Columnas para StandardFilterTable
  columns: ColumnDefinition[] = [
    { name: 'cedula', header: 'Número de Cédula', type: 'text', width: '180px' },
    { name: 'nombre_completo', header: 'Nombre Completo', type: 'text' },
    { name: 'created_at', header: 'Fecha de Registro', type: 'date', width: '200px' },

    { name: 'pre_registro', header: 'Pre-registro', type: 'status', width: '140px', statusConfig: this.yesNoStatusConfig },
    { name: 'entrevistado', header: 'Entrevistado', type: 'status', width: '140px', statusConfig: this.yesNoStatusConfig },
    { name: 'prueba_tecnica', header: 'Prueba Técnica', type: 'status', width: '150px', statusConfig: this.yesNoStatusConfig },
    { name: 'examenes_medicos', header: 'Exámenes Médicos', type: 'status', width: '160px', statusConfig: this.yesNoStatusConfig },
    { name: 'contratado', header: 'Contratado', type: 'status', width: '130px', statusConfig: this.yesNoStatusConfig },

    { name: 'actions', header: 'Acción', type: 'custom', filterable: false, width: '130px' }
  ];

  registros: RegistroRow[] = [];

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

  /* Tablas */
  simpleDisplayedColumns = ['cedula', 'nombre_completo', 'created_at', 'acciones'];
  simpleDataSource = new MatTableDataSource<CandidatoTabla>([]);
  displayedColumns: string[] = [
    'cedula', 'nombre_completo', 'clasificacion',
    'descripcion', 'observacion', 'estado', 'sede'
  ];
  dataSource = new MatTableDataSource<any>([]);
  showTable = false;
  filtroCedula: string = '';

  /* Diccionario abreviaciones */
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
    private infoVacantesService: InfoVacantesService,
  ) {}

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
      (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();

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
              const dt = toDate(c.created_at);
              return {
                id: c.id,
                cedula: String(c.numero ?? '').trim(),
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
            .sort((a, b) => {
              const ta = a.created_at?.getTime() ?? 0;
              const tb = b.created_at?.getTime() ?? 0;
              return tb - ta; // más recientes primero
            })
        )
      )
      .subscribe({
        next: (rows) => {
          this.registros = rows;

          // poblar simpleDataSource para filtros por cédula en tablas simples
          this.simpleDataSource.data = rows.map<CandidatoTabla>((r) => ({
            cedula: r.cedula,
            nombre_completo: r.nombre_completo,
            created_at: r.created_at ?? '',
          }));
        },
        error: () => Swal.fire('Error', 'No se pudieron cargar los candidatos.', 'error'),
      });
  }

  aplicarFiltroCedula(valor: string): void {
    const term = (valor ?? '').trim();
    this.simpleDataSource.filterPredicate = (d, f) => d.cedula?.toString().trim() === f.trim();
    this.simpleDataSource.filter = term;
  }

  /* ──────────  Acciones sobre cédula  ────────── */
  async seleccionarCedula(row: RowLike): Promise<void> {
    try {
      const cedula = String((row as any)?.cedula ?? '').trim();
      const nombre = String((row as any)?.nombre_completo ?? '').trim();

      if (!cedula) {
        Swal.fire({ icon: 'warning', title: 'Sin cédula', text: 'La fila no contiene cédula.' });
        return;
      }

      this.cedula = cedula;

      if (nombre) this.nombreCompletoChange.emit(nombre);

      // Si la fila trae id (caso RegistroRow), lo emitimos y marcamos pre_registro=true
      if ('id' in row && typeof (row as any).id === 'number' && Number.isFinite((row as any).id)) {
        const idRow = (row as any).id as number;

        this.idInfoEntrevistaAndreaChange.emit(idRow);

        this.infoVacantesService
          .setEstadoVacanteAplicante(idRow, 'pre_registro', true)
          .pipe(take(1))
          .subscribe({
            next: () => this.loadCandidatos(),
            error: () => Swal.fire('Error', 'No se pudo actualizar el estado de pre_registro', 'error'),
          });
      }

      // Busca vetados y otros datos asociados a la cédula
      await this.buscarCedula();
    } catch {
      Swal.fire({ icon: 'error', title: 'Error inesperado', text: 'Error al seleccionar la cédula' });
    }
  }

  buscarEntrevistaAndrea(): void {
    this.cedula = this.cedula.trim();
    if (!this.cedula) {
      Swal.fire('Atención', 'Ingresa una cédula para buscar.', 'info');
      return;
    }

    this.infoVacantesService.getVacantesPorNumero(this.cedula).pipe(take(1)).subscribe({
      next: async (resultado) => {
        const entrevista = resultado?.[0];
        if (!entrevista) {
          Swal.fire('Error', 'No se encontró la información, por favor llena de nuevo el preformulario.', 'error');
          return;
        }
        this.cedula = entrevista.numero;

        const nombre = [
          entrevista.primer_nombre,
          entrevista.segundo_nombre ?? '',
          entrevista.primer_apellido,
          entrevista.segundo_apellido ?? ''
        ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

        this.nombreCompletoChange.emit(nombre);
        this.idInfoEntrevistaAndreaChange.emit(entrevista.id);

        await this.buscarCedula();
      },
      error: () => Swal.fire('Error', 'No se pudo obtener la entrevista', 'error')
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
      const sedeAbrev = (sedeNombre && this.abreviaciones[sedeNombre]) ? this.abreviaciones[sedeNombre] : sedeNombre;

      const reporte = {
        cedula: this.cedula,
        observacion: this.observacion.trim(),
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
    });
  }

  /* filtro en tabla vetados */
  applyFilter(ev: Event): void {
    const val = (ev.target as HTMLInputElement).value ?? '';
    this.dataSource.filterPredicate = (data: any, filter: string) =>
      Object.values(data).some(v => String(v ?? '').toLowerCase().includes(filter));
    this.dataSource.filter = val.trim().toLowerCase();
  }
}
