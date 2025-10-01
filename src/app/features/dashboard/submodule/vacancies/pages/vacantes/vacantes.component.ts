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
    // Material / Angular necesarios por el template
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
  ],
  templateUrl: './vacantes.component.html',
  styleUrl: './vacantes.component.css'
})
export class VacantesComponent implements OnInit {
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
  ];

  viewMode: 'table' | 'card' = 'table';
  loading = false;
  permitido = false;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  constructor(
    private dialog: MatDialog,
    private vacantesService: VacantesService,
    private utilityService: UtilityServiceService,
  ) { }

  async ngOnInit(): Promise<void> {
    // Persistencia simple del toggle
    const saved = (typeof window !== 'undefined')
      ? (localStorage.getItem('vacantes:viewMode') as 'table' | 'card' | null)
      : null;
    if (saved) this.viewMode = saved;

    this.loadData();

    // Permisos (para botón Eliminar)
    const user = this.utilityService.getUser();
    this.permitido = this.isManager(user);

    // Filtro simple
    this.dataSource.filterPredicate = (data: any, filter: string) =>
      JSON.stringify(data).toLowerCase().includes(filter);
  }

  onToggleView(mode: 'table' | 'card'): void {
    this.viewMode = mode;
    try { localStorage.setItem('vacantes:viewMode', mode); } catch { }
  }

  // ================== Carga de datos ==================
  loadData(): void {
    this.loading = true;
    this.vacantesService.listarVacantes().subscribe({
      next: (response: any[]) => {
        // Normaliza datos mínimos que usa la tabla
        const rows = (response ?? []).map(r => this.mapRow(r));
        this.dataSource.data = rows;
        this.dataSource.paginator = this.paginator;
        this.dataSource.sort = this.sort;
      },
      error: () => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes', 'error');
      },
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

    return {
      ...r,
      salario: this.parseCurrency(r?.salario),                           // string "0.00" -> number
      municipio: Array.isArray(r?.municipio) ? r.municipio : [],         // [] o array de strings
      observacionVacante: r?.observacionVacante ?? '',
      preseleccionados: Array.isArray(r?.preseleccionados) ? r.preseleccionados : [],
      contratados: Array.isArray(r?.contratados) ? r.contratados : [],
      personasSolicitadas: Number(r?.personasSolicitadas) || 0,
      municipiosDistribucion: Array.isArray(r?.municipiosDistribucion) ? r.municipiosDistribucion : [],
      fechaPublicado: r?.fechaPublicado ?? null,                         // 'yyyy-MM-dd'
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
        experiencia: result.experiencia?.trim() || null,
        descripcion: result.descripcion?.trim() || null,
        salario: this.parseCurrency(result.salario),
        codigoElite: result.codigoElite?.trim() || null,
        observacionVacante: result.observacionVacante?.trim() || null,

        // Condicionales
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
    // "1.423.500" | "1423500.00" | 0 -> 1423500
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
    if (Number.isFinite(total) && total > 0) return total;

    const dist = Array.isArray(v?.municipiosDistribucion) ? v.municipiosDistribucion : [];
    const sumDist = dist.reduce((acc: number, d: any) => acc + (Number(d?.cantidad) || 0), 0);
    return sumDist || 0;
  }

  /** Faltantes = Req - Ing (puedes cambiar a Req - Firm si lo prefieres). */
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

  prue(v: any): number { return this.ce(v).prueba_tecnica; }      // columna "Pru"
  auto(v: any): number { return this.ce(v).autorizado; }          // columna "Auto"
  exm(v: any): number { return this.ce(v).examenes_medicos; }    // columna "Exm"
  firm(v: any): number { return this.ce(v).contratado; }          // columna "Firm"
  ing(v: any): number { return this.ce(v).ingreso; }             // columna "Ing"
  entrev(v: any): number { return this.ce(v).entrevistado; } // No usado en tabla
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
        this.vacantesService.getVacantesExcel(start, end).subscribe(blob => {
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

  /** % de cumplimiento = Ing / Req * 100, redondeado */
  cumplimientoPct(v: any): number {
    const req = this.totalRequerida(v);
    if (!req) return 0;
    const ingresados = this.firm(v);
    const pct = (ingresados / req) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  /** Clase de semáforo según % */
  cumplClass(v: any): string {
    const pct = this.cumplimientoPct(v);
    if (pct >= 100) return 'semaforo-pill semaforo-ok';
    if (pct >= 70) return 'semaforo-pill semaforo-warn';
    return 'semaforo-pill semaforo-error';
  }
}
