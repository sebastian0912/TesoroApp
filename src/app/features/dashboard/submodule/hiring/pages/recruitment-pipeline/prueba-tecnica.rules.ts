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

export type ResultadoPrueba = 'sin_resultado' | 'no_paso';

export function resultadoDePruebaTecnica(proceso: any): ResultadoPrueba {
  return proceso?.no_paso_prueba_tecnica === true ? 'no_paso' : 'sin_resultado';
}

/** Texto del pill según el resultado registrado. */
export function etiquetaPruebaTecnica(proceso: any): string {
  return resultadoDePruebaTecnica(proceso) === 'no_paso'
    ? 'No pasó la prueba'
    : 'Enviado a prueba';
}
