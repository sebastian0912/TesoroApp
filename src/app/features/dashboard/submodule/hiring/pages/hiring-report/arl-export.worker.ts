/// <reference lib="webworker" />

import * as XLSX from 'xlsx';

// Tipos requeridos para el worker
export interface ArlWorkerData {
    cruceRows: string[][];         // Datos del CRUCE (Excel 1, procesado)
    arlRows: any[][];              // Datos del ARL (Excel 2, raw o semiprocesado)
    headerRowCruce: string[];      // Headers reales del archivo de CRUCE
    indices: {                     // Índices detectados para ARL
        dniTrabajador: number;
        inicioVigencia: number;
    };
    errorsMap: Record<string, string[]>; // Mapa de cédula -> lista de errores (para pintar rojo/agregar columna)
}

addEventListener('message', async ({ data }: { data: ArlWorkerData }) => {
    try {
        const { cruceRows, arlRows, headerRowCruce, indices, errorsMap } = data;

        // 1. Preparamos el libro de salida
        // Usamos SheetJS (xlsx) dentro del worker porque es más ligero y síncrono para workers que ExcelJS
        // O si prefieres ExcelJS, tendríamos que importarlo.
        // Dado que el proyecto usa 'xlsx' y 'exceljs', y el usuario pidió ExcelJS para estilos:
        // NOTA: ExcelJS no funciona bien en Worker estándar sin polyfills de Buffer/stream.
        // MEJOR OPCIÓN: Usar XLSX para armar la data pesada y devolver la matriz o json listo,
        // o construir un CSV/HTML rápido.
        // PERO el usuario quiere "Excel Arl" y "ExcelJS" suele usarse para estilos.
        // Sin embargo, XLSX también soporta estilos básicos en versión Pro, o escritura básica en community.
        // Para simplificar y evitar problemas de dependencias en worker (Buffer is not defined),
        // usaremos lógica de cruce PURO aquí y devolveremos un objeto plano o BLOB binario usando XLSX.write.

        // Vamos a usar la lógica de cruce original.

        // 2. Indexar ARL para búsqueda O(1)
        const arlMap = new Map<string, any[][]>();

        arlRows.forEach((row) => {
            const cedula = normalizeCedula(row[indices.dniTrabajador]);
            if (cedula) {
                if (!arlMap.has(cedula)) {
                    arlMap.set(cedula, []);
                }
                arlMap.get(cedula)!.push(row);
            }
        });

        // 3. Construir filas de salida
        // Headers Salida: 
        // [Numero de Cedula, Arl, ARL_FECHAS, FECHA EN ARL, FECHA INGRESO SUBIDA CONTRATACION, Errores] + [Headers Originales Cruce]

        const outputHeaders = [
            'Numero de Cedula',
            'Arl',
            'ARL_FECHAS',
            'FECHA EN ARL',
            'FECHA INGRESO SUBIDA CONTRATACION',
            'Errores',
            ...headerRowCruce
        ];

        const outputData: any[][] = [outputHeaders];

        cruceRows.forEach((cruceRow) => {
            // cruceRow: [ .... ] es un array de strings (ya normalizado en el componente)
            // Índices hardcoded del componente original:
            // Col 1 = Cedula, Col 8 = Fecha Ingreso (según hiring-report.ts indicesFechas)
            // OJO: cruceRow en el componente tenía 195 columnas llenas de '-'.

            const cedulaCruce = normalizeCedula(cruceRow[1]);
            const fechaIngresoCruce = cruceRow[8];

            // Buscar en ARL
            const arlRowsForCedula = arlMap.get(cedulaCruce);

            let estadoArl = 'NO';
            let estadoFechas = 'NO';
            let fechaEnArl = 'SIN DATA';

            // Lógica de validación
            if (arlRowsForCedula && arlRowsForCedula.length > 0) {
                estadoArl = 'SI';
                const dCruce = parseDateStr(fechaIngresoCruce);
                let matchFound = false;
                let fechasArlTexto: string[] = [];

                for (const arlRow of arlRowsForCedula) {
                    const rawFechaArl = arlRow[indices.inicioVigencia];
                    const dArl = parseDateAny(rawFechaArl);

                    if (dArl) {
                        fechasArlTexto.push(formatDate(dArl));
                    } else {
                        fechasArlTexto.push(String(rawFechaArl || ''));
                    }

                    if (dCruce && dArl && dCruce.getTime() === dArl.getTime()) {
                        matchFound = true;
                    }
                }

                fechaEnArl = Array.from(new Set(fechasArlTexto)).join(' o ');

                if (matchFound) {
                    estadoFechas = 'SI';
                }
            }

            // Errores previos (de validación backend)
            const erroresPrevios = errorsMap[cedulaCruce] ? errorsMap[cedulaCruce].join('; ') : '';

            // Armar fila
            const newRow = [
                cedulaCruce,          // Numero de Cedula
                estadoArl,           // Arl
                estadoFechas,        // ARL_FECHAS
                fechaEnArl,          // FECHA EN ARL
                fechaIngresoCruce,   // FECHA INGRESO...
                erroresPrevios,      // Errores
                ...cruceRow          // Resto original
            ];

            outputData.push(newRow);
        });

        // 4. Generar Libro
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(outputData);

        // Ajustes visuales básicos (anchos)
        if (!ws['!cols']) ws['!cols'] = [];
        ws['!cols'][0] = { wch: 15 }; // Cedula
        ws['!cols'][1] = { wch: 8 };  // ARL
        ws['!cols'][2] = { wch: 12 }; // Fechas
        ws['!cols'][3] = { wch: 15 }; // Fecha ARL
        ws['!cols'][4] = { wch: 15 }; // Fecha Ingreso
        ws['!cols'][5] = { wch: 40 }; // Errores

        XLSX.utils.book_append_sheet(wb, ws, 'Reporte ARL');

        // 5. Escribir binario
        const fileData = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });

        // 6. Devolver
        // Removed transfer list [fileData.buffer] to prevent "Failed to convert value to object" error
        // if fileData is not exactly a TypedArray with valid buffer. Cloning is safer.
        postMessage({ success: true, fileData });

    } catch (error) {
        postMessage({ success: false, error: String(error) });
    }
});

// Helpers locales del Worker

function normalizeCedula(val: any): string {
    if (val == null) return '';
    let str = String(val).trim();
    // Remover .0 al final si es número string
    str = str.replace(/\.0$/, '');

    // Normalizar X
    // (Misma lógica simplificada que el componente)
    const upper = str.toUpperCase();
    if (upper.startsWith('X')) return upper;

    // Solo dígitos
    return str.replace(/[^\d]/g, '');
}

function parseDateStr(d: string): Date | null {
    if (!d || d.length < 8) return null;
    const parts = d.trim().split('/');
    if (parts.length !== 3) return null;
    // dd/mm/yyyy
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

function parseDateAny(val: any): Date | null {
    if (!val) return null;
    // Prioritize string parsing for dd/mm/yyyy as per user request
    const str = String(val).trim();
    if (str.includes('/')) return parseDateStr(str);

    // Fallback if formatting was missed
    if (typeof val === 'number') {
        const ms = Date.UTC(1899, 11, 30) + (val * 24 * 60 * 60 * 1000);
        const d = new Date(ms);
        if (!isNaN(d.getTime())) {
            return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }
    }

    // YYYY-MM-DD
    if (str.includes('-')) {
        const parts = str.split('-');
        if (parts[0].length === 4) return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
    }
    return null;
}

function formatDate(d: Date): string {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}
