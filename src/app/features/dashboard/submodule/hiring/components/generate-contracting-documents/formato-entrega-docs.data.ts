/**
 * Encabezado y textos variables del "Formato de Entrega de Documentos y
 * Autorizaciones" (AL CO-RE-6 para Apoyo, TA CO-RE-6 para Tu Alianza).
 *
 * Estaban repetidos en 14 sitios: los 11 generadores de inducción de
 * `generate-contracting-documents`, más dos copias en `hiring-questions` y
 * `contracting-pdf.service` que se habían quedado en la versión 23 mientras la
 * pantalla de inducción ya imprimía la 26. Es decir: el MISMO código de formato
 * salía con dos versiones distintas según desde dónde se generara.
 *
 * Cuando llegue el próximo comunicado de calidad se cambia SOLO acá.
 *
 * Última actualización — comunicado del 10 de agosto de 2026:
 *   - AL CO-RE-6 v27 y TA CO-RE-6 v20, emisión 10 de agosto de 2026
 *   - numeral 9 (plan funeral): $4.750 descontados quincenalmente
 *   - excepción Flores de los Andes: $13.169 descontados MENSUALMENTE
 */

export interface FormatoEntregaDocs {
  /** Código del formato en el maestro de calidad. */
  codigo: string;
  version: string;
  /** Tal como se imprime en el encabezado; no es una fecha, es su texto. */
  fechaEmision: string;
}

export const FORMATO_ENTREGA_APOYO: FormatoEntregaDocs = {
  codigo: 'AL CO-RE-6',
  version: '27',
  fechaEmision: 'Agosto 10-26',
};

export const FORMATO_ENTREGA_TU_ALIANZA: FormatoEntregaDocs = {
  codigo: 'TA CO-RE-6',
  version: '20',
  fechaEmision: 'Agosto 10-26',
};

/**
 * Numeral 9 del formato: autorización del descuento del plan funeral.
 *
 * "La afiliación se efectiva" (sin el "hace") es como está redactado en la
 * plantilla aprobada, así que se deja igual: el documento tiene que salir
 * literal al formato de calidad, no bien escrito.
 */
export function textoPlanFuneral(
  valor: string,
  periodicidad: 'quincenalmente' | 'mensualmente',
): string {
  return 'Plan funeral Coorserpark: AUTORIZO la afiliación y descuento VOLUNTARIO al plan, '
    + `por un valor de $${valor} descontados ${periodicidad} por Nómina. `
    + 'La afiliación se efectiva a partir del primer descuento.';
}

/** Valor general: aplica tanto a Apoyo como a Tu Alianza. */
export const PLAN_FUNERAL: string = textoPlanFuneral('4.750', 'quincenalmente');

/**
 * Flores de los Andes es la única excepción del comunicado: otro valor y
 * descuento MENSUAL, no quincenal.
 */
export const PLAN_FUNERAL_FLORES_ANDES: string = textoPlanFuneral('13.169', 'mensualmente');
