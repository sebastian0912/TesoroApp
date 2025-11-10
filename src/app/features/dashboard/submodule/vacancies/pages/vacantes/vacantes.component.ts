import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { SharedModule } from '@/app/shared/shared.module';
import { CrearEditarVacanteComponent } from '../../components/crear-editar-vacante/crear-editar-vacante.component';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

interface ConteoEstados {
  pre_registro: number;
  entrevistado: number;
  prueba_tecnica: number;
  autorizado: number;
  examenes_medicos: number;
  contratado: number;
  ingreso: number;
  total_con_su_ultimo_registro: number;
}

@Component({
  selector: 'app-vacantes',
  imports: [
    SharedModule,
    MatTableModule,
    FormsModule,
    NgIf,
    MatMenuModule,
    MatPaginatorModule,
    MatSortModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatIconModule,
    MatCardModule,
    MatSlideToggleModule,
  ],
  templateUrl: './vacantes.component.html',
  styleUrl: './vacantes.component.css'
})
export class VacantesComponent implements OnInit {
  filterFincaFaltantes = '';
  filterFincaCompletados = '';
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'acciones',
    'cumpl',
    'fechaPublicado',
    'req',
    'falt',
    'entrev',
    'prueba',
    'auto',
    'exm',
    'firm',
    'ing',
    'finca',
    'cargo',
    'municipio',
    'experiencia',
    'observacionVacante',
    'descripcion',
    'salario',
    'auxilioTransporte',
    'tipoContratacion',
    // Si deseas mostrar el switch o botón para activo, en HTML úsalo dentro de 'acciones'
  ];

  // Agregamos 'faltantes' y 'completados'
  viewMode: 'table' | 'card' | 'faltantes' | 'completados' = 'table';
  loading = false;
  permitido = false;
  sede = '';

  /** NUEVO: para bloquear acciones por fila mientras persiste el cambio de 'activo' */
  busyActivoIds = new Set<number | string>();

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private dialog: MatDialog,
    private vacantesService: VacantesService,
    private utilityService: UtilityServiceService,
  ) { }

  async ngOnInit(): Promise<void> {
    const saved = (typeof window !== 'undefined')
      ? (localStorage.getItem('vacantes:viewMode') as 'table' | 'card' | 'faltantes' | 'completados' | null)
      : null;
    if (saved) this.viewMode = saved;

    // 👇 Obtengo la sede ANTES de cargar
    const user = this.utilityService.getUser();
    this.sede = user?.sede?.nombre || '';
    this.permitido = this.isManager(user);

    this.loadData();

    this.dataSource.filterPredicate = (data: any, filter: string) =>
      JSON.stringify(data).toLowerCase().includes(filter);
  }

  onToggleView(mode: 'table' | 'card' | 'faltantes' | 'completados'): void {
    this.viewMode = mode;
    try { localStorage.setItem('vacantes:viewMode', mode); } catch { }
    setTimeout(() => {
      const active = this.getActiveDataSource();
      active.paginator = this.paginator;
      active.sort = this.sort;
    });
  }

  dataSourceFaltantes = new MatTableDataSource<any>([]);
  dataSourceCompletados = new MatTableDataSource<any>([]);

  private getActiveDataSource(): MatTableDataSource<any> {
    if (this.viewMode === 'faltantes') return this.dataSourceFaltantes;
    if (this.viewMode === 'completados') return this.dataSourceCompletados;
    return this.dataSource;
  }

  private rebuildDerivedTables(): void {
    const rows = this.dataSource.data ?? [];

    const falt = rows.filter(r => this.faltantes(r) > 0);
    const comp = rows.filter(r => this.totalRequerida(r) > 0 && this.faltantes(r) === 0);

    this.dataSourceFaltantes.data = falt;
    this.dataSourceCompletados.data = comp;

    // compartir misma lógica de filtro
    this.dataSourceFaltantes.filterPredicate = this.dataSource.filterPredicate;
    this.dataSourceCompletados.filterPredicate = this.dataSource.filterPredicate;

    // re-atachear paginator/sort al dataSource visible
    setTimeout(() => {
      const active = this.getActiveDataSource();
      active.paginator = this.paginator;
      active.sort = this.sort;
    });
  }

  private matchesSede(vac: any, sede: string): boolean {
    const wanted = this.norm(sede);
    if (!wanted) return true; // si no hay sede definida, no filtro

    const arr = Array.isArray(vac?.oficinasQueContratan) ? vac.oficinasQueContratan : [];
    return arr.some((o: any) => {
      const name = typeof o === 'string' ? o : o?.nombre;
      return this.norm(name) === wanted;
    });
  }

  // ================== Carga de datos ==================
  loadData(): void {
    this.loading = true;
    this.vacantesService.listarVacantes().subscribe({
      next: (response: any[]) => {
        const rows = (response ?? []).map(r => this.mapRow(r));

        // 👇 Si hay sede, me quedo solo con vacantes que la tengan en oficinasQueContratan
        const sede = this.sede;
        const filteredRows = sede ? rows.filter(r => this.matchesSede(r, sede)) : rows;

        this.dataSource.data = filteredRows;

        this.rebuildDerivedTables();
      },
      error: () => { /* ... */ },
      complete: () => this.loading = false
    });
  }

  private mapRow(r: any) {
    const defaultConteo: ConteoEstados = {
      pre_registro: 0,
      entrevistado: 0,
      prueba_tecnica: 0,
      autorizado: 0,
      examenes_medicos: 0,
      contratado: 0,
      ingreso: 0,
      total_con_su_ultimo_registro: 0,
    };

    // Normaliza municipios (acepta 'municipio' o 'municipios' del backend)
    const municipioArr = Array.isArray(r?.municipio)
      ? r.municipio
      : (Array.isArray(r?.municipios) ? r.municipios : []);

    return {
      ...r,
      /** NUEVO: asegurar que venga el estado activo (default true si no llega) */
      activo: typeof r?.activo === 'boolean' ? r.activo : true,
      /** NUEVO: mapear motivo si viene del backend */
      motivoInactivacion: r?.motivoInactivacion ?? '',

      salario: this.parseCurrency(r?.salario),
      municipio: municipioArr,
      observacionVacante: r?.observacionVacante ?? '',
      preseleccionados: Array.isArray(r?.preseleccionados) ? r.preseleccionados : [],
      contratados: Array.isArray(r?.contratados) ? r.contratados : [],
      personasSolicitadas: Number(r?.personasSolicitadas) || 0,
      municipiosDistribucion: Array.isArray(r?.municipiosDistribucion) ? r.municipiosDistribucion : [],
      fechaPublicado: r?.fechaPublicado ?? null, // 'yyyy-MM-dd'
      fechadeIngreso: r?.fechadeIngreso ?? null,
      cargo: r?.cargo ?? null,
      finca: r?.finca ?? '',
      experiencia: r?.experiencia ?? '',
      auxilioTransporte: r?.auxilioTransporte ?? 'No',
      tipoContratacion: r?.tipoContratacion ?? '',
      conteo_estados: (r?.conteo_estados as ConteoEstados) || defaultConteo,
    };
  }

  // ================== Filtro ==================
  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  // ================== Acciones (editar / eliminar) ==================
  openModalEdit(vacante?: any): void {
    const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
      width: '95vw',
      maxWidth: '95vw',
      data: vacante || null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const isPrueba = result.pruebaOContratacion === 'Prueba';

      const payload = {
        cargo: result.cargo?.trim() || null,
        temporal: result.temporal?.trim() || null,
        area: result.area || null,
        empresaUsuariaSolicita: result.empresaUsuariaSolicita?.trim() || null,
        finca: result.finca?.trim() || null,
        direccion: result.direccion?.trim() || null,

        experiencia: result.experiencia?.trim() || null,
        descripcion: result.descripcion?.trim() || null,
        salario: this.parseCurrency(result.salario),
        codigoElite: result.codigoElite?.trim() || null,
        observacionVacante: result.observacionVacante?.trim() || null,

        pruebaOContratacion: isPrueba ? 'Prueba' : 'Contratación',
        fechadePruebatecnica: isPrueba ? this.formatDate(result.fechadePruebatecnica) : null,
        horadePruebatecnica: isPrueba ? (result.horadePruebatecnica || null) : null,
        fechadeIngreso: this.formatDate(result.fechadeIngreso) || null,

        fechaPublicado: result.fechaPublicado || new Date().toISOString(),
        quienpublicolavacante: result.quienpublicolavacante || 'Sistema',
        estadovacante: result.estadovacante || 'Activa',

        personasSolicitadas: Number(result.personasSolicitadas) || 0,
        municipiosDistribucion: this.mapMunicipiosDistribucion(result.municipiosDistribucion),

        oficinasQueContratan: (result.oficinasQueContratan || []).map((o: any) => ({
          nombre: o?.nombre?.trim() || '',
          ruta: !!o?.ruta,
        })),

        tipoContratacion: result.tipoContratacion?.trim() || null,
        municipio: Array.isArray(result.municipio) ? result.municipio : [],
        auxilioTransporte: result.auxilioTransporte,
      };

      this.vacantesService.actualizarVacante(vacante?.id, payload).subscribe({
        next: () => {
          this.loadData();
          Swal.fire('¡Vacante actualizada!', 'Los datos se guardaron correctamente', 'success');
        },
        error: (error: any) => {
          Swal.fire('Error al guardar', error?.message || 'Error desconocido al actualizar la vacante', 'error');
        }
      });
    });
  }

  eliminarVacante(vacante: any): void {
    Swal.fire({
      title: '¿Estás seguro?',
      text: 'No podrás revertir esto',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#3085d6',
      cancelButtonColor: '#d33',
      confirmButtonText: 'Sí, eliminar'
    }).then(result => {
      if (result.isConfirmed) {
        this.vacantesService.eliminarVacante(vacante.id).subscribe({
          next: () => {
            Swal.fire('Eliminado', 'La vacante ha sido eliminada.', 'success');
            this.loadData();
          }
        });
      }
    });
  }

  openModal(vacante?: any): void {
    const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
      width: '95vw',
      maxWidth: '95vw',
      data: vacante ? vacante : null
    });

    dialogRef.afterClosed().subscribe(result => {
      if (!result) return;

      const isPrueba = result.pruebaOContratacion === 'Prueba';
      const oficinas = Array.isArray(result.oficinasQueContratan) ? result.oficinasQueContratan : [];

      const payload = {
        cargo: result.cargo?.trim() || null,
        area: result.area || null,
        empresaUsuariaSolicita: result.empresaUsuariaSolicita?.trim() || null,
        finca: result.finca?.trim() || null,
        ubicacionPruebaTecnica: result.ubicacionPruebaTecnica?.trim() || null,
        experiencia: result.experiencia?.trim() || null,
        direccion: result.direccion?.trim() || null,

        fechadePruebatecnica: isPrueba ? this.formatDate(result.fechadePruebatecnica) : null,
        horadePruebatecnica: isPrueba ? (result.horadePruebatecnica || null) : null,
        fechadeIngreso: this.formatDate(result.fechadeIngreso) || null,
        pruebaOContratacion: isPrueba ? 'Prueba' : 'Contratación',

        observacionVacante: result.observacionVacante?.trim() || null,
        temporal: result.temporal?.trim() || null,
        descripcion: result.descripcion?.trim() || null,
        fechaPublicado: this.formatDate(new Date()),
        quienpublicolavacante: result.quienpublicolavacante?.trim() || 'Usuario Logueado',
        estadovacante: result.estadovacante?.trim() || 'Activa',
        salario: this.parseCurrency(result.salario),
        codigoElite: result.codigoElite?.trim() || null,

        personasSolicitadas: Number(result.personasSolicitadas) || 0,
        municipiosDistribucion: this.mapMunicipiosDistribucion(result.municipiosDistribucion),

        oficinasQueContratan: oficinas.map((oficina: any) => ({
          nombre: oficina?.nombre?.trim() || '',
          ruta: !!oficina?.ruta
        })),

        tipoContratacion: result.tipoContratacion?.trim() || null,
        municipio: Array.isArray(result.municipio) ? result.municipio : [],
        auxilioTransporte: result.auxilioTransporte,
      };

      this.vacantesService.enviarVacante(payload).subscribe({
        next: () => {
          this.loadData();
          Swal.fire('¡Éxito!', 'La vacante ha sido enviada correctamente', 'success');
        },
        error: (error) => {
          Swal.fire('Error', `Problema al enviar la vacante: ${error?.message || 'Error desconocido'}`, 'error');
        }
      });
    });
  }

  // ================== NUEVO: Cambiar estado 'activo' ==================
  /** Alterna el estado activo de una fila. Úsalo desde un botón/switch en la columna 'acciones'. */
  onToggleActivo(row: any): void {
    const nuevo = !row?.activo;
    this.setActivo(row, nuevo);
  }

  /** Pide motivo (si aplica), hace UI optimista y envía PATCH { activo, motivoInactivacion? }. */
  async setActivo(row: any, nuevoActivo: boolean): Promise<void> {
    if (!row?.id || this.busyActivoIds.has(row.id)) return;

    const anterior = !!row.activo;

    // Si se va a DESACTIVAR y el cumplimiento no es 100%, pedir motivo
    let motivo: string | null = null;
    if (nuevoActivo === false && this.cumplimientoPct(row) < 100) {
      const res = await Swal.fire({
        title: 'Motivo de inactivación',
        input: 'textarea',
        inputLabel: 'Describe por qué se inactiva la vacante (obligatorio si no hay 100% de cumplimiento).',
        inputPlaceholder: 'Escribe aquí el motivo…',
        inputAttributes: { maxlength: '500', 'aria-label': 'Motivo de inactivación' },
        inputValidator: (val: any) => {
          const t = String(val ?? '').trim();
          if (!t) return 'El motivo es obligatorio.';
          if (t.length < 10) return 'Amplía un poco más el motivo (mínimo 10 caracteres).';
          return null;
        },
        showCancelButton: true,
        confirmButtonText: 'Guardar',
        cancelButtonText: 'Cancelar',
        focusConfirm: true,
        allowOutsideClick: () => !Swal.isLoading(),
      });

      if (!res.isConfirmed) {
        // Canceló: aseguro revertir visualmente el toggle
        row.activo = anterior;
        return;
      }
      motivo = String(res.value ?? '').trim();
    }

    // UI optimista
    this.busyActivoIds.add(row.id);
    row.activo = nuevoActivo;

    this.vacantesService.cambiarEstadoActivo(row.id, nuevoActivo, motivo ?? undefined).subscribe({
      next: () => {
        if (nuevoActivo === false) {
          // Si tu listado sólo trae activas, retírala
          this.removeRowById(row.id);
          Swal.fire('Desactivada', 'La publicación fue desactivada.', 'success');
        } else {
          Swal.fire('Activada', 'La publicación fue activada.', 'success');
        }
      },
      error: (err) => {
        // Revertir UI
        row.activo = anterior;
        Swal.fire('Error', err?.message || 'No se pudo cambiar el estado', 'error');
      },
      complete: () => {
        this.busyActivoIds.delete(row.id);
      }
    });
  }

  /** Elimina una fila por id del dataSource principal y reconstruye derivadas. */
  private removeRowById(id: number | string): void {
    const rows = (this.dataSource.data ?? []).filter(r => r.id !== id);
    this.dataSource.data = rows;
    this.rebuildDerivedTables();
  }

  // ================== Utilidades ==================
  formatDate(date: Date | string | null): string | null {
    if (!date) return null;
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  }

  private parseCurrency(val: any): number {
    return Number(String(val ?? '').replace(/[^\d.-]/g, '')) || 0;
  }

  private mapMunicipiosDistribucion(arr: any[]): Array<{ municipio: string; cantidad: number }> {
    const src = Array.isArray(arr) ? arr : [];
    return src
      .map(d => ({
        municipio: String(d?.municipio ?? '').trim(),
        cantidad: Number(d?.cantidad) || 0,
      }))
      .filter(d => !!d.municipio);
  }

  // ================== Métricas de tabla ==================
  /** Total requerido: primero personasSolicitadas, si no, suma de distribución. */
  totalRequerida(v: any): number {
    const total = Number(v?.personasSolicitadas);
    return total
  }

  /** Faltantes = Req - Firm (contratados). */
  faltantes(v: any): number {
    return Math.max(0, this.totalRequerida(v) - this.firm(v));
  }

  // ---------- Conteo por estados (desde conteo_estados) ----------
  private ce(v: any): ConteoEstados {
    const z: ConteoEstados = {
      pre_registro: 0,
      entrevistado: 0,
      prueba_tecnica: 0,
      autorizado: 0,
      examenes_medicos: 0,
      contratado: 0,
      ingreso: 0,
      total_con_su_ultimo_registro: 0,
    };
    return (v?.conteo_estados as ConteoEstados) || z;
  }

  prue(v: any): number { return this.ce(v).prueba_tecnica; }
  auto(v: any): number { return this.ce(v).autorizado; }
  exm(v: any): number { return this.ce(v).examenes_medicos; }
  firm(v: any): number { return this.ce(v).contratado; }
  ing(v: any): number { return this.ce(v).ingreso; }
  entrev(v: any): number { return this.ce(v).entrevistado; }

  // ---------- Predicados para las vistas filtradas ----------
  isFaltante = (_: number, row: any) => this.faltantes(row) > 0;
  isCompletado = (_: number, row: any) => this.totalRequerida(row) > 0 && this.faltantes(row) === 0;

  // ================== Utilidad de permisos ==================
  private isManager(user: any): boolean {
    const raw = user?.rol ?? user?.roles ?? [];
    const roleNames: string[] = Array.isArray(raw)
      ? raw.map((r: any) => (typeof r === 'string' ? r : r?.nombre)).filter((v: any): v is string => !!v)
      : [typeof raw === 'string' ? raw : raw?.nombre].filter(Boolean) as string[];
    const upper = roleNames.map(r => r.toUpperCase());
    return upper.includes('GERENCIA') || upper.includes('ADMIN');
  }

  // ================== Exportar / Importar Excel ==================
  descargarExcelVacantes(_: Event): void {
    const ref = this.dialog.open(DateRangeDialogComponent, {
      width: '400px',
      data: { title: 'Seleccionar rango de fechas', startDate: null, endDate: null }
    });
    ref.afterClosed().subscribe(result => {
      if (result) {
        const { start, end } = result;
        this.vacantesService.getVacantesExcel(start, end, this.sede).subscribe(blob => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vacantes_${start || 'inicio'}_${end || 'hoy'}.xlsx`;
          a.click();
          URL.revokeObjectURL(url);
        });
      }
    });
  }

  onFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        Swal.fire('Aviso', 'Implementa el endpoint para subir Excel (crearDetalleLaboral).', 'info');
      };
      reader.readAsArrayBuffer(file);
    }
    event.target.value = '';
  }

  abrirFormularioPreRegistroVacantes(): void {
    window.open('https://formulario.tsservicios.co/formulario/formulario-pre-registro-vacantes', '_blank');
  }

  /** % de cumplimiento = Firm / Req * 100, redondeado */
  cumplimientoPct(v: any): number {
    const req = this.totalRequerida(v);
    if (!req) return 0;
    const firmados = this.firm(v);
    const pct = (firmados / req) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  /** Clase de semáforo según % */
  cumplClass(v: any): string {
    const pct = this.cumplimientoPct(v);
    if (pct >= 100) return 'semaforo-pill semaforo-ok';
    if (pct >= 70) return 'semaforo-pill semaforo-warn';
    return 'semaforo-pill semaforo-error';
  }

  // Normaliza texto (lowercase, sin tildes, trim)
  private norm(s: any): string {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  // Predicado por finca (reutilizable)
  private fincaPredicate = (data: any, filter: string) =>
    this.norm(data?.finca).includes(this.norm(filter));

  // Setea los predicados de cada dataSource derivado
  private setDerivedPredicates(): void {
    this.dataSourceFaltantes.filterPredicate = this.fincaPredicate;
    this.dataSourceCompletados.filterPredicate = this.fincaPredicate;
  }

  // Handlers de los inputs
  applyFincaFilterFaltantes(value: string): void {
    this.filterFincaFaltantes = value;
    this.dataSourceFaltantes.filter = this.norm(this.filterFincaFaltantes);
    // opcional: reset paginación
    this.dataSourceFaltantes.paginator?.firstPage();
  }

  applyFincaFilterCompletados(value: string): void {
    this.filterFincaCompletados = value;
    this.dataSourceCompletados.filter = this.norm(this.filterFincaCompletados);
    this.dataSourceCompletados.paginator?.firstPage();
  }
}
