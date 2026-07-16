import {
  esContratoReal,
  esContratoRealMini,
  estadoContratoPill,
  tieneContratoActivoReal,
} from './contrato.rules';

/** Proceso tal como llega en candidato.entrevistas[0].proceso. */
function proceso(over: Record<string, any> = {}, contrato: Record<string, any> | null = {}) {
  return {
    contratado: false,
    ...over,
    contrato: contrato === null ? null : {
      codigo_contrato: 'COSUBA_0141-26',
      contrato_activo: true,
      fecha_ingreso: null,
      fecha_retiro: null,
      ...contrato,
    },
  };
}

describe('contrato.rules', () => {
  // Caso real detectado en prod (CC 1128324722): fila de contrato creada solo
  // para reservar el código, contrato_activo=true por default del modelo,
  // proceso apenas remitido a prueba técnica.
  it('una fila con solo el código reservado NO es contrato activo ni bloquea', () => {
    const p = proceso({ contratado: false, prueba_tecnica: true });
    expect(esContratoReal(p)).toBeFalse();
    expect(tieneContratoActivoReal(p)).toBeFalse();
    expect(estadoContratoPill(p)).toBe('en_tramite');
  });

  it('contratado=true con contrato_activo=true bloquea (pill verde)', () => {
    const p = proceso({ contratado: true });
    expect(tieneContratoActivoReal(p)).toBeTrue();
    expect(estadoContratoPill(p)).toBe('activo');
  });

  it('contrato legacy: contratado=false pero con fecha_ingreso cuenta como real', () => {
    const p = proceso({ contratado: false }, { fecha_ingreso: '2026-01-15' });
    expect(esContratoReal(p)).toBeTrue();
    expect(tieneContratoActivoReal(p)).toBeTrue();
    expect(estadoContratoPill(p)).toBe('activo');
  });

  it('contrato dado de baja → retirado, aunque haya sido real', () => {
    const p = proceso({ contratado: true }, { contrato_activo: false, fecha_retiro: '2026-06-30' });
    expect(tieneContratoActivoReal(p)).toBeFalse();
    expect(estadoContratoPill(p)).toBe('retirado');
  });

  it('sin fila de contrato no hay pill ni bloqueo', () => {
    const p = proceso({}, null);
    expect(esContratoReal(p)).toBeFalse();
    expect(tieneContratoActivoReal(p)).toBeFalse();
    expect(estadoContratoPill(p)).toBe('sin_fila');
    expect(estadoContratoPill(null)).toBe('sin_fila');
    expect(estadoContratoPill(undefined)).toBe('sin_fila');
  });

  describe('esContratoRealMini (filas planas de by-document-min)', () => {
    it('fila esqueleto: contratado=false y sin contrato_fecha_ingreso → no real', () => {
      expect(esContratoRealMini({ contratado: false, contrato_fecha_ingreso: null })).toBeFalse();
    });

    it('contratado=true → real', () => {
      expect(esContratoRealMini({ contratado: true })).toBeTrue();
    });

    it('legacy con contrato_fecha_ingreso → real', () => {
      expect(esContratoRealMini({ contratado: false, contrato_fecha_ingreso: '2026-01-15' })).toBeTrue();
    });

    it('fila vacía / null → no real', () => {
      expect(esContratoRealMini({})).toBeFalse();
      expect(esContratoRealMini(null)).toBeFalse();
    });
  });
});
