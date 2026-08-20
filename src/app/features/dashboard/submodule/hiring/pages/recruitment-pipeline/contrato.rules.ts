/**
 * Reglas del contrato "real" del pipeline.
 *
 * El backend crea la fila de Contrato ANTES de contratar: el flujo
 * `generar_codigo` (update-by-document / generar_codigo_contrato_para_cedula)
 * inserta una fila solo para reservar el `codigo_contrato`, y el modelo tiene
 * `contrato_activo = BooleanField(default=True)`. Resultado: candidatos que
 * apenas van en prueba técnica aparecían con "Contrato activo" y el pipeline
 * bloqueado, mientras el historial decía PRUEBA TÉCNICA (caso CC 1128324722).
 *
 * Regla: un contrato es REAL solo si el proceso llegó a `contratado === true`
 * o el contrato ya tiene `fecha_ingreso`. Una fila con solo el código
 * reservado NO bloquea nada.
 *
 * Aparte del componente para poder probarse sin levantar la página entera.
 */

/**
 * ¿El proceso representa una contratación real (no solo un código reservado)?
 *
 * OJO con exigir la fila de Contrato: `contratado` se puede marcar sin que
 * exista `ContratoCandidato` (el pipeline lo pone al cerrar contratación y la
 * fila solo nace al reservar código / guardar pago y transporte). Esa gente
 * salía CONTRATADO en el historial laboral y a la vez SIN pill ni banner en el
 * header, o sea sin ninguna forma de darle de baja (caso CC 1006913166).
 */
export function esContratoReal(proceso: any): boolean {
  if (!proceso) return false;
  if (proceso?.contratado === true) return true;
  return !!proceso?.contrato?.fecha_ingreso;
}

/**
 * ¿El candidato tiene un contrato REAL y ACTIVO?
 * Esto es lo único que bloquea el pipeline (banner + tabs deshabilitados).
 *
 * Solo un `contrato_activo === false` EXPLÍCITO retira: es lo que escribe la
 * baja. Sin fila de contrato (undefined) o con la columna en NULL —que es
 * nullable en el modelo, así que existen filas así— no hay nada que lo haya
 * retirado y el contrato sigue vigente.
 *
 * Es la MISMA regla que usa el historial laboral (`contrato_activo === false`
 * → RETIRADO). Cuando el header exigía `=== true`, header e historial decían
 * cosas distintas sobre la misma persona y no había cómo darle de baja.
 */
export function tieneContratoActivoReal(proceso: any): boolean {
  if (!esContratoReal(proceso)) return false;
  return proceso?.contrato?.contrato_activo !== false;
}

export type EstadoContratoPill = 'sin_fila' | 'activo' | 'retirado' | 'en_tramite';

/**
 * Estado del pill de contrato del header:
 * - 'activo'     → contrato real y vigente (verde, clickable para dar de baja).
 * - 'retirado'   → contrato dado de baja explícitamente (rojo, muestra fecha_retiro).
 * - 'en_tramite' → fila esqueleto: solo código reservado, aún no contratado (neutral).
 * - 'sin_fila'   → no hay fila de contrato (no se muestra pill).
 */
export function estadoContratoPill(proceso: any): EstadoContratoPill {
  // 'activo' se evalúa ANTES que la ausencia de fila: un proceso `contratado`
  // sin ContratoCandidato sigue siendo un contrato vigente que hay que poder
  // dar de baja. Sin esto el header no pintaba nada y el pipeline quedaba sin
  // salida (ver esContratoReal).
  if (tieneContratoActivoReal(proceso)) return 'activo';
  const contrato = proceso?.contrato;
  if (!contrato) return 'sin_fila';
  if (contrato.contrato_activo === false) return 'retirado';
  return 'en_tramite';
}

/**
 * Versión para las filas PLANAS del historial laboral (ProcesoMiniSerializer,
 * /procesos/by-document-min): ahí `contratado` y `contrato_fecha_ingreso`
 * vienen al nivel de la fila, no anidados.
 */
export function esContratoRealMini(row: any): boolean {
  return row?.contratado === true || !!row?.contrato_fecha_ingreso;
}

/**
 * Proceso vigente del candidato para leer su estado (etapas, resultados...).
 *
 * Una Entrevista puede existir SIN proceso y es un estado válido: el formulario
 * público abre una entrevista nueva cuando el proceso anterior quedó en estado
 * terminal (contratado / rechazado / no pasó), y el proceso solo se crea cuando
 * alguien atiende a la persona en el pipeline. Como las entrevistas llegan
 * ordenadas por fecha desc, `entrevistas[0]` puede ser esa entrevista recién
 * abierta y sin proceso — y todo lo que colgaba de ahí se veía vacío.
 *
 * Se mantiene la preferencia por la más reciente; solo si esa no tiene proceso
 * se cae a la siguiente que sí lo tenga.
 */
export function procesoVigente(candidato: any): any | null {
  return (
    procesoPorId(candidato, candidato?.proceso_vigente_id)
    ?? procesosDe(candidato)[0]
    ?? null
  );
}

/** Procesos de la persona, en el orden en que llegan las entrevistas. */
function procesosDe(candidato: any): any[] {
  const entrevistas: any[] = Array.isArray(candidato?.entrevistas) ? candidato.entrevistas : [];
  return entrevistas.map(e => e?.proceso).filter(Boolean);
}

/**
 * Proceso concreto por id, tal como lo resolvió el SERVIDOR.
 *
 * El backend manda `proceso_vigente_id` / `proceso_contrato_id` calculados con
 * `gestion_contratacion/proceso_estado.py`. Que el criterio viva en un solo
 * lado es justamente el arreglo: mientras cada pantalla lo deducía sola, con
 * dos turnos abiertos cada una apuntaba a un proceso distinto.
 *
 * Si el id no viene (backend sin desplegar) se devuelve null y el llamador cae
 * a su heurística de siempre, así que el orden de despliegue da igual.
 */
function procesoPorId(candidato: any, id: any): any | null {
  if (id == null) return null;
  return procesosDe(candidato).find(p => String(p?.id) === String(id)) ?? null;
}

/**
 * Proceso del que hay que leer el CONTRATO del candidato.
 *
 * El header miraba siempre `entrevistas[0].proceso`, y eso fallaba cuando la
 * entrevista más reciente es de un turno nuevo que todavía no tiene proceso (o
 * tiene uno de otra vacante): el contrato vive en una entrevista anterior. Se
 * veía CONTRATADO en el historial laboral y a la vez el header sin pill, así
 * que no había cómo dar de baja (caso CC 1097727446).
 *
 * Prioridad: contrato real y activo → contrato real (aunque esté retirado) →
 * fila de contrato (código reservado) → la primera entrevista, como antes.
 */
export function procesoDelContrato(candidato: any): any | null {
  const delServidor = procesoPorId(candidato, candidato?.proceso_contrato_id);
  if (delServidor) return delServidor;

  const procesos = procesosDe(candidato);
  if (!procesos.length) return candidato?.entrevistas?.[0]?.proceso ?? null;

  return (
    procesos.find(p => tieneContratoActivoReal(p))
    ?? procesos.find(p => esContratoReal(p))
    ?? procesos.find(p => !!p?.contrato)
    ?? candidato?.entrevistas?.[0]?.proceso
    ?? null
  );
}

/**
 * Proceso del que se leen (y en el que se guardan) los ANTECEDENTES.
 *
 * Es el proceso VIGENTE, ni más ni menos. Lo importante es que lectura y
 * escritura sean el MISMO: antes se leía de `entrevistas[0].proceso` y se
 * guardaba donde el backend decidiera por su cuenta, así que con dos turnos
 * abiertos el formulario se pintaba en blanco después de guardar
 * (caso CC 1006913166).
 *
 * NO se prefiere "el proceso que ya tiene antecedentes": los de un turno
 * anterior pertenecen a ESE turno y reusarlos filtraría estado de una vacante
 * a otra. Un turno nuevo empieza con los antecedentes en blanco a propósito —
 * hay que volver a consultarlos.
 */
export function procesoDeAntecedentes(candidato: any): any | null {
  return procesoVigente(candidato);
}
