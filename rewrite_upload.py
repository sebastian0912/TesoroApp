import os
import re

file_path = r"c:\Users\sebst\Documents\GITGUB\APOYO_LABORAL\TesoroApp\src\app\features\dashboard\submodule\treasury\pages\upload-treasury\upload-treasury.component.ts"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Update return type
text = text.replace(
    "private async validateInsertExcel(file: File): Promise<string[]> {",
    "private async validateInsertExcel(file: File): Promise<{ errors: string[], errorRows: any[][], headersRow: any[], totalValidRows: number }> {"
)

# 2. Add errorRows map, totalValidRows
text = text.replace(
    "const errors: string[] = [];\n\n          let headerRowIdx = -1;",
    "const errors: string[] = [];\n          const errorRows: any[][] = [];\n\n          let headerRowIdx = -1;"
)

# 3. Accents
text = text.replace(
    "c => String(c).trim().replace(/\s+/g, ' ').toUpperCase()",
    "c => String(c).trim().normalize(\"NFD\").replace(/[\u0300-\u036f]/g, \"\").replace(/\s+/g, ' ').toUpperCase()"
)

# 4. Resolve on missing headers
text = text.replace(
    "errors.push('No se encontró la fila de cabeceras válida (Debe contener CODIGO, CEDULA, NOMBRE e INGRESO) en las primeras 20 filas.');\n            return resolve(errors);",
    "errors.push('No se encontró la fila de cabeceras válida (Debe contener CODIGO, CEDULA, NOMBRE e INGRESO) en las primeras 20 filas.');\n            return resolve({ errors, errorRows: [], headersRow: [], totalValidRows: 0 });"
)

# 5. Iterating and adding to valid rows / error rows
text = text.replace(
    "const seenCedulas = new Set<string>();\n\n          for (let i = headerRowIdx + 1; i < rows.length; i++) {",
    "const seenCedulas = new Set<string>();\n          let totalValidRows = 0;\n\n          for (let i = headerRowIdx + 1; i < rows.length; i++) {"
)

# Wait, we need to completely replace the loop body to safely add the flags.
# I will use a regex block replace for the loop.

old_loop_body = """            const cedula = String(row[colIndices.CEDULA] || '').trim().toUpperCase();
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
            }"""

new_loop_body = """            const cedula = String(row[colIndices.CEDULA] || '').trim().toUpperCase();
            const ingreso = String(row[colIndices.INGRESO] || '').trim();

            let rowHasError = false;

            if (!cedula) {
              const hasOtherData = row.some((c, index) => index > 0 && String(c).trim() !== '');
              if (hasOtherData) {
                  errors.push(`Fila ${i + 1}: Fila contiene datos pero no tiene CÉDULA.`);
                  rowHasError = true;
                  errorRows.push([...row, 'Fila contiene datos pero no tiene CÉDULA.']);
              }
              continue;
            }

            // Duplicados
            if (seenCedulas.has(cedula)) {
                errors.push(`Fila ${i + 1}: Cédula duplicada en este Excel "${cedula}".`);
                rowHasError = true;
            } else {
                seenCedulas.add(cedula);
            }

            // Regla 1: Cédula solo números o inicia con X / x
            if (!/^([xX][a-zA-Z0-9]+|\d+)$/.test(cedula)) {
              errors.push(`Fila ${i + 1}: Cédula inválida "${cedula}". Debe ser numérica o iniciar con X.`);
              rowHasError = true;
            }

            // Regla 2: INGRESO no vacío, no solo "00:00:00", numérico de Excel o fecha de String válida
            if (!ingreso) {
              errors.push(`Fila ${i + 1}: La fecha de INGRESO está vacía (Cédula: ${cedula}).`);
              rowHasError = true;
            } else if (ingreso === '00:00:00' || ingreso === '0') {
               errors.push(`Fila ${i + 1}: La fecha de INGRESO es inválida (solo hora o cero) (Cédula: ${cedula}).`);
               rowHasError = true;
            } else {
               if (!this.isValidDateOrExcelSerial(row[colIndices.INGRESO])) {
                   errors.push(`Fila ${i + 1}: La fecha de INGRESO "${ingreso}" no parece ser válida (Cédula: ${cedula}).`);
                   rowHasError = true;
               }
            }

            if (rowHasError) {
                errorRows.push([...row, errors[errors.length - 1]]);
            } else {
                totalValidRows++;
            }"""

text = text.replace(old_loop_body, new_loop_body)

# 6. Final resolves
text = text.replace("resolve(errors);", "resolve({ errors, errorRows, headersRow: [...rows[headerRowIdx], 'MOTIVO_ERROR'], totalValidRows });")
text = text.replace("resolve(['Error al leer el archivo Excel para validación. Verifique que no esté corrupto o protegido.']);", "resolve({ errors: ['Error al leer Excel'], errorRows: [], headersRow: [], totalValidRows: 0 });")
text = text.replace("resolve(['Error al intentar cargar el archivo.']);", "resolve({ errors: ['Error al cargar el archivo.'], errorRows: [], headersRow: [], totalValidRows: 0 });")

# 7. handleFile
old_handle_file = """      // 1) PRE-VALIDATION EN EL FRONTEND (Solo para insert)
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
      }"""

new_handle_file = """      // 1) PRE-VALIDATION EN EL FRONTEND (Solo para insert)
      if (kind === 'insert') {
        Swal.fire({ icon: 'info', title: 'Validando formato...', html: 'Revisando reglas de Excel (Cédula e Ingreso)...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
        const valRes = await this.validateInsertExcel(file);
        if (valRes.errors.length > 0) {
          this.busy = false;

          let blockUpload = false;
          if (valRes.totalValidRows === 0) {
              blockUpload = true;
          } else {
              const res = await Swal.fire({
                  icon: 'warning',
                  title: 'Se encontraron errores',
                  html: `<p>Hay <b>${valRes.errors.length} filas</b> con errores previstos (ej. Ingreso vacío).</p>
                         <p>Las filas inválidas se descartarán y se importarán las otras. ¿Deseas descargar un Excel con los motivos y continuar subiendo las <b>${valRes.totalValidRows} correctas</b>?</p>`,
                  showCancelButton: true,
                  showDenyButton: true,
                  confirmButtonText: 'Descargar y continuar',
                  denyButtonText: 'Continuar sin descargar',
                  cancelButtonText: 'Cancelar',
                  width: '600px'
              });

              if (res.isDismissed || res.isDenied === undefined) {
                  blockUpload = true;
              }

              if (res.isConfirmed) {
                  const errorSheetData = [valRes.headersRow, ...valRes.errorRows];
                  const ws = XLSX.utils.aoa_to_sheet(errorSheetData);
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "Errores_Importacion");
                  XLSX.writeFile(wb, "empleados_errores.xlsx");
              }
              
              if (res.isDenied || res.isConfirmed) {
                 blockUpload = false;
              }
          }

          if (blockUpload) {
              input.value = '';
              if (valRes.totalValidRows === 0) {
                 Swal.fire('Error', 'El archivo no contiene filas válidas.', 'error');
              }
              return;
          }
        }
      }"""

# Need to escape dollars for python formatting? No since this is raw string building
text = text.replace(old_handle_file, new_handle_file)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done")