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

import { saveAs } from 'file-saver';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

// ✅ StandardFilterTable (tu tabla nueva)
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

/** Doc serializado (lo que devuelve el backend por cada tipo) */
type DocCell = {
  exists: boolean;
  url?: string;
  uploaded_at?: string; // ISO
  vigente15d?: boolean; // ✅ para iconos (✓ / ⚠ / ✗)
};

/** ✅ Cell UI para la tabla (abre PDF desde ✓ y ?) */
type DocUiCell = {
  state: 'OK' | 'WARN' | 'MISSING';
  url?: string | null;
  uploaded_at?: string | null;
};

/** Fila base (para ZIP/Excel y tu lógica actual) */
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

@Component({
  selector: 'app-consult-contracting-documentation',
  standalone: true,
  imports: [CommonModule, SharedModule, MatButtonModule, MatDialogModule, StandardFilterTable],
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

  // --------- tabla actual (tu lógica existente: ZIP/Excel/etc.) ----------
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
  // ✅ tabla con StandardFilterTable
  // =========================
  isLoadingChecklist = false;
  checklistColumns: ColumnDefinition[] = [];
  checklistRows: any[] = [];

  // =========================
  // ✅ abreviador de headers Excel
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

    // ✅ filtro eficiente (para tu MatTable actual; si ya no la usas, no molesta)
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

    this.cdr.markForCheck();
  }

  // ✅ Fix para *ngFor trackBy
  trackByTipo = (_: number, t: TipoHeader) => t.id;

  /** ✅ Abrir PDF cuando el estado sea OK o WARN */
  openDoc(cell: DocUiCell | null | undefined, ev?: MouseEvent): void {
    ev?.stopPropagation();
    const url = cell?.url ?? null;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

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

    this.isLoadingChecklist = true;

    try {
      const resp = await this.fetchChecklistPostBatched(parsed.cedulas, token);

      if (token !== this.requestToken) return;

      // headers dinámicos
      this.tipoHeaders = Array.isArray(resp?.tipos) ? resp.tipos : [];
      this.tipoColumnKeys = this.tipoHeaders.map(t => `type_${t.id}`);
      this.displayedColumns = [...this.baseColumns, ...this.tipoColumnKeys];

      // ✅ corte: hoy(00:00) - 15 días
      const cutoff = new Date();
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(cutoff.getDate() - 15);

      // filas base (para ZIP/Excel)
      const rows: Row[] = (resp?.items ?? []).map((it: ChecklistItemDto) => {
        const docsMap: Record<number, DocCell> = {};
        const docsArr: ChecklistDocDto[] = Array.isArray(it?.docs) ? it.docs : [];

        for (const d of docsArr) {
          const tid = Number(d?.type_id);
          if (!Number.isFinite(tid)) continue;

          const dd = d?.doc;

          const uploadedAt = this.parseFecha(dd?.uploaded_at as any);
          const vigente15d = !!dd && !!uploadedAt && uploadedAt.getTime() >= cutoff.getTime();

          docsMap[tid] = {
            exists: !!dd,
            url: dd?.file_url,
            uploaded_at: dd?.uploaded_at,
            vigente15d,
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

      // ✅ mantiene tu dataSource (ZIP/Excel)
      this.dataSource.data = rows;

      // =========================
      // ✅ StandardFilterTable (base + columnas dinámicas)
      // =========================
      const baseCols: ColumnDefinition[] = [
        { name: 'cedula', header: 'Cédula', type: 'text', stickyStart: true, width: '120px' },
        { name: 'tipo_documento', header: 'Tipo Doc', type: 'text', width: '110px' },
        { name: 'nombre', header: 'Nombre', type: 'text', width: '260px' },
        { name: 'finca', header: 'Finca', type: 'text', width: '160px' },
        { name: 'fecha_ingreso', header: 'Fecha ingreso', type: 'date', width: '150px' },
        { name: 'codigo_contrato', header: 'Código contrato', type: 'text', width: '150px' },
        { name: 'fecha_contratacion', header: 'Fecha contratación', type: 'date', width: '170px' },
      ];

      // ✅ IMPORTANTE: status/custom para usar tu estadoTemplate (íconos clicables)
      const dynCols: ColumnDefinition[] = this.tipoHeaders.map(t => ({
        name: `type_${t.id}`,
        header: t.name,
        type: 'status',
        width: '110px',
        align: 'center',
        filterable: false,
        sortable: false,
      }));

      this.checklistColumns = [...baseCols, ...dynCols];

      // ✅ rows para StandardFilterTable: guarda {state,url,uploaded_at}
      this.checklistRows = rows.map(r => {
        const out: any = {
          cedula: r.cedula ?? '',
          tipo_documento: r.tipo_documento ?? '',
          nombre: r.nombre ?? '',
          finca: r.finca ?? '',
          fecha_ingreso: r.fecha_ingreso ?? '',
          codigo_contrato: r.codigo_contrato ?? '',
          fecha_contratacion: r.fecha_contratacion ?? '',
        };

        for (const t of this.tipoHeaders) {
          const cell = r.docs?.[t.id];

          const state: DocUiCell['state'] =
            !cell?.exists ? 'MISSING' : cell?.vigente15d ? 'OK' : 'WARN';

          out[`type_${t.id}`] = {
            state,
            url: cell?.url ?? null,
            uploaded_at: cell?.uploaded_at ?? null,
          } satisfies DocUiCell;
        }

        return out;
      });

      Swal.close();
      this.cdr.markForCheck();
    } catch (e) {
      if (token !== this.requestToken) return;
      console.error(e);
      if (Swal.isVisible()) Swal.close();
      Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un problema consultando datos.' });
    } finally {
      this.isLoadingChecklist = false;
      this.cdr.markForCheck();
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

      const part = await firstValueFrom(
        this.gestionDocumentalService.getDocumentosChecklist(chunks[i]),
      );

      if (!merged.tipos?.length && Array.isArray(part?.tipos)) merged.tipos = part.tipos;
      if (Array.isArray(part?.items)) (merged.items as ChecklistItemDto[]).push(...part.items);

      if (Array.isArray(part?.invalidCedulas) && part.invalidCedulas.length) {
        merged.invalidCedulas = [...(merged.invalidCedulas ?? []), ...part.invalidCedulas];
      }

      merged.duplicatesRemoved =
        Number(merged.duplicatesRemoved ?? 0) + Number(part?.duplicatesRemoved ?? 0);
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

    // ✅ StandardFilterTable
    this.checklistRows = [];
    this.checklistColumns = [];
    this.isLoadingChecklist = false;
  }

  /** ---------- FILTRO DE TABLA (si aún usas MatTable) ---------- */
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
      Swal.fire({
        icon: 'info',
        title: 'Tipos no cargados',
        text: 'No se detectaron tipos documentales.',
      });
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
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => Swal.close()))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
          a.download = `documentos_union_${ts}.zip`;
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

  focusPasteZone(ev: MouseEvent): void {
    const el = ev.currentTarget as HTMLElement | null;
    el?.focus();
  }

  // ---------- EXCEL (faltantes) ----------
  async exportarExcelFaltantes(): Promise<void> {
    const data = this.dataSource.data ?? [];
    if (!data.length) {
      Swal.fire('Sin datos', 'No hay registros para exportar.', 'info');
      return;
    }

    if (!this.tipoHeaders?.length) {
      Swal.fire('Sin tipos', 'Primero consulta para cargar los tipos documentales.', 'info');
      return;
    }

    const excelMod: any = await import('exceljs');
    const WorkbookCtor = excelMod?.Workbook ?? excelMod?.default?.Workbook ?? excelMod?.default;

    if (!WorkbookCtor) {
      Swal.fire('Error', 'No se pudo cargar ExcelJS (Workbook). Revisa la instalación/import.', 'error');
      return;
    }

    // =========================
    // Helpers inline (sin sacar métodos)
    // =========================
    const norm = (s: any) =>
      String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9 ]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    const tokens = (s: any) => norm(s).split(' ').filter(Boolean);

    const scoreByKeywords = (nameNorm: string, keywords: readonly string[]) => {
      let score = 0;
      const nTok = new Set(tokens(nameNorm));

      for (const kw of keywords) {
        const k = norm(kw);
        if (!k) continue;

        if (nameNorm === k) score += 200;
        if (nameNorm.startsWith(k)) score += 80;
        if (nameNorm.includes(k)) score += 50;

        const kTok = tokens(k);
        let hit = 0;
        for (const t of kTok) if (nTok.has(t)) hit++;
        score += hit * 8;
      }
      return score;
    };

    const jaccard = (a: string, b: string) => {
      const A = new Set(tokens(a));
      const B = new Set(tokens(b));
      if (!A.size || !B.size) return 0;
      let inter = 0;
      for (const x of A) if (B.has(x)) inter++;
      const union = A.size + B.size - inter;
      return union ? inter / union : 0;
    };

    const pickTipoId = (keywords: readonly string[]) => {
      const kwJoined = norm((keywords ?? []).join(' '));

      let bestId: number | null = null;
      let bestScore = -1;

      for (const t of this.tipoHeaders) {
        const nameNorm = norm(t?.name);
        if (!nameNorm) continue;

        const s = scoreByKeywords(nameNorm, keywords);
        if (s > bestScore) {
          bestScore = s;
          bestId = Number(t.id);
        }
      }

      if (bestId == null || bestScore <= 0) {
        let bestJ = -1;
        let bestJId: number | null = null;

        for (const t of this.tipoHeaders) {
          const name = String(t?.name ?? '');
          const j = jaccard(name, kwJoined);
          if (j > bestJ) {
            bestJ = j;
            bestJId = Number(t.id);
          }
        }

        if (bestJId != null) return bestJId;
      }

      return bestId;
    };

    const safeSheetName = (name: string) =>
      (String(name ?? '').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31).trim() || 'HOJA');

    const paintHeader = (ws: any) => {
      const header = ws.getRow(1);
      header.height = 22;
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      header.eachCell((cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
      });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };

    const splitFullName = (full: string) => {
      const parts = String(full ?? '').trim().split(/\s+/g).filter(Boolean);

      let pn = '';
      let sn = '';
      let pa = '';
      let sa = '';

      if (parts.length === 1) {
        pn = parts[0];
      } else if (parts.length === 2) {
        pn = parts[0];
        pa = parts[1];
      } else if (parts.length === 3) {
        pn = parts[0];
        sn = parts[1];
        pa = parts[2];
      } else if (parts.length >= 4) {
        pn = parts[0];
        pa = parts[parts.length - 2];
        sa = parts[parts.length - 1];
        sn = parts.slice(1, -2).join(' ');
      }

      return { pn, sn, pa, sa };
    };

    // ✅ Vigente si uploaded_at está dentro de los últimos 15 días
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - 15);

    const wb = new WorkbookCtor();
    wb.creator = 'TuAlianza';
    wb.created = new Date();

    const requestedSheets = [
      { sheet: 'PROCURADURIA', keywords: ['PROCURADURIA', 'PROCURADURÍA', 'PROCURAD'] },
      { sheet: 'CONTRALORIA', keywords: ['CONTRALORIA', 'CONTRALORÍA', 'CONTRAL'] },
      { sheet: 'OFAC', keywords: ['OFAC'] },
      { sheet: 'POLICIVOS', keywords: ['POLICIVO', 'POLICIVOS', 'POLICIA', 'ANTECEDENTE', 'ANTECEDENTES'] },
      { sheet: 'ADRESS', keywords: ['ADRESS', 'ADDRESS', 'DIRECCION', 'DIRECCIÓN', 'DOMICILIO', 'RESIDENCIA'] },
      { sheet: 'SISBEN', keywords: ['SISBEN', 'SISBÉN'] },
      { sheet: 'AFP', keywords: ['AFP', 'FONDO', 'FONDO DE PENSION', 'PENSION', 'PENSIONES'] },
    ];

    const resolvedDocs = requestedSheets.map(r => ({
      ...r,
      tipoId: pickTipoId(r.keywords),
    }));

    // =========================================================
    // 1) HOJA GENERAL
    // =========================================================
    const wsGeneral = wb.addWorksheet('GENERAL', { views: [{ state: 'frozen', ySplit: 1 }] });

    const baseColsGeneral = [
      { header: 'Céd.', key: 'cedula', width: 12 },
      { header: 'T.Doc', key: 'tipo_documento', width: 10 },
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Finca', key: 'finca', width: 14 },
      { header: 'F.Ing', key: 'fecha_ingreso', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
      { header: 'Cod.Cto', key: 'codigo_contrato', width: 12 },
    ];

    const tipoColsGeneral = this.tipoHeaders.flatMap(t => {
      const n = this.abbrDoc(t.name);
      return [
        { header: n, key: `t_${t.id}_estado`, width: 4 },
        { header: `F.${n}`, key: `t_${t.id}_fecha`, width: 16, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
        { header: `L.${n}`, key: `t_${t.id}_link`, width: 6 },
      ];
    });

    wsGeneral.columns = [...baseColsGeneral, ...tipoColsGeneral];
    paintHeader(wsGeneral);

    const green = { argb: 'FF2E7D32' };
    const red = { argb: 'FFC62828' };
    const amber = { argb: 'FFF59E0B' };
    const linkBlue = { argb: 'FF2563EB' };

    for (const item of data) {
      const fechaIngreso = this.parseFecha(item.fecha_ingreso as any);

      const rowData: any = {
        cedula: item.cedula ?? '',
        tipo_documento: item.tipo_documento ?? '',
        nombre: item.nombre ?? '',
        finca: item.finca ?? '',
        fecha_ingreso: fechaIngreso ?? '',
        codigo_contrato: item.codigo_contrato ?? '',
      };

      this.tipoHeaders.forEach(t => {
        const doc = item.docs?.[t.id];
        const exists = !!doc?.exists;

        const uploadedAt = this.parseFecha(doc?.uploaded_at as any);
        const vigente15d = exists && !!uploadedAt && uploadedAt.getTime() >= cutoff.getTime();

        rowData[`t_${t.id}_estado`] = !exists ? '✗' : vigente15d ? '✓' : '⚠';
        rowData[`t_${t.id}_fecha`] = uploadedAt ?? (doc?.uploaded_at ?? '');
        rowData[`t_${t.id}_link`] =
          exists && doc?.url ? { text: 'Abrir', hyperlink: String(doc.url) } : '';
      });

      const row = wsGeneral.addRow(rowData);

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

    wsGeneral.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: wsGeneral.columnCount },
    };

    // =========================================================
    // 2) HOJAS POR FALTANTES (una hoja por documento)
    // =========================================================
    const sheetColumns = [
      { header: 'Céd.', key: 'cedula', width: 12 },
      { header: 'T.Doc', key: 'tipo_documento', width: 10 },
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Finca', key: 'finca', width: 14 },
      { header: 'F.Ing', key: 'fecha_ingreso', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
      { header: 'Cod.Cto', key: 'codigo_contrato', width: 12 },
    ];

    for (const req of resolvedDocs) {
      const tipoId = req.tipoId;

      const ws = wb.addWorksheet(safeSheetName(req.sheet), {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      ws.columns = sheetColumns;
      paintHeader(ws);

      const missingRows = data
        .filter(r => {
          if (!tipoId) return false;
          return !(r.docs?.[Number(tipoId)]?.exists === true);
        })
        .sort((a, b) => {
          const fa = String(a.finca ?? '').localeCompare(String(b.finca ?? ''), 'es', { sensitivity: 'base' });
          if (fa !== 0) return fa;
          return String(a.cedula ?? '').localeCompare(String(b.cedula ?? ''), 'es', { sensitivity: 'base' });
        });

      for (const r of missingRows) {
        const row = ws.addRow({
          cedula: r.cedula ?? '',
          tipo_documento: r.tipo_documento ?? '',
          nombre: r.nombre ?? '',
          finca: r.finca ?? '',
          fecha_ingreso: this.parseFecha(r.fecha_ingreso as any) ?? '',
          codigo_contrato: r.codigo_contrato ?? '',
        });

        if (row.number % 2 === 0) {
          row.eachCell((cell: any) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
          });
        }

        row.eachCell((cell: any) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
        row.getCell('nombre').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        row.getCell('finca').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }

      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columnCount },
      };
    }

    // =========================================================
    // 3) HOJA: FALTANTES POR PERSONA
    // =========================================================
    const wsPersonas = wb.addWorksheet('FALTANTES_PERSONA', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsPersonas.columns = [
      { header: 'Identificación', key: 'identificacion', width: 16 },
      { header: 'Tipo documento', key: 'tipo_documento', width: 14 },
      { header: 'Nombre Y Apellidos', key: 'nombre_completo', width: 30 },
      { header: 'Primer Nombre', key: 'primer_nombre', width: 16 },
      { header: 'Segundo Nombre', key: 'segundo_nombre', width: 18 },
      { header: 'Primer Apellido', key: 'primer_apellido', width: 18 },
      { header: 'Segundo Apellido', key: 'segundo_apellido', width: 18 },
      { header: 'Documentación faltante', key: 'faltantes', width: 38 },
    ];
    paintHeader(wsPersonas);

    const personasConFaltantes = data
      .map(r => {
        const faltantes = resolvedDocs
          .filter(d => {
            if (!d.tipoId) return true;
            return !(r.docs?.[Number(d.tipoId)]?.exists === true);
          })
          .map(d => (d.tipoId ? d.sheet : `${d.sheet} (NO_MAPEADO)`));

        return { r, faltantes };
      })
      .filter(x => x.faltantes.length > 0)
      .sort((a, b) => {
        const fa = String(a.r.nombre ?? '').localeCompare(String(b.r.nombre ?? ''), 'es', { sensitivity: 'base' });
        if (fa !== 0) return fa;
        return String(a.r.cedula ?? '').localeCompare(String(b.r.cedula ?? ''), 'es', { sensitivity: 'base' });
      });

    for (const { r, faltantes } of personasConFaltantes) {
      const nombreCompleto = String(r.nombre ?? '').trim();
      const { pn, sn, pa, sa } = splitFullName(nombreCompleto);

      const row = wsPersonas.addRow({
        identificacion: r.cedula ?? '',
        tipo_documento: r.tipo_documento ?? '',
        nombre_completo: nombreCompleto,
        primer_nombre: pn,
        segundo_nombre: sn,
        primer_apellido: pa,
        segundo_apellido: sa,
        faltantes: faltantes.join(', '),
      });

      if (row.number % 2 === 0) {
        row.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }

      row.eachCell((cell: any) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      row.getCell('nombre_completo').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      row.getCell('faltantes').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }

    wsPersonas.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: wsPersonas.columnCount },
    };

    const blob = new Blob([await wb.xlsx.writeBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const today = new Date().toISOString().slice(0, 10);
    saveAs(blob, `documentacion_general_y_faltantes_${today}.xlsx`);
  }
}
