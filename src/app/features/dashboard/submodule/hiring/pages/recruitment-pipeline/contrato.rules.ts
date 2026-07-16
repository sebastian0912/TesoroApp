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
