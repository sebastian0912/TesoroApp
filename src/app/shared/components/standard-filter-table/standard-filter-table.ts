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
  OnDestroy,
  AfterViewInit,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { CdkTableModule } from '@angular/cdk/table';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

import { InfoVacantesService } from '@/app/features/dashboard/submodule/hiring/service/info-vacantes/info-vacantes.service';

type Align = 'left' | 'center' | 'right';

export interface ColumnDefinition {
  name: string;
  header: string;
  type: 'text' | 'number' | 'date' | 'select' | 'status' | 'custom';
  options?: string[];
  statusConfig?: Record<string, { color: string; background: string }>;
  customClassConfig?: Record<string, { color: string; background: string }>;
  width?: string;           // si se define, se respeta y NO se autosizea
  filterable?: boolean;
  stickyStart?: boolean;
  stickyEnd?: boolean;
  align?: Align;
}

export interface ActiveFilter {
  name: string;
  header: string;
  type: string;
  value: any;
}

@Component({
  selector: 'app-standard-filter-table',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    // Material
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatTooltipModule,
    MatChipsModule,
    // CDK
    CdkTableModule,
  ],
  templateUrl: './standard-filter-table.html',
  styleUrls: ['./standard-filter-table.css'],
})
export class StandardFilterTable implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ContentChild('actionsTemplate', { static: false }) actionsTemplate!: TemplateRef<any>;
  @ContentChild('attachmentTemplate', { static: false }) attachmentTemplate!: TemplateRef<any>;

  @ContentChild('bloqueadoTemplate', { static: false }) bloqueadoTemplate?: TemplateRef<any>;
  @ContentChild('activoTemplate', { static: false }) activoTemplate?: TemplateRef<any>;

  @Input() data: any[] = [];
  @Input() columnDefinitions: ColumnDefinition[] = [];
  @Input() pageSizeOptions: number[] = [10, 20, 50];
  @Input() defaultPageSize = 10;
  @Input() tableTitle = 'Tabla de datos';

  /** Activa el autosize de columnas basado en contenido (por defecto: true) */
  @Input() autoSize = true;

  displayedColumns: string[] = [];
  displayedFilterColumns: string[] = [];
  dataSource = new MatTableDataSource<any>();
  filterControls: { [key: string]: FormControl<any> } = {};

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  /** Ref al <mat-table> para medición de columnas */
  @ViewChild('tableEl', { static: false }) tableEl!: ElementRef<HTMLElement>;

  private infoVacantesService = inject(InfoVacantesService);
  private subs: Array<{ unsubscribe: () => void }> = [];

  /** Conteos */
  totalCount = 0;
  filteredCount = 0;

  /** Anchos calculados por columna (ej: { codigo: '128px' }) */
  computedWidths: Record<string, string> = {};

  /** Timer para debounce del autosize */
  private autosizeTimer: any;

  /** Rango de fechas global */
  dateRange: FormGroup = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  yesNoOptions = ['Sí', 'No'];

  ngOnInit(): void {
    this.initializeTable();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['columnDefinitions']) {
      this.rebuildColumnsAndFilters();
      this.scheduleAutosize();
    }
    if (changes['data']) {
      this.dataSource.data = this.data || [];
      this.totalCount = this.data?.length || 0;
      this.applyFilters();
      if (this.paginator) this.dataSource.paginator = this.paginator;
      this.scheduleAutosize();
    }
  }

  ngAfterViewInit(): void {
    if (this.sort) {
      this.dataSource.sort = this.sort;
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
        return (raw ?? '').toString().toLowerCase();
      };
    }
    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.pageSize = this.defaultPageSize;
    }

    this.scheduleAutosize();
  }

  ngOnDestroy(): void {
    this.clearSubs();
    clearTimeout(this.autosizeTimer);
  }

  /** Recalcular cuando cambia el viewport */
  @HostListener('window:resize')
  onResize() {
    this.scheduleAutosize();
  }

  /** Inicializa columnas, filtros y listeners */
  private initializeTable(): void {
    this.displayedColumns = this.columnDefinitions.map(col => col.name);
    this.displayedFilterColumns = this.columnDefinitions.map(col => col.name + '_filter');
    this.dataSource.data = this.data || [];
    this.totalCount = this.data?.length || 0;
    this.filteredCount = this.totalCount;

    // Limpiar subs previas
    this.clearSubs();
    this.filterControls = {};

    // Date range (único para todas las cols date)
    const dateSub = this.dateRange.valueChanges.subscribe(() => this.applyFilters());
    this.subs.push(dateSub);

    // Controles por columna
    this.columnDefinitions.forEach(col => {
      if (col.filterable === false) return;
      if (col.type !== 'date') {
        const ctrl = new FormControl<any>((col.type === 'select' || col.type === 'status') ? [] : '');
        const s = ctrl.valueChanges.subscribe(() => this.applyFilters());
        this.filterControls[col.name] = ctrl;
        this.subs.push(s);
      }
    });

    this.applyFilters();
  }

  /** Reconstruye columnas y filtros si cambian las definiciones */
  private rebuildColumnsAndFilters(): void {
    // reset de controles existentes
    Object.values(this.filterControls).forEach(ctrl => ctrl.reset(colResetValue(ctrl)));
    this.dateRange.reset({ start: null, end: null });

    // volver a crear estructura
    this.initializeTable();
  }

  /** Aplica los filtros de cada columna */
  applyFilters(): void {
    const filtered = (this.data || []).filter(item => {
      return this.columnDefinitions.every(col => {
        if (col.filterable === false) return true;

        // Rango de fechas (global)
        if (col.type === 'date') {
          const start: Date | null = this.dateRange.get('start')?.value ?? null;
          const end: Date | null = this.dateRange.get('end')?.value ?? null;

          const itemDate: Date | null =
            item[col.name] instanceof Date
              ? item[col.name]
              : item[col.name]
                ? new Date(item[col.name])
                : null;

          if (!itemDate || isNaN(itemDate.getTime())) return !(start || end);

          if (start && itemDate < start) return false;
          if (end) {
            const toEnd = new Date(end);
            toEnd.setHours(23, 59, 59, 999);
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
    this.filteredCount = filtered.length;

    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.firstPage();
    }

    // Recalcular anchos tras cambiar contenido visible
    this.scheduleAutosize();
  }

  /** Limpia todos los filtros */
  clearFilters(): void {
    Object.keys(this.filterControls).forEach(key => {
      const ctrl = this.filterControls[key];
      if (Array.isArray(ctrl.value)) ctrl.setValue([]);
      else ctrl.setValue('');
    });
    this.dateRange.get('start')?.setValue(null);
    this.dateRange.get('end')?.setValue(null);
  }

  getStatusConfig(columnName: string): any {
    const colDef = this.columnDefinitions.find(col => col.name === columnName);
    return colDef ? colDef.statusConfig || {} : {};
  }

  getCustomClassConfig(columnName: string): any {
    const colDef = this.columnDefinitions.find(col => col.name === columnName);
    return colDef ? colDef.customClassConfig || {} : {};
  }

  /** Exportaciones */
  exportTable(format: 'pdf' | 'xml' | 'excel') {
    switch (format) {
      case 'pdf':
        this.exportToPDF();
        break;
      case 'xml':
        this.exportToXML();
        break;
      case 'excel':
        this.exportToExcel();
        break;
    }
  }

  private exportToExcel() {
    const exportData = (this.dataSource.data as any[]).map(row => {
      const obj: any = {};
      this.columnDefinitions.forEach(col => {
        let value = row[col.name];
        if (col.type === 'date') {
          const d = value instanceof Date ? value : value ? new Date(value) : null;
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

  private async exportToPDF() {
    const headers = this.columnDefinitions.map(c => c.header);
    const body = (this.dataSource.data as any[]).map(row =>
      this.columnDefinitions.map(col => {
        const val = row[col.name];
        if (col.type === 'date') {
          const d = val instanceof Date ? val : val ? new Date(val) : null;
          return d && !isNaN(d.getTime()) ? d.toLocaleString() : '';
        }
        return val ?? '';
      })
    );

    const { jsPDF } = await import('jspdf');
    const autoTable = (await import('jspdf-autotable')).default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    doc.setFontSize(12);
    doc.text(this.tableTitle || 'Reporte', 40, 36);

    autoTable(doc, {
      head: [headers],
      body,
      startY: 56,
      styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
      headStyles: { fillColor: [33, 150, 243] },
      didDrawPage: () => {
        const page = `${doc.getNumberOfPages()}`;
        doc.setFontSize(8);
        doc.text(`Página ${page}`, doc.internal.pageSize.getWidth() - 60, doc.internal.pageSize.getHeight() - 20);
      },
    });

    doc.save(`${(this.tableTitle || 'tabla').replace(/\s+/g, '_')}.pdf`);
  }

  private exportToXML() {
    const esc = (s: any) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    const tagName = (t: string) => t.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

    const rows = (this.dataSource.data as any[]).map(row => {
      const fields = this.columnDefinitions
        .map(col => `<${tagName(col.header)}>${esc(formatCell(row[col.name], col.type))}</${tagName(col.header)}>`)
        .join('');
      return `<row>${fields}</row>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<rows>\n${rows.join('\n')}\n</rows>`;
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(this.tableTitle || 'tabla').replace(/\s+/g, '_')}.xml`;
    a.click();
    URL.revokeObjectURL(a.href);

    function formatCell(val: any, type: ColumnDefinition['type']) {
      if (type === 'date') {
        const d = val instanceof Date ? val : val ? new Date(val) : null;
        return d && !isNaN(d.getTime()) ? d.toISOString() : '';
      }
      return val ?? '';
    }
  }

  /** Tags de filtros activos */
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
          (typeof val === 'string' && !!val.trim?.()) ||
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

    // 1) UI inmediata
    this.data = this.data.map(r => (r.id === row.id ? { ...r, detalle: detalleLimpio } : r));
    this.dataSource.data = (this.dataSource.data as any[]).map(r => (r.id === row.id ? { ...r, detalle: detalleLimpio } : r));

    // 2) Persistencia
    this.infoVacantesService.actualizarDetalle(row.id, detalleLimpio).subscribe({
      next: () => Swal.fire('Guardado', 'Detalle actualizado correctamente', 'success'),
      error: () => {
        // 3) Revertir UI si falla
        this.data = this.data.map(r => (r.id === row.id ? { ...r, detalle: prev } : r));
        this.dataSource.data = (this.dataSource.data as any[]).map(r => (r.id === row.id ? { ...r, detalle: prev } : r));
        Swal.fire('Error', 'No se pudo actualizar el detalle', 'error');
      },
    });
  }

  /** ---------------- AUTOSIZE DE COLUMNAS ---------------- */

  /** Programa el autosize (debounce para evitar medir en cada cambio minúsculo) */
  private scheduleAutosize() {
    if (!this.autoSize) return;
    clearTimeout(this.autosizeTimer);
    // Deja que Angular pinte primero
    this.autosizeTimer = setTimeout(() => this.autosizeColumns(), 0);
  }

  /** Mide header + celdas visibles y fija <col> en px (si no hay width definida) */
  /** Mide header + celdas visibles y fija <col> en px/chs.
   *  Si col.width viene definido, se usa como ANCHO EXACTO y no se mide. */
  private autosizeColumns(): void {
    if (!this.autoSize || !this.tableEl) return;

    const table = this.tableEl.nativeElement;
    const newWidths: Record<string, string> = {};
    const PADDING_FALLBACK = 24; // ~12px left + 12px right
    const MAX_CAP = 560;         // anti-outliers
    const MIN_BASE = 72;         // base mínima

    for (const col of this.columnDefinitions) {
      // 1) Si el usuario pasó un ancho (px, ch, rem...), respétalo y sigue
      if (col.width) {
        newWidths[col.name] = col.width;   // <-- se acepta '18ch', '120px', etc.
        continue;
      }

      // 2) Si NO hay width explícito, se mide
      const cls = `.mat-column-${cssEscape(col.name)}`;
      const headerEl =
        table.querySelector<HTMLElement>(`.mat-mdc-header-cell${cls}`) ||
        table.querySelector<HTMLElement>(`.cdk-header-cell${cls}`);

      const cellEls =
        Array.from(table.querySelectorAll<HTMLElement>(`.mat-mdc-cell${cls}`)) ||
        Array.from(table.querySelectorAll<HTMLElement>(`.cdk-cell${cls}`));

      // base mínima (algo mayor si es custom/toggle)
      let measured = (col.name === 'actions' || col.type === 'custom') ? 140 : MIN_BASE;

      // header
      if (headerEl) measured = Math.max(measured, measure(headerEl));

      // sample de filas (hasta 40 para performance)
      const sample = Math.min(cellEls.length, 40);
      for (let i = 0; i < sample; i++) {
        measured = Math.max(measured, measure(cellEls[i]));
      }

      measured = Math.min(measured, MAX_CAP);
      newWidths[col.name] = `${Math.ceil(measured)}px`;
    }

    this.computedWidths = newWidths;

    // --- helpers ---
    function measure(el: HTMLElement): number {
      try {
        const cs = getComputedStyle(el);
        const sw = el.scrollWidth;
        const pl = parseFloat(cs.paddingLeft || '0');
        const pr = parseFloat(cs.paddingRight || '0');
        return sw + pl + pr + 2;
      } catch {
        return el.scrollWidth + PADDING_FALLBACK;
      }
    }
    function cssEscape(s: string): string {
      return s.replace(/[^a-zA-Z0-9_-]/g, (m) => `\\${m}`);
    }
  }


  /** Util */
  private clearSubs() {
    this.subs.forEach(s => s?.unsubscribe?.());
    this.subs = [];
  }
}

/** Helper para resetear controles sin conocer el tipo */
function colResetValue(ctrl: FormControl<any>): any {
  return Array.isArray(ctrl.value) ? [] : '';
}
