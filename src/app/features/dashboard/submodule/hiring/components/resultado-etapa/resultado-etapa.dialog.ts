/**
 * Registro del resultado de una etapa con tres salidas: pasó / no pasó / no se
 * presentó. Lo usan el pipeline (pills del header) y el diálogo de cumplimiento
 * de vacantes, para que ambos pidan lo mismo y guarden en los mismos campos.
 *
 * El prompt es un MatDialog (`ResultadoEtapaDialogComponent`), no un
 * SweetAlert: abierto desde otro diálogo, Swal quedaba por detrás —se cuelga de
 * `body` y el orden de pintado depende de z-index y de las capas de cascada del
 * CDK—. MatDialog se apila encima por construcción, que es como funciona el
 * resto de la app.
 *
 * Los motivos son OBLIGATORIOS en "no pasó" y en "no se presentó", y cada uno
 * viaja en su propio campo del backend.
 */
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import {
  ResultadoEtapaDialogComponent,
  type ResultadoEtapaDialogData,
  type ResultadoEtapaDialogResult,
} from './resultado-etapa-dialog.component';

export type EtapaConResultado = 'prueba' | 'examen';
export type ResultadoEtapa = 'paso' | 'no_paso' | 'no_se_presento';

/** Lo que ya estaba registrado, para precargar el diálogo. */
export interface ResultadoEtapaPrevio {
  resultado?: ResultadoEtapa | 'sin_resultado' | null;
  motivoNoPaso?: string | null;
  motivoNoSePresento?: string | null;
}

/**
 * Abre el diálogo y devuelve el resultado, o null si el usuario cancela.
 *
 * Recibe el `MatDialog` de quien llama; los dos consumidores ya lo inyectan.
 */
export async function pedirResultadoEtapa(
  dialog: MatDialog,
  etapa: EtapaConResultado,
  previo: ResultadoEtapaPrevio = {},
  nombreCandidato?: string | null,
): Promise<{ resultado: ResultadoEtapa; motivo: string } | null> {
  const ref = dialog.open<
    ResultadoEtapaDialogComponent,
    ResultadoEtapaDialogData,
    ResultadoEtapaDialogResult | null
  >(ResultadoEtapaDialogComponent, {
    data: { etapa, previo, nombreCandidato },
    autoFocus: 'dialog',
    restoreFocus: true,
  });

  const res = await firstValueFrom(ref.afterClosed());
  return res ?? null;
}

/** Campos que espera update-by-document para el resultado de la etapa. */
export function payloadResultadoEtapa(
  etapa: EtapaConResultado,
  resultado: ResultadoEtapa,
  motivo: string,
): Record<string, unknown> {
  const sufijo = etapa === 'prueba' ? 'prueba_tecnica' : 'examen_medico';
  return {
    [`paso_${sufijo}`]: resultado === 'paso',
    [`no_paso_${sufijo}`]: resultado === 'no_paso',
    [`no_se_presento_${sufijo}`]: resultado === 'no_se_presento',
    [`motivo_no_paso_${sufijo}`]: resultado === 'no_paso' ? motivo : null,
    [`motivo_no_se_presento_${sufijo}`]: resultado === 'no_se_presento' ? motivo : null,
  };
}
