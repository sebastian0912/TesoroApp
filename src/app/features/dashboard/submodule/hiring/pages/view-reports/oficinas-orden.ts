/**
 * Orden canónico de oficinas para reportes.
 *
 * Se usa tanto en las tablas de la pantalla (consolidado y errores de
 * validación) como en el Excel de bases unidas, para que lo que se ve en
 * pantalla y lo que se descarga queden en el mismo orden.
 *
 * Reglas:
 *  1. Las oficinas de OFICINAS_ORDEN van primero, en ese orden exacto.
 *  2. Cualquier otra oficina va después, alfabéticamente.
 *  3. ADMINISTRATIVOS siempre va de última.
 */

/** Orden pedido por operaciones. Editar aquí si cambia la prioridad. */
export const OFICINAS_ORDEN: readonly string[] = [
  'FACA_PRINCIPAL',
  'FACA_PRIMERA', // en operación se le dice "Faca Parqueadero"
  'ROSAL',
  'CARTAGENITA',
  'MADRID',
  'FUNZA',
  'FONTIBON',
  'SOACHA',
  'SUBA',
  'TOCANCIPA',
  'SOTAQUIRA',
  'ZIPAQUIRA',
];

/** Va siempre al final, después de las oficinas no listadas. */
const OFICINA_ULTIMA = 'ADMINISTRATIVOS';

/** Pesos para lo que no está en OFICINAS_ORDEN. */
const PESO_NO_LISTADA = 1000;
const PESO_ULTIMA = 2000;

/** Rango Unicode de marcas diacríticas combinantes (tildes tras normalizar NFD). */
const DIACRITICO_MIN = 0x0300;
const DIACRITICO_MAX = 0x036f;

/**
 * Normaliza un nombre de oficina para comparar sin importar tildes,
 * guiones bajos, espacios de más ni mayúsculas.
 * 'Fontibón' / 'FONTIBON' / 'fontibon' → 'FONTIBON'
 */
export function normalizarOficina(valor: string | null | undefined): string {
  const sinTildes = Array.from(String(valor ?? '').normalize('NFD'))
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < DIACRITICO_MIN || code > DIACRITICO_MAX;
    })
    .join('');

  return sinTildes
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Alias de nombres que operación usa distinto a como están en BD. */
const ALIAS: Record<string, string> = {
  'FACA PARQUEADERO': 'FACA PRIMERA',
};

const INDICE: Map<string, number> = new Map(
  OFICINAS_ORDEN.map((nombre, i) => [normalizarOficina(nombre), i]),
);

/** Posición de una oficina dentro del orden canónico. */
export function pesoOficina(oficina: string | null | undefined): number {
  const norm = normalizarOficina(oficina);
  const clave = ALIAS[norm] ?? norm;

  if (clave === normalizarOficina(OFICINA_ULTIMA)) return PESO_ULTIMA;

  const idx = INDICE.get(clave);
  return idx === undefined ? PESO_NO_LISTADA : idx;
}

/**
 * Comparador para usar en `.sort()`. Las no listadas quedan juntas al final
 * y entre ellas se ordenan alfabéticamente.
 */
export function compararOficinas(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const pa = pesoOficina(a);
  const pb = pesoOficina(b);
  if (pa !== pb) return pa - pb;
  if (pa === PESO_NO_LISTADA) {
    return normalizarOficina(a).localeCompare(normalizarOficina(b));
  }
  return 0;
}

/** Ordena una lista por la oficina que devuelva `getOficina`, de forma estable. */
export function ordenarPorOficina<T>(
  items: T[],
  getOficina: (item: T) => string | null | undefined,
): T[] {
  return items
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const cmp = compararOficinas(getOficina(a.item), getOficina(b.item));
      return cmp !== 0 ? cmp : a.i - b.i;
    })
    .map((x) => x.item);
}
