import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import Swal from 'sweetalert2';
import { TesoreriaService } from '../../service/teroreria/tesoreria.service';

@Component({
  selector: 'app-upload-treasury',
  imports: [InfoCardComponent, CommonModule, MatCardModule],
  templateUrl: './upload-treasury.component.html',
  styleUrl: './upload-treasury.component.css'
})
export class UploadTreasuryComponent {

  constructor(private tesoreriaService: TesoreriaService) { }

  @ViewChild('fileInsert', { static: false }) fileInsert!: ElementRef<HTMLInputElement>;
  @ViewChild('fileSaldos', { static: false }) fileSaldos!: ElementRef<HTMLInputElement>;
  @ViewChild('fileEliminar', { static: false }) fileEliminar!: ElementRef<HTMLInputElement>;

  busy = false;

  cards = [
    { id: 'insert' as const, title: 'Insertar empleados (masivo)', imageUrl: 'icons/cards/excel.png', value: 0 },
    { id: 'saldos' as const, title: 'Actualizar saldos (masivo)', imageUrl: 'icons/cards/excel.png', value: 0 },
    { id: 'eliminar' as const, title: 'Eliminar empleados (masivo)', imageUrl: 'icons/cards/excel.png', value: 0 }
  ];

  onCardClick(cardId: 'insert' | 'saldos' | 'eliminar') {
    if (this.busy) return;
    if (cardId === 'insert') this.fileInsert?.nativeElement.click();
    if (cardId === 'saldos') this.fileSaldos?.nativeElement.click();
    if (cardId === 'eliminar') this.fileEliminar?.nativeElement.click();
  }

  // 🔧 Helper en tu clase
  private stripCommasDots(val: unknown): string {
    if (val === null || val === undefined) return '';
    return String(val).replace(/[.,]/g, '').trim(); // conserva ceros a la izquierda
  }


  async handleFile(kind: 'insert' | 'saldos' | 'eliminar', ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      this.busy = true;

      const allRows = await this.readExcelRows(file); // arrays crudos por fila

      if (!allRows.length) {
        Swal.fire({ icon: 'warning', title: 'Archivo vacío', text: 'No se encontraron filas.' });
        return;
      }

      if (kind === 'insert') {
        // == Inserción: datos a partir de fila 4 ==
        let rowsFromRow4 = allRows.slice(3); // fila 4 -> idx 3

        let cleaned = rowsFromRow4
          .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ''))
          .map(r => this.normalizeColumns(r, 23))
          .map(r => {
            // ⛏️ limpiar columnas 0 y 1 (sin comas ni puntos)
            r[0] = this.stripCommasDots(r[0]);
            r[1] = this.stripCommasDots(r[1]);
            return this.fixInsertRow(r);
          });

        // Quitar cabecera si viene en la fila 4
        if (cleaned.length && this.isHeaderRow(cleaned[0])) cleaned = cleaned.slice(1);

        if (!cleaned.length) {
          Swal.fire({ icon: 'warning', title: 'Sin datos', text: 'Desde la fila 4 no se encontraron registros.' });
          return;
        }

        const bad = cleaned.find(r => r.length !== 23);
        if (bad) {
          Swal.fire({
            icon: 'error',
            title: 'Formato inválido',
            html: 'El archivo de <b>inserción</b> debe tener <b>exactamente 23 columnas</b> y los datos comienzan en la <b>fila 4</b>.'
          });
          return;
        }

        Swal.fire({ icon: 'info', title: 'Cargando empleados...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        console.log('Empleados a insertar:', cleaned);
        //await this.tesoreriaService.añadirEmpleado(cleaned);
        Swal.fire({ icon: 'success', title: 'Inserción exitosa', text: 'Se cargaron los empleados correctamente.' });
        this.bumpCard('insert');
      } else if (kind === 'saldos') {
        // == Saldos: 2 columnas [numero_de_documento, saldos] ==
        const rows = allRows
          .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ''))
          .map(r => this.normalizeColumns(r, 2));

        // Quitar cabecera si viene
        if (rows.length && this.isHeaderRow(rows[0])) rows.shift();

        const bad = rows.find(r => r.length < 2 || String(r[0]).trim() === '');
        if (bad) {
          Swal.fire({
            icon: 'error',
            title: 'Formato inválido',
            html: 'El archivo de <b>saldos</b> debe tener <b>2 columnas</b> (numero_de_documento, saldos) y sin encabezado.'
          });
          return;
        }

        Swal.fire({ icon: 'info', title: 'Actualizando saldos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        let ok = 0, fail = 0;
        for (const r of rows) {
          const cedula = String(r[0]).trim();
          const saldos = String(r[1] ?? '').trim();
          if (!cedula || saldos === '' || saldos === 'null' || saldos === 'undefined') { fail++; continue; }
          try {
            await this.tesoreriaService.actualizarEmpleado(cedula, saldos);
            ok++;
          } catch {
            fail++;
          }
        }

        Swal.fire({
          icon: fail ? 'warning' : 'success',
          title: 'Proceso finalizado',
          html: `Saldos actualizados: <b>${ok}</b> OK, <b>${fail}</b> con error.`
        });
        this.bumpCard('saldos');

      } else if (kind === 'eliminar') {
        // == Eliminar (bloquear): 1 columna [numero_de_documento] ==
        const rows = allRows
          .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ''))
          .map(r => this.normalizeColumns(r, 1)); // nos quedamos con la primera celda (cédula)

        // Quitar cabecera si viene (CEDULA / CÉDULA / CODIGO, etc.)
        if (rows.length && this.isHeaderRow(rows[0])) rows.shift();

        const cedulas = rows
          .map(r => String(r[0] ?? '').trim())
          .filter(v => v.length > 0);

        if (!cedulas.length) {
          Swal.fire({ icon: 'error', title: 'Sin cédulas', text: 'El archivo de eliminar debe contener al menos una cédula.' });
          return;
        }

        Swal.fire({ icon: 'info', title: 'Bloqueando empleados...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        let ok = 0, fail = 0;
        for (const cedula of cedulas) {
          try {
            // Bloqueo lógico: estado siempre true
            await this.tesoreriaService.bloquearEmpleado(cedula, true);
            ok++;
          } catch {
            fail++;
          }
        }

        Swal.fire({
          icon: fail ? 'warning' : 'success',
          title: 'Proceso finalizado',
          html: `Empleados bloqueados: <b>${ok}</b> OK, <b>${fail}</b> con error.`
        });
        this.bumpCard('eliminar');
      }

    } catch (e: any) {
      Swal.fire({ icon: 'error', title: 'Error', text: e?.message ?? 'Error procesando el archivo' });
    } finally {
      this.busy = false;
      (ev.target as HTMLInputElement).value = ''; // permite recargar el mismo archivo
    }
  }

  private bumpCard(id: 'insert' | 'saldos' | 'eliminar') {
    const card = this.cards.find(c => c.id === id);
    if (card) card.value = (card.value ?? 0) + 1;
  }

  /** Detecta si una fila coincide con cabecera común (CODIGO, CEDULA, etc.) */
  private isHeaderRow(row: any[]): boolean {
    const first = String(row[0] ?? '').toUpperCase();
    return ['CODIGO', 'CÓDIGO', 'CEDULA', 'CÉDULA', 'NUMERO', 'N°', 'DOCUMENTO', 'NÚMERO'].includes(first);
  }

  /** Normaliza a N columnas: recorta o rellena con '' al final */
  private normalizeColumns(row: any[], expected: number): any[] {
    const trimmed = row.map(c => (typeof c === 'string' ? c.trim() : c));
    if (trimmed.length === expected) return trimmed;
    if (trimmed.length > expected) return trimmed.slice(0, expected);
    const pad = Array.from({ length: expected - trimmed.length }, () => '');
    return [...trimmed, ...pad];
  }

  /** Ajustes típicos para insert (preservar strings, fecha Excel, números) */
  private fixInsertRow(row: any[]): any[] {
    const out = row.map(c => (typeof c === 'string' ? c.trim() : c));

    // Strings que podrían requerir ceros a la izquierda
    if (out[0] != null) out[0] = String(out[0]).trim(); // CODIGO
    if (out[1] != null) out[1] = String(out[1]).trim(); // CEDULA

    // Fecha de ingreso (idx 3)
    out[3] = this.asExcelDateString(out[3]); // "YYYY-MM-DD"

    // Campos numéricos comunes (ajusta según tu modelo)
    const numericIdx = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21];
    for (const idx of numericIdx) {
      const v = out[idx];
      if (v === '' || v == null) continue;
      const s = String(v).replace(/\./g, '').replace(',', '.'); // "1.234,56" -> "1234.56"
      const n = Number(s);
      out[idx] = isNaN(n) ? '' : n;
    }
    return out;
  }

  /** Convierte serial Excel a "YYYY-MM-DD" o retorna string tal cual */
  private asExcelDateString(v: any): string {
    if (v == null || v === '') return '';
    if (typeof v === 'number') {
      const utcDays = Math.floor(v - 25569);
      const date = new Date(utcDays * 86400 * 1000);
      const yyyy = date.getUTCFullYear();
      const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(date.getUTCDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    return String(v).trim();
  }

  // ===== Solo Excel (.xlsx/.xls), primera hoja =====
  private async readExcelRows(file: File): Promise<any[][]> {
    const name = file.name.toLowerCase();
    if (!(name.endsWith('.xlsx') || name.endsWith('.xls'))) {
      throw new Error('Solo se permiten archivos Excel (.xlsx, .xls).');
    }
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    // header:1 => arrays crudos; raw:false => convierte fechas/números legibles
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });
    return rows ?? [];
  }
}
