/**
 * Reglas puras de la pestaña "Antecedentes Judiciales".
 *
 * Sin Angular ni servicios: lo que está acá se prueba directo en
 * `selection-questions.rules.spec.ts` (sin TestBed).
 */

/**
 * Clave para comparar un valor guardado contra las opciones de un catálogo:
 * sin tildes, en mayúsculas y con los espacios colapsados.
 *
 * Solo se usa para COMPARAR; lo que entra al formulario siempre es el valor
 * exacto del catálogo (ver `alinearConCatalogo`).
 */
export function claveComparable(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Devuelve el valor EXACTO del catálogo que corresponde a `valor`, o el
 * original si no hay ninguno parecido.
 *
 * Un `mat-select` solo pinta la opción si el valor del control es idéntico
 * (===) al de un `mat-option`. Lo guardado no siempre coincide letra por
 * letra con el catálogo, y entonces el campo se veía VACÍO aunque el dato
 * estuviera bien guardado. Casos reales medidos en prod:
 *   - `PROTECCIÓN ` con tilde (17 filas) contra la opción `PROTECCION`.
 *   - `Sin Buscar` / `Cumple` guardados en minúsculas, que el patch pasaba a
 *     MAYÚSCULAS y dejaban de coincidir con opciones de escritura mixta.
 * Se compara sin tildes, sin mayúsculas y con espacios colapsados.
 */
export function alinearConCatalogo(
  valor: unknown,
  opciones: readonly (string | number)[],
): unknown {
  if (valor === null || valor === undefined || valor === '') return valor;
  const clave = claveComparable(valor);
  if (!clave) return valor;
  const match = opciones.find(o => claveComparable(o) === clave);
  return match !== undefined ? match : valor;
}
