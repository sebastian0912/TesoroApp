import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { TrasladosService } from '../../service/traslados.service';
import { SharedModule } from '@/app/shared/shared.module';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ElectronWindowService } from '@/app/core/services/electron-window.service';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';
import * as ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

interface RangoFechas {
  start: string | null;
  end: string | null;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-transfer-query',
  imports: [
    SharedModule,
    MatTableModule
  ],
  templateUrl: './transfer-query.component.html',
  styleUrl: './transfer-query.component.css'
})
export class TransferQueryComponent {
  myForm!: FormGroup;
  dataSource = new MatTableDataSource<any>([]);
  isExporting = false;

  displayedColumns: string[] = [
    'codigo_traslado',
    'solicitud_traslado',
    'eps_a_trasladar',
    'responsable',
    'estado_del_traslado'
  ];

  constructor(
    private trasladosService: TrasladosService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private electronWindow: ElectronWindowService,
    private dialog: MatDialog,
  ) {
    this.myForm = this.fb.group({
      cedula: ['', Validators.required],
    });
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  onSubmit(): void {
    if (this.myForm.valid) {
      this.trimField('cedula');

      Swal.fire({
        title: 'Buscando información...',
        html: 'Por favor, espere.',
        icon: 'info',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      this.trasladosService.buscarAfiliacionPorId(this.myForm.value.cedula).subscribe(
        (data: any) => {
          Swal.close();
          this.dataSource.data = data;
          this.cdr.markForCheck();
        },
        (_error: any) => {
          Swal.close();
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo realizar la consulta. Por favor, inténtelo de nuevo más tarde.',
          });
          this.cdr.markForCheck();
        }
      );
    }
  }


  private trimField(fieldName: string) {
    const control = this.myForm.get(fieldName);
    if (control && control.value && typeof control.value === 'string') {
      control.setValue(control.value.trim());
    }
  }

  verDocumento(solicitud: string): void {
    this.electronWindow.openDocument(solicitud, { title: 'Solicitud de traslado' });
  }

  /**
   * Resuelve la URL del PDF a abrir desde el response del backend.
   * Prioridad: solicitud_doc.file_url (gestion_documental) > external_url (Drive).
   * Fallback al campo legacy solicitud_traslado solo si todavía existe.
   */
  resolveSolicitudUrl(element: any): string | null {
    return (
      element?.solicitud_doc?.file_url ||
      element?.external_url ||
      element?.solicitud_traslado ||
      null
    );
  }

  /**
   * Toma el JSON `ultimas_actualizaciones` ({ "YYYY-MM-DD HH:MM:SS.us": "desc" })
   * y devuelve la fecha mas antigua (la subida original) parseada como Date.
   * Si el JSON no tiene entradas validas, cae a `marca_temporal_solicitud`.
   */
  private getFechaSubida(element: any): Date | null {
    const ua = element?.ultimas_actualizaciones;
    if (ua && typeof ua === 'object') {
      const claves = Object.keys(ua).filter(k => !!k);
      if (claves.length > 0) {
        const ordenadas = [...claves].sort();
        const masAntigua = ordenadas[0];
        const d = this.parseFechaUltimasActualizaciones(masAntigua);
        if (d && !isNaN(d.getTime())) return d;
      }
    }
    if (element?.marca_temporal_solicitud) {
      const d = new Date(element.marca_temporal_solicitud);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  /** "2025-09-04 14:23:11.123456" -> Date local. */
  private parseFechaUltimasActualizaciones(raw: string): Date | null {
    if (!raw) return null;
    // Permite tanto "YYYY-MM-DD HH:mm:ss" como ISO con T.
    const normal = raw.replace(' ', 'T');
    const d = new Date(normal);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Abre el dialog de rango de fechas y luego genera un Excel profesional
   * con los traslados que tengan fecha de subida dentro del rango,
   * ordenados de la mas antigua a la mas reciente. Si el usuario no
   * elige fechas, se exportan todos los registros tal cual.
   */
  async descargarExcel(): Promise<void> {
    const filas = (this.dataSource.data || []).slice();
    if (filas.length === 0) {
      Swal.fire({
        icon: 'info',
        title: 'Sin datos',
        text: 'Realiza primero una busqueda para poder exportar.',
      });
      return;
    }

    // 1) Pedir rango de fechas con el dialog compartido.
    const dialogRef = this.dialog.open<DateRangeDialogComponent, void, RangoFechas>(
      DateRangeDialogComponent,
      { width: '550px', autoFocus: true, restoreFocus: true }
    );
    const rango = await firstValueFrom(dialogRef.afterClosed());
    if (rango === undefined) {
      // Usuario cerro/cancelo el dialog.
      return;
    }

    this.isExporting = true;
    this.cdr.markForCheck();

    try {
      // 2) Decorar con fecha_subida y filtrar por rango si se eligio.
      const startDate = this.parseRangoBoundary(rango.start, 'start');
      const endDate = this.parseRangoBoundary(rango.end, 'end');

      const decoradas = filas
        .map(f => ({ raw: f, fechaSubida: this.getFechaSubida(f) }))
        .filter(d => this.dentroDelRango(d.fechaSubida, startDate, endDate))
        .sort((a, b) => {
          const ta = a.fechaSubida ? a.fechaSubida.getTime() : Number.POSITIVE_INFINITY;
          const tb = b.fechaSubida ? b.fechaSubida.getTime() : Number.POSITIVE_INFINITY;
          return ta - tb;
        });

      if (decoradas.length === 0) {
        this.isExporting = false;
        this.cdr.markForCheck();
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados en el rango',
          text: 'No hay traslados con fecha de subida dentro del rango seleccionado.',
        });
        return;
      }

      const cedula = String(this.myForm.value.cedula || '').trim() || 'sin_cedula';
      const ahora = new Date();
      const sufijo = `${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}_${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}`;
      const rangoLabel = this.labelRango(rango);

      const wb = new ExcelJS.Workbook();
      wb.creator = 'TesoroApp';
      wb.created = ahora;
      wb.modified = ahora;

      const ws = wb.addWorksheet('Traslados', {
        views: [{ state: 'frozen', ySplit: 4 }],
      });

      // ---------- Encabezado titulo + meta ----------
      ws.mergeCells('A1:K1');
      const tituloCell = ws.getCell('A1');
      tituloCell.value = 'Reporte de Traslados EPS';
      tituloCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      tituloCell.alignment = { vertical: 'middle', horizontal: 'center' };
      tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF21263C' } };
      ws.getRow(1).height = 28;

      ws.mergeCells('A2:K2');
      const subCell = ws.getCell('A2');
      subCell.value = `Cedula: ${cedula}    |    Rango: ${rangoLabel}    |    Total: ${decoradas.length}    |    Generado: ${ahora.toLocaleString('es-CO')}`;
      subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF4B5563' } };
      subCell.alignment = { vertical: 'middle', horizontal: 'center' };
      ws.getRow(2).height = 18;

      ws.getRow(3).height = 6; // separador

      // ---------- Header de columnas ----------
      const columnas = [
        { header: 'Codigo Traslado', key: 'codigo_traslado', width: 18 },
        { header: 'Cedula', key: 'numero_cedula', width: 16 },
        { header: 'Fecha de Subida', key: 'fecha_subida', width: 22 },
        { header: 'EPS a Trasladar', key: 'eps_a_trasladar', width: 24 },
        { header: 'EPS Trasladada', key: 'eps_trasladada', width: 24 },
        { header: 'Responsable', key: 'responsable', width: 26 },
        { header: 'Estado', key: 'estado_del_traslado', width: 22 },
        { header: 'Observacion', key: 'observacion_estado', width: 32 },
        { header: 'Numero Radicado', key: 'numero_radicado', width: 22 },
        { header: 'Fecha Efectividad', key: 'fecha_efectividad', width: 20 },
        { header: 'Solicitud', key: 'solicitud', width: 20 },
      ] as const;

      const headerRow = ws.getRow(4);
      columnas.forEach((c, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = c.header;
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF21263C' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF21263C' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'medium', color: { argb: 'FF8CD50A' } },
        };
        ws.getColumn(i + 1).width = c.width;
      });
      headerRow.height = 26;

      // ---------- Datos ----------
      decoradas.forEach((entry, idx) => {
        const r = entry.raw;
        const url = this.resolveSolicitudUrl(r);
        const row = ws.getRow(5 + idx);

        row.getCell(1).value = r.codigo_traslado ?? '';
        row.getCell(2).value = r.numero_cedula ?? '';
        row.getCell(3).value = entry.fechaSubida ?? null;
        row.getCell(4).value = r.eps_a_trasladar ?? '';
        row.getCell(5).value = r.eps_trasladada ?? '';
        row.getCell(6).value = r.responsable ?? '';
        row.getCell(7).value = r.estado_del_traslado ?? '';
        row.getCell(8).value = r.observacion_estado ?? '';
        row.getCell(9).value = r.numero_radicado ?? '';
        row.getCell(10).value = r.fecha_efectividad ?? '';

        const solicitudCell = row.getCell(11);
        if (url) {
          solicitudCell.value = { text: 'Ver solicitud', hyperlink: url, tooltip: url };
          solicitudCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1565C0' }, underline: true };
        } else {
          solicitudCell.value = 'Sin documento';
          solicitudCell.font = { name: 'Calibri', size: 11, color: { argb: 'FF94A3B8' }, italic: true };
        }

        // Estilos generales
        const baseFont = { name: 'Calibri', size: 11 } as const;
        const banded = idx % 2 === 1;
        for (let c = 1; c <= columnas.length; c++) {
          const cell = row.getCell(c);
          if (c !== 11) {
            cell.font = baseFont;
          }
          cell.alignment = { vertical: 'middle', horizontal: c === 1 || c === 3 || c === 9 || c === 10 ? 'center' : 'left', wrapText: true };
          cell.border = {
            top: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            left: { style: 'hair', color: { argb: 'FFE2E8F0' } },
            right: { style: 'hair', color: { argb: 'FFE2E8F0' } },
          };
          if (banded) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        }

        // Formato fecha_subida
        row.getCell(3).numFmt = 'yyyy-mm-dd hh:mm';

        row.height = 22;
      });

      // ---------- Auto filtro y print ----------
      ws.autoFilter = {
        from: { row: 4, column: 1 },
        to: { row: 4, column: columnas.length },
      };
      ws.pageSetup.printTitlesRow = '1:4';
      ws.pageSetup.fitToPage = true;
      ws.pageSetup.fitToWidth = 1;
      ws.pageSetup.fitToHeight = 0;
      ws.pageSetup.orientation = 'landscape';
      ws.pageSetup.margins = { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `traslados_${cedula}_${sufijo}.xlsx`);
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'No se pudo generar el Excel',
        text: 'Ocurrio un error al construir el archivo. Intentalo de nuevo.',
      });
    } finally {
      this.isExporting = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Convierte el string "YYYY-MM-DD" del dialog en Date local. Para `start`
   * pone 00:00:00; para `end` pone 23:59:59 para incluir todo el dia final.
   */
  private parseRangoBoundary(raw: string | null, kind: 'start' | 'end'): Date | null {
    if (!raw) return null;
    const [y, m, d] = raw.split('-').map(n => parseInt(n, 10));
    if (!y || !m || !d) return null;
    if (kind === 'start') return new Date(y, m - 1, d, 0, 0, 0, 0);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }

  /** Sin start/end -> incluye todo. Con start o end abiertos en un lado, igual filtra. */
  private dentroDelRango(fecha: Date | null, start: Date | null, end: Date | null): boolean {
    if (!start && !end) return true;
    if (!fecha) return false; // sin fecha de subida, fuera del filtro por rango
    if (start && fecha.getTime() < start.getTime()) return false;
    if (end && fecha.getTime() > end.getTime()) return false;
    return true;
  }

  /** Texto humano del rango, para el subtitulo del Excel. */
  private labelRango(r: RangoFechas): string {
    if (!r.start && !r.end) return 'Todos';
    if (r.start && r.end) return `${r.start} a ${r.end}`;
    if (r.start) return `Desde ${r.start}`;
    return `Hasta ${r.end}`;
  }

}
