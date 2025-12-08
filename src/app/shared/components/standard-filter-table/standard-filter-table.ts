import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ContentChild,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  TemplateRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CdkTableModule } from '@angular/cdk/table';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
} from '@angular/forms';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { Subscription } from 'rxjs';

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
import { MatButtonModule } from '@angular/material/button';

type DateRangeGroup = FormGroup<{
  start: FormControl<Date | null>;
  end: FormControl<Date | null>;
}>;

@Component({
  selector: 'app-standard-filter-table',
  standalone: true,
  templateUrl: './standard-filter-table.html',
  styleUrls: ['./standard-filter-table.css'],
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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StandardFilterTable
  implements OnInit, OnChanges, AfterViewInit, OnDestroy
{
  // =======================
  //  Content projection
  // =======================

  @ContentChild('actionsTemplate')
  actionsTemplate?: TemplateRef<unknown>;

  @ContentChild('attachmentTemplate')
  attachmentTemplate?: TemplateRef<unknown>;

  @ContentChild('semaforoTemplate')
  semaforoTemplate?: TemplateRef<unknown>;

  @ContentChild('estadoTemplate')
  estadoTemplate?: TemplateRef<unknown>;

  // =======================
  //  Inputs de configuración
  // =======================

  @Input() data: any[] = [];
  @Input() columnDefinitions: ColumnDefinition[] = [];
  @Input() pageSizeOptions: number[] = [10, 20, 50];
  @Input() defaultPageSize = 10;
  @Input() tableTitle = 'Tabla de datos';
  @Input() customPdfExport?: () => void;
  @Input() isLoading = false;

  // =======================
  //  Estado interno tabla
  // =======================

  displayedColumns: string[] = [];
  displayedFilterColumns: string[] = [];
  dataSource = new MatTableDataSource<any>([]);

  filterControls: Record<string, FormControl<any>> = {};

  @ViewChild(MatSort) sort?: MatSort;
  @ViewChild(MatPaginator) paginator?: MatPaginator;

  // Rango de fechas global para todas las columnas tipo 'date'
  dateRange: DateRangeGroup = new FormGroup<{
    start: FormControl<Date | null>;
    end: FormControl<Date | null>;
  }>({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  readonly yesNoOptions: string[] = ['Sí', 'No'];

  // Control para mostrar/ocultar filtros en móvil
  showFilters = false;

  // Subscripciones internas
  private subscriptions = new Subscription();

  // ======================================================
  // trackBy
  // ======================================================

  trackByCol = (_: number, c: ColumnDefinition) => c?.name;
  trackByRow = (_: number, row: any) => row?.id ?? JSON.stringify(row);

  // ======================================================
  // Ciclo de vida
  // ======================================================

  ngOnInit(): void {
    this.initializeTable();
    this.setupDateRangeListener();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Cambian las columnas → reconfigura columnas y filtros
    if (changes['columnDefinitions'] && !changes['columnDefinitions'].firstChange) {
      this.rebuildColumnsAndFilters();
    }

    // Cambian los datos → reaplica filtros
    if (changes['data'] && !changes['data'].firstChange) {
      this.dataSource.data = this.data || [];
      this.applyFilters();
      if (this.paginator) {
        this.dataSource.paginator = this.paginator;
      }
    }
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;

      // Accesor de ordenamiento consistente (fecha/number/string)
      this.dataSource.sortingDataAccessor = (item: any, property: string) => {
        const col = this.columnDefinitions.find((c) => c.name === property);
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

        // Default string, case-insensitive
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
  }

  // ======================================================
  // Inicialización / configuración
  // ======================================================

  /** Inicializa columnas, filtros y datasource */
  private initializeTable(): void {
    this.displayedColumns = this.columnDefinitions.map((col) => col.name);
    this.displayedFilterColumns = this.columnDefinitions.map(
      (col) => `${col.name}_filter`,
    );

    this.dataSource.data = this.data || [];

    // Limpiar controles anteriores
    this.filterControls = {};

    // Inicializar controles de filtro
    this.columnDefinitions.forEach((col) => {
      if (col.filterable === false) return;

      if (col.type === 'date') {
        // Los filtros de fecha usan dateRange global; no se crea control por columna
        return;
      }

      const isMultiSelect = col.type === 'select' || col.type === 'status';
      const control = new FormControl<any>(isMultiSelect ? [] : '');

      this.filterControls[col.name] = control;
      this.subscriptions.add(
        control.valueChanges.subscribe(() => this.applyFilters()),
      );
    });
  }

  /** Suscripción única al rango de fechas */
  private setupDateRangeListener(): void {
    this.subscriptions.add(
      this.dateRange.valueChanges.subscribe(() => this.applyFilters()),
    );
  }

  /** Reconstruye columnas y filtros si cambian las definiciones */
  private rebuildColumnsAndFilters(): void {
    // Elimina subscripciones anteriores (controles + dateRange)
    this.subscriptions.unsubscribe();
    this.subscriptions = new Subscription();

    // Reset de rango de fechas sin disparar doble filtro
    this.dateRange.reset(
      { start: null, end: null },
      { emitEvent: false },
    );

    // Reconfigurar tabla y volver a suscribir
    this.initializeTable();
    this.setupDateRangeListener();
    this.applyFilters();
  }

  // ======================================================
  // Filtros
  // ======================================================

  /** Aplica los filtros de cada columna a los datos de entrada */
  applyFilters(): void {
    const sourceData = this.data || [];

    const filtered = sourceData.filter((item) =>
      this.columnDefinitions.every((col) => {
        if (col.filterable === false) return true;

        // Filtro por rango de fechas (global)
        if (col.type === 'date') {
          const start: Date | null = this.dateRange.get('start')?.value ?? null;
          const end: Date | null = this.dateRange.get('end')?.value ?? null;

          const raw = item[col.name];
          const itemDate: Date | null =
            raw instanceof Date ? raw : raw ? new Date(raw) : null;

          // Si no hay fecha en el registro y no hay rango → pasa
          if (!itemDate || isNaN(itemDate.getTime())) {
            return !(start || end);
          }

          if (start && itemDate < start) return false;

          if (end) {
            const inclusiveEnd = new Date(end);
            inclusiveEnd.setHours(23, 59, 59, 999);
            if (itemDate > inclusiveEnd) return false;
          }

          return true;
        }

        // Otros filtros (text, number, select, status, custom)
        const control = this.filterControls[col.name];
        if (!control) return true;

        const filterValue = control.value;
        const itemValue = item[col.name];

        // select múltiple
        if (Array.isArray(filterValue)) {
          return filterValue.length === 0 || filterValue.includes(itemValue);
        }

        if (typeof filterValue === 'string') {
          const needle = filterValue.trim().toLowerCase();
          if (!needle) return true;
          return (itemValue ?? '').toString().toLowerCase().includes(needle);
        }

        if (typeof filterValue === 'number') {
          return itemValue === filterValue;
        }

        return true;
      }),
    );

    this.dataSource.data = filtered;

    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.firstPage();
    }
  }

  /** Limpia todos los filtros */
  clearFilters(): void {
    Object.keys(this.filterControls).forEach((key) => {
      const ctrl = this.filterControls[key];
      if (Array.isArray(ctrl.value)) {
        ctrl.setValue([], { emitEvent: false });
      } else {
        ctrl.setValue('', { emitEvent: false });
      }
    });

    this.dateRange.reset(
      { start: null, end: null },
      { emitEvent: false },
    );

    this.applyFilters();
  }

  /** Devuelve los filtros activos para mostrar tags/chips */
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

  /** Limpia un filtro individual (tag) */
  clearSingleFilter(filter: ActiveFilter): void {
    if (filter.type === 'date') {
      this.dateRange.reset(
        { start: null, end: null },
        { emitEvent: false },
      );
    } else if (this.filterControls[filter.name]) {
      const ctrl = this.filterControls[filter.name];
      if (Array.isArray(ctrl.value)) {
        ctrl.setValue([], { emitEvent: false });
      } else {
        ctrl.setValue('', { emitEvent: false });
      }
    }

    this.applyFilters();
  }

  /** Toggle para mostrar/ocultar filtros en móvil */
  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  // ======================================================
  // Configuración de columnas (status/custom)
  // ======================================================

  private getStatusConfig(
    columnName: string,
  ): Record<string, { color: string; background: string }> {
    const colDef = this.columnDefinitions.find((col) => col.name === columnName);
    return colDef?.statusConfig || {};
  }

  private getCustomClassConfig(
    columnName: string,
  ): Record<string, { color: string; background: string }> {
    const colDef = this.columnDefinitions.find((col) => col.name === columnName);
    return colDef?.customClassConfig || {};
  }

  getStatusStyles(
    columnName: string,
    value: any,
  ): { color?: string; background?: string } {
    const config = this.getStatusConfig(columnName);
    const entry = config ? config[value] : undefined;
    return entry || {};
  }

  getCustomStyles(
    columnName: string,
    value: any,
  ): { color?: string; background?: string } {
    const config = this.getCustomClassConfig(columnName);
    const entry = config ? config[value] : undefined;
    return entry || {};
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
        if (this.customPdfExport) {
          this.customPdfExport();
        } else {
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
    // Exporta los datos filtrados visibles
    const exportData = (this.dataSource.data as any[]).map((row) => {
      const obj: Record<string, any> = {};
      this.columnDefinitions.forEach((col) => {
        let value = row[col.name];

        if (col.type === 'date') {
          const d =
            value instanceof Date ? value : value ? new Date(value) : null;
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

  /** Obtiene los datos paginados para las tarjetas móviles */
  getPagedData(): any[] {
    if (!this.paginator) {
      return this.dataSource.data;
    }

    const startIndex = this.paginator.pageIndex * this.paginator.pageSize;
    const endIndex = startIndex + this.paginator.pageSize;
    return this.dataSource.data.slice(startIndex, endIndex);
  }
}
