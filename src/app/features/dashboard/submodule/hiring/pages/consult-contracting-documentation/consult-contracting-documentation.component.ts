import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  OnInit,
  inject,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import Swal from 'sweetalert2';
import { finalize, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { SharedModule } from '@/app/shared/shared.module';
import { MatButtonModule } from '@angular/material/button';

import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { OrdenUnionDialogComponent } from '../../components/orden-union-dialog/orden-union-dialog.component';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

// ✅ NUEVO (tablas pendientes)
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';
import {
  RobotsService,
  PendientesResumenResponse,
  PendientesPorOficinaResponse,
} from '../../../robots/services/robots/robots.service';

/** Doc serializado (lo que devuelve el backend por cada tipo) */
type DocCell = {
  exists: boolean;
  url?: string;
  uploaded_at?: string; // ISO
};

/** Fila de la tabla */
type Row = {
  cedula: string;
  tipo_documento?: string | null;
  nombre?: string | null;
  finca?: string | null;
  fecha_ingreso?: string | Date | null;
  codigo_contrato?: string | null;
  fecha_contratacion?: string | Date | null;
  /** Mapa type_id -> DocCell */
  docs: Record<number, DocCell>;
};

type TipoHeader = { id: number; name: string };

type ChecklistDocDto = {
  type_id: number;
  doc: null | { file_url?: string; uploaded_at?: string };
};

type ChecklistItemDto = {
  cedula: string;
  tipo_documento?: string | null;
  nombre_completo?: string | null;
  finca?: string | null;
  fecha_ingreso?: string | null;
  codigo_contrato?: string | null;
  fecha_contratacion?: string | null;
  docs?: ChecklistDocDto[];
};

type ChecklistResponseDto = {
  tipos?: TipoHeader[];
  items?: ChecklistItemDto[];
  invalidCedulas?: string[];
  duplicatesRemoved?: number;
  totalReceived?: number;
};

// =========================
// ✅ NUEVO: PENDIENTES (PIVOT)
// =========================
type PivotEstado = 'SIN_CONSULTAR' | 'EN_PROGRESO' | 'PENDIENTES';

type PendientesResumenPivotRow = {
  label: string;
  SIN_CONSULTAR: number;
  EN_PROGRESO: number;
  PENDIENTES: number;
};

type PendientesPorOficinaPivotRow = {
  estado: PivotEstado;
  [key: string]: any; // of_* => number
};

@Component({
  selector: 'app-consult-contracting-documentation',
  standalone: true,
  imports: [CommonModule, SharedModule, MatButtonModule, MatDialogModule],
  templateUrl: './consult-contracting-documentation.component.html',
  styleUrls: ['./consult-contracting-documentation.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultContractingDocumentationComponent implements OnInit {
  // inyección moderna
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly gestionDocumentalService = inject(GestionDocumentalService);
  private readonly dialog = inject(MatDialog);
  private readonly utilityService = inject(UtilityServiceService);

  // ✅ NUEVO
  private readonly robotsService = inject(RobotsService);

  // --------- Ajustes para masivo ----------
  private readonly MAX_POST_BATCH = 1500;

  /** token para ignorar respuestas viejas (cuando el usuario pega otra lista) */
  private requestToken = 0;

  // --------- UI / estado ----------
  cedulaControl = new FormControl<string>('', { nonNullable: true });
  user: any;

  // --------- columnas dinámicas ----------
  /** Tipos que devuelve el backend, en orden */
  tipoHeaders: TipoHeader[] = [];
  /** Claves de columnas para Material Table */
  tipoColumnKeys: string[] = [];

  // --------- tabla ----------
  dataSource = new MatTableDataSource<Row>([]);
  displayedColumns: string[] = [];

  private readonly baseColumns: string[] = [
    'cedula',
    'tipo_documento',
    'nombre',
    'finca',
    'fecha_ingreso',
    'codigo_contrato',
    'fecha_contratacion',
  ];

  // =========================
  // ✅ NUEVO: TABLAS PENDIENTES
  // =========================
  isLoadingPendientesResumen = false;
  pendientesResumenRows: PendientesResumenPivotRow[] = [];
  pendientesResumenColumns: ColumnDefinition[] = [];

  isLoadingPendientesPorOficina = false;
  pendientesPorOficinaRows: PendientesPorOficinaPivotRow[] = [];
  pendientesPorOficinaColumns: ColumnDefinition[] = [];

  pendientesRowsWithAnyPending = 0;
  pendientesDistinctCedulasWithAnyPending = 0;

  // =========================
  // ✅ NUEVO: abreviador de headers Excel
  // =========================
  private readonly DOC_ABBR: Record<string, string> = {
    Procuraduria: 'Proc',
    Procuraduría: 'Proc',
    Contraloria: 'Contra',
    Contraloría: 'Contra',
    Policivo: 'Pol',
    SISBEN: 'Sis',
    Sisben: 'Sis',
    OFAC: 'OFAC',
    Fondo: 'Fondo',
    Adress: 'Dir',
    Address: 'Dir',
    Direccion: 'Dir',
    Dirección: 'Dir',
  };

  constructor() {
    // al destruir el componente, invalida cualquier request en curso
    this.destroyRef.onDestroy(() => {
      this.requestToken++;
    });
  }

  ngOnInit(): void {
    this.user = this.utilityService.getUser();

    this.resetTabla();

    // ✅ filtro eficiente
    this.dataSource.filterPredicate = (row, filter) => {
      const f = (filter ?? '').trim().toLowerCase();
      if (!f) return true;

      return (
        (row.cedula ?? '').toLowerCase().includes(f) ||
        (row.tipo_documento ?? '').toLowerCase().includes(f) ||
        (row.nombre ?? '').toLowerCase().includes(f) ||
        (row.finca ?? '').toLowerCase().includes(f) ||
        (row.codigo_contrato ?? '').toLowerCase().includes(f)
      );
    };

    // ✅ NUEVO
    this.buildPendientesColumnsBase();
    void this.loadPendientesWithSwal();

    this.cdr.markForCheck();
  }

  // ✅ Fix para *ngFor trackBy
  trackByTipo = (_: number, t: TipoHeader) => t.id;

  /** ---------- BÚSQUEDA INDIVIDUAL ---------- */
  buscarPorCedula(): void {
    const cedula = (this.cedulaControl.value ?? '').trim();
    if (!cedula) {
      Swal.fire({ icon: 'warning', title: 'Cédula vacía', text: 'Ingrese una cédula.' });
      return;
    }
    this.procesarCedulasPegadas(cedula);
  }

  /** ---------- PEGAR LISTA DIRECTO EN TABLA ---------- */
  onTablePaste(evt: ClipboardEvent): void {
    const txt = evt.clipboardData?.getData('text') ?? '';
    if (!txt) return;

    evt.preventDefault();

    if (/[\s,\t\r\n;]/.test(txt)) {
      this.procesarCedulasPegadas(txt);
    } else {
      this.cedulaControl.setValue(txt.trim());
      this.buscarPorCedula();
    }
  }

  /** ---------- PROCESAMIENTO MASIVO (5.000+) ---------- */
  procesarCedulasPegadas(texto: string): void {
    void this.procesarCedulasPegadasAsync(texto);
  }

  private async procesarCedulasPegadasAsync(texto: string): Promise<void> {
    const token = ++this.requestToken;

    this.resetTabla();
    this.cdr.markForCheck();

    const parsed = this.parseCedulasBulk(texto);

    if (!parsed.cedulas.length) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No se detectaron cédulas válidas.' });
      return;
    }

    Swal.fire({
      icon: 'info',
      title: 'Consultando información...',
      text: `Cédulas únicas: ${parsed.cedulas.length}`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const resp = await this.fetchChecklistPostBatched(parsed.cedulas, token);

      if (token !== this.requestToken) return;

      // headers dinámicos
      this.tipoHeaders = Array.isArray(resp?.tipos) ? resp.tipos : [];
      this.tipoColumnKeys = this.tipoHeaders.map(t => `type_${t.id}`);
      this.displayedColumns = [...this.baseColumns, ...this.tipoColumnKeys];

      // filas
      const rows: Row[] = (resp?.items ?? []).map((it: ChecklistItemDto) => {
        const docsMap: Record<number, DocCell> = {};
        const docsArr: ChecklistDocDto[] = Array.isArray(it?.docs) ? it.docs : [];

        for (const d of docsArr) {
          const tid = Number(d?.type_id);
          if (!Number.isFinite(tid)) continue;

          const dd = d?.doc;
          docsMap[tid] = {
            exists: !!dd,
            url: dd?.file_url,
            uploaded_at: dd?.uploaded_at,
          };
        }

        return {
          cedula: String(it?.cedula ?? ''),
          tipo_documento: it?.tipo_documento ?? '',
          nombre: it?.nombre_completo ?? '',
          finca: it?.finca ?? '',
          fecha_ingreso: it?.fecha_ingreso ?? '',
          codigo_contrato: it?.codigo_contrato ?? '',
          fecha_contratacion: it?.fecha_contratacion ?? '',
          docs: docsMap,
        };
      });

      this.dataSource.data = rows;

      Swal.close();
      this.cdr.markForCheck();
    } catch (e) {
      if (token !== this.requestToken) return;
      console.error(e);
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un problema consultando datos.' });
    }
  }

  /**
   * ✅ Usa POST siempre. Si son demasiadas, parte en lotes.
   */
  private async fetchChecklistPostBatched(
    cedulas: string[],
    token: number,
  ): Promise<ChecklistResponseDto> {
    if (cedulas.length <= this.MAX_POST_BATCH) {
      return await firstValueFrom(this.gestionDocumentalService.getDocumentosChecklist(cedulas));
    }

    const chunks = this.chunkArray(cedulas, this.MAX_POST_BATCH);

    const merged: ChecklistResponseDto = {
      tipos: [],
      items: [],
      totalReceived: cedulas.length,
      duplicatesRemoved: 0,
      invalidCedulas: [],
    };

    for (let i = 0; i < chunks.length; i++) {
      if (token !== this.requestToken) {
        throw new DOMException('Aborted', 'AbortError');
      }

      Swal.update({
        text: `Consultando lote ${i + 1} de ${chunks.length} (${chunks[i].length} cédulas)`,
      });

      const part = await firstValueFrom(this.gestionDocumentalService.getDocumentosChecklist(chunks[i]));

      if (!merged.tipos?.length && Array.isArray(part?.tipos)) merged.tipos = part.tipos;
      if (Array.isArray(part?.items)) (merged.items as ChecklistItemDto[]).push(...part.items);

      if (Array.isArray(part?.invalidCedulas) && part.invalidCedulas.length) {
        merged.invalidCedulas = [...(merged.invalidCedulas ?? []), ...part.invalidCedulas];
      }

      merged.duplicatesRemoved = Number(merged.duplicatesRemoved ?? 0) + Number(part?.duplicatesRemoved ?? 0);
      merged.totalReceived = Number(merged.totalReceived ?? cedulas.length);
    }

    return merged;
  }

  /** Parseo masivo: dedupe estable + normaliza + detecta inválidas */
  private parseCedulasBulk(texto: string) {
    const tokens = String(texto ?? '').split(/[\s,;\t\r\n]+/g);

    const seen = new Set<string>();
    const cedulas: string[] = [];
    const invalid: string[] = [];

    let totalReceived = 0;
    let duplicatesRemoved = 0;

    for (const raw of tokens) {
      const s = (raw ?? '').trim();
      if (!s) continue;

      totalReceived++;

      // normaliza (solo dígitos)
      const digits = s.replace(/\D+/g, '');

      // regla simple
      if (digits.length < 6 || digits.length > 15) {
        invalid.push(s);
        continue;
      }

      if (seen.has(digits)) {
        duplicatesRemoved++;
        continue;
      }

      seen.add(digits);
      cedulas.push(digits);
    }

    return { cedulas, invalid, duplicatesRemoved, totalReceived };
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private resetTabla(): void {
    this.dataSource.data = [];
    this.tipoHeaders = [];
    this.tipoColumnKeys = [];
    this.displayedColumns = [...this.baseColumns];
  }

  /** ---------- FILTRO DE TABLA ---------- */
  applyFilters(ev: Event): void {
    this.dataSource.filter = (ev.target as HTMLInputElement).value.trim().toLowerCase();
    this.cdr.markForCheck();
  }

  limpiarTabla(): void {
    this.requestToken++;
    this.resetTabla();
    this.cedulaControl.setValue('');
    this.cdr.markForCheck();
  }

  /** ---------- ZIP DE ARCHIVOS ---------- */
  descargarZip(): void {
    if (!this.dataSource.data?.length) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'Primero realiza una consulta.' });
      return;
    }
    if (!this.tipoHeaders?.length) {
      Swal.fire({ icon: 'info', title: 'Tipos no cargados', text: 'No se detectaron tipos documentales.' });
      return;
    }

    Swal.fire({
      title: '¿Deseas descargar los archivos PDF?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, por favor',
      cancelButtonText: 'No',
    }).then(r => r.isConfirmed && this.abrirDialogOrden());
  }

  abrirDialogOrden(): void {
    const antecedentes = this.tipoHeaders.map(t => ({
      id: t.id,
      name: t.name?.toUpperCase?.() || String(t.name),
    }));

    if (!antecedentes.length) {
      Swal.fire({ icon: 'info', title: 'Sin tipos disponibles', text: 'No hay tipos para ordenar.' });
      return;
    }

    this.dialog
      .open(OrdenUnionDialogComponent, {
        panelClass: 'orden-union-dialog-panel',
        minWidth: '500pt',
        height: '90vh',
        maxHeight: '90vh',
        autoFocus: false,
        restoreFocus: false,
        data: { antecedentes },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orden: number[] | null) => orden && this.descargarZipConUnion(orden));
  }

  descargarZipConUnion(ordenSeleccionado: Array<number | string>): void {
    const cedulasStr = this.dataSource.data.filter(r => r.cedula).map(r => r.cedula);

    const cedulasNum = cedulasStr.map(c => Number(c)).filter(n => Number.isFinite(n));

    const noNumericas = cedulasStr.length - cedulasNum.length;
    if (noNumericas > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cédulas no numéricas',
        text: `Se omitieron ${noNumericas} cédula(s) con formato no numérico.`,
      });
    }

    const ordenNums = (ordenSeleccionado ?? [])
      .map(v => (typeof v === 'string' ? Number(v) : v))
      .filter(n => Number.isFinite(n));

    if (!cedulasNum.length || !ordenNums.length) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'Verifica cédulas y orden seleccionado.' });
      return;
    }

    Swal.fire({
      title: 'Preparando descarga...',
      text: 'Esto puede tardar unos segundos',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.gestionDocumentalService
      .descargarZipPorCedulasYOrden(cedulasNum, ordenNums)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => Swal.close()),
      )
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `documentos_union_${new Date().toISOString()}.slice(0, 19).replace(/[:T]/g, '-')}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar el archivo.' }),
      });
  }

  // ---------- Util ----------
  private parseFecha(fecha: string | Date | null | undefined): Date | null {
    if (!fecha) return null;
    if (fecha instanceof Date) return isNaN(fecha.getTime()) ? null : fecha;

    const s0 = String(fecha).trim();

    // dd/mm/yyyy
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const m = ddmmyyyy.exec(s0);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

    // ✅ Normaliza ISO con microsegundos: .824286 -> .824
    const s = s0.replace(/(\.\d{3})\d+(?=[Z+-])/, '$1');

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  private abbrDoc(name: string, max = 8): string {
    const mapped = this.DOC_ABBR[name];
    if (mapped) return mapped;
    const s = String(name ?? '').trim();
    return s.length <= max ? s : s.slice(0, max - 1) + '…';
  }

  // ---------- EXCEL (faltantes) ----------

  async exportarExcelFaltantes(): Promise<void> {
    const data = this.dataSource.data ?? [];
    if (!data.length) {
      Swal.fire('Sin datos', 'No hay registros para exportar.', 'info');
      return;
    }

    const excelMod: any = await import('exceljs');

    // ✅ Robustez contra "Workbook is not a constructor"
    const WorkbookCtor = excelMod?.Workbook ?? excelMod?.default?.Workbook ?? excelMod?.default;

    if (!WorkbookCtor) {
      Swal.fire('Error', 'No se pudo cargar ExcelJS (Workbook). Revisa la instalación/import.', 'error');
      return;
    }

    // ✅ Vigente si uploaded_at está dentro de los últimos 15 días
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 15);

    const wb = new WorkbookCtor();
    wb.creator = 'TuAlianza';
    wb.created = new Date();

    const ws = wb.addWorksheet('Faltantes', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // ✅ headers cortos + columnas compactas
    const baseCols = [
      { header: 'Céd.', key: 'cedula', width: 12 },
      { header: 'T.Doc', key: 'tipo_documento', width: 10 },
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Finca', key: 'finca', width: 14 },
      { header: 'F.Ing', key: 'fecha_ingreso', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
      { header: 'Cod.Cto', key: 'codigo_contrato', width: 12 },
    ];

    const tipoCols = this.tipoHeaders.flatMap(t => {
      const n = this.abbrDoc(t.name);
      return [
        { header: n, key: `t_${t.id}_estado`, width: 4 }, // ✓ ✗ ⚠
        { header: `F.${n}`, key: `t_${t.id}_fecha`, width: 16, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
        { header: `L.${n}`, key: `t_${t.id}_link`, width: 6 }, // Abrir
      ];
    });

    ws.columns = [...baseCols, ...tipoCols];

    const header = ws.getRow(1);
    header.height = 26;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    header.eachCell((cell: any) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
    });

    const green = { argb: 'FF2E7D32' };
    const red = { argb: 'FFC62828' };
    const amber = { argb: 'FFF59E0B' };
    const linkBlue = { argb: 'FF2563EB' };

    for (const item of data) {
      const fechaIngreso = this.parseFecha(item.fecha_ingreso as any);
      const fechaContratacion = this.parseFecha(item.fecha_contratacion as any);

      const rowData: any = {
        cedula: item.cedula ?? '',
        tipo_documento: item.tipo_documento ?? '',
        nombre: item.nombre ?? '',
        finca: item.finca ?? '',
        fecha_ingreso: fechaIngreso ?? '',
        codigo_contrato: item.codigo_contrato ?? '',
        fecha_contratacion: fechaContratacion ?? '',
      };

      this.tipoHeaders.forEach(t => {
        const doc = item.docs?.[t.id];
        const exists = !!doc?.exists;

        const uploadedAt = this.parseFecha(doc?.uploaded_at as any);
        const vigente15d = exists && !!uploadedAt && uploadedAt.getTime() >= cutoff.getTime();

        rowData[`t_${t.id}_estado`] = !exists ? '✗' : vigente15d ? '✓' : '⚠';
        rowData[`t_${t.id}_fecha`] = uploadedAt ?? (doc?.uploaded_at ?? '');
        rowData[`t_${t.id}_link`] = exists && doc?.url ? { text: 'Abrir', hyperlink: String(doc.url) } : '';
      });

      const row = ws.addRow(rowData);

      if (row.number % 2 === 0) {
        row.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }

      this.tipoHeaders.forEach(t => {
        const estadoCell = row.getCell(`t_${t.id}_estado`);
        const fechaCell = row.getCell(`t_${t.id}_fecha`);
        const linkCell = row.getCell(`t_${t.id}_link`);

        const v = String(estadoCell.value ?? '');
        estadoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        estadoCell.font = {
          name: 'Segoe UI Symbol',
          bold: true,
          color: v === '✓' ? green : v === '⚠' ? amber : red,
        };

        fechaCell.alignment = { vertical: 'middle', horizontal: 'center' };

        linkCell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (linkCell.value && typeof linkCell.value === 'object') {
          linkCell.font = { color: linkBlue, underline: true };
        }
      });
    }

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columnCount },
    };

    // ✅ bordes finos + header borde superior
    const lastRow = ws.lastRow?.number ?? 1;
    for (let r = 1; r <= lastRow; r++) {
      for (let c = 1; c <= ws.columnCount; c++) {
        const cell = ws.getRow(r).getCell(c);
        cell.border = {
          top: cell.border?.top ?? (r === 1 ? { style: 'thin', color: { argb: 'FF9CA3AF' } } : undefined),
          bottom: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          left: { style: 'hair', color: { argb: 'FFE5E7EB' } },
          right: { style: 'hair', color: { argb: 'FFE5E7EB' } },
        };
      }
    }

    // ✅ autofit con tope (evita columnas eternas)
    const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

    ws.columns?.forEach((col: any) => {
      const key = String(col?.key ?? '');

      const isDate =
        key === 'fecha_ingreso' ||
        key === 'fecha_contratacion' ||
        key.endsWith('_fecha');

      const isEstado = key.endsWith('_estado');
      const isLink = key.endsWith('_link');

      if (isEstado) {
        col.width = 4;
        return;
      }
      if (isLink) {
        col.width = 6;
        return;
      }
      if (isDate) {
        col.width = key.endsWith('_fecha') ? 16 : 12;
        return;
      }

      let maxLen = String(col.header ?? '').length;
      col.eachCell({ includeEmpty: true }, (cell: any) => {
        let v = cell?.value;
        if (!v) return;
        if (typeof v === 'object' && v.text) v = v.text;
        const len = String(v).length;
        if (len > maxLen) maxLen = len;
      });

      col.width = clamp(maxLen + 2, 8, 24);
    });

    const blob = new Blob([await wb.xlsx.writeBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const today = new Date().toISOString().slice(0, 10);
    saveAs(blob, `faltantes_${today}.xlsx`);
  }

  // ---------- EXCEL (auditoría dinámica) ----------
  verReporteAuditoria(): void {
    const data = this.dataSource.data ?? [];
    if (!data.length) {
      Swal.fire('Sin datos', 'No hay registros para exportar.', 'info');
      return;
    }

    const toDateVal = (v: any): Date | '' => {
      const d = this.parseFecha(v);
      return d ? d : '';
    };

    // ✅ headers cortos
    const baseHeaders = ['Céd.', 'T.Doc', 'Nombre', 'Finca', 'F.Ing', 'Cod.Cto', 'F.Cto'];

    const dynHeaders: string[] = [];
    this.tipoHeaders.forEach(t => {
      const n = this.abbrDoc(t.name);
      dynHeaders.push(n);       // Ver
      dynHeaders.push(`F.${n}`); // Fecha
    });

    const headers = [...baseHeaders, ...dynHeaders];
    const aoa: any[][] = [headers];

    for (const r of data) {
      const row: any[] = [
        r.cedula ?? '',
        r.tipo_documento ?? '',
        r.nombre ?? '',
        r.finca ?? '',
        toDateVal(r.fecha_ingreso),
        r.codigo_contrato ?? '',
        toDateVal(r.fecha_contratacion),
      ];

      this.tipoHeaders.forEach(t => {
        const cell = r.docs?.[t.id];
        const linkText = cell?.exists && cell.url ? 'Ver' : '';
        const dateVal = cell?.uploaded_at ? toDateVal(cell.uploaded_at) : '';

        row.push(linkText);
        row.push(dateVal);
      });

      aoa.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    const endCol = headers.length - 1;
    const endRow = aoa.length - 1;
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: endRow, c: endCol } }),
    };

    const baseCols = baseHeaders.length;
    for (let rIdx = 1; rIdx < aoa.length; rIdx++) {
      this.tipoHeaders.forEach((t, i) => {
        const linkColIdx = baseCols + i * 2;
        const cellAddr = XLSX.utils.encode_cell({ r: rIdx, c: linkColIdx });
        const cell = ws[cellAddr];
        const url = this.dataSource.data[rIdx - 1]?.docs?.[t.id]?.url;

        if (cell && url) {
          cell.t = 's';
          cell.v = 'Ver';
          (cell as any).l = { Target: String(url) };
        }
      });
    }

    const setDateFormat = (rowIdx: number, colIdx: number) => {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      const c = ws[addr];
      if (c && c.v instanceof Date) {
        c.t = 'd';
        c.z = 'yyyy-mm-dd';
      }
    };

    for (let rIdx = 1; rIdx < aoa.length; rIdx++) {
      setDateFormat(rIdx, 4);
      setDateFormat(rIdx, 6);

      this.tipoHeaders.forEach((_, i) => {
        const dateColIdx = baseCols + i * 2 + 1;
        setDateFormat(rIdx, dateColIdx);
      });
    }

    const computeWch = (colIndex: number): number => {
      const headerLen = String(headers[colIndex] ?? '').length;
      let maxLen = headerLen;
      for (let r = 1; r < aoa.length; r++) {
        const val = aoa[r][colIndex];
        const length = val instanceof Date ? 10 : val ? String(val).length : 0;
        if (length > maxLen) maxLen = length;
      }
      // ✅ más compacto
      return Math.max(8, Math.min(24, maxLen + 2));
    };

    ws['!cols'] = headers.map((_, c) => ({ wch: computeWch(c) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    XLSX.writeFile(wb, `reporte_auditoria_${yyyy}-${mm}-${dd}.xlsx`);
  }

  // =====================================================================
  // ✅ NUEVO: PENDIENTES (RESUMEN + POR OFICINA)
  // =====================================================================

  reloadPendientes(): void {
    void this.loadPendientesWithSwal();
  }

  private async loadPendientesWithSwal(): Promise<void> {
    Swal.fire({
      icon: 'info',
      title: 'Cargando pendientes...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    const results = await Promise.allSettled([
      this.loadPendientesResumen(true),
      this.loadPendientesPorOficina(true),
    ]);

    Swal.close();

    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed > 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Carga incompleta',
        text: `Se cargaron algunos datos, pero ${failed} sección(es) fallaron.`,
      });
    }

    this.cdr.markForCheck();
  }

  private buildPendientesColumnsBase(): void {
    this.pendientesResumenColumns = [
      { name: 'label', header: 'Cantidades', type: 'text' as const, width: '220px', filterable: false, sortable: false },
      { name: 'SIN_CONSULTAR', header: 'SIN_CONSULTAR', type: 'number' as const, width: '160px' },
      { name: 'EN_PROGRESO', header: 'EN_PROGRESO', type: 'number' as const, width: '160px' },
      { name: 'PENDIENTES', header: 'PENDIENTES', type: 'number' as const, width: '140px' },
    ];

    this.pendientesPorOficinaColumns = [
      { name: 'estado', header: 'Estado', type: 'text' as const, width: '180px' },
    ];
  }

  private async loadPendientesResumen(silent = false): Promise<void> {
    this.isLoadingPendientesResumen = true;
    try {
      const resp: PendientesResumenResponse = await firstValueFrom(this.robotsService.getPendientesResumen());

      this.pendientesRowsWithAnyPending = Number(resp?.rowsWithAnyPending ?? 0);
      this.pendientesDistinctCedulasWithAnyPending = Number(resp?.distinctCedulasWithAnyPending ?? 0);

      const t = resp?.totalsByModuleSum ?? { SIN_CONSULTAR: 0, EN_PROGRESO: 0, PENDIENTES: 0 };

      this.pendientesResumenRows = [
        {
          label: 'Cantidades',
          SIN_CONSULTAR: Number(t.SIN_CONSULTAR ?? 0),
          EN_PROGRESO: Number(t.EN_PROGRESO ?? 0),
          PENDIENTES: Number(t.PENDIENTES ?? 0),
        },
      ];
    } catch (e) {
      console.error(e);
      this.pendientesResumenRows = [];
      this.pendientesRowsWithAnyPending = 0;
      this.pendientesDistinctCedulasWithAnyPending = 0;

      if (!silent) {
        await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar /pendientes/resumen/' });
      } else {
        throw e;
      }
    } finally {
      this.isLoadingPendientesResumen = false;
      this.cdr.markForCheck();
    }
  }

  private async loadPendientesPorOficina(silent = false): Promise<void> {
    this.isLoadingPendientesPorOficina = true;
    try {
      const resp: PendientesPorOficinaResponse = await firstValueFrom(this.robotsService.getPendientesPorOficina());
      const items = Array.isArray(resp?.items) ? resp.items : [];

      const officePairs = items.map(it => ({
        key: this.officeKey(it?.oficina ?? null),
        label: this.officeLabel(it?.oficina ?? null),
      }));

      const seen = new Set<string>();
      const offices = officePairs.filter(o => (seen.has(o.key) ? false : (seen.add(o.key), true)));

      this.pendientesPorOficinaColumns = [
        { name: 'estado', header: 'Estado', type: 'text' as const, width: '180px' },
        ...offices.map(o => ({
          name: o.key,
          header: o.label,
          type: 'number' as const,
          width: '140px',
        })),
      ];

      const rows: PendientesPorOficinaPivotRow[] = [
        { estado: 'SIN_CONSULTAR' },
        { estado: 'EN_PROGRESO' },
        { estado: 'PENDIENTES' },
      ];

      for (const o of offices) {
        const item = items.find(it => this.officeKey(it?.oficina ?? null) === o.key);
        const t = item?.totalsByModuleSum ?? { SIN_CONSULTAR: 0, EN_PROGRESO: 0, PENDIENTES: 0 };

        rows[0][o.key] = Number(t.SIN_CONSULTAR ?? 0);
        rows[1][o.key] = Number(t.EN_PROGRESO ?? 0);
        rows[2][o.key] = Number(t.PENDIENTES ?? 0);
      }

      this.pendientesPorOficinaRows = rows;
    } catch (e) {
      console.error(e);
      this.pendientesPorOficinaRows = [];
      this.pendientesPorOficinaColumns = [
        { name: 'estado', header: 'Estado', type: 'text' as const, width: '180px' },
      ];

      if (!silent) {
        await Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar /pendientes/por-oficina/' });
      } else {
        throw e;
      }
    } finally {
      this.isLoadingPendientesPorOficina = false;
      this.cdr.markForCheck();
    }
  }

  private officeKey(oficina: string | null): string {
    const raw = (oficina ?? 'SIN_OFICINA').trim() || 'SIN_OFICINA';
    const normalized = raw
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();

    return `of_${normalized}`;
  }

  private officeLabel(oficina: string | null): string {
    const raw = (oficina ?? 'SIN_OFICINA').trim();
    return raw || 'SIN_OFICINA';
  }
}
