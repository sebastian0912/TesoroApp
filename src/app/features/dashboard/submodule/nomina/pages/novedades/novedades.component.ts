import { ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Observable, map, startWith } from 'rxjs';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

import {
  Client, NominaService, NovedadPeriodo, PeriodoNominaDto,
} from '../../service/nomina/nomina.service';
import { NovedadFormDialogComponent } from './novedad-form-dialog.component';

type FiltroNaturaleza = 'TODAS' | 'DEVENGO' | 'DEDUCCION' | 'OTRO';

/**
 * Submódulo "Novedades" (dashboard/nomina/novedades): registro MANUAL de las
 * novedades de un periodo. A diferencia del botón de novedades del cálculo
 * (Excel efímero), aquí las novedades se GENERAN y ALMACENAN contra una
 * (empresa usuaria, periodo) y el cálculo las consumirá después.
 */
@Component({
  selector: 'app-novedades',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatDialogModule,
  ],
  templateUrl: './novedades.component.html',
  styleUrls: ['./novedades.component.css'],
})
export class NovedadesComponent implements OnInit {

  // ── Contexto: empresa usuaria + periodo ─────────────────────────────────
  clientControl = new FormControl<Client | string | null>(null);
  periodoControl = new FormControl<PeriodoNominaDto | string | null>(null);

  clientes: Client[] = [];
  periodos: PeriodoNominaDto[] = [];
  filteredClientes$!: Observable<Client[]>;
  filteredPeriodos$!: Observable<PeriodoNominaDto[]>;

  // ── Tabla / filtros locales ─────────────────────────────────────────────
  queryControl = new FormControl('');
  filtroNaturaleza: FiltroNaturaleza = 'TODAS';

  novedades: NovedadPeriodo[] = [];
  dataSource = new MatTableDataSource<NovedadPeriodo>([]);
  displayedColumns = [
    'empleado', 'concepto', 'naturaleza', 'cantidad',
    'fechas', 'valor', 'observacion', 'acciones',
  ];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  isLoading = false;
  /** false cuando el endpoint aún no existe en el backend (404/501). */
  backendDisponible = true;

  // ── KPIs del periodo (solo novedades no anuladas) ───────────────────────
  kpis = { total: 0, empleados: 0, devengos: 0, deducciones: 0, horas: 0, dias: 0, valor: 0 };

  constructor(
    private nominaService: NominaService,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.nominaService.getClientesActivos().subscribe(res => {
      this.clientes = res || [];
      this.clientControl.updateValueAndValidity({ emitEvent: true });
      this.cdr.markForCheck();
    });
    this.nominaService.getPeriodosNomina().subscribe(res => {
      // Más recientes primero: es lo que se está registrando ahora.
      this.periodos = (res || []).slice().sort(
        (a, b) => (b.fecha_inicio || '').localeCompare(a.fecha_inicio || ''),
      );
      this.periodoControl.updateValueAndValidity({ emitEvent: true });
      this.cdr.markForCheck();
    });

    this.filteredClientes$ = this.clientControl.valueChanges.pipe(
      startWith(''),
      map(v => typeof v === 'string' ? v : v?.nombre_legal || ''),
      map(nombre => nombre
        ? this.clientes.filter(c => c.nombre_legal.toLowerCase().includes(nombre.toLowerCase()))
        : this.clientes.slice()),
    );
    this.filteredPeriodos$ = this.periodoControl.valueChanges.pipe(
      startWith(''),
      map(v => typeof v === 'string' ? v : v?.descripcion || ''),
      map(desc => desc
        ? this.periodos.filter(p => (p.descripcion || '').toLowerCase().includes(desc.toLowerCase()))
        : this.periodos.slice()),
    );

    // Al cambiar el contexto (empresa u periodo objeto) se recarga la lista.
    this.clientControl.valueChanges.subscribe(v => {
      if (v && typeof v === 'object') this.cargarNovedades();
    });
    this.periodoControl.valueChanges.subscribe(v => {
      if (v && typeof v === 'object') this.cargarNovedades();
    });

    this.queryControl.valueChanges.subscribe(() => this.aplicarFiltros());

    // Filtro/orden client-side coherente con las columnas visibles.
    this.dataSource.sortingDataAccessor = (row, col) => {
      switch (col) {
        case 'empleado': return (row.nombre_empleado || row.documento || '').toLowerCase();
        case 'concepto': return (row.codigo_concepto || '').toLowerCase();
        case 'naturaleza': return row.naturaleza || '';
        case 'cantidad': return row.cantidad ?? -1;
        case 'fechas': return row.fecha_inicio || '';
        case 'valor': return row.valor ?? -1;
        default: return (row as any)[col] ?? '';
      }
    };
  }

  // ── Contexto ─────────────────────────────────────────────────────────────
  get clienteSel(): Client | null {
    const v = this.clientControl.value;
    return v && typeof v === 'object' ? v : null;
  }

  get periodoSel(): PeriodoNominaDto | null {
    const v = this.periodoControl.value;
    return v && typeof v === 'object' ? v : null;
  }

  get contextoListo(): boolean {
    return !!(this.clienteSel && this.periodoSel);
  }

  displayClient(c: Client | null): string { return c ? c.nombre_legal : ''; }
  displayPeriodo(p: PeriodoNominaDto | null): string { return p ? p.descripcion : ''; }

  limpiarEmpresa(ev?: Event): void { ev?.stopPropagation(); this.clientControl.setValue(null); this.resetLista(); }
  limpiarPeriodo(ev?: Event): void { ev?.stopPropagation(); this.periodoControl.setValue(null); this.resetLista(); }

  private resetLista(): void {
    this.novedades = [];
    this.dataSource.data = [];
    this.calcularKpis();
    this.cdr.markForCheck();
  }

  // ── Datos ────────────────────────────────────────────────────────────────
  cargarNovedades(): void {
    if (!this.contextoListo) return;
    this.isLoading = true;
    this.cdr.markForCheck();
    this.nominaService.getNovedadesPeriodo({
      clienteId: this.clienteSel!.id_entidad,
      periodoId: this.periodoSel!.id_periodo,
    }).subscribe({
      next: rows => {
        this.backendDisponible = true;
        // Las anuladas no se listan ni cuentan: el borrado es lógico en backend.
        this.novedades = (rows || []).filter(r => r.estado !== 'ANULADA');
        this.aplicarFiltros();
        this.calcularKpis();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: err => {
        this.isLoading = false;
        this.novedades = [];
        this.aplicarFiltros();
        this.calcularKpis();
        // 404/501 = backend aún no expone el módulo: banner informativo, no error.
        this.backendDisponible = !(err?.status === 404 || err?.status === 501);
        if (this.backendDisponible) {
          Swal.fire('Error', 'No se pudieron cargar las novedades del periodo.', 'error');
        }
        this.cdr.markForCheck();
      },
    });
  }

  aplicarFiltros(): void {
    const q = (this.queryControl.value || '').trim().toLowerCase();
    let rows = this.novedades;
    if (this.filtroNaturaleza !== 'TODAS') {
      rows = rows.filter(r => {
        const nat = (r.naturaleza || 'OTRO').toUpperCase();
        if (this.filtroNaturaleza === 'OTRO') return nat !== 'DEVENGO' && nat !== 'DEDUCCION';
        return nat === this.filtroNaturaleza;
      });
    }
    if (q) {
      rows = rows.filter(r =>
        (r.nombre_empleado || '').toLowerCase().includes(q) ||
        (r.documento || '').toLowerCase().includes(q) ||
        (r.codigo_concepto || '').toLowerCase().includes(q) ||
        (r.descripcion_concepto || '').toLowerCase().includes(q) ||
        (r.observacion || '').toLowerCase().includes(q));
    }
    this.dataSource.data = rows;
    if (!this.dataSource.paginator && this.paginator) this.dataSource.paginator = this.paginator;
    if (!this.dataSource.sort && this.sort) this.dataSource.sort = this.sort;
  }

  cambiarFiltroNaturaleza(f: FiltroNaturaleza): void {
    this.filtroNaturaleza = f;
    this.aplicarFiltros();
  }

  private calcularKpis(): void {
    const rows = this.novedades;
    const docs = new Set(rows.map(r => r.documento));
    this.kpis = {
      total: rows.length,
      empleados: docs.size,
      devengos: rows.filter(r => (r.naturaleza || '').toUpperCase() === 'DEVENGO').length,
      deducciones: rows.filter(r => (r.naturaleza || '').toUpperCase() === 'DEDUCCION').length,
      horas: rows.filter(r => r.unidad === 'HORA').reduce((s, r) => s + (Number(r.cantidad) || 0), 0),
      dias: rows.filter(r => r.unidad === 'DIA').reduce((s, r) => s + (Number(r.cantidad) || 0), 0),
      valor: rows.reduce((s, r) => s + (Number(r.valor) || 0), 0),
    };
  }

  badgeNaturaleza(n?: string | null): string {
    const nat = (n || '').toUpperCase();
    if (nat === 'DEVENGO') return 'devengo';
    if (nat === 'DEDUCCION') return 'deduccion';
    return 'otro';
  }

  // ── Acciones ─────────────────────────────────────────────────────────────
  nuevaNovedad(): void {
    if (!this.contextoListo) return;
    const ref = this.dialog.open(NovedadFormDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        cliente: this.clienteSel!,
        periodo: this.periodoSel!,
      },
    });
    ref.afterClosed().subscribe(res => { if (res) this.cargarNovedades(); });
  }

  editarNovedad(row: NovedadPeriodo): void {
    const ref = this.dialog.open(NovedadFormDialogComponent, {
      width: '640px',
      maxWidth: '95vw',
      disableClose: true,
      data: {
        cliente: this.clienteSel!,
        periodo: this.periodoSel!,
        novedad: row,
      },
    });
    ref.afterClosed().subscribe(res => { if (res) this.cargarNovedades(); });
  }

  anularNovedad(row: NovedadPeriodo): void {
    Swal.fire({
      title: '¿Anular novedad?',
      html: `Se anulará <b>${row.codigo_concepto} — ${row.descripcion_concepto || ''}</b>` +
            `<br>de <b>${row.nombre_empleado || row.documento}</b>.` +
            `<br><small>La novedad deja de ser candidata al cálculo del periodo.</small>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#c62828',
    }).then(r => {
      if (!r.isConfirmed || row.id == null) return;
      this.nominaService.anularNovedadPeriodo(row.id).subscribe({
        next: () => {
          Swal.fire({ title: 'Novedad anulada', icon: 'success', timer: 1400, showConfirmButton: false });
          this.cargarNovedades();
        },
        error: () => Swal.fire('Error', 'No se pudo anular la novedad.', 'error'),
      });
    });
  }

  exportarExcel(): void {
    if (!this.dataSource.data.length) return;
    const data = this.dataSource.data.map(r => ({
      'Documento': r.documento,
      'Empleado': r.nombre_empleado || '',
      'Código': r.codigo_concepto,
      'Concepto': r.descripcion_concepto || '',
      'Naturaleza': r.naturaleza || '',
      'Unidad': r.unidad || '',
      'Cantidad': r.cantidad ?? '',
      'Fecha Inicio': r.fecha_inicio || '',
      'Fecha Fin': r.fecha_fin || '',
      'Valor': r.valor ?? '',
      'Observación': r.observacion || '',
      'Estado': r.estado || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Novedades');
    const periodo = (this.periodoSel?.descripcion || 'periodo').replace(/[\\/:*?"<>|]/g, '-');
    XLSX.writeFile(wb, `Novedades_${periodo}.xlsx`);
  }
}
