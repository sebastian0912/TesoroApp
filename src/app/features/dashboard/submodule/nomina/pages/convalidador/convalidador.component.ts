import { AfterViewInit, ChangeDetectorRef, Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';

import {
  Client,
  ConceptoNomina,
  ConvalidadorExterno,
  EstadoConvalidacion,
  NominaService,
} from '../../service/nomina/nomina.service';
import { ConvalidadorFormDialogComponent } from './convalidador-form-dialog.component';

interface ConvalidadorCatalogRow extends ConvalidadorExterno {
  concepto_unidad?: string;
  concepto_activo: boolean;
  tiene_homologacion: boolean;
  homologaciones_adicionales: number;
}

@Component({
  selector: 'app-convalidador',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatDialogModule,
    MatDividerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSnackBarModule,
    MatSortModule,
    MatSlideToggleModule,
    MatTableModule,
    MatTooltipModule,
  ],
  templateUrl: './convalidador.component.html',
  styleUrls: ['./convalidador.component.css'],
})
export class ConvalidadorComponent implements OnInit, AfterViewInit {
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  displayedColumns = [
    'concepto_codigo',
    'concepto_descripcion',
    'codigo_externo',
    'concepto_externo',
    'clasificacion_externa',
    'estado_convalidacion',
    'activo',
    'acciones',
  ];
  dataSource = new MatTableDataSource<ConvalidadorCatalogRow>([]);
  isLoading = false;

  clientes: Client[] = [];
  clienteControl = new FormControl<string | Client>('');
  filteredClientes$!: Observable<Client[]>;
  selectedCliente: Client | null = null;

  conceptos: ConceptoNomina[] = [];
  conceptoControl = new FormControl<string | ConceptoNomina>('');
  filteredConceptos$!: Observable<ConceptoNomina[]>;
  selectedConcepto: ConceptoNomina | null = null;

  convalidacionesEmpresa: ConvalidadorExterno[] = [];
  catalogoConceptos: ConvalidadorCatalogRow[] = [];

  filterEstado = '';
  filterActivo = '';
  filterSearch = '';

  readonly ESTADO_LABELS: Record<string, { label: string; color: string; icon: string }> = {
    CONVALIDADO: { label: 'Convalidado', color: 'estado-ok', icon: 'check_circle' },
    CONVALIDADO_CON_OBSERVACION: { label: 'Con observacion', color: 'estado-warn', icon: 'info' },
    REVISAR: { label: 'Revisar', color: 'estado-review', icon: 'rate_review' },
    SIN_HOMOLOGACION: { label: 'Sin homologacion', color: 'estado-none', icon: 'help_outline' },
  };

  constructor(
    private nominaService: NominaService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.cargarClientes();
    this.cargarConceptos();

    this.filteredClientes$ = this.clienteControl.valueChanges.pipe(
      startWith(''),
      map((value) => typeof value === 'string' ? value : value?.nombre_legal || ''),
      map((nombre) => nombre ? this._filterClientes(nombre) : this.clientes.slice()),
    );

    this.filteredConceptos$ = this.conceptoControl.valueChanges.pipe(
      startWith(''),
      map((value) => typeof value === 'string' ? value : (value ? `[${value.codigo}] ${value.descripcion}` : '')),
      map((term) => term ? this._filterConceptos(term) : this.conceptos.slice()),
    );
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.paginator = this.paginator;
  }

  cargarClientes(): void {
    this.nominaService.getClientesActivos().subscribe({
      next: (data) => {
        this.clientes = data;
        this.clienteControl.setValue(this.clienteControl.value);
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open('Error al cargar empresas', 'Cerrar', { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  cargarConceptos(): void {
    this.nominaService.getConceptos().subscribe({
      next: (data) => {
        this.conceptos = data;
        this.conceptoControl.setValue(this.conceptoControl.value);
        this.reconstruirCatalogo();
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open('Error al cargar conceptos', 'Cerrar', { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  private _filterClientes(term: string): Client[] {
    const lower = term.toLowerCase();
    return this.clientes.filter((cliente) =>
      cliente.nombre_legal.toLowerCase().includes(lower) ||
      (cliente.nit ?? '').toLowerCase().includes(lower)
    );
  }

  private _filterConceptos(term: string): ConceptoNomina[] {
    const lower = term.toLowerCase();
    return this.conceptos.filter((concepto) =>
      concepto.codigo.toLowerCase().includes(lower) ||
      concepto.descripcion.toLowerCase().includes(lower) ||
      (concepto.abreviatura ?? '').toLowerCase().includes(lower)
    );
  }

  displayCliente(cliente: Client): string {
    return cliente ? `${cliente.nombre_legal}${cliente.nit ? ' (' + cliente.nit + ')' : ''}` : '';
  }

  displayConcepto(concepto: ConceptoNomina): string {
    return concepto ? `[${concepto.codigo}] ${concepto.descripcion}` : '';
  }

  onClienteSelected(cliente: Client): void {
    this.selectedCliente = cliente;
    this.cargarConvalidaciones();
  }

  onClienteCleared(): void {
    this.selectedCliente = null;
    this.clienteControl.setValue('');
    this.convalidacionesEmpresa = [];
    this.catalogoConceptos = [];
    this.dataSource.data = [];
  }

  onConceptoSelected(concepto: ConceptoNomina): void {
    this.selectedConcepto = concepto;
    this.aplicarFiltros();
  }

  onConceptoCleared(): void {
    this.selectedConcepto = null;
    this.conceptoControl.setValue('');
    this.aplicarFiltros();
  }

  cargarConvalidaciones(): void {
    if (!this.selectedCliente) {
      this.dataSource.data = [];
      return;
    }

    this.isLoading = true;
    this.cdr.markForCheck();
    this.nominaService.getConvalidaciones({ entidad_externa: this.selectedCliente.id_entidad }).subscribe({
      next: (data) => {
        this.convalidacionesEmpresa = data;
        this.reconstruirCatalogo();
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open('Error al cargar convalidaciones', 'Cerrar', { duration: 3000 });
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  abrirDialogoCrear(): void {
    if (!this.selectedCliente) {
      this.snackBar.open('Seleccione primero una empresa usuaria', 'Cerrar', { duration: 3000 });
      return;
    }

    const ref = this.dialog.open(ConvalidadorFormDialogComponent, {
      width: '680px',
      data: {
        convalidacion: null,
        entidadId: this.selectedCliente.id_entidad,
        conceptoSugerido: this.selectedConcepto,
      },
    });

    ref.afterClosed().subscribe((ok) => {
      if (ok) this.cargarConvalidaciones();
    });
  }

  abrirDialogoEditar(item: ConvalidadorCatalogRow): void {
    const ref = this.dialog.open(ConvalidadorFormDialogComponent, {
      width: '680px',
      data: {
        convalidacion: item.tiene_homologacion ? this.toConvalidacion(item) : null,
        entidadId: item.entidad_externa,
        conceptoSugerido: this.conceptos.find((concepto) => concepto.id_concepto === item.concepto) ?? null,
      },
    });

    ref.afterClosed().subscribe((ok) => {
      if (ok) this.cargarConvalidaciones();
    });
  }

  toggleActivo(item: ConvalidadorCatalogRow): void {
    if (!item.id_convalidacion) {
      this.abrirDialogoEditar(item);
      return;
    }

    const nuevoEstado = !item.activo;
    this.nominaService.actualizarConvalidacion(item.id_convalidacion, { activo: nuevoEstado }).subscribe({
      next: () => {
        item.activo = nuevoEstado;
        this.snackBar.open(
          `Homologacion ${nuevoEstado ? 'activada' : 'desactivada'}`,
          'Cerrar',
          { duration: 2000 },
        );
        this.cdr.markForCheck();
      },
      error: () => {
        this.snackBar.open('Error al actualizar estado', 'Cerrar', { duration: 3000 });
        this.cdr.markForCheck();
      },
    });
  }

  limpiarFiltros(): void {
    this.filterEstado = '';
    this.filterActivo = '';
    this.filterSearch = '';
    this.selectedConcepto = null;
    this.conceptoControl.setValue('');
    this.aplicarFiltros();
  }

  totalCatalogo(): number {
    return this.catalogoConceptos.length;
  }

  contarHomologados(): number {
    return this.catalogoConceptos.filter(r => r.tiene_homologacion).length;
  }

  contarPendientes(): number {
    return this.catalogoConceptos.filter(r => !r.tiene_homologacion).length;
  }

  getNaturalezaClass(naturaleza: string | undefined): string {
    if (!naturaleza) return 'nat-otro';
    const n = naturaleza.toUpperCase();
    if (n.includes('DEVENGO')) return 'nat-devengo';
    if (n.includes('DEDUCC')) return 'nat-deduccion';
    if (n.includes('APORTE')) return 'nat-aporte';
    if (n.includes('PROVIS')) return 'nat-provision';
    return 'nat-otro';
  }

  private reconstruirCatalogo(): void {
    if (!this.selectedCliente) {
      this.catalogoConceptos = [];
      this.dataSource.data = [];
      return;
    }

    const porConcepto = new Map<number, ConvalidadorExterno[]>();
    for (const convalidacion of this.convalidacionesEmpresa) {
      const actuales = porConcepto.get(convalidacion.concepto) ?? [];
      actuales.push(convalidacion);
      porConcepto.set(convalidacion.concepto, actuales);
    }

    this.catalogoConceptos = this.conceptos.map((concepto) => {
      const homologaciones = (porConcepto.get(concepto.id_concepto!) ?? [])
        .slice()
        .sort((a, b) => {
          const fechaA = a.actualizado_at ?? a.creado_at ?? '';
          const fechaB = b.actualizado_at ?? b.creado_at ?? '';
          return fechaB.localeCompare(fechaA);
        });
      const principal = homologaciones[0];

      return {
        id_convalidacion: principal?.id_convalidacion,
        concepto: concepto.id_concepto!,
        concepto_codigo: concepto.codigo,
        concepto_descripcion: concepto.descripcion,
        concepto_naturaleza: concepto.naturaleza_display ?? concepto.naturaleza,
        concepto_unidad: concepto.unidad_display ?? concepto.unidad,
        entidad_externa: this.selectedCliente!.id_entidad,
        entidad_nombre: this.selectedCliente!.nombre_legal,
        entidad_nit: this.selectedCliente!.nit,
        codigo_externo: principal?.codigo_externo ?? '',
        concepto_externo: principal?.concepto_externo ?? '',
        clasificacion_externa: principal?.clasificacion_externa ?? '',
        tabla_operativa_destino: principal?.tabla_operativa_destino ?? '',
        campo_operativo_destino: principal?.campo_operativo_destino ?? '',
        estado_convalidacion: principal?.estado_convalidacion ?? 'SIN_HOMOLOGACION',
        estado_display: principal?.estado_display,
        observacion: principal?.observacion ?? '',
        activo: principal?.activo ?? false,
        creado_at: principal?.creado_at,
        actualizado_at: principal?.actualizado_at,
        concepto_activo: concepto.activo,
        tiene_homologacion: !!principal,
        homologaciones_adicionales: Math.max(0, homologaciones.length - 1),
      };
    });

    this.aplicarFiltros();
  }

  aplicarFiltros(): void {
    if (!this.selectedCliente) {
      this.dataSource.data = [];
      return;
    }

    const search = this.filterSearch.trim().toLowerCase();
    const conceptoId = this.selectedConcepto?.id_concepto;

    this.dataSource.data = this.catalogoConceptos.filter((item) => {
      if (conceptoId && item.concepto !== conceptoId) return false;
      if (this.filterEstado && item.estado_convalidacion !== this.filterEstado) return false;
      if (this.filterActivo !== '' && String(item.activo) !== this.filterActivo) return false;
      if (!search) return true;

      return [
        item.concepto_codigo,
        item.concepto_descripcion,
        item.concepto_naturaleza,
        item.concepto_unidad,
        item.codigo_externo,
        item.concepto_externo,
        item.clasificacion_externa,
        item.observacion,
      ].some((value) => (value ?? '').toLowerCase().includes(search));
    });

    this.paginator?.firstPage();
  }

  private toConvalidacion(item: ConvalidadorCatalogRow): ConvalidadorExterno {
    return {
      id_convalidacion: item.id_convalidacion,
      concepto: item.concepto,
      concepto_codigo: item.concepto_codigo,
      concepto_descripcion: item.concepto_descripcion,
      concepto_naturaleza: item.concepto_naturaleza,
      entidad_externa: item.entidad_externa,
      entidad_nombre: item.entidad_nombre,
      entidad_nit: item.entidad_nit,
      codigo_externo: item.codigo_externo,
      concepto_externo: item.concepto_externo,
      clasificacion_externa: item.clasificacion_externa,
      tabla_operativa_destino: item.tabla_operativa_destino,
      campo_operativo_destino: item.campo_operativo_destino,
      estado_convalidacion: item.estado_convalidacion as EstadoConvalidacion,
      estado_display: item.estado_display,
      observacion: item.observacion,
      activo: item.activo,
      creado_at: item.creado_at,
      actualizado_at: item.actualizado_at,
    };
  }
}
