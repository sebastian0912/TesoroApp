import {
  aplicarResultadoPruebaLocal,
  esVacanteDePruebaTecnica,
  etiquetaPruebaTecnica,
  resultadoDePruebaTecnica,
} from './prueba-tecnica.rules';

/** Proceso tal como lo devuelve el serializer (fields = "__all__"). */
function proceso(over: Record<string, any> = {}) {
  return {
    publicacion: 77,
    vacante_tipo: 'Prueba técnica',
    prueba_tecnica: true,
    no_paso_prueba_tecnica: false,
    paso_prueba_tecnica: false,
    motivo_no_paso_prueba_tecnica: null,
    ...over,
  };
}

describe('esVacanteDePruebaTecnica', () => {
  it('reconoce las variantes históricas del tipo', () => {
    // `vacante_tipo` no es uniforme en los datos: viene de la remisión.
    ['Prueba', 'prueba', 'Prueba técnica', 'PRUEBA TECNICA', 'prueba_tecnica', '  Prueba  ']
      .forEach((tipo) => {
        expect(esVacanteDePruebaTecnica(proceso({ vacante_tipo: tipo })))
          .withContext(tipo)
          .toBeTrue();
      });
  });

  it('no aplica a vacantes de contratación ni autorización', () => {
    ['Contratación', 'Autorización de ingreso', '', null, undefined]
      .forEach((tipo) => {
        expect(esVacanteDePruebaTecnica(proceso({ vacante_tipo: tipo })))
          .withContext(String(tipo))
          .toBeFalse();
      });
  });

  it('exige que haya vacante remitida', () => {
    // Sin `publicacion` no hay vacante seleccionada: el pill no debe salir aunque
    // quede un vacante_tipo viejo colgado del proceso.
    expect(esVacanteDePruebaTecnica(proceso({ publicacion: null }))).toBeFalse();
    expect(esVacanteDePruebaTecnica(proceso({ publicacion: undefined }))).toBeFalse();
  });

  it('no revienta sin proceso', () => {
    expect(esVacanteDePruebaTecnica(null)).toBeFalse();
    expect(esVacanteDePruebaTecnica(undefined)).toBeFalse();
    expect(esVacanteDePruebaTecnica({})).toBeFalse();
  });
});

describe('resultadoDePruebaTecnica', () => {
  it('sin marca es "sin_resultado"', () => {
    expect(resultadoDePruebaTecnica(proceso())).toBe('sin_resultado');
  });

  it('con la marca de aprobado es "paso"', () => {
    expect(resultadoDePruebaTecnica(proceso({ paso_prueba_tecnica: true }))).toBe('paso');
  });

  it('con la marca de reprobado es "no_paso"', () => {
    expect(resultadoDePruebaTecnica(proceso({ no_paso_prueba_tecnica: true }))).toBe('no_paso');
  });

  it('"no pasó" tiene prioridad si por error llegaran ambos flags', () => {
    const p = proceso({ paso_prueba_tecnica: true, no_paso_prueba_tecnica: true });
    expect(resultadoDePruebaTecnica(p)).toBe('no_paso');
  });

  it('solo el true explícito cuenta', () => {
    // El backend manda booleano; cualquier otra cosa no debe leerse como resultado.
    expect(resultadoDePruebaTecnica(proceso({ no_paso_prueba_tecnica: null, paso_prueba_tecnica: null }))).toBe('sin_resultado');
    expect(resultadoDePruebaTecnica({})).toBe('sin_resultado');
  });
});

describe('etiquetaPruebaTecnica', () => {
  it('dice "Enviado a prueba" mientras no haya resultado', () => {
    expect(etiquetaPruebaTecnica(proceso())).toBe('Enviado a prueba');
  });

  it('dice "Pasó la prueba" cuando aprobó', () => {
    expect(etiquetaPruebaTecnica(proceso({ paso_prueba_tecnica: true }))).toBe('Pasó la prueba');
  });

  it('dice "No pasó la prueba" cuando reprobó', () => {
    expect(etiquetaPruebaTecnica(proceso({ no_paso_prueba_tecnica: true }))).toBe('No pasó la prueba');
  });
});

describe('aplicarResultadoPruebaLocal', () => {
  function candidato() {
    return {
      numero_documento: '1005851505',
      entrevistas: [{ id: 1, proceso: proceso() }],
    };
  }

  it('crea referencias NUEVAS en toda la cadena (por eso el pill se actualiza)', () => {
    // El bug original: mutar en el sitio dejaba la misma referencia y los computed
    // memoizados del pill no recalculaban hasta re-buscar.
    const cand = candidato();
    const out = aplicarResultadoPruebaLocal(cand, { noPaso: true, motivo: 'no completó', ahora: '2026-07-15T23:39:00Z' });

    expect(out).not.toBe(cand);
    expect(out.entrevistas).not.toBe(cand.entrevistas);
    expect(out.entrevistas[0]).not.toBe(cand.entrevistas[0]);
    expect(out.entrevistas[0].proceso).not.toBe(cand.entrevistas[0].proceso);
    // El original no se muta.
    expect(cand.entrevistas[0].proceso.no_paso_prueba_tecnica).toBeFalse();
  });

  it('el resultado ya se lee como "no pasó" (lo que muestra el pill)', () => {
    const out = aplicarResultadoPruebaLocal(candidato(), { noPaso: true, motivo: 'faltó', ahora: 'AHORA' });
    const proc = out.entrevistas[0].proceso;

    expect(resultadoDePruebaTecnica(proc)).toBe('no_paso');
    expect(etiquetaPruebaTecnica(proc)).toBe('No pasó la prueba');
    expect(proc.motivo_no_paso_prueba_tecnica).toBe('faltó');
    expect(proc.no_paso_prueba_tecnica_at).toBe('AHORA');
    expect(proc.paso_prueba_tecnica).toBeFalse();
  });

  it('al marcar "pasó" limpia el motivo y sella su fecha', () => {
    const out = aplicarResultadoPruebaLocal(candidato(), { noPaso: false, motivo: '', ahora: 'AHORA' });
    const proc = out.entrevistas[0].proceso;

    expect(resultadoDePruebaTecnica(proc)).toBe('paso');
    expect(etiquetaPruebaTecnica(proc)).toBe('Pasó la prueba');
    expect(proc.motivo_no_paso_prueba_tecnica).toBeNull();
    expect(proc.no_paso_prueba_tecnica_at).toBeNull();
    expect(proc.paso_prueba_tecnica_at).toBe('AHORA');
  });

  it('prefiere las fechas que devuelve el backend', () => {
    const out = aplicarResultadoPruebaLocal(candidato(), {
      noPaso: true, motivo: 'x', ahora: 'LOCAL',
      procResp: { no_paso_prueba_tecnica_at: '2026-07-15T10:00:00Z' },
    });

    expect(out.entrevistas[0].proceso.no_paso_prueba_tecnica_at).toBe('2026-07-15T10:00:00Z');
  });

  it('sin proceso devuelve el candidato tal cual', () => {
    const cand = { numero_documento: '1', entrevistas: [] };
    expect(aplicarResultadoPruebaLocal(cand, { noPaso: true, motivo: '', ahora: 'X' })).toBe(cand);
  });
});
