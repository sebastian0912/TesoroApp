import { Component, signal, computed, ChangeDetectionStrategy, ChangeDetectorRef, inject, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';

import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import { ContabilidadService } from '../../service/contabilidad.service';

export interface SheetTab {
  name: string;
  columns: ColumnDefinition[];
  data: any[];
  rowCount: number;
  colCount: number;
}

/** Vista del panel consolidado */
type ViewMode = 'consolidado' | 'detalle';

/** Mapeo de hojas a meses consolidados */
const QUINCENA_MAPPING: Record<string, string> = {
  'NM 1Q DE ENERO 2025 G1': 'ENERO',
  'NM 2Q ENERO 2025 G1': 'ENERO',
  'NM 1Q FEBRERO 2025': 'FEBRERO',
  'NM 2Q FEBRERO 2025': 'FEBRERO',
  'NM 1Q MARZO 2025': 'MARZO',
  'NM 2Q MARZO': 'ABRIL',
  'NM 1Q ABRIL G1': 'ABRIL',
  'NM 2Q ABRIL 2025': 'MAYO',
  'NM 1Q MAYO 2025': 'MAYO',
  'NM 2Q MAYO 2025': 'JUNIO',
  'NM 1Q JUNIO 2025': 'JUNIO',
  'NM 2Q JUNIO 2025': 'JULIO',
  'NM 1Q JULIO 2025': 'JULIO',
  'NM 2Q JULIO 2025': 'AGOSTO',
  'NM 1Q AGOSTO 2025': 'AGOSTO',
  'NM 2Q AGOSTO 2025': 'SEPTIEMBRE',
  'NM 1Q SEPTIEMBRE 2025': 'SEPTIEMBRE',
  '2Q SEPTIEMBRE 2025': 'NOVIEMBRE',
  '1Q OCTUBRE 2025': 'NOVIEMBRE',
  '2Q OCTUBRE 2025': 'NOVIEMBRE',
  'INCAPACIDADES PG 2025': 'DICIEMBRE',
};

@Component({
  selector: 'app-quincenas',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatToolbarModule,
    MatChipsModule,
    MatTooltipModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    StandardFilterTable,
  ],
  templateUrl: './quincenas.component.html',
  styleUrls: ['./quincenas.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuincenasComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly contabilidadService = inject(ContabilidadService);

  /** Todas las pestañas parseadas del Excel */
  sheetTabs = signal<SheetTab[]>([]);
  loading = signal(false);
  fileName = signal('');
  activeTabIndex = signal(0);
  totalRows = signal(0);
  totalSheets = signal(0);

  /** Progreso de carga */
  loadProgress = signal(0);
  loadingSheet = signal('');
  sheetsProcessed = signal(0);
  totalSheetsToProcess = signal(0);

  /** Vista actual */
  viewMode = signal<ViewMode>('consolidado');

  /** Opciones de carga */
  tipoCarga = signal<'GENERAL' | 'QUINCENA'>('QUINCENA');
  empresaCarga = signal('');
  periodoCarga = signal('');
  saving = signal(false);

  /** Referencia al mapeo de quincenas */
  readonly quincenaMapping = QUINCENA_MAPPING;

  /** Computed: si ya se cargaron datos */
  hasData = computed(() => this.sheetTabs().length > 0);

  /** Archivo original para enviar al backend */
  private currentFile: File | null = null;

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      Swal.fire('Error', 'Por favor seleccione un archivo Excel (.xlsx o .xls)', 'error');
      return;
    }

    this.currentFile = file;
    this.fileName.set(file.name);
    this.loading.set(true);
    this.loadProgress.set(0);
    this.loadingSheet.set('Leyendo archivo...');
    this.sheetsProcessed.set(0);
    this.cdr.detectChanges();

    const reader = new FileReader();

    reader.onprogress = (e: ProgressEvent<FileReader>) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 30);
        this.ngZone.run(() => {
          this.loadProgress.set(pct);
          this.loadingSheet.set(`Leyendo archivo... ${Math.round((e.loaded / e.total) * 100)}%`);
          this.cdr.detectChanges();
        });
      }
    };

    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.ngZone.run(() => {
        this.loadProgress.set(30);
        this.loadingSheet.set('Parseando Excel...');
        this.cdr.detectChanges();
      });

      setTimeout(() => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          this.processWorkbookProgressively(workbook);
        } catch (err) {
          console.error('Error al procesar el archivo:', err);
          this.ngZone.run(() => {
            this.loading.set(false);
            this.loadProgress.set(0);
            this.cdr.detectChanges();
          });
          Swal.fire('Error', 'No se pudo procesar el archivo Excel.', 'error');
        }
      }, 100);
    };

    reader.onerror = () => {
      this.ngZone.run(() => {
        this.loading.set(false);
        this.loadProgress.set(0);
        this.cdr.detectChanges();
      });
      Swal.fire('Error', 'No se pudo leer el archivo.', 'error');
    };

    // ArrayBuffer es mucho más eficiente que base64 para archivos grandes
    reader.readAsArrayBuffer(file);
  }

  private processWorkbookProgressively(workbook: XLSX.WorkBook): void {
    const sheetNames = workbook.SheetNames;
    const totalSheets = sheetNames.length;
    this.totalSheetsToProcess.set(totalSheets);
    const tabs: SheetTab[] = [];
    let totalRowCount = 0;
    let idx = 0;

    const processNext = () => {
      if (idx >= totalSheets) {
        // Finalizar
        this.ngZone.run(() => {
          this.sheetTabs.set(tabs);
          this.totalRows.set(totalRowCount);
          this.totalSheets.set(tabs.length);
          this.loading.set(false);
          this.loadProgress.set(100);
          this.viewMode.set('consolidado');
          this.cdr.detectChanges();
        });
        Swal.fire({
          icon: 'success',
          title: 'Archivo cargado',
          html: `<b>${tabs.length}</b> hojas y <b>${totalRowCount.toLocaleString()}</b> registros cargados correctamente.`,
          timer: 2500,
          showConfirmButton: false,
        });
        return;
      }

      const sheetName = sheetNames[idx];
      const progress = 30 + Math.round(((idx + 1) / totalSheets) * 70); // 30-100%

      this.ngZone.run(() => {
        this.loadProgress.set(progress);
        this.loadingSheet.set(`Procesando: ${sheetName}`);
        this.sheetsProcessed.set(idx + 1);
        this.cdr.detectChanges();
      });

      try {
        const tab = this.processSheet(workbook, sheetName);
        if (tab) {
          totalRowCount += tab.rowCount;
          tabs.push(tab);
        }
      } catch (err) {
        console.warn(`Error procesando hoja "${sheetName}":`, err);
      }

      idx++;
      // Yield al event loop para permitir que la UI se actualice
      setTimeout(processNext, 0);
    };

    processNext();
  }

  /** Máximo de filas a cargar por hoja para visualización */
  private readonly MAX_ROWS_PER_SHEET = 15000;

  private processSheet(workbook: XLSX.WorkBook, sheetName: string): SheetTab | null {
    const worksheet = workbook.Sheets[sheetName];

    // Usar range limitado para hojas enormes
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    const totalRowsInSheet = range.e.r - range.s.r;
    const limitedRange = totalRowsInSheet > this.MAX_ROWS_PER_SHEET
      ? { ...range, e: { ...range.e, r: range.s.r + this.MAX_ROWS_PER_SHEET } }
      : undefined;

    const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      defval: '',
      blankrows: false,
      range: limitedRange,
    });

    if (jsonData.length < 1) return null;

    const headerRowIndex = this.findHeaderRow(jsonData);
    const headerRow = jsonData[headerRowIndex];
    if (!headerRow) return null;

    const dataRows = jsonData.slice(headerRowIndex + 1);
    const columns = this.buildColumns(headerRow);

    const rows = dataRows
      .filter(row => row.some((cell: any) => cell !== '' && cell !== null && cell !== undefined))
      .map((row, idx) => {
        const obj: any = { _rowIndex: idx + 1 };
        headerRow.forEach((header: any, colIdx: number) => {
          const key = this.sanitizeKey(header, colIdx);
          let value = colIdx < row.length ? row[colIdx] : '';
          if (value instanceof Date) {
            value = this.formatDate(value);
          }
          obj[key] = value;
        });
        return obj;
      });

    const displayName = totalRowsInSheet > this.MAX_ROWS_PER_SHEET
      ? `${sheetName} (${this.MAX_ROWS_PER_SHEET.toLocaleString()} de ${totalRowsInSheet.toLocaleString()})`
      : sheetName;

    return {
      name: displayName,
      columns,
      data: rows,
      rowCount: rows.length,
      colCount: columns.length,
    };
  }

  /** Guardar archivo en el backend */
  async guardarEnBackend(): Promise<void> {
    if (!this.currentFile) {
      Swal.fire('Error', 'No hay archivo para guardar.', 'error');
      return;
    }

    this.saving.set(true);
    this.cdr.detectChanges();

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      const result = await this.contabilidadService.importarExcel(
        this.currentFile,
        this.tipoCarga(),
        this.empresaCarga(),
        this.periodoCarga(),
        undefined,
        user?.nombre || user?.correo_electronico || ''
      );

      Swal.fire({
        icon: 'success',
        title: 'Datos guardados',
        html: `Se guardaron <b>${result.total_hojas}</b> hojas con <b>${result.total_registros.toLocaleString()}</b> registros en la base de datos.`,
        timer: 3000,
        showConfirmButton: false,
      });
    } catch (err: any) {
      const msg = err?.error?.error || 'Error al guardar en el servidor.';
      Swal.fire('Error', msg, 'error');
    } finally {
      this.saving.set(false);
      this.cdr.detectChanges();
    }
  }

  /** Navegar a la pestaña de detalle de una hoja específica */
  goToSheet(index: number): void {
    this.viewMode.set('detalle');
    this.activeTabIndex.set(index);
  }

  switchView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  private findHeaderRow(data: any[][]): number {
    let bestIdx = 0;
    let bestScore = 0;

    const limit = Math.min(5, data.length);
    for (let i = 0; i < limit; i++) {
      const row = data[i];
      const score = row.filter((c: any) => typeof c === 'string' && c.trim().length > 0).length;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private buildColumns(headerRow: any[]): ColumnDefinition[] {
    return headerRow
      .map((header: any, idx: number) => {
        const name = this.sanitizeKey(header, idx);
        const headerText = header ? String(header).trim() : `Col_${idx + 1}`;
        return {
          name,
          header: headerText,
          type: 'text' as const,
          width: this.estimateWidth(headerText),
          filterable: true,
        };
      })
      .filter(col => col.header !== '');
  }

  private sanitizeKey(header: any, idx: number): string {
    if (!header || String(header).trim() === '') return `col_${idx}`;
    return String(header)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñü_]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .substring(0, 50) || `col_${idx}`;
  }

  private estimateWidth(header: string): string {
    const len = header.length;
    if (len <= 6) return '10ch';
    if (len <= 12) return '14ch';
    if (len <= 20) return '20ch';
    if (len <= 30) return '26ch';
    return '32ch';
  }

  private formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  getTabIcon(sheetName: string): string {
    const name = sheetName.toUpperCase();
    if (name.includes('NM') || name.includes('NOMINA')) return 'payments';
    if (name.includes('BON')) return 'card_giftcard';
    if (name.includes('LQ') || name.includes('LIQ')) return 'receipt_long';
    if (name.includes('SS')) return 'security';
    if (name.includes('ALIMENT')) return 'restaurant';
    if (name.includes('TRANSPORT')) return 'directions_bus';
    if (name.includes('FUNERARIO')) return 'church';
    if (name.includes('DEVOL')) return 'undo';
    if (name.includes('CESANT')) return 'savings';
    if (name.includes('RODAMIENTO')) return 'directions_car';
    if (name.includes('EXTRAS')) return 'more_time';
    if (name.includes('PRIMA')) return 'attach_money';
    if (name.includes('VACACION')) return 'beach_access';
    if (name.includes('INCAPAC')) return 'local_hospital';
    if (name.includes('MATERNIDAD')) return 'pregnant_woman';
    if (name.includes('FECHA')) return 'calendar_month';
    if (name.includes('MOV')) return 'swap_horiz';
    if (name.includes('ANALISIS')) return 'analytics';
    return 'table_chart';
  }
}
