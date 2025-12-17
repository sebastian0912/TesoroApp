import { MatButtonModule } from '@angular/material/button';
import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ContentChild,
  ContentChildren,
  QueryList,
  TemplateRef,
  AfterViewInit,
  AfterContentInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import { CdkTableModule } from '@angular/cdk/table';
import Swal from 'sweetalert2';

import { merge, Subscription } from 'rxjs';
import { debounceTime, startWith } from 'rxjs/operators';

import {
  ActiveFilter,
  ColumnDefinition,
} from '../../models/advanced-table-interface';

import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatCommonModule, MatNativeDateModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ColumnCellTemplateDirective } from '../../directives/column-cell-template.directive';


type DateRangeGroup = FormGroup<{
  start: FormControl<Date | null>;
  end: FormControl<Date | null>;
}>;

type StatusStyle = { color: string; background: string };

@Component({
  selector: 'app-standard-filter-table',
  templateUrl: './standard-filter-table.html',
  styleUrl: './standard-filter-table.css',
  imports: [
    CommonModule,
    CdkTableModule,
    MatTableModule,
    MatCommonModule,
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
    ColumnCellTemplateDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandardFilterTable
  implements OnInit, OnChanges, AfterViewInit, AfterContentInit, OnDestroy {
  // Templates de contenido proyectado (los que ya tenías)
  @ContentChild('actionsTemplate') actionsTemplate?: TemplateRef<unknown>;
  @ContentChild('attachmentTemplate') attachmentTemplate?: TemplateRef<unknown>;
  @ContentChild('semaforoTemplate') semaforoTemplate?: TemplateRef<unknown>;
  @ContentChild('estadoTemplate') estadoTemplate?: TemplateRef<unknown>;

  // ✅ Templates genéricos por columna (bloqueado/activo/etc.)
  @ContentChildren(ColumnCellTemplateDirective)
  private columnTemplates?: QueryList<ColumnCellTemplateDirective>;

  private columnTplMap = new Map<string, TemplateRef<any>>();

  // Inputs de configuración
  @Input() data: any[] = [];
  @Input() columnDefinitions: ColumnDefinition[] = [];
  @Input() pageSizeOptions: number[] = [10, 20, 50];
  @Input() defaultPageSize = 10;
  @Input() tableTitle = 'Tabla de datos';
  @Input() customPdfExport?: () => void;
  @Input() isLoading = false;

  /** ✅ Opcional: overlay global con SweetAlert mientras isLoading=true */
  @Input() useSwalLoading = false;

  displayedColumns: string[] = [];
  displayedFilterColumns: string[] = [];
  dataSource = new MatTableDataSource<any>([]);

  filterControls: Record<string, FormControl<any>> = {};

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  // Rango de fechas global para todas las columnas tipo 'date'
  dateRange: DateRangeGroup = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  readonly yesNoOptions: string[] = ['Activo', 'Inactivo'];
  showFilters = false;

  private subscriptions = new Subscription();

  // caches
  private colByName = new Map<string, ColumnDefinition>();
  private statusConfigByCol = new Map<string, Record<string, StatusStyle>>();
  private customConfigByCol = new Map<string, Record<string, StatusStyle>>();

  // trackBy
  trackByCol = (_: number, c: ColumnDefinition) => c?.name;
  trackByRow = (i: number, row: any) =>
    row?.id ?? row?.uuid ?? row?.code ?? row?._id ?? i;

  // ======================================================
  // Ciclo de vida
  // ======================================================
  ngOnInit(): void {
    this.initializeTable();
    this.applyFilters();
  }

  ngAfterContentInit(): void {
    this.rebuildTemplateMap();
    if (this.columnTemplates) {
      this.subscriptions.add(
        this.columnTemplates.changes.subscribe(() => this.rebuildTemplateMap()),
      );
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Swal opcional
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

    if (
      changes['columnDefinitions'] &&
      !changes['columnDefinitions'].firstChange
    ) {
      this.rebuildColumnsAndFilters();
      return;
    }

    if (changes['data'] && !changes['data'].firstChange) {
      this.dataSource.data = this.data || [];
      this.applyFilters();
      if (this.paginator) this.dataSource.paginator = this.paginator;
    }
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;

      // sorting accessor usando cache
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
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.useSwalLoading && Swal.isVisible()) Swal.close();
  }

  // ======================================================
  // ✅ Templates por columna
  // ======================================================
  private rebuildTemplateMap(): void {
    this.columnTplMap.clear();
    (this.columnTemplates?.toArray() ?? []).forEach((t) => {
      if (t.column) this.columnTplMap.set(t.column, t.template);
    });
  }

  /** Usado por el HTML: si existe template para la columna, se renderiza */
  getCellTemplate(columnName: string): TemplateRef<any> | null {
    return this.columnTplMap.get(columnName) ?? null;
  }

  // ======================================================
  // Inicialización / configuración
  // ======================================================
  private initializeTable(): void {
    this.buildColumnCaches();

    this.displayedColumns = (this.columnDefinitions || []).map((col) => col.name);
    this.displayedFilterColumns = (this.columnDefinitions || []).map(
      (col) => `${col.name}_filter`,
    );

    this.dataSource.data = this.data || [];

    // Reset controles + subs (ojo: NO toca el map de templates)
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();
    this.filterControls = {};

    // Crear controles
    (this.columnDefinitions || []).forEach((col) => {
      if (col.filterable === false) return;
      if (col.type === 'date') return; // dateRange global

      const isMultiSelect = col.type === 'select' || col.type === 'status';
      this.filterControls[col.name] = new FormControl<any>(isMultiSelect ? [] : '');
    });

    // Una sola suscripción combinada + debounce
    const streams = [
      this.dateRange.valueChanges.pipe(startWith(this.dateRange.value)),
      ...Object.values(this.filterControls).map((c) =>
        c.valueChanges.pipe(startWith(c.value)),
      ),
    ];

    this.subscriptions.add(
      merge(...streams)
        .pipe(debounceTime(120))
        .subscribe(() => this.applyFilters()),
    );

    // volver a enganchar el changes de templates si ya existe QueryList
    if (this.columnTemplates) {
      this.subscriptions.add(
        this.columnTemplates.changes.subscribe(() => this.rebuildTemplateMap()),
      );
    }
  }

  private rebuildColumnsAndFilters(): void {
    this.dateRange.reset({ start: null, end: null }, { emitEvent: false });
    this.initializeTable();
    this.applyFilters();
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

  // ======================================================
  // Filtros
  // ======================================================
  applyFilters(): void {
    const sourceData = this.data || [];

    const start: Date | null = this.dateRange.get('start')?.value ?? null;
    const end: Date | null = this.dateRange.get('end')?.value ?? null;

    const textFilters: Array<{ name: string; needle: string }> = [];
    const multiFilters: Array<{ name: string; set: Set<any>; isStatus: boolean }> =
      [];

    for (const col of this.columnDefinitions || []) {
      if (col.filterable === false) continue;
      if (col.type === 'date') continue;

      const ctrl = this.filterControls[col.name];
      if (!ctrl) continue;

      const val = ctrl.value;

      if (Array.isArray(val)) {
        if (val.length > 0) {
          multiFilters.push({
            name: col.name,
            set: new Set(val),
            isStatus: col.type === 'status',
          });
        }
        continue;
      }

      if (typeof val === 'string') {
        const needle = val.trim().toLowerCase();
        if (needle) textFilters.push({ name: col.name, needle });
        continue;
      }

      if (typeof val === 'number') {
        multiFilters.push({
          name: col.name,
          set: new Set([val]),
          isStatus: false,
        });
      }
    }

    const hasDateFilter = !!(start || end);
    const dateCols = hasDateFilter
      ? (this.columnDefinitions || []).filter(
        (c) => c.type === 'date' && c.filterable !== false,
      )
      : [];

    const hasAnyFilter =
      textFilters.length > 0 || multiFilters.length > 0 || dateCols.length > 0;

    if (!hasAnyFilter) {
      this.dataSource.data = sourceData;
      return;
    }

    // End inclusivo
    let inclusiveEnd: Date | null = null;
    if (end) {
      inclusiveEnd = new Date(end);
      inclusiveEnd.setHours(23, 59, 59, 999);
    }

    const out: any[] = [];
    for (let i = 0; i < sourceData.length; i++) {
      const item = sourceData[i];

      // text
      let ok = true;
      for (let j = 0; j < textFilters.length; j++) {
        const f = textFilters[j];
        const v = (item?.[f.name] ?? '').toString().toLowerCase();
        if (!v.includes(f.needle)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;

      // multi/status
      for (let j = 0; j < multiFilters.length; j++) {
        const f = multiFilters[j];
        const raw = item?.[f.name];

        if (f.isStatus) {
          const label = this.getStatusLabel(f.name, raw);
          if (!f.set.has(label)) {
            ok = false;
            break;
          }
        } else {
          if (!f.set.has(raw)) {
            ok = false;
            break;
          }
        }
      }
      if (!ok) continue;

      // date
      if (dateCols.length) {
        for (let j = 0; j < dateCols.length; j++) {
          const col = dateCols[j];
          const raw = item?.[col.name];
          const d: Date | null =
            raw instanceof Date ? raw : raw ? new Date(raw) : null;

          if (!d || isNaN(d.getTime())) {
            ok = false;
            break;
          }

          if (start && d < start) {
            ok = false;
            break;
          }

          if (inclusiveEnd && d > inclusiveEnd) {
            ok = false;
            break;
          }
        }
      }

      if (ok) out.push(item);
    }

    this.dataSource.data = out;

    if (this.paginator && this.paginator.pageIndex !== 0) {
      this.paginator.firstPage();
    }
  }

  clearFilters(): void {
    Object.keys(this.filterControls).forEach((key) => {
      const ctrl = this.filterControls[key];
      if (Array.isArray(ctrl.value)) ctrl.setValue([], { emitEvent: false });
      else ctrl.setValue('', { emitEvent: false });
    });

    this.dateRange.reset({ start: null, end: null }, { emitEvent: false });
    this.applyFilters();
  }

  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];

    (this.columnDefinitions || []).forEach((col) => {
      if (col.filterable === false) return;

      if (col.type === 'date') {
        const start = this.dateRange.get('start')?.value;
        const end = this.dateRange.get('end')?.value;
        if (start || end) {
          filters.push({
            name: col.name,
            header: col.header,
            type: 'date',
            value: { from: start, to: end },
          });
        }
      } else if (this.filterControls[col.name]) {
        const val = this.filterControls[col.name].value;
        const hasVal =
          (Array.isArray(val) && val.length > 0) ||
          (typeof val === 'string' && val.trim().length > 0) ||
          typeof val === 'number';

        if (hasVal) {
          filters.push({
            name: col.name,
            header: col.header,
            type: col.type,
            value: val,
          });
        }
      }
    });

    return filters;
  }

  clearSingleFilter(filter: ActiveFilter): void {
    if (filter.type === 'date') {
      this.dateRange.reset({ start: null, end: null }, { emitEvent: false });
    } else if (this.filterControls[filter.name]) {
      const ctrl = this.filterControls[filter.name];
      if (Array.isArray(ctrl.value)) ctrl.setValue([], { emitEvent: false });
      else ctrl.setValue('', { emitEvent: false });
    }
    this.applyFilters();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  // ======================================================
  // Status / custom styles
  // ======================================================
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

  // ======================================================
  // Exportaciones
  // ======================================================
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
    const exportData = (this.dataSource.data as any[]).map((row) => {
      const obj: Record<string, any> = {};
      (this.columnDefinitions || []).forEach((col) => {
        let value = row[col.name];
        if (col.type === 'date') {
          const d = value instanceof Date ? value : value ? new Date(value) : null;
          value = d && !isNaN(d.getTime()) ? d.toLocaleString() : '';
        }
        obj[col.header] = value;
      });
      return obj;
    });

    if (!exportData.length) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin datos para exportar',
        text: 'No hay registros que cumplan los filtros actuales.',
        timer: 2500,
        showConfirmButton: false,
      });
      return;
    }

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const workbook: XLSX.WorkBook = {
      Sheets: { Datos: worksheet },
      SheetNames: ['Datos'],
    };

    const fileName = `${this.tableTitle || 'tabla'}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    Swal.fire({
      icon: 'success',
      title: 'Exportación completada',
      text: `Se ha generado el archivo ${fileName} con los registros filtrados.`,
      timer: 2500,
      showConfirmButton: false,
    });
  }

  // ======================================================
  // Paginación (vista móvil)
  // ======================================================
  getPagedData(): any[] {
    if (!this.paginator) return this.dataSource.data;
    const startIndex = this.paginator.pageIndex * this.paginator.pageSize;
    const endIndex = startIndex + this.paginator.pageSize;
    return this.dataSource.data.slice(startIndex, endIndex);
  }
}
