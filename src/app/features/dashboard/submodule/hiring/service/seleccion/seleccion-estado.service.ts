import { Injectable, computed, signal } from '@angular/core';

/**
 * Estado compartido de la "observación del evaluador" (proceso.aplica_o_no_aplica)
 * del candidato seleccionado actualmente.
 *
 * Lo escribe `form-entrevista` (al cargar el candidato y cada vez que el operador
 * cambia el select de la observación). Lo leen los componentes hermanos del
 * pipeline de contratación para bloquearse cuando el candidato queda EN ESPERA
 * de vacante:
 *  - Remisión / asignación de vacante (`help-information`)
 *  - Exámenes de ingreso (`recruitment-pipeline`)
 *  - Contratación (`hiring-questions`)
 *
 * Es un singleton (`providedIn: 'root'`): siempre refleja al candidato activo,
 * que es único en pantalla.
 */
@Injectable({ providedIn: 'root' })
export class SeleccionEstadoService {
  /** Valor crudo: 'APLICA' | 'NO_APLICA' | 'EN_ESPERA' | null. */
  private readonly _aplicaObservacion = signal<string | null>(null);
  readonly aplicaObservacion = this._aplicaObservacion.asReadonly();

  /** El candidato está EN ESPERA de vacante. */
  readonly enEsperaVacante = computed(() => this._aplicaObservacion() === 'EN_ESPERA');

  /** El candidato quedó marcado como NO APLICA. */
  readonly noAplica = computed(() => this._aplicaObservacion() === 'NO_APLICA');

  /**
   * Bloqueo de remisión / exámenes de ingreso / contratación. Aplica tanto si el
   * candidato está EN ESPERA de vacante como si quedó marcado NO APLICA: en
   * ninguno de los dos casos se le puede remitir, examinar ni contratar.
   */
  readonly bloqueado = computed(() => this.enEsperaVacante() || this.noAplica());

  /** Frase corta para los avisos/banners según el motivo del bloqueo. */
  readonly motivoBloqueo = computed(() => {
    if (this.enEsperaVacante()) return 'en espera de vacante';
    if (this.noAplica()) return 'marcado como NO APLICA';
    return '';
  });

  /** Lo invoca `form-entrevista` cada vez que (re)evalúa la observación del evaluador. */
  setAplicaObservacion(value: string | null | undefined): void {
    const norm = (value ?? '').toString().trim().toUpperCase();
    this._aplicaObservacion.set(norm || null);
  }
}
