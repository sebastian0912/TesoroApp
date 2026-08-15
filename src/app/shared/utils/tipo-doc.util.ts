/**
 * Normalizador de tipo de documento — espejo de
 * `back-tu-apo-django/gestion_catalogos/tipos_doc.py`.
 *
 * NO EDITAR sin sincronizar con el backend: si las dos listas divergen, el
 * front manda un valor que el backend normaliza distinto y se vuelve a crear
 * la fila duplicada que todo esto intenta evitar.
 *
 * Por qué también en el front y no solo en el backend: el payload del front es
 * el que decide QUÉ fila del UNIQUE (tipo_doc, numero_documento) se toca. En
 * particular el prefijo `X` del número de documento se calcula comparando el
 * tipo contra 'CC'; si esa comparación se hace sobre el valor crudo, un 'C.C'
 * manda `X<cédula>` y crea un Candidato nuevo.
 *
 * Estado medido en prod (2026-08-04): 5893 valores distintos de tipo_doc y
 * 2821 cédulas con más de un tipo, o sea la misma persona duplicada.
 */

/** Valores activos del catálogo TIPOS_IDENTIFICACION. */
export const CANON_TIPOS = ['CC', 'CE', 'PPT', 'CTRA'] as const;

/** Fuera del catálogo pero existen en la BD: se aceptan, no se ofrecen. */
export const TIPOS_TOLERADOS = ['TI'] as const;

/**
 * Mientras las 2957 filas 'PET' no estén migradas, el backend sigue
 * aterrizando en 'PET' para no chocar contra las 697 'PPT' que ya existen.
 * Se cambia a 'PPT' el día de la migración, junto con la constante del backend.
 */
export const TIPO_PERMISO_CANONICO = 'PET';

const ALIAS: Record<string, string> = {
  CCC: 'CC', CDC: 'CC', CEDULA: 'CC', CEDULACIUDADANIA: 'CC', CEDULADECIUDADANIA: 'CC',
  CEX: 'CE', CEDULAEXTRANJERIA: 'CE', CEDULADEEXTRANJERIA: 'CE',
  PET: 'PPT', PEP: 'PPT', PTT: 'PPT', PPTT: 'PPT', PP: 'PPT',
  PERMISO: 'PPT', PERMISOPERMANENCIA: 'PPT', PERMISOPROTECCIONTEMPORAL: 'PPT',
  CONT: 'CTRA', CTR: 'CTRA', CONTRASENA: 'CTRA',
};

/** Devuelve el tipo canónico, o null si el valor no es un tipo de documento. */
export function canonTipoDoc(raw: unknown): string | null {
  let t = String(raw ?? '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // tildes
    .replace(/[^A-Z]/g, '');           // solo letras: mata puntos y números
  if (!t) return null;
  t = ALIAS[t] ?? t;
  if (t === 'PPT') t = TIPO_PERMISO_CANONICO;
  if ((CANON_TIPOS as readonly string[]).includes(t)) return t;
  if ((TIPOS_TOLERADOS as readonly string[]).includes(t)) return t;
  if (t === TIPO_PERMISO_CANONICO) return t;
  return null;
}

/**
 * Clave de identidad de una PERSONA. Espejo de `Candidato.normalize_doc`:
 * quita la `X` inicial, para que 'X1002498616' y '1002498616' se reconozcan
 * como la misma persona al deduplicar listas.
 */
export function docKey(numero: unknown): string {
  return String(numero ?? '').trim().replace(/\s+/g, '').replace(/^[xX]+(?=\d)/, '');
}

/**
 * Número de documento tal como espera el backend: la `X` marca que NO es
 * cédula de ciudadanía. Misma convención que `make_owner_id` del backend.
 */
export function docParaEnviar(tipoRaw: unknown, numeroRaw: unknown): string {
  const digits = String(numeroRaw ?? '').replace(/\D+/g, '').trim();
  if (!digits) return digits;
  return canonTipoDoc(tipoRaw) === 'CC' ? digits : `X${digits}`;
}

/** Etiqueta para pintar. Nunca mostrar el valor crudo de la BD. */
export function tipoDocLabel(raw: unknown): string {
  return canonTipoDoc(raw) ?? String(raw ?? '').trim().toUpperCase();
}
