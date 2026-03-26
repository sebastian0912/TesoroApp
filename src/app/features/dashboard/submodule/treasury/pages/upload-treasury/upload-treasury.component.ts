import { InfoCardComponent } from '@/app/shared/components/info-card/info-card.component';
import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { TesoreriaService, ExcelImportResponse } from '../../service/teroreria/tesoreria.service';

@Component({
  selector: 'app-upload-treasury',
  imports: [InfoCardComponent, CommonModule, MatCardModule, MatIconModule, MatButtonModule],
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

  async downloadTemplate(id: 'insert' | 'saldos' | 'eliminar') {
    let url = '';
    let filename = '';
    if (id === 'insert') {
      url = 'templates/BASE.xlsx';
      filename = 'BASE.xlsx';
    } else if (id === 'saldos') {
      url = 'templates/tesoreria_template_saldos_fondos.xlsx';
      filename = 'tesoreria_template_saldos_fondos.xlsx';
    } else if (id === 'eliminar') {
      url = 'templates/tesoreria_template_estados_min.xlsx';
      filename = 'tesoreria_template_estados_min.xlsx';
    }

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('No se pudo descargar el template');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      console.error('Error descargando template:', e);
      Swal.fire('Error', 'No se pudo descargar el template. Verifique que el archivo exista.', 'error');
    }
  }

  private async validateInsertExcel(file: File): Promise<string[]> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0]; // O BASE
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
          const errors: string[] = [];

          let headerRowIdx = -1;
          const colIndices = { CODIGO: -1, CEDULA: -1, NOMBRE: -1, INGRESO: -1 };

          // Buscar la fila de encabezados en las primeras 20 filas (Normalizando cabeceras)
          for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            const normalizedRow = row.map(c => String(c).trim().replace(/\s+/g, ' ').toUpperCase());
            
            const reqCols = ['CODIGO', 'CEDULA', 'NOMBRE', 'INGRESO'];
            const hasAllReq = reqCols.every(req => normalizedRow.includes(req));
            
            if (hasAllReq) {
              headerRowIdx = i;
              colIndices.CODIGO = normalizedRow.indexOf('CODIGO');
              colIndices.CEDULA = normalizedRow.indexOf('CEDULA');
              colIndices.NOMBRE = normalizedRow.indexOf('NOMBRE');
              colIndices.INGRESO = normalizedRow.indexOf('INGRESO');
              break;
            }
          }

          if (headerRowIdx === -1) {
            errors.push('No se encontró la fila de cabeceras válida (Debe contener CODIGO, CEDULA, NOMBRE e INGRESO) en las primeras 20 filas.');
            return resolve(errors);
          }

          const seenCedulas = new Set<string>();

          for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0 || row.every(c => String(c).trim() === '')) continue; // omitir vacías

            const cedula = String(row[colIndices.CEDULA] || '').trim().toUpperCase();
            const ingreso = String(row[colIndices.INGRESO] || '').trim();

            if (!cedula) {
              const hasOtherData = row.some((c, index) => index > 0 && String(c).trim() !== '');
              if (hasOtherData) {
                  // If it has data but no cedula, we can flag it as skipped/error, the user wants us to be serious. 
                  // Let's flag row as error if it has other data but no cedula
                  errors.push(`Fila ${i + 1}: Fila contiene datos pero no tiene CÉDULA.`);
              }
              continue;
            }

            // Duplicados
            if (seenCedulas.has(cedula)) {
                errors.push(`Fila ${i + 1}: Cédula duplicada en este Excel "${cedula}".`);
            } else {
                seenCedulas.add(cedula);
            }

            // Regla 1: Cédula solo números o inicia con X / x
            if (!/^([xX][a-zA-Z0-9]+|\d+)$/.test(cedula)) {
              errors.push(`Fila ${i + 1}: Cédula inválida "${cedula}". Debe ser numérica o iniciar con X.`);
            }

            // Regla 2: INGRESO no vacío, no solo "00:00:00", numérico de Excel o fecha de String válida
            if (!ingreso) {
              errors.push(`Fila ${i + 1}: La fecha de INGRESO está vacía (Cédula: ${cedula}).`);
            } else if (ingreso === '00:00:00' || ingreso === '0') {
               errors.push(`Fila ${i + 1}: La fecha de INGRESO es inválida (solo hora o cero) (Cédula: ${cedula}).`);
            } else {
               if (!this.isValidDateOrExcelSerial(row[colIndices.INGRESO])) {
                   errors.push(`Fila ${i + 1}: La fecha de INGRESO "${ingreso}" no parece ser válida (Cédula: ${cedula}).`);
               }
            }
          }
          resolve(errors);
        } catch (err) {
          resolve(['Error al leer el archivo Excel para validación. Verifique que no esté corrupto o protegido.']);
        }
      };
      reader.onerror = () => resolve(['Error al intentar cargar el archivo.']);
      reader.readAsArrayBuffer(file);
    });
  }

  private isValidDateOrExcelSerial(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'number') {
        return value > 1; // Simple heuristic for valid excel numbers (which act as dates)
    }
    const strVal = String(value).trim();
    if (/^\d+(\.\d*)?$/.test(strVal) && Number(strVal) > 1) return true;
    // Check YYYY-MM-DD
    const d = new Date(strVal);
    if (!isNaN(d.getTime())) return true;
    
    // Other common patterns DD/MM/YYYY or YYYY/MM/DD
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(strVal)) return true;
    if (/^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(strVal)) return true;
    
    return false;
  }

  async handleFile(kind: 'insert' | 'saldos' | 'eliminar', ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Validate extension
    const name = file.name.toLowerCase();
    if (kind === 'insert' && !name.endsWith('.xlsx')) {
      Swal.fire({ icon: 'error', title: 'Archivo inválido', text: 'Para insertar empleados solo se permiten archivos .xlsx.' });
      input.value = '';
      return;
    }
    if (kind !== 'insert' && !(name.endsWith('.xlsx') || name.endsWith('.xls'))) {
      Swal.fire({ icon: 'error', title: 'Archivo inválido', text: 'Solo se permiten archivos Excel (.xlsx, .xls).' });
      input.value = '';
      return;
    }

    try {
      this.busy = true;

      // 1) PRE-VALIDATION EN EL FRONTEND (Solo para insert)
      if (kind === 'insert') {
        Swal.fire({ icon: 'info', title: 'Validando formato...', html: 'Revisando reglas de Excel (Cédula e Ingreso)...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const validationErrors = await this.validateInsertExcel(file);
        if (validationErrors.length > 0) {
          this.busy = false;
          input.value = '';
          Swal.fire({
            icon: 'error',
            title: 'Errores pre-validación Excel',
            html: `<div style="text-align: left; max-height: 200px; overflow-y: auto;">
                     <ul style="padding-left: 20px;">${validationErrors.map(e => `<li>${e}</li>`).join('')}</ul>
                   </div>
                   <br><small>Corrija estos errores en su Excel antes de intentar subirlo de nuevo.</small>`,
            width: '600px'
          });
          return;
        }
      }

      Swal.fire({ icon: 'info', title: 'Procesando archivo...', html: 'El backend está importando y mapeando el archivo Excel.', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

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
      
      const escapeHtml = (unsafe: string) => {
        return unsafe.replace(/&/g, "&amp;")
                     .replace(/</g, "&lt;")
                     .replace(/>/g, "&gt;")
                     .replace(/"/g, "&quot;")
                     .replace(/'/g, "&#039;");
      };

      html += `
        <hr/>
        <div style="text-align: left; color: red;">
          <p><b>Errores Encontrados: ${res.errors_count}</b></p>
          <ul style="max-height: 150px; overflow-y: auto;">
            ${res.errors_sample.map(e => `<li>Fila ${e.row}: ${escapeHtml(String(e.error))}</li>`).join('')}
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
