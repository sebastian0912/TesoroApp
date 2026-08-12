/**
 * Clasificación de `Referencia.tipo`.
 *
 * En producción ese campo NO tiene un valor único por categoría: conviven los
 * valores sin numerar del modelo viejo con los numerados que escribe el
 * formulario actual.
 *
 *   PERSONAL  119.860 | PERSONAL1  7.124 | PERSONAL2  7.124
 *   FAMILIAR  119.794 | FAMILIAR1  7.293 | FAMILIAR2  7.292
 *   LABORAL    60.510
 *
 * Los PDFs comparaban con igualdad exacta (`tipo === 'PERSONAL'`), así que a
 * los candidatos recientes —los que llegan con PERSONAL1/PERSONAL2— les salían
 * las referencias en blanco. Aquí se clasifica por prefijo y se ordena por el
 * sufijo numérico, para que "1" siempre quede antes que "2".
 */

const norm = (v: unknown): string =>
  String(v ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

/** PERSONAL, PERSONAL1, PERSONAL 2, LABORAL, LABORAL1... */
export function esReferenciaPersonal(tipo: unknown): boolean {
  const t = norm(tipo);
  return t.startsWith('PERSONAL') || t.startsWith('LABORAL');
}

/** FAMILIAR, FAMILIAR1, FAMILIAR 2... */
export function esReferenciaFamiliar(tipo: unknown): boolean {
  return norm(tipo).startsWith('FAMILIAR');
}

/** Sufijo numérico del tipo (PERSONAL2 -> 2). Sin sufijo, null. */
function sufijoDe(tipo: unknown): number | null {
  const m = norm(tipo).match(/(\d+)$/);
  return m ? Number(m[1]) : null;
}

/** Ordena por sufijo numérico conservando el orden original en los empates. */
export function ordenarPorSufijo<T = any>(refs: readonly T[]): T[] {
  return refs
    .map((ref, i) => ({ ref, i }))
    .sort(
      (a, b) =>
        (sufijoDe((a.ref as any)?.tipo) ?? 0) - (sufijoDe((b.ref as any)?.tipo) ?? 0) || a.i - b.i,
    )
    .map(x => x.ref);
}

/**
 * Separa las referencias en personales (incluye laborales) y familiares.
 *
 * Hay candidatos con AMBAS versiones: las del modelo viejo (PERSONAL, FAMILIAR,
 * LABORAL) y las que escribe el formulario actual (PERSONAL1/2, FAMILIAR1/2),
 * a veces con el mismo nombre mal escrito de un lado y completo del otro. Las
 * numeradas son las recientes y las más completas, así que van primero; las
 * viejas quedan detrás como respaldo cuando no hay numeradas.
 */
export function separarReferencias<T = any>(
  referencias: readonly T[],
): { personales: T[]; familiares: T[] } {
  const lista: T[] = Array.isArray(referencias) ? [...referencias] : [];

  const priorizar = (predicado: (t: unknown) => boolean): T[] => {
    const propias = lista.filter(r => predicado((r as any)?.tipo));
    const numeradas = ordenarPorSufijo(propias.filter(r => sufijoDe((r as any)?.tipo) !== null));
    const sinNumerar = propias.filter(r => sufijoDe((r as any)?.tipo) === null);
    return [...numeradas, ...sinNumerar];
  };

  // LABORAL va al final de las personales: suele ser el dato más pobre
  // (registros con teléfono "000") y solo debe usarse si no hay otra.
  const personalesPuras = priorizar(t => norm(t).startsWith('PERSONAL'));
  const laborales = priorizar(t => norm(t).startsWith('LABORAL'));

  return {
    personales: [...personalesPuras, ...laborales],
    familiares: priorizar(esReferenciaFamiliar),
  };
}
