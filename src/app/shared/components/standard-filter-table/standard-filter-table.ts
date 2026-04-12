import { SelectionModel } from '@angular/cdk/collections';
import { CdkTableModule } from '@angular/cdk/table';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ContentChild,
  DoCheck,
  EventEmitter,
  Inject,
  Input,
  IterableDiffer,
  IterableDiffers,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  TemplateRef,
  ViewChild,
  ContentChildren,
  QueryList,
  AfterContentInit,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSidenavModule, MatDrawer } from '@angular/material/sidenav';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatTable, MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';

import { merge, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

import { ActiveFilter, ColumnDefinition, FilterOperator } from '../../models/advanced-table-interface';
import { ColumnCellTemplateDirective } from '../../directives/column-cell-template.directive';

type DateRangeGroup = FormGroup<{
  start: FormControl<Date | null>;
  end: FormControl<Date | null>;
}>;

type StatusStyle = { color: string; background: string };
type ViewMode = 'table' | 'cards';

@Component({
  selector: 'app-standard-filter-table',
  standalone: true,
  templateUrl: './standard-filter-table.html',
  styleUrls: ['./standard-filter-table.css'],
  imports: [
    CommonModule,
    CdkTableModule,
    MatTableModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    ReactiveFormsModule,
    MatMenuModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSortModule,
    MatButtonModule,
    MatCheckboxModule,
    MatSidenavModule,
    MatSlideToggleModule,
    MatDividerModule,
    RouterModule,
  ],
  changeDetection: ChangeDetectionStrategy.Default,
})
export class StandardFilterTable implements OnInit, OnChanges, AfterViewInit, DoCheck, OnDestroy, AfterContentInit {
  readonly Array = Array;
  readonly String = String;

  // =========================
  // differs: detecta mutación de arrays (push/splice) sin cambiar la referencia
  // =========================
  private dataDiffer: IterableDiffer<any>;
  private colsDiffer: IterableDiffer<ColumnDefinition>;

  // =========================
  // Toggle vista (desktop)
  // =========================
  viewMode: ViewMode = 'table';
  setViewMode(ev: MatSlideToggleChange): void {
    this.viewMode = ev.checked ? 'cards' : 'table';
    this.saveState();
  }

  // Templates proyectados
  @ContentChild('actionsTemplate') actionsTemplate?: TemplateRef<unknown>;
  @ContentChild('attachmentTemplate') attachmentTemplate?: TemplateRef<unknown>;
  @ContentChild('semaforoTemplate') semaforoTemplate?: TemplateRef<unknown>;

  // Generic column templates
  @ContentChildren(ColumnCellTemplateDirective) cellTemplatesQuery!: QueryList<ColumnCellTemplateDirective>;
  customTemplates: Record<string, TemplateRef<any>> = {};

  /**
   * ✅ estadoTemplate ahora puede recibir:
   * - $implicit: row
   * - col: ColumnDefinition
   */
  @ContentChild('estadoTemplate') estadoTemplate?: TemplateRef<{ $implicit: any; col?: ColumnDefinition }>;
  @ContentChild('headerActionTemplate') headerActionTemplate?: TemplateRef<{ $implicit: ColumnDefinition }>;

  // Drawer
  @ViewChild('drawer') drawer?: MatDrawer;

  // Tabla (para recalcular sticky header/body en columnas dinámicas)
  @ViewChild(MatTable) matTable?: MatTable<any>;

  // Inputs
  @Input() data: any[] = [];
  @Input() columnDefinitions: ColumnDefinition[] = [];
  @Input() pageSizeOptions: number[] = [10, 20, 50];
  @Input() defaultPageSize = 10;
  @Input() tableTitle = 'Tabla de datos';
  @Input() totalCount: number | null = null;

  @Input() customPdfExport?: () => void;
  @Input() isLoading = false;
  @Input() createRoute?: string[] | null;

  @Input() useSwalLoading = false;
  @Input() enableRowClick = false;

  @Input() enableSelection = false;

  // Persistencia
  @Input() storageKey?: string;

  @Output() rowClicked = new EventEmitter<any>();

  // Tabla
  displayedColumns: string[] = [];
  dataSource = new MatTableDataSource<any>([]);

  // Advanced Filters: Record<colName, FormGroup>
  // Estructura del FG: { operator, value, min, max }
  filterForms: Record<string, FormGroup> = {};

  // Estado de filtrabilidad por columna (usuario puede apagar filtros)
  // por defecto true, salvo que definition diga false.
  filterEnabledByCol: Record<string, boolean> = {};

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  // Búsqueda global
  globalSearch = new FormControl<string>('', { nonNullable: true });

  // Densidad
  density: 'compact' | 'comfortable' = 'compact';

  // Rango fechas global
  dateRange: DateRangeGroup = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  // Target para el rango de fechas: 'ALL' o el nombre de una columna date
  dateTargetColumn = new FormControl<string>('ALL', { nonNullable: true });

  // Helper options
  readonly yesNoOptions: string[] = ['Activo', 'Inactivo'];

  // Operadores disponibles
  readonly textOperators: { val: FilterOperator, label: string }[] = [
    { val: 'contains', label: 'Contiene' },
    { val: 'equals', label: 'Igual a' },
    { val: 'startsWith', label: 'Empieza con' },
  ];
  readonly numberOperators: { val: FilterOperator, label: string }[] = [
    { val: 'equals', label: 'Igual a' },
    { val: 'range', label: 'Rango' },
    { val: 'gte', label: 'Mayor o igual' },
    { val: 'lte', label: 'Menor o igual' },
  ];

  // Columnas visibles
  visibleColumns: ColumnDefinition[] = [];
  private visibleColumnNames = new Set<string>();

  // Selección
  selection = new SelectionModel<any>(true, []);

  // Subs separadas
  private filterSubs = new Subscription();
  private uiSubs = new Subscription();

  // caches
  private colByName = new Map<string, ColumnDefinition>();
  private statusConfigByCol = new Map<string, Record<string, StatusStyle>>();
  private customConfigByCol = new Map<string, Record<string, StatusStyle>>();

  // Select Search Caches
  selectSearchControls: Record<string, FormControl<string>> = {};

  constructor(
    private cdr: ChangeDetectorRef,
    private differs: IterableDiffers,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    // ✅ trackBy estable para detectar cambios con fiabilidad
    this.dataDiffer = this.differs.find([]).create<any>((i, row) => this.trackByRow(i, row));
    this.colsDiffer = this.differs.find([]).create<ColumnDefinition>((i, c) => c?.name ?? i);
  }

  // trackBy
  trackByCol = (_: number, c: ColumnDefinition) => c?.name;
  trackByRow = (i: number, row: any) => row?.id ?? row?.uuid ?? row?.code ?? row?._id ?? i;

  // =========================
  // ✅ sticky refresher (header + body)
  // =========================
  private refreshSticky(): void {
    queueMicrotask(() => this.matTable?.updateStickyColumnStyles());
  }

  // =========================
  // lifecycle
  // =========================
  ngOnInit(): void {
    // Restaurar estado si existe key
    if (this.storageKey) {
      this.loadState();
    }

    this.initializeTable();
    this.applyFilters();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.useSwalLoading && changes['isLoading']) {
      if (this.isLoading) {
        Swal.fire({
          title: 'Cargando...',
          allowOutsideClick: false,
          allowEscapeKey: false,
          didOpen: () => Swal.showLoading(),
        });
      } else if (Swal.isVisible()) {
        Swal.close();
      }
    }

    // Si columnDefinitions llega como referencia nueva
    if (changes['columnDefinitions'] && !changes['columnDefinitions'].firstChange) {
      this.rebuildColumnsAndFilters();
      return;
    }

    if (changes['enableSelection'] && !changes['enableSelection'].firstChange) {
      if (!this.enableSelection) this.selection.clear();
      this.recomputeVisibleColumns();
    }

    // Si data llega como referencia nueva
    if (changes['data'] && !changes['data'].firstChange) {
      this.dataSource.data = (this.data || []).slice();

      if (this.paginator) this.dataSource.paginator = this.paginator;
      if (this.sort) this.dataSource.sort = this.sort;

      this.syncPaginatorLength();
      this.applyFilters();
    }

    if (changes['defaultPageSize'] && !changes['defaultPageSize'].firstChange) {
      if (this.paginator) {
        this.paginator.pageSize = this.defaultPageSize;
        this.paginator.firstPage();
        this.syncPaginatorLength();
      }
    }
  }

  // ✅ esto detecta push/splice sin cambiar referencia (y sin necesidad de click)
  ngDoCheck(): void {
    const colsChanged = this.colsDiffer.diff(this.columnDefinitions || []);
    if (colsChanged) {
      this.rebuildColumnsAndFilters();
      return;
    }

    const dataChanged = this.dataDiffer.diff(this.data || []);
    if (dataChanged) {
      this.applyFilters();
      this.syncPaginatorLength();
    }
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;

      this.dataSource.sortingDataAccessor = (item: any, property: string) => {
        const col = this.colByName.get(property);
        const raw = item?.[property];
        if (!col) return raw;

        if (col.type === 'date') {
          if (raw instanceof Date) return raw.getTime();
          const d = raw ? new Date(raw) : null;
          return d && !isNaN(d.getTime()) ? d.getTime() : -Infinity;
        }

        if (col.type === 'number') {
          if (raw === null || raw === undefined || raw === '') return -Infinity;
          const n = typeof raw === 'number' ? raw : Number(raw);
          return isNaN(n) ? -Infinity : n;
        }

        return (raw ?? '').toString().toLowerCase();
      };
    }

    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.pageSize = this.defaultPageSize;

      this.syncPaginatorLength();
      this.uiSubs.add(this.paginator.page.subscribe(() => this.cdr.detectChanges()));
    }

    // primer render con data actual
    this.dataSource.data = (this.data || []).slice();
    this.applyFilters();

    this.refreshSticky();
    this.cdr.detectChanges();
  }



  ngAfterContentInit() {
    this.updateCustomTemplates();
    this.cellTemplatesQuery.changes.subscribe(() => {
      this.updateCustomTemplates();
      this.cdr.markForCheck();
    });
  }

  private updateCustomTemplates() {
    this.customTemplates = {};
    this.cellTemplatesQuery.forEach((item) => {
      this.customTemplates[item.column] = item.template;
    });
  }

  ngOnDestroy(): void {
    this.filterSubs.unsubscribe();
    this.uiSubs.unsubscribe();

    if (this.useSwalLoading && Swal.isVisible()) Swal.close();
  }

  emitRowClick(row: any, event?: Event): void {
    if (!this.enableRowClick) return;

    const target = event?.target as HTMLElement | null;
    if (target?.closest('button, a, mat-checkbox, [data-row-click-ignore="true"]')) return;

    this.rowClicked.emit(row);
  }

  // =========================
  // Drawer & UI
  // =========================
  toggleDrawer(): void {
    this.drawer?.toggle();
  }

  closeDrawer(): void {
    this.drawer?.close();
  }

  // =========================
  // init / rebuild
  // =========================
  private initializeTable(): void {
    this.buildColumnCaches();
    this.ensureVisibleColumnsInitialized();
    this.recomputeVisibleColumns();

    this.dataSource.data = (this.data || []).slice();

    this.filterSubs.unsubscribe();
    this.filterSubs = new Subscription();

    // Rebuild controls preserving values if possible, or init new ones
    // We clean old controls that probably don't match anymore
    const oldForms = this.filterForms;
    this.filterForms = {};
    this.selectSearchControls = {};

    (this.columnDefinitions || []).forEach((col) => {
      // Init filterEnabledByCol default
      if (this.filterEnabledByCol[col.name] === undefined) {
        this.filterEnabledByCol[col.name] = col.filterable !== false;
      }

      if (col.filterable === false) return;
      if (col.type === 'date') return; // Date handled globally or specifically separate

      const existing = oldForms[col.name];
      const isMulti = col.type === 'select' || col.type === 'status';

      // Default operators
      let defaultOp: FilterOperator = 'contains';
      if (col.type === 'number') defaultOp = 'equals';
      if (isMulti) defaultOp = 'in'; // not really used but consistency

      this.filterForms[col.name] = new FormGroup({
        operator: new FormControl<FilterOperator>(existing?.value.operator ?? defaultOp),
        value: new FormControl<any>(existing?.value.value ?? (isMulti ? [] : '')),
        min: new FormControl<number | null>(existing?.value.min ?? null),
        max: new FormControl<number | null>(existing?.value.max ?? null),
      });

      if (isMulti) {
        this.selectSearchControls[col.name] = new FormControl('', { nonNullable: true });
      }
    });

    const streams = [
      this.globalSearch.valueChanges.pipe(startWith(this.globalSearch.value)),
      this.dateRange.valueChanges.pipe(startWith(this.dateRange.value)),
      this.dateTargetColumn.valueChanges.pipe(startWith(this.dateTargetColumn.value)),
      ...Object.values(this.filterForms).map(g => g.valueChanges.pipe(startWith(g.value)))
    ];

    this.filterSubs.add(
      merge(...streams).pipe(debounceTime(120)).subscribe(() => {
        this.applyFilters();
        this.refreshSticky();
        this.cdr.detectChanges();
      }),
    );

    this.syncPaginatorLength();
    this.refreshSticky();
  }

  private rebuildColumnsAndFilters(): void {
    // Reset filters? Maybe keep if column name matches?
    // User requested persistence, so try to keep.

    // We update the visible columns set based on definitions
    this.visibleColumnNames = new Set((this.columnDefinitions || []).map((c) => c.name));
    if (this.columnDefinitions.some((c) => c.name === 'actions')) this.visibleColumnNames.add('actions');

    this.initializeTable();
    this.applyFilters();
    this.refreshSticky();
    this.cdr.detectChanges();
  }

  private buildColumnCaches(): void {
    this.colByName.clear();
    this.statusConfigByCol.clear();
    this.customConfigByCol.clear();

    (this.columnDefinitions || []).forEach((c) => {
      if (!c?.name) return;
      this.colByName.set(c.name, c);
      if (c.statusConfig) this.statusConfigByCol.set(c.name, c.statusConfig);
      if (c.customClassConfig) this.customConfigByCol.set(c.name, c.customClassConfig);
    });
  }

  private ensureVisibleColumnsInitialized(): void {
    const names = (this.columnDefinitions || []).map((c) => c.name);

    if (this.visibleColumnNames.size === 0) {
      names.forEach((n) => this.visibleColumnNames.add(n));
    } else {
      // Clean up names that no longer exist
      const now = new Set(names);
      [...this.visibleColumnNames].forEach((n) => {
        if (!now.has(n)) this.visibleColumnNames.delete(n);
      });
      // Add new ones (default visible behavior, or check preference?)
      // If we are rebuilding, we might ideally respect user pref.
      names.forEach((n) => {
        if (!this.visibleColumnNames.has(n) && this.colByName.get(n)?.name) {
          // If it's a new column, add it? Or leave hidden? 
          // Behavior: if it wasn't there before, add it.
          this.visibleColumnNames.add(n);
        }
      });
    }

    if (names.includes('actions')) this.visibleColumnNames.add('actions');
  }

  private recomputeVisibleColumns(): void {
    this.visibleColumns = (this.columnDefinitions || []).filter((c) => this.visibleColumnNames.has(c.name));

    const cols = this.visibleColumns.map((c) => c.name);
    this.displayedColumns = this.enableSelection ? ['select', ...cols] : cols;

    this.refreshSticky();
    this.saveState();
  }

  private syncPaginatorLength(): void {
    if (!this.paginator) return;
    const len = this.totalCount ?? (this.dataSource.data?.length ?? 0);
    this.paginator.length = len;
  }

  // =========================
  // Columnas visibles (menu)
  // =========================
  isColumnVisible(name: string): boolean {
    return this.visibleColumnNames.has(name);
  }

  toggleColumn(name: string, checked: boolean): void {
    if (name === 'actions') return;
    if (checked) this.visibleColumnNames.add(name);
    else this.visibleColumnNames.delete(name);

    this.recomputeVisibleColumns();
    this.applyFilters();
    this.refreshSticky();
    this.cdr.detectChanges();
  }

  // Toggle filterability
  isFilterEnabled(name: string): boolean {
    return this.filterEnabledByCol[name] ?? true;
  }

  toggleFilterability(name: string, checked: boolean): void {
    this.filterEnabledByCol[name] = checked;
    this.applyFilters();
    this.saveState();
  }

  // =========================
  // Toolbar helpers
  // =========================
  clearGlobalSearch(): void {
    this.globalSearch.setValue('', { emitEvent: false });
    this.applyFilters();
    this.refreshSticky();
    // this.cdr.detectChanges(); // applyFilters triggers this likely via sync
  }

  hasAnyActiveFilters(): boolean {
    return this.String(this.globalSearch.value ?? '').trim().length > 0 || this.getActiveFilters().length > 0;
  }

  // =========================
  // Filters
  // =========================
  applyFilters(): void {
    const sourceData = this.data || [];

    const globalNeedle = this.String(this.globalSearch.value ?? '').trim().toLowerCase();

    // Dates
    const start: Date | null = this.dateRange.get('start')?.value ?? null;
    const end: Date | null = this.dateRange.get('end')?.value ?? null;
    let inclusiveEnd: Date | null = null;
    if (end) {
      inclusiveEnd = new Date(end);
      inclusiveEnd.setHours(23, 59, 59, 999);
    }
    const dateTarget = this.dateTargetColumn.value; // 'ALL' or colName

    // Active Forms
    const activeColFilters: Array<{
      name: string;
      op: FilterOperator;
      val: any;
      min: number | null;
      max: number | null;
      isStatus: boolean;
      colType: string;
    }> = [];

    for (const col of this.columnDefinitions) {
      if (col.filterable === false) continue;
      if (!this.filterEnabledByCol[col.name]) continue; // User disabled
      if (col.type === 'date') continue; // Handled separate

      const form = this.filterForms[col.name];
      if (!form) continue;

      const { operator, value, min, max } = form.value;
      const op = operator ?? 'contains';

      // Check if filter is active
      let isActive = false;

      if (col.type === 'text') {
        if (typeof value === 'string' && value.trim() !== '') isActive = true;
      } else if (col.type === 'number') {
        if (operator === 'range') {
          if (min !== null || max !== null) isActive = true;
        } else {
          if (value !== null && value !== '' && value !== undefined) isActive = true;
        }
      } else if (col.type === 'select' || col.type === 'status') {
        if (Array.isArray(value) && value.length > 0) isActive = true;
      }

      if (isActive) {
        activeColFilters.push({
          name: col.name,
          op: operator,
          val: value,
          min: min ?? null,
          max: max ?? null,
          isStatus: col.type === 'status',
          colType: col.type,
        });
      }
    }

    const hasDateFilter = !!(start || end);
    // Determine which columns to check for date
    const dateColsToCheck = this.columnDefinitions.filter(c => c.type === 'date' && c.filterable !== false);

    const hasAnyFilter = !!globalNeedle || activeColFilters.length > 0 || hasDateFilter;

    if (!hasAnyFilter) {
      this.dataSource.data = sourceData.slice();
      this.syncPaginatorLength();
      this.pruneSelection();
      this.refreshSticky();
      return;
    }

    const searchCols = this.visibleColumns.filter((c) => !['actions', 'attachment', 'semaforo'].includes(c.name));
    const out: any[] = [];

    for (let i = 0; i < sourceData.length; i++) {
      const item = sourceData[i];
      let ok = true;

      // 1. Global Search
      if (globalNeedle) {
        let hit = false;
        for (const c of searchCols) {
          const raw = item?.[c.name];
          let v: string;
          if (c.type === 'status') v = this.getStatusLabel(c.name, raw);
          else if (c.type === 'date') {
            const d = raw instanceof Date ? raw : raw ? new Date(raw) : null;
            v = d && !isNaN(d.getTime()) ? d.toLocaleDateString('es-CO') : '';
          } else {
            v = (raw ?? '').toString();
          }
          if (v.toLowerCase().includes(globalNeedle)) {
            hit = true;
            break;
          }
        }
        if (!hit) {
          ok = false;
        }
      }

      if (!ok) continue;

      // 2. Column Filters
      for (const f of activeColFilters) {
        const raw = item?.[f.name];

        // Select/Status
        if (f.colType === 'select' || f.colType === 'status') {
          // Usually strict match for options. Multi-select acts as OR/IN
          const set = new Set(f.val as any[]);
          let vToCheck = raw;
          if (f.isStatus) vToCheck = this.getStatusLabel(f.name, raw);

          if (!set.has(vToCheck)) {
            ok = false;
            break;
          }
          continue;
        }

        // Number
        if (f.colType === 'number') {
          const n = typeof raw === 'number' ? raw : Number(raw);
          if (isNaN(n)) {
            ok = false;
            break;
          }

          if (f.op === 'range') {
            if (f.min !== null && n < f.min) { ok = false; break; }
            if (f.max !== null && n > f.max) { ok = false; break; }
          } else if (f.op === 'equals') {
            if (n !== Number(f.val)) { ok = false; break; }
          } else if (f.op === 'gte') {
            if (n < Number(f.val)) { ok = false; break; }
          } else if (f.op === 'lte') {
            if (n > Number(f.val)) { ok = false; break; }
          }
          continue;
        }

        // Text
        const s = (raw ?? '').toString().toLowerCase();
        const needle = (f.val ?? '').toString().toLowerCase();

        if (f.op === 'equals') {
          if (s !== needle) { ok = false; break; }
        } else if (f.op === 'startsWith') {
          if (!s.startsWith(needle)) { ok = false; break; }
        } else {
          // Default contains
          if (!s.includes(needle)) { ok = false; break; }
        }
      }

      if (!ok) continue;

      // 3. Date Range
      if (hasDateFilter && dateColsToCheck.length > 0) {
        // Rule: 
        // If dateTarget === 'ALL', then ANY date column match (OR logic? or AND? usually checks against relevant dates)
        // "Todas las fechas" implies filtering records where the dates fall in range.
        // If I choose 1 col, check that col.

        const relevantCols = dateTarget === 'ALL'
          ? dateColsToCheck
          : dateColsToCheck.filter(c => c.name === dateTarget);

        // Implementation detail: If ALL, should it be:
        // A) Record is valid if ALL date columns are in range? (Restrictive)
        // B) Record is valid if AT LEAST ONE date column is in range? (Permissive)
        // C) Record is valid if data within specific columns are in range. Typically "Date Range" filters by "Created Date" or similar.
        // Let's assume ALL targeted columns must be satisfied? Or just one?
        // Usually strict filter: if I say "Date between X and Y", I want records where that date is X-Y.
        // If I select "All dates", it's ambiguous. But let's assume valid: 
        // Check each relevant column. If a column has a value, it MUST be in range.

        for (const col of relevantCols) {
          const raw = item?.[col.name];
          const d: Date | null = raw instanceof Date ? raw : raw ? new Date(raw) : null;

          if (!d || isNaN(d.getTime())) {
            // If date is missing/invalid, strict filter excludes it? Or ignores?
            // Usually standard table excludes rows with null date if filtering by date.
            ok = false;
            break;
          }
          if (start && d < start) { ok = false; break; }
          if (inclusiveEnd && d > inclusiveEnd) { ok = false; break; }
        }
      }

      if (ok) out.push(item);
    }

    this.dataSource.data = out;
    this.syncPaginatorLength();

    if (this.paginator && this.paginator.pageIndex !== 0) {
      this.paginator.firstPage();
    }

    this.pruneSelection();
    this.refreshSticky();
  }

  clearFilters(): void {
    Object.values(this.filterForms).forEach((fg) => {
      // Reset values but keep operators? Or reset everything?
      // Resetting values is safer.
      fg.patchValue({
        value: Array.isArray(fg.value.value) ? [] : '',
        min: null,
        max: null
      }, { emitEvent: false });
    });

    this.globalSearch.setValue('', { emitEvent: false });
    this.dateRange.reset({ start: null, end: null }, { emitEvent: false });
    this.dateTargetColumn.setValue('ALL', { emitEvent: false });

    this.applyFilters();
  }

  clearSingleFilter(name: string): void {
    if (name === '__dateRange__') {
      this.dateRange.reset();
      return;
    }

    const fg = this.filterForms[name];
    if (fg) {
      fg.patchValue({ value: Array.isArray(fg.value.value) ? [] : '', min: null, max: null });
    }
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    // global date range
    const start = this.dateRange.get('start')?.value;
    const end = this.dateRange.get('end')?.value;
    if (start || end) {
      filters.push({
        name: '__dateRange__',
        header: 'Fecha (' + (this.dateTargetColumn.value === 'ALL' ? 'Todas' : this.colByName.get(this.dateTargetColumn.value)?.header) + ')',
        type: 'date',
        value: { from: start, to: end },
        operator: 'range'
      });
    }

    Object.keys(this.filterForms).forEach((colName) => {
      const col = this.colByName.get(colName);
      if (!col || !this.filterEnabledByCol[colName]) return;

      const form = this.filterForms[colName];
      if (!form) return;

      const { value, min, max, operator } = form.value;
      const colType = col.type;

      let hasVal = false;
      let displayVal = value;

      if (colType === 'number') {
        if (operator === 'range') {
          if (min !== null || max !== null) {
            hasVal = true;
            displayVal = `${min ?? '...'} - ${max ?? '...'}`;
          }
        } else {
          if (value !== null && value !== '' && value !== undefined) hasVal = true;
        }
      } else if (colType === 'select' || colType === 'status') {
        if (Array.isArray(value) && value.length > 0) hasVal = true;
      } else {
        if (typeof value === 'string' && value.trim().length > 0) hasVal = true;
      }

      if (hasVal) {
        filters.push({
          name: colName,
          header: col.header,
          type: col.type,
          value: displayVal,
          operator: operator
        });
      }
    });

    return filters;
  }

  toggleFilters(): void {
    // Mobile toggle
    this.toggleDrawer();
  }

  // =========================
  // status/custom
  // =========================
  private getStatusConfig(columnName: string): Record<string, StatusStyle> {
    return this.statusConfigByCol.get(columnName) || {};
  }

  private getCustomClassConfig(columnName: string): Record<string, StatusStyle> {
    return this.customConfigByCol.get(columnName) || {};
  }

  getStatusStyles(columnName: string, value: any): { color?: string; background?: string } {
    const config = this.getStatusConfig(columnName);
    return config?.[value] || {};
  }

  getCustomStyles(columnName: string, value: any): { color?: string; background?: string } {
    const config = this.getCustomClassConfig(columnName);
    return config?.[value] || {};
  }

  getStatusLabel(_columnName: string, value: any): string {
    if (value === true || value === 'true' || value === 1 || value === '1') return 'Activo';
    if (value === false || value === 'false' || value === 0 || value === '0') return 'Inactivo';
    if (value === null || value === undefined || value === '') return '-';
    return String(value);
  }

  isSortable(col: ColumnDefinition): boolean {
    if (col.sortable === false) return false;
    if (col.name === 'actions' || col.name === 'attachment') return false;
    return true;
  }

  // =========================
  // export
  // =========================
  exportTable(format: 'pdf' | 'xml' | 'excel'): void {
    switch (format) {
      case 'pdf':
        if (this.customPdfExport) this.customPdfExport();
        else {
          Swal.fire({
            icon: 'info',
            title: 'Funcionalidad no disponible',
            text: 'La exportación a PDF aún no está implementada.',
            timer: 2500,
            showConfirmButton: false,
          });
        }
        break;

      case 'xml':
        Swal.fire({
          icon: 'info',
          title: 'Funcionalidad no disponible',
          text: 'La exportación a XML aún no está implementada.',
          timer: 2500,
          showConfirmButton: false,
        });
        break;

      case 'excel':
        this.exportToExcel();
        break;
    }
  }

  private exportToExcel(): void {
    // Basic implementation
    const data = this.dataSource.filteredData.length ? this.dataSource.filteredData : this.data;
    const ws: XLSX.WorkSheet = XLSX.utils.json_to_sheet(data);
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Datos');
    XLSX.writeFile(wb, 'export.xlsx');
  }

  // =========================
  // Selection
  // =========================
  isAllSelected(): boolean {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }

  masterToggle(): void {
    this.isAllSelected()
      ? this.selection.clear()
      : this.dataSource.data.forEach((row) => this.selection.select(row));
  }

  toggleRow(row: any): void {
    this.selection.toggle(row);
  }

  private pruneSelection(): void {
    // Si la data cambió, quitar de selection los que ya no existen?
    // O mantenerlos? Usually keep unless we re-fetch.
    // Here we just keep standard selection behavior.
  }

  getPagedData(): any[] {
    // Helper for cards view to respect pagination
    if (!this.paginator) return this.dataSource.data;
    const startIndex = this.paginator.pageIndex * this.paginator.pageSize;
    return this.dataSource.data.slice(startIndex, startIndex + this.paginator.pageSize);
  }

  // =========================
  // Persistence
  // =========================
  private saveState(): void {
    if (!this.storageKey) return;
    if (!isPlatformBrowser(this.platformId)) return;

    const state = {
      visibleColumnNames: Array.from(this.visibleColumnNames),
      filterEnabledByCol: this.filterEnabledByCol,
      viewMode: this.viewMode,
      density: this.density
    };

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch (e) {
      console.error('Error saving table state', e);
    }
  }

  private loadState(): void {
    if (!this.storageKey) return;
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return;
      const state = JSON.parse(raw);

      if (state.visibleColumnNames) {
        this.visibleColumnNames = new Set(state.visibleColumnNames);
      }
      if (state.filterEnabledByCol) {
        this.filterEnabledByCol = state.filterEnabledByCol;
      }
      if (state.viewMode) this.viewMode = state.viewMode;
      if (state.density) this.density = state.density;

    } catch (e) {
      console.error('Error loading table state', e);
    }
  }

  // Get date cols for dropdown
  getDateColumns(): ColumnDefinition[] {
    return this.columnDefinitions?.filter(c => c.type === 'date') || [];
  }
}
