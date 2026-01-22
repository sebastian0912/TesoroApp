import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';

import Swal from 'sweetalert2';

import { VacantesService } from '../../service/vacantes/vacantes.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { SharedModule } from '@/app/shared/shared.module';
import { CrearEditarVacanteComponent } from '../../components/crear-editar-vacante/crear-editar-vacante.component';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';

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
type AuxilioTransporte = 'Si' | 'No';

interface OficinaPayload {
  nombre: string;
  ruta: boolean;
}

interface DistPayload {
  municipio: string;
  cantidad: number;
}

@Component({
  selector: 'app-vacantes',
  standalone: true,
  imports: [
    SharedModule,
    StandardFilterTable,
    NgIf,
    MatMenuModule,
    MatDialogModule,
    MatButtonToggleModule,
    MatIconModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatDividerModule,
  ],
  templateUrl: './vacantes.component.html',
  styleUrl: './vacantes.component.css',
})
export class VacantesComponent implements OnInit {
  // Data
  private allRows: any[] = [];
  visibleRows: any[] = [];

  // Tabla
  pageSizeOptions: number[] = [10, 25, 50];
  defaultPageSize = 10;
  tableTitle = 'Vacantes';

  // ⬇️ OJO: la columna de acciones se llama "actions" en TODO lado
  columnDefinitions: ColumnDefinition[] = [
    { name: 'actions', header: 'Acciones', type: 'custom', filterable: false, sortable: false, width: '72px', stickyStart: true },

    { name: 'cumpl', header: 'Cumpl.', type: 'custom', filterable: false, sortable: true, width: '90px' },
    { name: 'fechaPublicado', header: 'Publicado', type: 'date', filterable: true, sortable: true, width: '120px' },

    { name: 'req', header: 'Req', type: 'number', filterable: false, sortable: true, width: '70px' },
    { name: 'falt', header: 'Falt.', type: 'number', filterable: false, sortable: true, width: '70px' },
    { name: 'entrev', header: 'Entrev', type: 'number', filterable: false, sortable: true, width: '80px' },
    { name: 'prueba', header: 'Pru', type: 'number', filterable: false, sortable: true, width: '70px' },
    { name: 'auto', header: 'Auto', type: 'number', filterable: false, sortable: true, width: '70px' },
    { name: 'exm', header: 'Exm', type: 'number', filterable: false, sortable: true, width: '70px' },
    { name: 'firm', header: 'Firm', type: 'number', filterable: false, sortable: true, width: '70px' },
    { name: 'ing', header: 'Ing', type: 'number', filterable: false, sortable: true, width: '70px' },

    { name: 'finca', header: 'Centro de costo', type: 'text', filterable: true, sortable: true, width: '170px' },
    { name: 'cargo', header: 'Cargo', type: 'text', filterable: true, sortable: true, width: '170px' },

    { name: 'municipioLabel', header: 'Municipio', type: 'text', filterable: true, sortable: true, width: '200px' },

    { name: 'experiencia', header: 'Expe', type: 'text', filterable: true, sortable: true, width: '90px' },
    { name: 'observacionVacante', header: 'Observación del perfil', type: 'text', filterable: true, sortable: false, width: '260px' },
    { name: 'descripcion', header: 'Descripción', type: 'text', filterable: true, sortable: false, width: '260px' },

    { name: 'salario', header: 'Salario', type: 'custom', filterable: false, sortable: true, width: '140px' },
    { name: 'auxilioTransporte', header: 'Auxilio', type: 'text', filterable: true, sortable: true, width: '120px' },
    { name: 'tipoContratacion', header: 'Tipo de Contrato', type: 'text', filterable: true, sortable: true, width: '160px' },
  ];

  displayedColumns: string[] = this.columnDefinitions.map(c => c.name);

  viewMode: 'table' | 'faltantes' | 'completados' = 'table';
  loading = false;

  permitido = false;
  sede = '';
  busyActivoIds = new Set<number | string>();

  constructor(
    private dialog: MatDialog,
    private vacantesService: VacantesService,
    private utilityService: UtilityServiceService,
  ) { }

  ngOnInit(): void {
    const saved =
      typeof window !== 'undefined'
        ? (localStorage.getItem('vacantes:viewMode') as 'table' | 'faltantes' | 'completados' | null)
        : null;
    if (saved) this.viewMode = saved;

    const user = this.utilityService.getUser();
    this.sede = user?.sede?.nombre || '';
    this.permitido = this.isManager(user);

    this.loadData();
  }

  onToggleView(mode: 'table' | 'faltantes' | 'completados'): void {
    this.viewMode = mode;
    try { localStorage.setItem('vacantes:viewMode', mode); } catch { }
    this.applyViewMode();
  }

  private applyViewMode(): void {
    const rows = this.allRows ?? [];

    if (this.viewMode === 'faltantes') {
      this.visibleRows = rows.filter(r => (Number(r?.falt) || 0) > 0);
      return;
    }

    if (this.viewMode === 'completados') {
      this.visibleRows = rows.filter(r => (Number(r?.req) || 0) > 0 && (Number(r?.falt) || 0) === 0);
      return;
    }

    this.visibleRows = rows;
  }

  loadData(): void {
    this.loading = true;

    this.vacantesService.listarVacantes().subscribe({
      next: (response: any[]) => {
        const rows = (response ?? []).map(r => this.enrichComputed(this.mapRow(r)));
        const filtered = this.sede ? rows.filter(r => this.matchesSede(r, this.sede)) : rows;

        this.allRows = filtered;
        this.applyViewMode();
      },
      error: () => { },
      complete: () => (this.loading = false),
    });
  }

  private enrichComputed(row: any): any {
    const req = Number(row?.personasSolicitadas) || 0;

    const entrev = this.entrev(row);
    const prueba = this.prue(row);
    const auto = this.auto(row);
    const exm = this.exm(row);
    const firm = this.firm(row);
    const ing = this.ing(row);

    const falt = Math.max(0, req - firm);
    const cumpl = req ? Math.max(0, Math.min(100, Math.round((firm / req) * 100))) : 0;

    return {
      ...row,
      req,
      falt,
      entrev,
      prueba,
      auto,
      exm,
      firm,
      ing,
      cumpl,
      municipioLabel: Array.isArray(row?.municipio) ? row.municipio.join(', ') : '',
    };
  }

  private matchesSede(vac: any, sede: string): boolean {
    const wanted = this.norm(sede);
    if (!wanted) return true;

    const arr = Array.isArray(vac?.oficinasQueContratan) ? vac.oficinasQueContratan : [];
    return arr.some((o: any) => {
      const name = typeof o === 'string' ? o : o?.nombre;
      return this.norm(name) === wanted;
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

    const municipioArr = Array.isArray(r?.municipio)
      ? r.municipio
      : (Array.isArray(r?.municipios) ? r.municipios : []);

    return {
      ...r,
      activo: typeof r?.activo === 'boolean' ? r.activo : true,
      motivoInactivacion: r?.motivoInactivacion ?? '',

      salario: this.parseCurrency(r?.salario),
      municipio: municipioArr,
      observacionVacante: r?.observacion ?? '',
      preseleccionados: Array.isArray(r?.preseleccionados) ? r.preseleccionados : [],
      contratados: Array.isArray(r?.contratados) ? r.contratados : [],
      personasSolicitadas: Number(r?.personasSolicitadas) || 0,
      municipiosDistribucion: Array.isArray(r?.municipiosDistribucion) ? r.municipiosDistribucion : [],
      fechaPublicado: r?.fechaPublicado ?? null,
      fechadeIngreso: r?.fechadeIngreso ?? null,
      cargo: r?.cargo ?? null,
      finca: r?.finca ?? '',
      experiencia: r?.experiencia ?? '',
      auxilioTransporte: r?.auxilioTransporte ?? 'No',
      tipoContratacion: r?.tipoContratacion ?? '',
      conteo_estados: (r?.conteo_estados as ConteoEstados) || defaultConteo,
    };
  }

  // ================== Acciones ==================
openModalEdit(vacante?: any): void {
  const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
    width: '95vw',
    maxWidth: '95vw',
    data: vacante ?? null,
  });

  dialogRef.afterClosed().subscribe((result: any) => {
    if (!result) return;

    const t = (v: unknown): string => (v ?? '').toString().trim();
    const n = (v: unknown): number => Number(v);

    const id: number | string | null = vacante?.id ?? null;
    if (!id) {
      Swal.fire('Error', 'No se encontró el ID de la vacante para actualizar.', 'error');
      return;
    }

    const missing: string[] = [];

    // Requeridos
    if (!t(result.cargo)) missing.push('Cargo');
    if (!t(result.finca)) missing.push('Centro de costo');
    if (!t(result.direccion)) missing.push('Dirección');
    if (!t(result.empresaUsuariaSolicita)) missing.push('Empresa usuaria');
    if (!t(result.temporal)) missing.push('Temporal');
    if (!t(result.area)) missing.push('Área');
    if (!t(result.experiencia)) missing.push('Experiencia');
    if (!t(result.descripcion)) missing.push('Descripción');
    if (!t(result.tipoContratacion)) missing.push('Tipo de contratación');
    if (!t(result.pruebaOContratacion)) missing.push('Prueba o Contratación');

    const total: number = Math.trunc(n(result.personasSolicitadas));
    if (!(total >= 1)) missing.push('Personas solicitadas (mínimo 1)');

    const aux: AuxilioTransporte | '' = (t(result.auxilioTransporte) as AuxilioTransporte | '');
    if (!(aux === 'Si' || aux === 'No')) missing.push('Auxilio Transporte (Si/No)');

    const municipios: string[] = Array.isArray(result.municipio)
      ? (result.municipio as unknown[]).map((m: unknown) => t(m)).filter((s: string) => !!s)
      : [];
    if (!municipios.length) missing.push('Municipio(s)');

    // Condicionales
    const isPrueba: boolean = t(result.pruebaOContratacion) === 'Prueba';
    if (isPrueba) {
      if (!result.fechadePruebatecnica) missing.push('Fecha de Prueba Técnica');
      if (!t(result.horadePruebatecnica)) missing.push('Hora de Prueba Técnica');
    }

    const tieneIngreso: string = t(result.tieneFechaIngreso);
    if (tieneIngreso === 'Si') {
      if (!result.fechadeIngreso) missing.push('Fecha de Ingreso');
    }

    // Oficinas
    const oficinasRaw: unknown[] = Array.isArray(result.oficinasQueContratan) ? (result.oficinasQueContratan as unknown[]) : [];
    if (!oficinasRaw.length) missing.push('Oficinas que contratan');

    const oficinasLimpias: OficinaPayload[] = oficinasRaw
      .map((o: any): OficinaPayload => ({ nombre: t(o?.nombre), ruta: !!o?.ruta }))
      .filter((o: OficinaPayload) => !!o.nombre);

    if (!oficinasLimpias.length) missing.push('Nombre de oficina (vacío)');

    // Distribución
    const distRaw: unknown[] = Array.isArray(result.municipiosDistribucion) ? (result.municipiosDistribucion as unknown[]) : [];

    const distClean: DistPayload[] = distRaw
      .map((d: any): DistPayload => ({
        municipio: t(d?.municipio),
        cantidad: Math.trunc(n(d?.cantidad)),
      }))
      .filter((d: DistPayload) => !!d.municipio && Number.isFinite(d.cantidad) && d.cantidad >= 0);

    const sumaDist: number = distClean.reduce((acc: number, d: DistPayload) => acc + (d.cantidad || 0), 0);
    if (sumaDist > total) missing.push(`Distribución: suma ${sumaDist} supera total ${total}`);

    const distSet = new Set(distClean.map((d: DistPayload) => d.municipio));
    const faltanFilas: string[] = municipios.filter((m: string) => !distSet.has(m));
    if (faltanFilas.length) {
      missing.push(
        `Distribución: faltan municipios (${faltanFilas.slice(0, 6).join(', ')}${faltanFilas.length > 6 ? '...' : ''})`
      );
    }

    if (missing.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan campos / hay inconsistencias',
        html: `<ul style="text-align:left; margin:0; padding-left:18px;">
                ${Array.from(new Set(missing)).map((m: string) => `<li>${m}</li>`).join('')}
              </ul>`,
      });
      return;
    }

    const payload = {
      cargo: t(result.cargo) || null,
      temporal: t(result.temporal) || null,
      area: t(result.area) || null,
      empresaUsuariaSolicita: t(result.empresaUsuariaSolicita) || null,
      finca: t(result.finca) || null,
      direccion: t(result.direccion) || null,

      experiencia: t(result.experiencia) || null,
      descripcion: t(result.descripcion) || null,
      salario: this.parseCurrency(result.salario),
      codigoElite: t(result.codigoElite) || null,
      observacion: t(result.observacionVacante) || null,

      pruebaOContratacion: isPrueba ? 'Prueba' : 'Contratación',
      fechadePruebatecnica: isPrueba ? this.formatDate(result.fechadePruebatecnica) : null,
      horadePruebatecnica: isPrueba ? (t(result.horadePruebatecnica) || null) : null,
      fechadeIngreso: tieneIngreso === 'Si' ? (this.formatDate(result.fechadeIngreso) || null) : null,

      fechaPublicado: result.fechaPublicado || new Date().toISOString(),
      quienpublicolavacante: t(result.quienpublicolavacante) || 'Sistema',
      estadovacante: t(result.estadovacante) || 'Activa',

      personasSolicitadas: total,
      municipiosDistribucion: distClean,

      oficinasQueContratan: oficinasLimpias,

      tipoContratacion: t(result.tipoContratacion) || null,
      municipio: municipios,
      auxilioTransporte: aux,
    };

    this.vacantesService.actualizarVacante(id, payload).subscribe({
      next: () => {
        this.loadData();
        Swal.fire('¡Vacante actualizada!', 'Los datos se guardaron correctamente', 'success');
      },
      error: (error: any) => {
        Swal.fire('Error al guardar', error?.message || 'Error desconocido al actualizar la vacante', 'error');
      },
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
      confirmButtonText: 'Sí, eliminar',
    }).then(result => {
      if (!result.isConfirmed) return;

      this.vacantesService.eliminarVacante(vacante.id).subscribe({
        next: () => {
          Swal.fire('Eliminado', 'La vacante ha sido eliminada.', 'success');
          this.loadData();
        },
        error: (err: any) => Swal.fire('Error', err?.message || 'No se pudo eliminar', 'error'),
      });
    });
  }

openModal(vacante?: any): void {
  const dialogRef = this.dialog.open(CrearEditarVacanteComponent, {
    width: '95vw',
    maxWidth: '95vw',
    data: vacante ?? null,
  });

  dialogRef.afterClosed().subscribe((result: any) => {
    if (!result) return;

    const t = (v: unknown): string => (v ?? '').toString().trim();
    const n = (v: unknown): number => Number(v);

    const missing: string[] = [];

    // Requeridos
    if (!t(result.cargo)) missing.push('Cargo');
    if (!t(result.finca)) missing.push('Centro de costo');
    if (!t(result.direccion)) missing.push('Dirección');
    if (!t(result.empresaUsuariaSolicita)) missing.push('Empresa usuaria');
    if (!t(result.temporal)) missing.push('Temporal');
    if (!t(result.area)) missing.push('Área');
    if (!t(result.experiencia)) missing.push('Experiencia');
    if (!t(result.descripcion)) missing.push('Descripción');
    if (!t(result.tipoContratacion)) missing.push('Tipo de contratación');
    if (!t(result.pruebaOContratacion)) missing.push('Prueba o Contratación');

    const total: number = Math.trunc(n(result.personasSolicitadas));
    if (!(total >= 1)) missing.push('Personas solicitadas (mínimo 1)');

    const aux: AuxilioTransporte | '' = (t(result.auxilioTransporte) as AuxilioTransporte | '');
    if (!(aux === 'Si' || aux === 'No')) missing.push('Auxilio Transporte (Si/No)');

    const municipios: string[] = Array.isArray(result.municipio)
      ? (result.municipio as unknown[]).map((m: unknown) => t(m)).filter((s: string) => !!s)
      : [];
    if (!municipios.length) missing.push('Municipio(s)');

    // Condicionales
    const isPrueba: boolean = t(result.pruebaOContratacion) === 'Prueba';
    if (isPrueba) {
      if (!result.fechadePruebatecnica) missing.push('Fecha de Prueba Técnica');
      if (!t(result.horadePruebatecnica)) missing.push('Hora de Prueba Técnica');
    }

    const tieneIngreso: string = t(result.tieneFechaIngreso);
    if (tieneIngreso === 'Si') {
      if (!result.fechadeIngreso) missing.push('Fecha de Ingreso');
    }

    // Oficinas
    const oficinasRaw: unknown[] = Array.isArray(result.oficinasQueContratan) ? (result.oficinasQueContratan as unknown[]) : [];
    if (!oficinasRaw.length) missing.push('Oficinas que contratan');

    const oficinasLimpias: OficinaPayload[] = oficinasRaw
      .map((o: any): OficinaPayload => ({ nombre: t(o?.nombre), ruta: !!o?.ruta }))
      .filter((o: OficinaPayload) => !!o.nombre);

    if (!oficinasLimpias.length) missing.push('Nombre de oficina (vacío)');

    // Distribución
    const distRaw: unknown[] = Array.isArray(result.municipiosDistribucion) ? (result.municipiosDistribucion as unknown[]) : [];

    const distClean: DistPayload[] = distRaw
      .map((d: any): DistPayload => ({
        municipio: t(d?.municipio),
        cantidad: Math.trunc(n(d?.cantidad)),
      }))
      .filter((d: DistPayload) => !!d.municipio && Number.isFinite(d.cantidad) && d.cantidad >= 0);

    const sumaDist: number = distClean.reduce((acc: number, d: DistPayload) => acc + (d.cantidad || 0), 0);
    if (sumaDist > total) missing.push(`Distribución: suma ${sumaDist} supera total ${total}`);

    const distSet = new Set(distClean.map((d: DistPayload) => d.municipio));
    const faltanFilas: string[] = municipios.filter((m: string) => !distSet.has(m));
    if (faltanFilas.length) {
      missing.push(
        `Distribución: faltan municipios (${faltanFilas.slice(0, 6).join(', ')}${faltanFilas.length > 6 ? '...' : ''})`
      );
    }

    if (missing.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Faltan campos / hay inconsistencias',
        html: `<ul style="text-align:left; margin:0; padding-left:18px;">
                ${Array.from(new Set(missing)).map((m: string) => `<li>${m}</li>`).join('')}
              </ul>`,
      });
      return;
    }

    const payload = {
      cargo: t(result.cargo) || null,
      area: t(result.area) || null,
      empresaUsuariaSolicita: t(result.empresaUsuariaSolicita) || null,
      finca: t(result.finca) || null,
      ubicacionPruebaTecnica: isPrueba ? (t(result.ubicacionPruebaTecnica) || null) : null,
      experiencia: t(result.experiencia) || null,
      direccion: t(result.direccion) || null,

      fechadePruebatecnica: isPrueba ? this.formatDate(result.fechadePruebatecnica) : null,
      horadePruebatecnica: isPrueba ? (t(result.horadePruebatecnica) || null) : null,
      fechadeIngreso: tieneIngreso === 'Si' ? (this.formatDate(result.fechadeIngreso) || null) : null,
      pruebaOContratacion: isPrueba ? 'Prueba' : 'Contratación',

      observacion: t(result.observacionVacante) || null,
      temporal: t(result.temporal) || null,
      descripcion: t(result.descripcion) || null,
      fechaPublicado: this.formatDate(new Date()),
      quienpublicolavacante: t(result.quienpublicolavacante) || 'Usuario Logueado',
      estadovacante: t(result.estadovacante) || 'Activa',
      salario: this.parseCurrency(result.salario),
      codigoElite: t(result.codigoElite) || null,

      personasSolicitadas: total,
      municipiosDistribucion: distClean,

      oficinasQueContratan: oficinasLimpias,

      tipoContratacion: t(result.tipoContratacion) || null,
      municipio: municipios,
      auxilioTransporte: aux,
    };

    this.vacantesService.enviarVacante(payload).subscribe({
      next: () => {
        this.loadData();
        Swal.fire('¡Éxito!', 'La vacante ha sido enviada correctamente', 'success');
      },
      error: (error: any) => {
        Swal.fire('Error', `Problema al enviar la vacante: ${error?.message || 'Error desconocido'}`, 'error');
      },
    });
  });
}



  formatDate(date: Date | string | null): string | null {
    if (!date) return null;
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
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

  // ================== Activo ==================
  async setActivo(row: any, nuevoActivo: boolean): Promise<void> {
    if (!row?.id || this.busyActivoIds.has(row.id)) return;

    const anterior = !!row.activo;

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
        allowOutsideClick: () => !Swal.isLoading(),
      });

      if (!res.isConfirmed) {
        row.activo = anterior;
        return;
      }
      motivo = String(res.value ?? '').trim();
    }

    this.busyActivoIds.add(row.id);
    row.activo = nuevoActivo;

    this.vacantesService.cambiarEstadoActivo(row.id, nuevoActivo, motivo ?? undefined).subscribe({
      next: () => {
        if (nuevoActivo === false) {
          this.allRows = (this.allRows ?? []).filter(r => r.id !== row.id);
          this.applyViewMode();
          Swal.fire('Desactivada', 'La publicación fue desactivada.', 'success');
        } else {
          Swal.fire('Activada', 'La publicación fue activada.', 'success');
        }
      },
      error: (err: any) => {
        row.activo = anterior;
        Swal.fire('Error', err?.message || 'No se pudo cambiar el estado', 'error');
      },
      complete: () => this.busyActivoIds.delete(row.id),
    });
  }

  // ================== Utilidades ==================
  private parseCurrency(val: any): number {
    return Number(String(val ?? '').replace(/[^\d.-]/g, '')) || 0;
  }

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

  cumplimientoPct(v: any): number {
    const req = Number(v?.req ?? v?.personasSolicitadas) || 0;
    if (!req) return 0;
    const firmados = Number(v?.firm ?? this.firm(v)) || 0;
    return Math.max(0, Math.min(100, Math.round((firmados / req) * 100)));
  }

  cumplClass(v: any): string {
    const pct = this.cumplimientoPct(v);
    if (pct >= 100) return 'semaforo-pill semaforo-ok';
    if (pct >= 70) return 'semaforo-pill semaforo-warn';
    return 'semaforo-pill semaforo-error';
  }

  private isManager(user: any): boolean {
    const raw = user?.rol ?? user?.roles ?? [];
    const roleNames: string[] = Array.isArray(raw)
      ? raw.map((r: any) => (typeof r === 'string' ? r : r?.nombre)).filter((v: any): v is string => !!v)
      : [typeof raw === 'string' ? raw : raw?.nombre].filter(Boolean) as string[];
    const upper = roleNames.map(r => r.toUpperCase());
    return upper.includes('GERENCIA') || upper.includes('ADMIN');
  }

  descargarExcelVacantes(_: Event): void {
    const ref = this.dialog.open(DateRangeDialogComponent, {
      width: '400px',
      data: { title: 'Seleccionar rango de fechas', startDate: null, endDate: null },
    });

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      const { start, end } = result;

      this.vacantesService.getVacantesExcel(start, end, this.sede).subscribe(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vacantes_${start || 'inicio'}_${end || 'hoy'}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  // ✅ XLSX lazy-load: evita que “se congele” al entrar a la página
  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) { input.value = ''; return; }

    const XLSX = await import('xlsx');

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      Swal.fire('Aviso', 'Implementa el endpoint para subir Excel (crearDetalleLaboral).', 'info');
    };
    reader.readAsArrayBuffer(file);

    input.value = '';
  }

  abrirFormularioPreRegistroVacantes(): void {
    window.open('https://formulario.tsservicios.co/formulario/formulario-pre-registro-vacantes', '_blank');
  }

  private norm(s: any): string {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
