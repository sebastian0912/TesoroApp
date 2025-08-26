import {
  Component,
  Input,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  ContentChild,
  TemplateRef,
  inject,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { FormControl, FormGroup } from '@angular/forms';
import * as XLSX from 'xlsx';
import { SharedModule } from '../../shared.module';
import { CdkTableModule } from '@angular/cdk/table';
import Swal from 'sweetalert2';
import { InfoVacantesService } from '@/app/features/dashboard/submodule/hiring/service/info-vacantes/info-vacantes.service';

type Align = 'left' | 'center' | 'right';

export interface ColumnDefinition {
  name: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'select' | 'status' | 'custom';
  options?: string[];
  statusConfig?: Record<string, { color: string; background: string }>;
  customClassConfig?: Record<string, { color: string; background: string }>;
  width?: string;
  filterable?: boolean;
  stickyStart?: boolean;
  stickyEnd?: boolean;
  align?: Align;
}

/** Tipo para tags de filtros activos */
export interface ActiveFilter {
  name: string;
  header: string;
  type: string;
  value: any;
}

@Component({
  selector: 'app-standard-filter-table',
  standalone: true,
  templateUrl: './standard-filter-table.html',
  styleUrls: ['./standard-filter-table.css'],
  imports: [
    SharedModule,
    CdkTableModule
  ],
})
export class StandardFilterTable implements OnInit, OnChanges {
  @ContentChild('actionsTemplate', { static: false })
  actionsTemplate!: TemplateRef<any>;
  @ContentChild('attachmentTemplate', { static: false })
  attachmentTemplate!: TemplateRef<any>;

  @Input() data: any[] = [];
  @Input() columnDefinitions: ColumnDefinition[] = [];
  @Input() pageSizeOptions: number[] = [10, 20, 50];
  @Input() defaultPageSize = 10;
  @Input() tableTitle = 'Tabla de datos';

  displayedColumns: string[] = [];
  displayedFilterColumns: string[] = [];
  dataSource = new MatTableDataSource<any>();
  filterControls: { [key: string]: FormControl<any> } = {};

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  private infoVacantesService = inject(InfoVacantesService);

  // Rango de fechas global para todas las columnas tipo 'date'
  dateRange: FormGroup = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });
  yesNoOptions = ['Sí', 'No'];

  /** trackBy para *ngFor de columnas */
  trackByCol = (_: number, c: ColumnDefinition) => c?.name;

  ngOnInit(): void {
    this.initializeTable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Si cambian las columnas, reconfigura columnas y filtros
    if (changes['columnDefinitions'] && !changes['columnDefinitions'].firstChange) {
      this.rebuildColumnsAndFilters();
    }

    // Si cambian los datos, reaplica filtros
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
        const col = this.columnDefinitions.find(c => c.name === property);
        const raw = item?.[property];

        if (!col) return raw;

        if (col.type === 'date') {
          if (raw instanceof Date) return raw.getTime();
          const d = raw ? new Date(raw) : null;
          return d && !isNaN(d.getTime()) ? d.getTime() : -Infinity;
        }

        if (col.type === 'number') {
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

  /** Inicializa columnas, filtros y listeners */
  private initializeTable(): void {
    this.displayedColumns = this.columnDefinitions.map(col => col.name);
    this.displayedFilterColumns = this.columnDefinitions.map(col => col.name + '_filter');
    this.dataSource.data = this.data || [];

    // Inicializar controles de filtro
    this.filterControls = {};
    this.columnDefinitions.forEach(col => {
      if (col.filterable === false) return;

      if (col.type === 'date') {
        // Un solo rango global (escucha cambios)
        this.dateRange.valueChanges.subscribe(() => this.applyFilters());
      } else {
        this.filterControls[col.name] = new FormControl<any>(
          (col.type === 'select' || col.type === 'status') ? [] : ''
        ); this.filterControls[col.name].valueChanges.subscribe(() => this.applyFilters());
      }
    });
  }

  /** Reconstruye columnas y filtros si cambian las definiciones */
  private rebuildColumnsAndFilters(): void {
    // Reset de filtros
    Object.values(this.filterControls).forEach(ctrl => ctrl.reset(colResetValue(ctrl)));
    this.dateRange.reset({ start: null, end: null });

    // Reinit columnas y controles
    this.initializeTable();
    this.applyFilters();
  }

  /** Aplica los filtros de cada columna */
  applyFilters(): void {
    const filtered = (this.data || []).filter(item => {
      return this.columnDefinitions.every(col => {
        if (col.filterable === false) return true;

        // Filtro por rango de fechas (global)
        if (col.type === 'date') {
          const start: Date | null = this.dateRange.get('start')?.value ?? null;
          const end: Date | null = this.dateRange.get('end')?.value ?? null;

          // Admite Date o string ISO
          const itemDate: Date | null =
            item[col.name] instanceof Date
              ? item[col.name]
              : item[col.name]
                ? new Date(item[col.name])
                : null;

          if (!itemDate || isNaN(itemDate.getTime())) return !(start || end); // sin fecha -> pasa si no hay rango

          if (start && itemDate < start) return false;
          if (end) {
            const toEnd = new Date(end);
            toEnd.setHours(23, 59, 59, 999); // incluye el día completo
            if (itemDate > toEnd) return false;
          }
          return true;
        }

        // Otros filtros
        const control = this.filterControls[col.name];
        if (!control) return true;
        const filterValue = control.value;
        const itemValue = item[col.name];

        if (Array.isArray(filterValue)) {
          // select múltiple
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
      });
    });

    this.dataSource.data = filtered;

    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.firstPage();
    }
  }

  /** Limpia todos los filtros */
  clearFilters(): void {
    Object.keys(this.filterControls).forEach(key => {
      const ctrl = this.filterControls[key];
      if (Array.isArray(ctrl.value)) {
        ctrl.setValue([]);
      } else {
        ctrl.setValue('');
      }
    });
    this.dateRange.get('start')?.setValue(null);
    this.dateRange.get('end')?.setValue(null);
  }

  getColumnType(columnName: string): string {
    const colDef = this.columnDefinitions.find(col => col.name === columnName);
    return colDef ? colDef.type : 'text';
  }

  getStatusConfig(columnName: string): any {
    const colDef = this.columnDefinitions.find(col => col.name === columnName);
    return colDef ? colDef.statusConfig || {} : {};
  }

  getCustomClassConfig(columnName: string): any {
    const colDef = this.columnDefinitions.find(col => col.name === columnName);
    return colDef ? colDef.customClassConfig || {} : {};
  }

  exportTable(format: 'pdf' | 'xml' | 'excel') {
    switch (format) {
      case 'pdf':
        alert('Exportar a PDF no implementado aún.');
        break;
      case 'xml':
        alert('Exportar a XML no implementado aún.');
        break;
      case 'excel':
        this.exportToExcel();
        break;
    }
  }

  exportToExcel() {
    // Exporta los datos filtrados visibles
    const exportData = (this.dataSource.data as any[]).map(row => {
      const obj: any = {};
      this.columnDefinitions.forEach(col => {
        let value = row[col.name];
        if (col.type === 'date') {
          // Asegura formato legible
          const d =
            value instanceof Date ? value : value ? new Date(value) : null;
          value = d && !isNaN(d.getTime()) ? d.toLocaleString() : '';
        }
        obj[col.header] = value;
      });
      return obj;
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(exportData);
    const workbook: XLSX.WorkBook = { Sheets: { Datos: worksheet }, SheetNames: ['Datos'] };
    XLSX.writeFile(workbook, `${this.tableTitle || 'tabla'}.xlsx`);
  }

  /** Devuelve los filtros activos para mostrar tags */
  getActiveFilters(): ActiveFilter[] {
    const filters: ActiveFilter[] = [];
    (this.columnDefinitions || []).forEach((col: ColumnDefinition) => {
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
          (typeof val === 'string' && !!val) ||
          (typeof val === 'number');
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
      this.dateRange.reset({ start: null, end: null });
    } else if (this.filterControls[filter.name]) {
      const ctrl = this.filterControls[filter.name];
      if (Array.isArray(ctrl.value)) ctrl.setValue([]);
      else ctrl.setValue('');
    }
  }

  async editarDetalle(row: any) {
    const { value: nuevoDetalle, isConfirmed } = await Swal.fire<string>({
      title: 'Editar detalle',
      input: 'textarea',
      inputValue: row?.detalle ?? '',
      inputLabel: 'Detalle',
      inputPlaceholder: 'Escribe el detalle…',
      inputAttributes: { maxlength: '5000' },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      allowOutsideClick: () => !Swal.isLoading(),
    });

    if (!isConfirmed || nuevoDetalle == null) return;

    const detalleLimpio = (nuevoDetalle ?? '').trim();
    const prev = row.detalle;

    // 1) UI inmediata: actualiza dataset completo y visible
    this.data = this.data.map(r =>
      r.id === row.id ? { ...r, detalle: detalleLimpio } : r
    );
    this.dataSource.data = (this.dataSource.data as any[]).map(r =>
      r.id === row.id ? { ...r, detalle: detalleLimpio } : r
    );

    // 2) Persistencia en backend
    this.infoVacantesService.actualizarDetalle(row.id, detalleLimpio).subscribe({
      next: () => {
        Swal.fire('Guardado', 'Detalle actualizado correctamente', 'success');
      },
      error: (err) => {
        console.error('Error al actualizar detalle:', err);
        // 3) Revertir UI si falla el backend
        this.data = this.data.map(r =>
          r.id === row.id ? { ...r, detalle: prev } : r
        );
        this.dataSource.data = (this.dataSource.data as any[]).map(r =>
          r.id === row.id ? { ...r, detalle: prev } : r
        );
        Swal.fire('Error', 'No se pudo actualizar el detalle', 'error');
      }
    });
  }



}

/** Helper para resetear controles sin conocer el tipo */
function colResetValue(ctrl: FormControl<any>): any {
  return Array.isArray(ctrl.value) ? [] : '';
}
