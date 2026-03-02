import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import Swal from 'sweetalert2';
import { TesoreriaService, ExcelImportResponse } from '../../service/teroreria/tesoreria.service';

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
    { id: 'eliminar' as const, title: 'Actualizar Estados (masivo)', imageUrl: 'icons/cards/excel.png', value: 0 }
  ];

  onCardClick(cardId: 'insert' | 'saldos' | 'eliminar') {
    if (this.busy) return;
    if (cardId === 'insert') this.fileInsert?.nativeElement.click();
    if (cardId === 'saldos') this.fileSaldos?.nativeElement.click();
    if (cardId === 'eliminar') this.fileEliminar?.nativeElement.click();
  }

  async handleFile(kind: 'insert' | 'saldos' | 'eliminar', ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate extension
    const name = file.name.toLowerCase();
    if (!(name.endsWith('.xlsx') || name.endsWith('.xls'))) {
      Swal.fire({ icon: 'error', title: 'Archivo inválido', text: 'Solo se permiten archivos Excel (.xlsx, .xls).' });
      input.value = '';
      return;
    }

    try {
      this.busy = true;
      Swal.fire({ icon: 'info', title: 'Procesando archivo...', html: 'El backend está leyendo y validando el archivo Excel.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      let res: ExcelImportResponse;

      if (kind === 'insert') {
        res = await this.tesoreriaService.importarPersonasExcel(file);
      } else if (kind === 'saldos') {
        res = await this.tesoreriaService.importarSaldosFondosExcel(file);
      } else { // eliminar
        res = await this.tesoreriaService.importarEstadosExcel(file);
      }

      this.showImportResult(res, kind);

    } catch (e: any) {
      // Backend error often comes in e.error
      console.error(e);
      let errorMsg = 'Error comunicándose con el backend';
      if (e.error) {
        if (typeof e.error === 'string') errorMsg = e.error;
        else if (e.error.error) errorMsg = e.error.error;
        else if (e.error.detail) errorMsg = e.error.detail;
      } else if (e.message) {
        errorMsg = e.message;
      }

      Swal.fire({ icon: 'error', title: 'Error de importación', html: `<b>Motivo:</b><br>${errorMsg}` });
    } finally {
      this.busy = false;
      input.value = ''; // clears the input so you can select the same file again
    }
  }

  private showImportResult(res: ExcelImportResponse, kind: 'insert' | 'saldos' | 'eliminar') {
    this.bumpCard(kind);

    const hasErrors = (res.errors_count ?? 0) > 0;

    let html = `
      <div style="text-align: left;">
        <p><b>Total Filas Leídas:</b> ${res.total_rows ?? 0}</p>
        <p><b>Procesadas (Válidas):</b> ${res.processed ?? 0}</p>
        <p><b>Nuevos Creados:</b> ${res.created ?? 0}</p>
        <p><b>Actualizados:</b> ${res.updated ?? 0}</p>
        <p><b>Omitidas (Sin cambios/Vacías):</b> ${res.skipped ?? 0}</p>
      </div>
    `;

    if (hasErrors && Array.isArray(res.errors_sample)) {
      html += `
        <hr/>
        <div style="text-align: left; color: red;">
          <p><b>Errores Encontrados: ${res.errors_count}</b></p>
          <ul style="max-height: 150px; overflow-y: auto;">
            ${res.errors_sample.map(e => `<li>Fila ${e.row}: ${e.error}</li>`).join('')}
          </ul>
        </div>
      `;
    }

    Swal.fire({
      icon: hasErrors ? 'warning' : 'success',
      title: 'Importación Finalizada',
      html,
      width: '600px'
    });
  }

  private bumpCard(id: 'insert' | 'saldos' | 'eliminar') {
    const card = this.cards.find(c => c.id === id);
    if (card) card.value = (card.value ?? 0) + 1;
  }

}
