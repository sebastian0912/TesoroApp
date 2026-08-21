/**
 * Utilidades de fecha del modulo de Incapacidades (v2).
 *
 * Reglas de la casa:
 *  - NO se usa `moment`. El modulo trabaja con `provideNativeDateAdapter`,
 *    asi que todo se resuelve con `Date` nativo.
 *  - NUNCA se usa `toISOString()` para serializar al backend: esa funcion
 *    convierte a UTC y en Colombia (UTC-5) desplaza la fecha un dia hacia
 *    atras. Ver `aIsoCorto`.
 *
 * Contexto de los datos reales (verificado en produccion):
 *  - `fecha_nacimiento` llega como TEXTO en dos formatos mezclados:
 *    ISO `yyyy-MM-dd` (53.921 filas) y `dd/MM/yyyy` (31.656 filas), mas
 *    ~3.784 filas con basura.
 *  - Existen fechas imposibles guardadas en la base: `0001-01-01`,
 *    `9994-03-30`, etc. El parser las descarta.
 */

/** Ano minimo considerado plausible para cualquier fecha del modulo. */
export const ANIO_MINIMO_PLAUSIBLE = 1900;

/** Edad minima aceptada para un trabajador. */
export const EDAD_MINIMA = 14;

/** Edad maxima aceptada para un trabajador. */
export const EDAD_MAXIMA = 100;

/** `yyyy-MM-dd`, opcionalmente seguido de hora (ISO 8601) o de nada. */
const RE_ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/;

/** `dd/MM/yyyy` o `dd-MM-yyyy`, opcionalmente seguido de hora. */
const RE_LATINO = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[T\s].*)?$/;

/**
 * Construye un `Date` en hora LOCAL a medianoche validando que la
 * combinacion dia/mes/ano exista de verdad (descarta 31/02, 30/02, etc.).
 */
function construirFechaLocal(anio: number, mes: number, dia: number): Date | null {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) return null;
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;

  const fecha = new Date(anio, mes - 1, dia, 0, 0, 0, 0);
  if (Number.isNaN(fecha.getTime())) return null;

  // `new Date(2024, 1, 31)` se desborda a marzo: verificamos que no ocurrio.
  if (
    fecha.getFullYear() !== anio ||
    fecha.getMonth() !== mes - 1 ||
    fecha.getDate() !== dia
  ) {
    return null;
  }
  return fecha;
}

/**
 * `true` si la fecha cae dentro del rango plausible del modulo:
 * ano entre {@link ANIO_MINIMO_PLAUSIBLE} y el ano en curso (inclusive).
 */
export function esFechaPlausible(fecha: Date | null | undefined): boolean {
  if (!fecha || Number.isNaN(fecha.getTime())) return false;
  const anio = fecha.getFullYear();
  return anio >= ANIO_MINIMO_PLAUSIBLE && anio <= new Date().getFullYear();
}

/**
 * Parsea una fecha tolerando los formatos que realmente conviven en la base.
 *
 * Acepta:
 *  - `Date` (se normaliza a medianoche local).
 *  - `yyyy-MM-dd`            -> `'1990-05-12'`
 *  - `yyyy-M-d`              -> `'1990-5-2'`
 *  - ISO con hora            -> `'1990-05-12T00:00:00Z'`, `'1990-05-12 08:30:00'`
 *  - `dd/MM/yyyy`            -> `'12/05/1990'`
 *  - `dd-MM-yyyy`            -> `'12-05-1990'`
 *
 * Descarta (devuelve `null`):
 *  - `null`, `undefined`, cadena vacia, texto libre.
 *  - Fechas inexistentes (`31/02/2024`).
 *  - Fechas fuera del rango plausible (`0001-01-01`, `9994-03-30`).
 *
 * IMPORTANTE: en el caso ISO NO se delega en `new Date(cadena)` porque
 * JavaScript interpreta `'1990-05-12'` como UTC y en Colombia devuelve el
 * 11 de mayo. Aqui siempre se construye la fecha en hora local.
 *
 * @param valor texto o `Date` proveniente del backend / del formulario.
 * @returns `Date` a medianoche local, o `null` si no es utilizable.
 */
export function parsearFechaFlexible(valor: unknown): Date | null {
  if (valor == null) return null;

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null;
    const normalizada = construirFechaLocal(
      valor.getFullYear(),
      valor.getMonth() + 1,
      valor.getDate(),
    );
    return esFechaPlausible(normalizada) ? normalizada : null;
  }

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return null;
    const desdeEpoch = new Date(valor);
    if (Number.isNaN(desdeEpoch.getTime())) return null;
    return parsearFechaFlexible(desdeEpoch);
  }

  if (typeof valor !== 'string') return null;

  const texto = valor.trim();
  if (!texto) return null;

  const iso = RE_ISO.exec(texto);
  if (iso) {
    const fecha = construirFechaLocal(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    return esFechaPlausible(fecha) ? fecha : null;
  }

  const latino = RE_LATINO.exec(texto);
  if (latino) {
    const fecha = construirFechaLocal(Number(latino[3]), Number(latino[2]), Number(latino[1]));
    return esFechaPlausible(fecha) ? fecha : null;
  }

  return null;
}

/**
 * Serializa una fecha a `yyyy-MM-dd` SIN desfase de zona horaria.
 *
 * Se construye con `getFullYear/getMonth/getDate` (calendario local).
 * `toISOString()` esta PROHIBIDO aqui: para el 12/05/1990 00:00 en UTC-5
 * devolveria `'1990-05-11'`.
 *
 * @returns la fecha formateada, o cadena vacia si el valor no es usable.
 */
export function aIsoCorto(fecha: Date | null | undefined): string {
  if (!fecha || Number.isNaN(fecha.getTime())) return '';
  const anio = String(fecha.getFullYear()).padStart(4, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/**
 * Atajo: parsea cualquier valor y lo devuelve como `yyyy-MM-dd`.
 * Util para armar los request del backend desde controles del formulario.
 *
 * @returns `yyyy-MM-dd` o cadena vacia si el valor no es parseable.
 */
export function aIsoCortoFlexible(valor: unknown): string {
  return aIsoCorto(parsearFechaFlexible(valor));
}

/**
 * Calcula la edad en anos cumplidos a partir de la fecha de nacimiento.
 *
 * Devuelve `null` cuando la fecha es impensable o la edad resultante cae
 * fuera del rango {@link EDAD_MINIMA}..{@link EDAD_MAXIMA}. Esto cubre la
 * basura conocida de la tabla (`0001-01-01`, `9994-03-30`, texto libre).
 *
 * NOTA: no uses `edadTrabajador` del backend, solo esta poblado en el 41%
 * de los casos. Esta funcion cubre el 99,8% via `fecha_nacimiento`.
 *
 * @param fechaNacimiento texto o `Date`.
 * @param referencia fecha contra la cual se calcula (por defecto, hoy).
 */
export function calcularEdad(fechaNacimiento: unknown, referencia?: Date): number | null {
  const nacimiento = parsearFechaFlexible(fechaNacimiento);
  if (!nacimiento) return null;

  const hoy = referencia && !Number.isNaN(referencia.getTime()) ? referencia : new Date();

  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const mesesDiff = hoy.getMonth() - nacimiento.getMonth();
  if (mesesDiff < 0 || (mesesDiff === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad -= 1;
  }

  if (edad < EDAD_MINIMA || edad > EDAD_MAXIMA) return null;
  return edad;
}

/**
 * Dias calendario entre dos fechas, ambos extremos incluidos
 * (asi es como cuenta los dias una incapacidad: del 1 al 3 son 3 dias).
 *
 * @returns `null` si alguna fecha no es parseable o el rango esta invertido.
 */
export function diasCalendarioInclusive(inicio: unknown, fin: unknown): number | null {
  const desde = parsearFechaFlexible(inicio);
  const hasta = parsearFechaFlexible(fin);
  if (!desde || !hasta) return null;

  const MS_POR_DIA = 24 * 60 * 60 * 1000;
  // Se normaliza a UTC-medianoche SOLO para restar, evitando que un cambio
  // de horario de verano (que este pais no tiene, pero el navegador puede
  // simular) produzca 0,96 dias.
  const aUtc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const dias = Math.round((aUtc(hasta) - aUtc(desde)) / MS_POR_DIA) + 1;
  return dias >= 1 ? dias : null;
}
