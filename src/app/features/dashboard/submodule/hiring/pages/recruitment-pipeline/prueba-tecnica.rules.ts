/**
 * Reglas del pill "Enviado a prueba" del header.
 *
 * Es SOLO un marcador de resultado: no toca el gate de Contratación. Hoy
 * `prueba_tecnica` se pone en true al REMITIR (help-information al guardar la
 * vacante), no al aprobar, y ese mismo campo es el que habilita Contratación
 * (`prueba_tecnica === true || autorizado === true`). Por eso "pasó" aquí no
 * vuelve a escribir `prueba_tecnica`: solo limpia la marca de "no pasó".
 *
 * Aparte del componente para poder probarse sin levantar la página entera.
 */

/** Minúsculas y sin tildes, para comparar valores históricos no uniformes. */
function normalizar(valor: any): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

/**
 * ¿El proceso está remitido a una vacante de prueba técnica?
 *
 * Se mira `vacante_tipo`, que es lo que guarda la remisión. Los valores históricos
 * no son uniformes ('Prueba', 'Prueba técnica', 'prueba_tecnica'), así que se
 * normaliza igual que `mapApiTipoToForm` en hiring/help-information.
 */
export function esVacanteDePruebaTecnica(proceso: any): boolean {
  if (!proceso?.publicacion) return false;

  const tipo = normalizar(proceso?.vacante_tipo);
  return tipo === 'prueba' || tipo === 'prueba tecnica' || tipo === 'prueba_tecnica';
}

export type ResultadoPrueba = 'sin_resultado' | 'paso' | 'no_paso';

export function resultadoDePruebaTecnica(proceso: any): ResultadoPrueba {
  // "no pasó" tiene prioridad por si alguna fila vieja tuviera ambos flags.
  if (proceso?.no_paso_prueba_tecnica === true) return 'no_paso';
  if (proceso?.paso_prueba_tecnica === true) return 'paso';
  return 'sin_resultado';
}

/** Texto del pill según el resultado registrado. */
export function etiquetaPruebaTecnica(proceso: any): string {
  switch (resultadoDePruebaTecnica(proceso)) {
    case 'paso': return 'Pasó la prueba';
    case 'no_paso': return 'No pasó la prueba';
    default: return 'Enviado a prueba';
  }
}
