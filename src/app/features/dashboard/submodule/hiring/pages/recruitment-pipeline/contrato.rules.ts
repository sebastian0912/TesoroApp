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

/** ¿La fila de contrato representa una contratación real (no solo un código reservado)? */
export function esContratoReal(proceso: any): boolean {
  const contrato = proceso?.contrato;
  if (!contrato) return false;
  return proceso?.contratado === true || !!contrato?.fecha_ingreso;
}

/**
 * ¿El candidato tiene un contrato REAL y ACTIVO?
 * Esto es lo único que bloquea el pipeline (banner + tabs deshabilitados).
 */
export function tieneContratoActivoReal(proceso: any): boolean {
  return esContratoReal(proceso) && proceso?.contrato?.contrato_activo === true;
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
  const contrato = proceso?.contrato;
  if (!contrato) return 'sin_fila';
  if (tieneContratoActivoReal(proceso)) return 'activo';
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
  const entrevistas: any[] = Array.isArray(candidato?.entrevistas) ? candidato.entrevistas : [];
  const procesos = entrevistas.map(e => e?.proceso).filter(Boolean);
  if (!procesos.length) return candidato?.entrevistas?.[0]?.proceso ?? null;

  return (
    procesos.find(p => tieneContratoActivoReal(p))
    ?? procesos.find(p => esContratoReal(p))
    ?? procesos.find(p => !!p?.contrato)
    ?? candidato?.entrevistas?.[0]?.proceso
    ?? null
  );
}
