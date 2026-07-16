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

export type ResultadoPrueba = 'sin_resultado' | 'paso' | 'no_paso' | 'no_se_presento';

export function resultadoDePruebaTecnica(proceso: any): ResultadoPrueba {
  // "no pasó" tiene prioridad por si alguna fila vieja tuviera varios flags.
  if (proceso?.no_paso_prueba_tecnica === true) return 'no_paso';
  if (proceso?.no_se_presento_prueba_tecnica === true) return 'no_se_presento';
  if (proceso?.paso_prueba_tecnica === true) return 'paso';
  return 'sin_resultado';
}

/** Texto del pill según el resultado registrado. */
export function etiquetaPruebaTecnica(proceso: any): string {
  switch (resultadoDePruebaTecnica(proceso)) {
    case 'paso': return 'Pasó la prueba';
    case 'no_paso': return 'No pasó la prueba';
    case 'no_se_presento': return 'No se presentó';
    default: return 'Enviado a prueba';
  }
}

/**
 * Devuelve una COPIA del candidato con el resultado de la prueba aplicado sobre
 * `entrevistas[0].proceso`, creando referencias NUEVAS en toda la cadena
 * (candidato → entrevista → proceso).
 *
 * Es clave que sean referencias nuevas: en el pipeline `_proceso()` es un signal
 * computed y los derivados (resultadoPrueba, etiquetaPrueba…) memoizan por
 * referencia. Si se mutara el proceso en su sitio, `_proceso()` devolvería el
 * mismo objeto y el pill no cambiaría hasta re-buscar al candidato.
 */
export function aplicarResultadoPruebaLocal(
  candidato: any,
  opts: { resultado: 'paso' | 'no_paso' | 'no_se_presento'; motivo: string; procResp?: any; ahora: string },
): any {
  const proc = candidato?.entrevistas?.[0]?.proceso;
  if (!proc) return candidato;

  const { resultado, motivo, procResp, ahora } = opts;
  const paso = resultado === 'paso';
  const noPaso = resultado === 'no_paso';
  const noShow = resultado === 'no_se_presento';

  const procActualizado = {
    ...proc,
    paso_prueba_tecnica: paso,
    paso_prueba_tecnica_at: procResp?.paso_prueba_tecnica_at ?? (paso ? ahora : null),
    no_paso_prueba_tecnica: noPaso,
    no_paso_prueba_tecnica_at: procResp?.no_paso_prueba_tecnica_at ?? (noPaso ? ahora : null),
    motivo_no_paso_prueba_tecnica: noPaso ? motivo : null,
    no_se_presento_prueba_tecnica: noShow,
    no_se_presento_prueba_tecnica_at: procResp?.no_se_presento_prueba_tecnica_at ?? (noShow ? ahora : null),
  };

  const entrevistas = [...(candidato.entrevistas ?? [])];
  entrevistas[0] = { ...entrevistas[0], proceso: procActualizado };
  return { ...candidato, entrevistas };
}
