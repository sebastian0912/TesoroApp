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
        await this.tesoreriaService.añadirEmpleado(cleaned);
        Swal.fire({ icon: 'success', title: 'Inserción exitosa', text: 'Se cargaron los empleados correctamente.' });
        this.bumpCard('insert');
      }
      else if (kind === 'saldos') {
        // == Saldos/Fondos (masivo): 2 o 3 columnas [cedula, saldos(, fondos)] ==
        const raw = allRows
          .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ''))
          .map(r => this.normalizeColumns(r, 3)); // hasta 3 columnas

        // Quitar cabecera si viene
        if (raw.length && this.isHeaderRow(raw[0])) raw.shift();

        // Normaliza y deduplica
        const rows: Array<{ cedula: string; saldos?: string | null; fondos?: string | null }> = [];
        const seen = new Set<string>();

        const sanitize = (v: any): string | null => {
          if (v === null || v === undefined) return null;
          const s = String(v).trim();
          if (!s || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') return null;
          // opcional: si vienes con separadores de miles "154.450" o "154,450", límpialos aquí
          return s;
        };

        for (const r of raw) {
          const cedula = String(r[0] ?? '').trim();
          const saldos = sanitize(r[1]);
          const fondos = sanitize(r[2]); // puede venir vacío en archivos de 2 columnas

          // descarta filas sin cédula o sin al menos un valor (saldos/fondos)
          if (!cedula || (saldos === null && fondos === null)) continue;

          if (!seen.has(cedula)) {
            rows.push({ cedula, saldos, fondos });
            seen.add(cedula);
          }
        }

        if (!rows.length) {
          Swal.fire({
            icon: 'error',
            title: 'Sin datos válidos',
            html: 'Debes incluir al menos una fila con <b>cédula</b> y <b>saldo</b> (y opcionalmente <b>fondo</b>).'
          });
          return;
        }

        Swal.fire({ icon: 'info', title: 'Actualizando saldos...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
          const res = await this.tesoreriaService.actualizarSaldosMasivo(rows);

          const noenc = (res.no_encontrados || []).slice(0, 10);
          const more = Math.max(0, (res.no_encontrados || []).length - noenc.length);

          Swal.fire({
            icon: res.errores ? 'warning' : 'success',
            title: 'Proceso finalizado',
            html: `
        Recibidos: <b>${res.total_recibidos}</b><br>
        Actualizados: <b>${res.actualizados}</b><br>
        Sin cambios: <b>${res.sin_cambios}</b><br>
        No encontrados: <b>${(res.no_encontrados || []).length}</b>${noenc.length
                ? `<br><small>${noenc.join(', ')}${more ? ` y ${more} más…` : ''}</small>`
                : ''
              }<br>
        Errores: <b>${res.errores}</b>
      `
          });

          this.bumpCard('saldos');
        } catch (e) {
          console.error(e);
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo completar la actualización masiva.' });
        }
      }

      else if (kind === 'eliminar') {
        // == Desactivar (activo=false) : 1 columna [numero_de_documento] ==
        const rows = allRows
          .filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ''))
          .map(r => this.normalizeColumns(r, 1)); // solo 1 columna

        // Quitar cabecera si viene (CEDULA / CÉDULA / CODIGO, etc.)
        if (rows.length && this.isHeaderRow(rows[0])) rows.shift();

        // Cédulas normalizadas y únicas
        const cedulas = Array.from(new Set(
          rows
            .map(r => String(r[0] ?? '').trim())
            .filter(v => v.length > 0)
        ));

        if (!cedulas.length) {
          Swal.fire({
            icon: 'error',
            title: 'Sin cédulas',
            text: 'El archivo debe contener al menos una cédula.'
          });
          return;
        }

        Swal.fire({ icon: 'info', title: 'Desactivando empleados...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

        try {
          // Llamada MASIVA (una sola petición)
          const res = await this.tesoreriaService.actualizarEstadosMasivo({
            documentos: cedulas,
            activo: false
          });

          Swal.fire({
            icon: (res.errores && res.errores > 0) ? 'warning' : 'success',
            title: 'Proceso finalizado',
            html: `
        Recibidos: <b>${res.total_recibidos}</b><br>
        Actualizados: <b>${res.actualizados}</b><br>
        Ya en estado: <b>${res.ya_en_estado}</b><br>
        No encontrados: <b>${(res.no_encontrados || []).length}</b><br>
        Errores: <b>${res.errores}</b>
      `
          });
          this.bumpCard('eliminar');
        } catch (e) {
          Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo completar la desactivación masiva.' });
        }
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
