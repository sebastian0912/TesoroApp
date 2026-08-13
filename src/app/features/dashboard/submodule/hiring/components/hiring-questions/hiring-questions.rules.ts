/**
 * Reglas puras de la pestaña de contratación (hiring-questions).
 *
 * Sin Angular ni servicios: se prueban directo en
 * `hiring-questions.rules.spec.ts` (sin TestBed).
 */

/**
 * Número desde lo que digita el usuario, aceptando coma decimal ("0,522").
 *
 * Con `Number()` a secas la coma daba NaN, que el serializador de HTTP
 * convertía en null y el %ARL se perdía con Swal de éxito incluido.
 * Vacío/null/no-numérico -> null (el backend acepta null).
 */
export function toNumeroDecimal(x: unknown): number | null {
  if (x === '' || x == null) return null;
  const n = Number(String(x).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Primer valor no vacío de una fila del maestro, probando varias claves.
 *
 * `GET /gestion_centros_costos/` responde con las claves "tal cual el Excel"
 * ("Ccostos", "Empresa " con espacio final, "Categoría" con tilde), mientras
 * `/resolver/` responde snake_case. Leyendo solo minúsculas todo salía
 * `undefined` y el autollenado no hacía nada; probando ambas formas la misma
 * lectura sirve con cualquiera de los dos endpoints.
 */
export function campoDeFila(fila: Record<string, any>, ...claves: string[]): string {
  for (const k of claves) {
    const v = fila?.[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}
