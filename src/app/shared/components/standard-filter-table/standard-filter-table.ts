// src/app/shared/components/standard-filter-table/standard-filter-table.ts
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
  EventEmitter,
  Output,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
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
  width?: string;
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
    CdkTableModule,
  ],
  templateUrl: './standard-filter-table.html',
  styleUrls: ['./standard-filter-table.css'],
})
export class StandardFilterTable implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @ContentChild('actionsTemplate', { static: false }) actionsTemplate!: TemplateRef<any>;
  @ContentChild('attachmentTemplate', { static: false }) attachmentTemplate!: TemplateRef<any>;
  @Output() rowClicked = new EventEmitter<any>();

  @ContentChild('bloqueadoTemplate', { static: false }) bloqueadoTemplate?: TemplateRef<any>;
  @ContentChild('activoTemplate', { static: false }) activoTemplate?: TemplateRef<any>;

  @Input() data: any[] = [];
  @Input() columnDefinitions: ColumnDefinition[] = [];
  @Input() pageSizeOptions: number[] = [10, 20, 50];
  @Input() defaultPageSize = 10;
  @Input() tableTitle = 'Tabla de datos';
  @Input() autoSize = true;

  displayedColumns: string[] = [];
  displayedFilterColumns: string[] = [];
  dataSource = new MatTableDataSource<any>();
  filterControls: { [key: string]: FormControl<any> } = {};

  totalCount: number = 0;
  filteredCount: number = 0;

  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild('tableEl', { static: false }) tableEl?: ElementRef<HTMLElement>;

  private infoVacantesService = inject(InfoVacantesService);

  // Plataforma
  private platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private subs: Array<{ unsubscribe: () => void }> = [];

  computedWidths: Record<string, string> = {};
  private autosizeTimer: any;

  dateRange: FormGroup = new FormGroup({
    start: new FormControl<Date | null>(null),
    end: new FormControl<Date | null>(null),
  });

  yesNoOptions = ['Sí', 'No'];

  /** ------------ Helpers seguros para template/export ------------ */
  /** Devuelve una Date válida o null (evita NG02100 en DatePipe). */
  safeDate(value: unknown): Date | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
    const d = new Date(value as any);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Convierte a número o NaN; útil para sorting/control interno. */
  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    const n = Number(value as any);
    return Number.isFinite(n) ? n : NaN;
  }

  // Polyfill rAF SSR-safe
  private raf(cb: () => void): any {
    if (this.isBrowser && typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      return window.requestAnimationFrame(cb);
    }
    return setTimeout(cb, 0);
  }

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
      this.totalCount = Array.isArray(this.data) ? this.data.length : 0;
      this.applyFilters();
      if (this.paginator) this.dataSource.paginator = this.paginator;
      this.scheduleAutosize();
    }
  }

  ngAfterViewInit(): void {
    // No tocar DOM/Material en SSR
    if (!this.isBrowser) return;

    if (this.sort) {
      this.dataSource.sort = this.sort;
      // sortingDataAccessor recomendado para fechas/números
      this.dataSource.sortingDataAccessor = (item: any, property: string) => {
        const col = this.columnDefinitions.find(c => c.name === property);
        const raw = item?.[property];
        if (!col) return raw;
        if (col.type === 'date') {
          const d = this.safeDate(raw);
          return d ? d.getTime() : -Infinity;
        }
        if (col.type === 'number') {
          const n = this.toNumber(raw);
          return Number.isNaN(n) ? -Infinity : n;
        }
        return (raw ?? '').toString().toLowerCase();
      };
      this.subs.push(this.sort.sortChange.subscribe(() => this.scheduleAutosize()));
    }

    if (this.paginator) {
      this.dataSource.paginator = this.paginator;
      this.paginator.pageSize = this.defaultPageSize;
      this.subs.push(this.paginator.page.subscribe(() => this.scheduleAutosize()));
    }

    this.scheduleAutosize();
  }

  ngOnDestroy(): void {
    this.clearSubs();
    clearTimeout(this.autosizeTimer);
  }

  @HostListener('window:resize')
  onResize() {
    this.scheduleAutosize();
  }

  private initializeTable(): void {
    this.displayedColumns = this.columnDefinitions.map(col => col.name);
    this.displayedFilterColumns = this.columnDefinitions.map(col => col.name + '_filter');
    this.dataSource.data = this.data || [];
    this.totalCount = Array.isArray(this.data) ? this.data.length : 0;
    this.filteredCount = this.totalCount; // ✅ antes usabas "filtered" sin definir

    this.clearSubs();
    this.filterControls = {};

    const dateSub = this.dateRange.valueChanges.subscribe(() => this.applyFilters());
    this.subs.push(dateSub);

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

  private rebuildColumnsAndFilters(): void {
    Object.values(this.filterControls).forEach(ctrl => ctrl.reset(colResetValue(ctrl)));
    this.dateRange.reset({ start: null, end: null });
    this.initializeTable();
  }

  applyFilters(): void {
    const filtered = (this.data || []).filter(item => {
      return this.columnDefinitions.every(col => {
        if (col.filterable === false) return true;

        if (col.type === 'date') {
          const start: Date | null = this.dateRange.get('start')?.value ?? null;
          const end: Date | null = this.dateRange.get('end')?.value ?? null;
          const itemDate = this.safeDate(item[col.name]);

          if (!itemDate) return !(start || end);

          if (start && itemDate < start) return false;
          if (end) {
            const toEnd = new Date(end);
            toEnd.setHours(23, 59, 59, 999);
            if (itemDate > toEnd) return false;
          }
          return true;
        }

        const control = this.filterControls[col.name];
        if (!control) return true;

        const filterValue = control.value;
        const itemValue = item[col.name];

        // Select / status (arreglo de opciones)
        if (Array.isArray(filterValue)) {
          return filterValue.length === 0 || filterValue.includes(itemValue);
        }

        // Números: comparar como número si hay filtro
        if (col.type === 'number') {
          if (filterValue === '' || filterValue == null) return true;
          const fv = this.toNumber(filterValue);
          const iv = this.toNumber(itemValue);
          if (Number.isNaN(fv)) return true;
          return iv === fv;
        }

        // Texto: contains case-insensitive
        if (typeof filterValue === 'string') {
          const needle = filterValue.trim().toLowerCase();
          if (!needle) return true;
          return (itemValue ?? '').toString().toLowerCase().includes(needle);
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

    this.scheduleAutosize();
  }

  clearFilters(): void {
    Object.keys(this.filterControls).forEach(key => {
      const ctrl = this.filterControls[key];
      if (Array.isArray(ctrl.value)) ctrl.setValue([]);
      else ctrl.setValue('');
    });
    this.dateRange.get('start')?.setValue(null);
    this.dateRange.get('end')?.setValue(null);
    this.applyFilters(); // ✅ reaplicar
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
      case 'pdf': this.exportToPDF(); break;
      case 'xml': this.exportToXML(); break;
      case 'excel': this.exportToExcel(); break;
    }
  }

  private exportToExcel() {
    const exportData = (this.dataSource.data as any[]).map(row => {
      const obj: any = {};
      this.columnDefinitions.forEach(col => {
        let value = row[col.name];
        if (col.type === 'date') {
          const d = this.safeDate(value);
          value = d ? d.toLocaleString() : '';
        }
        obj[col.header] = value ?? '';
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
          const d = this.safeDate(val);
          return d ? d.toLocaleString() : '';
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
        .map(col => {
          const v = col.type === 'date' ? (this.safeDate(row[col.name])?.toISOString() ?? '') : (row[col.name] ?? '');
          return `<${tagName(col.header)}>${esc(v)}</${tagName(col.header)}>`;
        })
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
  }

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

  clearSingleFilter(filter: ActiveFilter): void {
    if (filter.type === 'date') {
      this.dateRange.reset({ start: null, end: null });
    } else if (this.filterControls[filter.name]) {
      const ctrl = this.filterControls[filter.name];
      if (Array.isArray(ctrl.value)) ctrl.setValue([]);
      else ctrl.setValue('');
    }
    this.applyFilters(); // ✅ reaplicar también aquí
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

    this.data = this.data.map(r => (r.id === row.id ? { ...r, detalle: detalleLimpio } : r));
    this.dataSource.data = (this.dataSource.data as any[]).map(r => (r.id === row.id ? { ...r, detalle: detalleLimpio } : r));

    this.infoVacantesService.actualizarDetalle(row.id, detalleLimpio).subscribe({
      next: () => Swal.fire('Guardado', 'Detalle actualizado correctamente', 'success'),
      error: () => {
        this.data = this.data.map(r => (r.id === row.id ? { ...r, detalle: prev } : r));
        this.dataSource.data = (this.dataSource.data as any[]).map(r => (r.id === row.id ? { ...r, detalle: prev } : r));
        Swal.fire('Error', 'No se pudo actualizar el detalle', 'error');
      },
    });
  }

  /** ---------- AUTOSIZE ---------- */
  private scheduleAutosize() {
    if (!this.autoSize || !this.isBrowser) return;
    clearTimeout(this.autosizeTimer);
    this.autosizeTimer = setTimeout(() => {
      this.raf(() => this.autosizeColumns());
    }, 0);
  }

  private autosizeColumns(): void {
    if (!this.autoSize || !this.isBrowser) return;

    const host = this.tableEl?.nativeElement ?? null;
    if (!host || typeof (host as any).querySelector !== 'function') return;

    const container = host.closest('.table-viewport') as HTMLElement | null;
    const containerWidth = container?.clientWidth || host.clientWidth || 0;

    const PADDING_FALLBACK = 24;
    const MAX_CAP = 560;
    const MIN_BASE = 72;

    const newWidths: Record<string, string> = {};

    const flexCols = this.columnDefinitions.filter(c => !c.width);
    const fixedCols = this.columnDefinitions.filter(c => !!c.width);

    const measuredMap = new Map<string, number>();

    for (const col of flexCols) {
      const cls = `.mat-column-${cssEscape(col.name)}`;

      const headerEl =
        host.querySelector<HTMLElement>(`.mat-mdc-header-cell${cls}, .cdk-header-cell${cls}`);

      const cellEls =
        host.querySelectorAll<HTMLElement>(`.mat-mdc-cell${cls}, .cdk-cell${cls}`);

      let measured = (col.name === 'actions' || col.type === 'custom') ? 140 : MIN_BASE;

      if (headerEl) measured = Math.max(measured, measure(headerEl));

      const sample = Math.min(cellEls.length, 40);
      for (let i = 0; i < sample; i++) {
        measured = Math.max(measured, measure(cellEls[i]));
      }

      measured = Math.min(measured, MAX_CAP);
      measuredMap.set(col.name, measured);
      newWidths[col.name] = `${Math.ceil(measured)}px`;
    }

    for (const col of fixedCols) {
      newWidths[col.name] = col.width as string;
    }

    const fixedTotalPx = fixedCols
      .map(c => toPx(c.width as string, containerWidth))
      .reduce((a, b) => a + b, 0);

    const measuredTotal = Array.from(measuredMap.values()).reduce((a, b) => a + b, 0);

    const scrollbarW = container ? (container.offsetWidth - container.clientWidth) : 0;
    const availableForFlex = Math.max(0, containerWidth - fixedTotalPx - scrollbarW);

    if (availableForFlex > 0 && measuredTotal > 0 && flexCols.length) {
      if (measuredTotal < availableForFlex) {
        const extra = availableForFlex - measuredTotal;
        const perCol = Math.floor(extra / flexCols.length);
        const remainder = extra - perCol * flexCols.length;

        flexCols.forEach((c, i) => {
          const base = measuredMap.get(c.name)!;
          const add = perCol + (i === flexCols.length - 1 ? remainder : 0);
          newWidths[c.name] = `${base + add}px`;
        });
      }
    }

    this.computedWidths = newWidths;

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
    function toPx(value: string, basis: number): number {
      if (!value) return 0;
      const v = String(value).trim();
      if (v.endsWith('px')) return parseFloat(v) || 0;
      if (v.endsWith('%')) return Math.round((parseFloat(v) || 0) * basis / 100);
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 0;
    }
  }

  private clearSubs() {
    this.subs.forEach(s => s?.unsubscribe?.());
    this.subs = [];
  }

  formatInt(value: unknown, locale = 'es-CO'): string {
    const n = typeof value === 'number' ? value : Number(value as any);
    return Number.isFinite(n) ? n.toLocaleString(locale) : '0';
  }

}

/** Helper para resetear controles sin conocer el tipo */
function colResetValue(ctrl: FormControl<any>): any {
  return Array.isArray(ctrl.value) ? [] : '';
}
