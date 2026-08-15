/**
 * Lectura y cruce del Excel de ARL.
 *
 * El archivo es el export masivo del portal de la ARL (una fila por trabajador),
 * no un documento por candidato. Antes esta lógica vivía dentro de
 * `hiring-report.component.ts`; se extrajo aquí para que el botón "Finalizar
 * contratación" del pipeline valide EXACTAMENTE con las mismas reglas y no se
 * abran dos criterios distintos de "el ARL está bien".
 *
 * Columnas obligatorias (se buscan por contenido, no por posición):
 *   - una que contenga "DNI" y "TRABAJADOR"
 *   - una que contenga "INICIO" y "VIGENCIA"
 */

import * as XLSX from 'xlsx';

export interface ArlIndex {
  /** cédula normalizada -> fechas de inicio de vigencia encontradas */
  porCedula: Map<string, Date[]>;
  /** Texto formateado (DD/MM/YYYY) por cédula, para mensajes de error. */
  textoPorCedula: Map<string, string[]>;
  /** Nombre del archivo del que se leyó, para mostrarlo en la UI. */
  nombreArchivo: string;
  /** Filas de datos leídas (sin encabezado). */
  totalFilas: number;
}

export type ArlHallazgoTipo = 'sin_arl' | 'fecha_distinta' | 'duplicado';

export interface ArlHallazgo {
  tipo: ArlHallazgoTipo;
  cedula: string;
  mensaje: string;
}

export interface ArlResultado {
  ok: boolean;
  /** Primera fecha del ARL que se encontró (ISO YYYY-MM-DD) o null. */
  fechaIso: string | null;
  hallazgos: ArlHallazgo[];
}

export class ArlExcelError extends Error {
  constructor(
    message: string,
    readonly detalleHtml: string,
  ) {
    super(message);
    this.name = 'ArlExcelError';
  }
}

/** Solo dígitos; conserva el prefijo X de los documentos especiales. */
export function normalizarCedula(val: any): string {
  if (!val) return '';
  const s = String(val).trim().toUpperCase();
  if (s.startsWith('X')) return s.replace(/\./g, '').replace(/\s/g, '');
  return s.replace(/[^\d]/g, '');
}

/** Fecha a medianoche local, para comparar por día sin arrastrar horas. */
function aMedianoche(y: number, m: number, d: number): Date {
  return new Date(y, m, d);
}

/**
 * Parsea una celda de fecha del ARL. El portal exporta de forma inconsistente:
 * serial de Excel, ISO con guiones, o DD/MM/YYYY.
 */
export function parseFechaArl(raw: any): Date | null {
  if (raw == null || raw === '') return null;

  if (raw instanceof Date) {
    return isNaN(raw.getTime())
      ? null
      : aMedianoche(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }

  // Serial de Excel (días desde 1899-12-30).
  if (typeof raw === 'number') {
    const ms = Date.UTC(1899, 11, 30) + raw * 24 * 60 * 60 * 1000;
    const d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    return aMedianoche(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }

  const txt = String(raw).trim();
  if (!txt) return null;

  if (txt.includes('/')) {
    const [a, b, c] = txt.split('/').map((x) => parseInt(x, 10));
    if ([a, b, c].some(isNaN)) return null;
    // LATAM: DD/MM/YYYY. Si el "mes" pasa de 12 y el "día" no, venía en US.
    let dia = a, mes = b;
    if (mes > 12 && dia <= 12) [dia, mes] = [mes, dia];
    let anio = c;
    if (anio < 100) anio += anio < 30 ? 2000 : 1900;
    return aMedianoche(anio, mes - 1, dia);
  }

  if (txt.includes('-')) {
    const partes = txt.split('-').map((x) => parseInt(x, 10));
    if (partes.some(isNaN) || partes.length < 3) return null;
    // YYYY-MM-DD si el primer bloque tiene 4 dígitos; si no, DD-MM-YYYY.
    return txt.split('-')[0].length === 4
      ? aMedianoche(partes[0], partes[1] - 1, partes[2])
      : aMedianoche(partes[2], partes[1] - 1, partes[0]);
  }

  return null;
}

export function formatearFecha(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Date -> 'YYYY-MM-DD' en hora local (sin el corrimiento de toISOString). */
export function aIsoLocal(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Lee el Excel y devuelve un índice cédula -> fechas.
 *
 * Lanza `ArlExcelError` con el detalle en HTML listo para Swal cuando el archivo
 * no se puede abrir, está vacío o le faltan las columnas.
 */
export async function leerArlExcel(file: File): Promise<ArlIndex> {
  let wb: XLSX.WorkBook;
  try {
    const buffer = await file.arrayBuffer();
    wb = XLSX.read(buffer, { type: 'array' });
  } catch (e: any) {
    throw new ArlExcelError(
      'No se pudo leer el archivo ARL',
      `Ocurrió un error al abrir <b>${file.name}</b>.<br><br>` +
        `<b>Detalle:</b> ${(e && e.message) || 'Sin detalle.'}<br><br>` +
        `Verifica que no esté abierto en otra ventana ni protegido con contraseña.`,
    );
  }

  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: true });

  if (data.length < 2) {
    throw new ArlExcelError(
      'El archivo ARL está vacío',
      `El archivo <b>${file.name}</b> está vacío o solo tiene el encabezado. ` +
        `Verifica que contenga al menos una fila de datos.`,
    );
  }

  const headers = data[0].map((h) => String(h).toUpperCase().trim());
  const idxDni = headers.findIndex((h) => h.includes('DNI') && h.includes('TRABAJADOR'));
  const idxVig = headers.findIndex((h) => h.includes('INICIO') && h.includes('VIGENCIA'));

  if (idxDni === -1 || idxVig === -1) {
    const faltantes: string[] = [];
    if (idxDni === -1) faltantes.push('"DNI TRABAJADOR"');
    if (idxVig === -1) faltantes.push('"INICIO VIGENCIA"');

    throw new ArlExcelError(
      'El archivo ARL no tiene las columnas necesarias',
      `No se encontró la(s) columna(s) ${faltantes.join(' y ')} en el archivo ` +
        `<b>${file.name}</b>.<br><br>` +
        `Abre el Excel y revisa la <b>primera fila</b> (encabezados). Debe tener:<br>` +
        `• Una columna cuyo nombre contenga <b>DNI TRABAJADOR</b>.<br>` +
        `• Una columna cuyo nombre contenga <b>INICIO VIGENCIA</b>.<br><br>` +
        `Sin estas columnas no se puede validar ARL.`,
    );
  }

  const porCedula = new Map<string, Date[]>();
  const textoPorCedula = new Map<string, string[]>();
  const filas = data.slice(1);

  for (const row of filas) {
    const cedula = normalizarCedula(row[idxDni]);
    if (!cedula) continue;

    const fecha = parseFechaArl(row[idxVig]);

    if (!porCedula.has(cedula)) {
      porCedula.set(cedula, []);
      textoPorCedula.set(cedula, []);
    }
    if (fecha) porCedula.get(cedula)!.push(fecha);
    textoPorCedula.get(cedula)!.push(formatearFecha(fecha) || String(row[idxVig] ?? '').trim());
  }

  return { porCedula, textoPorCedula, nombreArchivo: file.name, totalFilas: filas.length };
}

/**
 * Cruza UNA cédula contra el índice del ARL.
 *
 * `fechaIngreso` viene del contrato (`ContratoCandidato.fecha_ingreso`,
 * 'YYYY-MM-DD'), que es la misma que se escribe en la columna 9 del cruce.
 *
 * Los tres hallazgos son los mismos que producía hiring-report:
 *   - sin_arl        → la cédula no está en el archivo
 *   - duplicado      → varias filas para la misma cédula (riesgo de cobro doble)
 *   - fecha_distinta → ninguna fecha del ARL coincide con la de ingreso
 */
export function validarCedulaContraArl(
  index: ArlIndex,
  cedulaRaw: string,
  fechaIngreso: string | Date | null,
): ArlResultado {
  const cedula = normalizarCedula(cedulaRaw);
  const hallazgos: ArlHallazgo[] = [];

  const filas = index.porCedula.get(cedula);
  if (!filas || filas.length === 0) {
    hallazgos.push({ tipo: 'sin_arl', cedula, mensaje: 'No existe en ARL' });
    return { ok: false, fechaIso: null, hallazgos };
  }

  const textos = index.textoPorCedula.get(cedula) ?? [];
  if (filas.length > 1) {
    hallazgos.push({
      tipo: 'duplicado',
      cedula,
      mensaje:
        `Múltiples registros en ARL (${filas.length}) para la misma cédula. ` +
        `Riesgo de cobro duplicado si la persona se retira.`,
    });
  }

  const dIngreso =
    fechaIngreso instanceof Date
      ? aMedianoche(fechaIngreso.getFullYear(), fechaIngreso.getMonth(), fechaIngreso.getDate())
      : parseFechaArl(fechaIngreso);

  const match = dIngreso
    ? filas.find((f) => f.getTime() === dIngreso.getTime()) ?? null
    : null;

  if (!match) {
    const unicas = Array.from(new Set(textos.filter(Boolean)));
    hallazgos.push({
      tipo: 'fecha_distinta',
      cedula,
      mensaje:
        `Fecha de ingreso (${formatearFecha(dIngreso) || fechaIngreso || 'sin fecha'}) ` +
        `diferente a fecha(s) ARL (${unicas.join(' o ') || 'sin fecha'})`,
    });
  }

  return {
    // Los duplicados avisan pero no bloquean: la afiliación existe y la fecha
    // cuadra. Lo que bloquea es no estar en el ARL o tener otra fecha.
    ok: !!match,
    fechaIso: aIsoLocal(match ?? filas[0] ?? null),
    hallazgos,
  };
}
