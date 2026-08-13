/**
 * Reglas de TITULAR.
 *
 * Dos personas distintas pueden compartir número de documento: en BD conviven
 * una fila 'CC' y otra 'C.C'/'CE' con el mismo número. Todo lo que se llavee o
 * se filtre "por persona" debe hacerlo por tipo+número, no por el número a
 * secas; con la cédula sola, finalizar/consultar al CC se le atribuía también
 * al otro titular.
 */

/**
 * Llave por TITULAR (tipo|número). Con el número a secas, finalizar al CC
 * pintaba el badge "✓ Ya finalizado" también sobre el otro titular homónimo.
 * Devuelve null si el candidato no tiene número de documento.
 */
export function claveTitular(cand: any): string | null {
  const ced = cand?.numero_documento;
  if (ced == null || String(ced).trim() === '') return null;
  return `${String(cand?.tipo_doc || 'CC').trim().toUpperCase()}|${String(ced).trim()}`;
}

/**
 * Elige el documento QUE ES DEL TITULAR, no el primero de la lista.
 *
 * El backend guarda `owner_id = "<cedula>"` para CC y `"x<cedula>"` para
 * cualquier otro tipo, justamente para no mezclar a dos titulares que
 * comparten número. Pero la lectura expande las formas (`<ced>`, `x<ced>`,
 * `X<ced>`), así que la consulta puede devolver documentos de AMBAS personas.
 * Quedarse con `docs[0]` a ciegas mostraba el examen médico, la ARL o la FOTO
 * del otro titular.
 *
 * Solo letras antes de comparar el tipo: en BD conviven 'CC', 'C.C' y 'C.C.'
 * para la misma persona, y con comparación cruda un 'C.C' se tomaba por
 * extranjero y se le buscaban los documentos con prefijo "x".
 *
 * Si ningún documento trae `owner_id` (payload viejo) se conserva el
 * comportamiento anterior: es preferible mostrar algo a romper la pantalla.
 */
export function elegirDocDelTitular<T>(
  docs: T[] | null | undefined,
  cedula: string | null | undefined,
  tipoDoc: string | null | undefined,
): T | null {
  if (!Array.isArray(docs) || docs.length === 0) return null;

  const ced = String(cedula ?? '').trim().replace(/^[xX]/, '');
  const esCC = String(tipoDoc || 'CC').toUpperCase().replace(/[^A-Z]/g, '') === 'CC';
  const esperado = esCC ? ced : `x${ced}`;

  // `owner_id` no hace parte del tipo declarado de los documentos (payloads
  // viejos no lo traen); se lee de forma laxa a propósito.
  const conOwner = docs.filter(d => (d as any)?.owner_id != null);
  if (conOwner.length === 0) return docs[0];

  const propios = conOwner.filter(
    d => String((d as any).owner_id).trim().toLowerCase() === esperado.toLowerCase()
  );
  return propios[0] ?? null;
}
