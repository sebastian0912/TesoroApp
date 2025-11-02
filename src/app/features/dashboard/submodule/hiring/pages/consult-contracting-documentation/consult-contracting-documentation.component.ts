import { Component, OnInit, DestroyRef, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import Swal from 'sweetalert2';
import { finalize } from 'rxjs';

import { SharedModule } from '@/app/shared/shared.module';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';

import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { OrdenUnionDialogComponent } from '../../components/orden-union-dialog/orden-union-dialog.component';

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

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

@Component({
  selector: 'app-consult-contracting-documentation',
  standalone: true,
  imports: [SharedModule, MatButtonModule, MatDialogModule],
  templateUrl: './consult-contracting-documentation.component.html',
  styleUrl: './consult-contracting-documentation.component.css'
})
export class ConsultContractingDocumentationComponent implements OnInit {

  // inyección moderna
  private readonly destroyRef = inject(DestroyRef);
  private readonly gestionDocumentalService = inject(GestionDocumentalService);
  private readonly dialog = inject(MatDialog);
  private readonly utilityService = inject(UtilityServiceService);

  // --------- UI / estado ----------
  cedulaControl = new FormControl<string>('', { nonNullable: true });
  user: any;

  // --------- columnas dinámicas ----------
  /** Tipos que devuelve el backend, en orden */
  tipoHeaders: Array<{ id: number; name: string }> = [];
  /** Claves de columnas para Material Table (coinciden con los ng-container/defs de la plantilla) */
  tipoColumnKeys: string[] = [];

  // --------- tabla ----------
  dataSource = new MatTableDataSource<Row>([]);
  /** Columnas base + dinámicas por tipo */
  displayedColumns: string[] = [
    'cedula', 'tipo_documento', 'nombre', 'finca', 'fecha_ingreso', 'codigo_contrato', 'fecha_contratacion'
    // luego se añaden ...tipoColumnKeys
  ];

  ngOnInit(): void {
    this.user = this.utilityService.getUser();

    // filtro de texto simple sobre todas las props stringificadas
    this.dataSource.filterPredicate = (row, filter) =>
      JSON.stringify(row).toLowerCase().includes(filter);
  }

  /** ---------- BÚSQUEDA INDIVIDUAL ---------- */
  buscarPorCedula(): void {
    const cedula = this.cedulaControl.value.trim();
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
    if (txt.includes('\n') || txt.includes('\t') || txt.includes(',')) {
      this.procesarCedulasPegadas(txt);
    } else {
      this.cedulaControl.setValue(txt.trim());
      this.buscarPorCedula();
    }
  }

  /** ---------- PROCESAMIENTO MASIVO CON NUEVO ENDPOINT ---------- */
  procesarCedulasPegadas(texto: string): void {
    // limpia tabla y normaliza/deduplica cédulas
    this.dataSource.data = [];
    this.tipoHeaders = [];
    this.tipoColumnKeys = [];
    this.displayedColumns = [
      'cedula', 'tipo_documento', 'nombre', 'finca', 'fecha_ingreso', 'codigo_contrato', 'fecha_contratacion'
    ];

    const cedulas = Array.from(
      new Set(
        texto.split(/[\n,\t;]+/).map(c => c.trim()).filter(Boolean)
      )
    );
    if (!cedulas.length) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No se detectaron cédulas.' });
      return;
    }

    Swal.fire({
      icon: 'info',
      title: 'Consultando información...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.gestionDocumentalService
      .getDocumentosChecklistByGet(cedulas) // 👈 usa el nuevo servicio (tipos por defecto del backend)
      .pipe(finalize(() => Swal.close()))
      .subscribe({
        next: (resp: any) => {
          // 1) Encabezados de tipos (en orden) -> columnas dinámicas
          this.tipoHeaders = Array.isArray(resp?.tipos) ? resp.tipos : [];
          this.tipoColumnKeys = this.tipoHeaders.map(t => `type_${t.id}`);
          this.displayedColumns = [
            'cedula', 'tipo_documento', 'nombre', 'finca', 'fecha_ingreso', 'codigo_contrato', 'fecha_contratacion',
            ...this.tipoColumnKeys
          ];

          // 2) Items -> filas
          const rows: Row[] = (resp?.items ?? []).map((it: any) => {
            const docsMap: Record<number, DocCell> = {};
            const docsArr: any[] = Array.isArray(it?.docs) ? it.docs : [];
            docsArr.forEach(d => {
              const tid = Number(d?.type_id);
              if (!Number.isFinite(tid)) return;
              const dd = d?.doc;
              docsMap[tid] = {
                exists: !!dd,
                url: dd?.file_url,
                uploaded_at: dd?.uploaded_at
              };
            });

            return {
              cedula: String(it?.cedula ?? ''),
              tipo_documento: it?.tipo_documento ?? '',
              nombre: it?.nombre_completo ?? '',
              finca: it?.finca ?? '',
              fecha_ingreso: it?.fecha_ingreso ?? '',
              codigo_contrato: it?.codigo_contrato ?? '',
              fecha_contratacion: it?.fecha_contratacion ?? '',
              docs: docsMap
            };
          });

          this.dataSource.data = rows;
        },
        error: () => {
          Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un problema consultando datos.' });
        }
      });
  }

  /** ---------- FILTRO DE TABLA ---------- */
  applyFilters(ev: Event): void {
    this.dataSource.filter = (ev.target as HTMLInputElement).value.trim().toLowerCase();
  }

  limpiarTabla(): void {
    this.dataSource.data = [];
    this.cedulaControl.setValue('');
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
      cancelButtonText: 'No'
    }).then(r => r.isConfirmed && this.abrirDialogOrden());
  }

  abrirDialogOrden(): void {
    // 🔹 Opción A: todos los tipos que devolvió el backend (en el mismo orden)
    const antecedentes = this.tipoHeaders.map(t => ({
      id: t.id,
      name: t.name?.toUpperCase?.() || String(t.name)
    }));

    if (!antecedentes.length) {
      Swal.fire({ icon: 'info', title: 'Sin tipos disponibles', text: 'No hay tipos para ordenar.' });
      return;
    }

    this.dialog.open(OrdenUnionDialogComponent, {
      panelClass: 'orden-union-dialog-panel',
      minWidth: '500pt',
      height: '90vh',
      maxHeight: '90vh',
      autoFocus: false,
      restoreFocus: false,
      data: { antecedentes }
    }).afterClosed()
      .subscribe((orden: number[] | null) => orden && this.descargarZipConUnion(orden));

  }


  descargarZipConUnion(ordenSeleccionado: Array<number | string>): void {
    const cedulasStr = this.dataSource.data
      .filter(r => r.cedula)
      .map(r => r.cedula);

    const cedulasNum = cedulasStr
      .map(c => Number(c))
      .filter(n => Number.isFinite(n));

    const noNumericas = cedulasStr.length - cedulasNum.length;
    if (noNumericas > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cédulas no numéricas',
        text: `Se omitieron ${noNumericas} cédula(s) con formato no numérico.`
      });
    }

    const ordenNums = (ordenSeleccionado ?? [])
      .map(v => typeof v === 'string' ? Number(v) : v)
      .filter(n => Number.isFinite(n));

    if (!cedulasNum.length || !ordenNums.length) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'Verifica cédulas y orden seleccionado.' });
      return;
    }

    Swal.fire({
      title: 'Preparando descarga...',
      text: 'Esto puede tardar unos segundos',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.gestionDocumentalService
      .descargarZipPorCedulasYOrden(cedulasNum, ordenNums)
      .pipe(finalize(() => Swal.close())) // 👈 quitamos el paréntesis extra aquí
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `documentos_union_${new Date().toISOString()}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: () => Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar el archivo.' })
      });
  }
  // ---------- Util ----------

  private parseFecha(fecha: string | Date | null | undefined): Date | null {
    if (!fecha) return null;
    if (fecha instanceof Date) return isNaN(fecha.getTime()) ? null : fecha;
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const m = ddmmyyyy.exec(fecha);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? null : d;
  }

  // ---------- EXCEL (faltantes dinámico por tipos) ----------
  // ✅ Excel pro con iconos y estilos
  async exportarExcelFaltantes(): Promise<void> {
    const data = this.dataSource.data ?? [];
    if (!data.length) {
      Swal.fire('Sin datos', 'No hay registros para exportar.', 'info');
      return;
    }

    // Carga dinámica para no romper SSR ni inflar el bundle inicial
    const ExcelJS = await import('exceljs');

    // 1) Libro y hoja
    const wb = new ExcelJS.Workbook();
    wb.creator = 'TuAlianza';
    wb.created = new Date();

    const ws = wb.addWorksheet('Faltantes', {
      views: [{ state: 'frozen', ySplit: 1 }] // encabezado congelado
    });

    // 2) Columnas (base + dinámicas por tipo)
    const baseCols = [
      { header: 'Cédula', key: 'cedula', width: 16 },
      { header: 'Tipo de Documento', key: 'tipo_documento', width: 18 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Finca', key: 'finca', width: 18 },
      { header: 'Fecha ingreso', key: 'fecha_ingreso', width: 16, style: { numFmt: 'dd-mm-yyyy' } },
      { header: 'Código de contrato', key: 'codigo_contrato', width: 20 },
    ];

    const tipoCols = this.tipoHeaders.map(t => ({
      header: t.name,
      key: `t_${t.id}`,
      width: 18
    }));

    ws.columns = [...baseCols, ...tipoCols];

    // 3) Cabecera con estilo (oscuro, tipografía blanca, centrado)
    const header = ws.getRow(1);
    header.height = 22;
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { vertical: 'middle', horizontal: 'center' };
    header.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F2937' } // gris oscuro
      };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } }
      };
    });

    // 4) Filas
    const baseKeys = baseCols.map(c => c.key);
    const baseCount = baseCols.length;
    const green = { argb: 'FF2E7D32' }; // verde 700
    const red = { argb: 'FFC62828' }; // rojo 800

    for (const item of data) {
      // Mapa base
      const rowData: any = {
        cedula: item.cedula ?? '',
        tipo_documento: item.tipo_documento ?? '',
        nombre: item.nombre ?? '',
        finca: item.finca ?? '',
        fecha_ingreso: item.fecha_ingreso ?? '',
        codigo_contrato: item.codigo_contrato ?? ''
      };

      // Por cada tipo: ✓ o ✗
      this.tipoHeaders.forEach(t => {
        const cell = item.docs?.[t.id];
        rowData[`t_${t.id}`] = cell?.exists ? '✓' : '✗';
      });

      const row = ws.addRow(rowData);

      // Zebra striping (muy sutil)
      if (row.number % 2 === 0) {
        row.eachCell((cell, col) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9FAFB' } // gris muy claro
          };
        });
      }

      // Centrar y colorear las celdas dinámicas por tipo
      for (let col = baseCount + 1; col <= ws.columnCount; col++) {
        const c = row.getCell(col);
        const v = (c.value ?? '') as string;
        c.alignment = { vertical: 'middle', horizontal: 'center' };
        c.font = {
          name: 'Segoe UI Symbol',
          bold: true,
          color: v === '✓' ? green : red
        };
      }
    }

    // 5) Autofiltro sobre toda la cabecera
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: ws.columnCount }
    };

    // 6) Bordes finos externos (look minimal)
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

    // 7) Guardar
    const blob = new Blob([await wb.xlsx.writeBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
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

    // ---- helpers locales ----
    const toDateVal = (v: any): Date | '' => {
      const d = this.parseFecha(v);
      return d ? d : '';
    };

    const baseHeaders = [
      'Cédula',
      'Tipo de Documento',
      'Nombre',
      'Finca',
      'Fecha ingreso',
      'Código de contrato',
      'Fecha de contratación'
    ];

    // Por cada tipo: 2 columnas -> [<NombreTipo>, Fecha <NombreTipo>]
    const dynHeaders: string[] = [];
    this.tipoHeaders.forEach(t => {
      dynHeaders.push(t.name);
      dynHeaders.push(`Fecha ${t.name}`);
    });

    const headers = [...baseHeaders, ...dynHeaders];

    // ---- construimos la matriz (AOA) con headers + filas ----
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

      // por cada tipo: celda link + celda fecha
      this.tipoHeaders.forEach(t => {
        const cell = r.docs?.[t.id];
        // Texto minimalista del link
        const linkText = cell?.exists && cell.url ? 'Ver' : '';
        const dateVal = cell?.uploaded_at ? toDateVal(cell.uploaded_at) : '';

        row.push(linkText);
        row.push(dateVal);
      });

      aoa.push(row);
    }

    // ---- hoja ----
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // 1) AutoFilter en todo el rango
    const endCol = headers.length - 1;
    const endRow = aoa.length - 1;
    ws['!autofilter'] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: endRow, c: endCol } })
    };

    // 2) Convertir a hipervínculo las celdas "Ver" de cada tipo
    //    fila de datos comienza en 1 (porque 0 es el header)
    const baseCols = baseHeaders.length;
    for (let rIdx = 1; rIdx < aoa.length; rIdx++) {
      this.tipoHeaders.forEach((t, i) => {
        const linkColIdx = baseCols + (i * 2);       // columna del link
        const cellAddr = XLSX.utils.encode_cell({ r: rIdx, c: linkColIdx });
        const cell = ws[cellAddr];
        // La URL está en this.dataSource.data[rIdx-1].docs[t.id]?.url
        const url = this.dataSource.data[rIdx - 1]?.docs?.[t.id]?.url;

        if (cell && url) {
          // Asegura tipo string y añade hipervínculo
          cell.t = 's';
          cell.v = 'Ver';
          (cell as any).l = { Target: String(url) };
        }
      });
    }

    // 3) Formato de fecha para las columnas de fecha (base + dinámicas)
    //    Base: "Fecha ingreso" (col 4) y "Fecha de contratación" (col 6) -> índice 0-based
    const setDateFormat = (rowIdx: number, colIdx: number) => {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: colIdx });
      const c = ws[addr];
      if (c && c.v instanceof Date) {
        c.t = 'd';          // tipo fecha
        c.z = 'yyyy-mm-dd'; // formato minimalista
      }
    };

    for (let rIdx = 1; rIdx < aoa.length; rIdx++) {
      // base dates: indices 4 y 6 (0-based dentro de headers)
      setDateFormat(rIdx, 4);
      setDateFormat(rIdx, 6);

      // dinámicas: cada tipo añade [link, fecha] -> la fecha es la columna impar del par
      this.tipoHeaders.forEach((_, i) => {
        const dateColIdx = baseCols + (i * 2) + 1;
        setDateFormat(rIdx, dateColIdx);
      });
    }

    // 4) Anchos de columna elegantes (mínimo 14, máximo 42)
    const computeWch = (colIndex: number): number => {
      const headerLen = String(headers[colIndex] ?? '').length;
      let maxLen = headerLen;
      for (let r = 1; r < aoa.length; r++) {
        const val = aoa[r][colIndex];
        const length =
          val instanceof Date
            ? 10 // "yyyy-mm-dd"
            : (val ? String(val).length : 0);
        if (length > maxLen) maxLen = length;
      }
      return Math.max(14, Math.min(42, maxLen + 2));
    };

    ws['!cols'] = headers.map((_, c) => ({ wch: computeWch(c) }));

    // ---- libro y export ----
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoría');

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    XLSX.writeFile(wb, `reporte_auditoria_${yyyy}-${mm}-${dd}.xlsx`);
  }

}
