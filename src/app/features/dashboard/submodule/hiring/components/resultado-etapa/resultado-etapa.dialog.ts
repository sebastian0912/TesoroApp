/**
 * Diálogo compartido para registrar el resultado de una etapa con tres salidas
 * posibles: pasó / no pasó / no se presentó.
 *
 * Lo usan el pipeline (pills del header) y el diálogo de cumplimiento de
 * vacantes. Vive aparte para que ambos pidan lo mismo y guarden en los mismos
 * campos: si el flujo se duplicara, tarde o temprano uno pediría motivo y el
 * otro no.
 *
 * Los motivos son OBLIGATORIOS en "no pasó" y en "no se presentó", y cada uno
 * viaja en su propio campo del backend.
 */
import Swal from 'sweetalert2';

export type EtapaConResultado = 'prueba' | 'examen';
export type ResultadoEtapa = 'paso' | 'no_paso' | 'no_se_presento';

/** Lo que ya estaba registrado, para precargar el diálogo. */
export interface ResultadoEtapaPrevio {
  resultado?: ResultadoEtapa | 'sin_resultado' | null;
  motivoNoPaso?: string | null;
  motivoNoSePresento?: string | null;
}

const TEXTOS: Record<EtapaConResultado, {
  titulo: string;
  preguntaNoPaso: string;
  preguntaNoShow: string;
  ejemploNoShow: string;
}> = {
  prueba: {
    titulo: 'Resultado de la prueba técnica',
    preguntaNoPaso: '¿Por qué no pasó la prueba técnica?',
    preguntaNoShow: '¿Por qué no se presentó a la prueba técnica?',
    ejemploNoShow: 'Avisó que no podía, no contestó, se retiró del proceso...',
  },
  examen: {
    titulo: 'Resultado del examen médico',
    preguntaNoPaso: '¿Por qué no pasó el examen médico?',
    preguntaNoShow: '¿Por qué no se presentó al examen médico?',
    ejemploNoShow: 'No asistió a la cita, la reprogramó, se retiró del proceso...',
  },
};

/**
 * Pide resultado y (si aplica) motivo. Devuelve null si el usuario cancela en
 * cualquiera de los dos pasos: cancelar el motivo NO guarda un resultado a
 * medias.
 */
export async function pedirResultadoEtapa(
  etapa: EtapaConResultado,
  previo: ResultadoEtapaPrevio = {},
  nombreCandidato?: string | null,
): Promise<{ resultado: ResultadoEtapa; motivo: string } | null> {
  const t = TEXTOS[etapa];
  const actual = previo.resultado && previo.resultado !== 'sin_resultado' ? previo.resultado : '';

  const decision = await Swal.fire({
    title: t.titulo,
    text: nombreCandidato ? String(nombreCandidato) : undefined,
    input: 'radio',
    inputOptions: {
      paso: 'Pasó',
      no_paso: 'No pasó',
      no_se_presento: 'No se presentó',
    },
    inputValue: actual,
    inputValidator: (v) => (!v ? 'Selecciona un resultado.' : null),
    icon: 'question',
    heightAuto: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
  });

  if (!decision.isConfirmed) return null;
  const resultado = String(decision.value) as ResultadoEtapa;
  if (resultado === 'paso') return { resultado, motivo: '' };

  const noShow = resultado === 'no_se_presento';
  const pedido = await Swal.fire({
    title: 'Motivo',
    input: 'textarea',
    inputLabel: noShow ? t.preguntaNoShow : t.preguntaNoPaso,
    inputPlaceholder: noShow ? t.ejemploNoShow : '',
    inputValue: (noShow ? previo.motivoNoSePresento : previo.motivoNoPaso) ?? '',
    inputValidator: (valor) => {
      const texto = String(valor ?? '').trim();
      if (!texto) return 'El motivo es obligatorio.';
      if (texto.length < 5) return 'Amplía un poco más el motivo (mínimo 5 caracteres).';
      return null;
    },
    icon: 'warning',
    heightAuto: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
  });

  if (!pedido.isConfirmed) return null;
  return { resultado, motivo: String(pedido.value ?? '').trim() };
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
