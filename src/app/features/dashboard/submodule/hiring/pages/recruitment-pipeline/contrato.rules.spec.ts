import {
  esContratoReal,
  esContratoRealMini,
  estadoContratoPill,
  procesoDeAntecedentes,
  procesoDelContrato,
  procesoVigente,
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

  it('sin fila de contrato ni contratado no hay pill ni bloqueo', () => {
    const p = proceso({}, null);
    expect(esContratoReal(p)).toBeFalse();
    expect(tieneContratoActivoReal(p)).toBeFalse();
    expect(estadoContratoPill(p)).toBe('sin_fila');
    expect(estadoContratoPill(null)).toBe('sin_fila');
    expect(estadoContratoPill(undefined)).toBe('sin_fila');
  });

  // Caso real (CC 1006913166): el historial laboral decía CONTRATADO y el
  // header no pintaba pill, así que no había forma de dar de baja.
  it('contratado=true SIN fila de contrato sigue siendo contrato activo', () => {
    const p = proceso({ contratado: true }, null);
    expect(esContratoReal(p)).toBeTrue();
    expect(tieneContratoActivoReal(p)).toBeTrue();
    expect(estadoContratoPill(p)).toBe('activo');
  });

  // contrato_activo es nullable en el modelo: NULL no es una baja. Exigir
  // `=== true` dejaba estas filas en "en trámite", sin botón de baja, mientras
  // el historial las mostraba CONTRATADO.
  it('contratado=true con contrato_activo NULL sigue activo (NULL no es baja)', () => {
    const p = proceso({ contratado: true }, { contrato_activo: null });
    expect(tieneContratoActivoReal(p)).toBeTrue();
    expect(estadoContratoPill(p)).toBe('activo');
  });

  it('sin contratar y con contrato_activo NULL sigue siendo solo trámite', () => {
    const p = proceso({ contratado: false }, { contrato_activo: null });
    expect(tieneContratoActivoReal(p)).toBeFalse();
    expect(estadoContratoPill(p)).toBe('en_tramite');
  });

  describe('procesoVigente / procesoDeAntecedentes', () => {
    const cand = (procesos: any[], extra: Record<string, any> = {}) => ({
      ...extra,
      entrevistas: procesos.map(proc => (proc === null ? {} : { proceso: proc })),
    });

    it('obedece el proceso_vigente_id que resolvió el servidor', () => {
      const abierto = { id: 9 };
      const c = cand([{ id: 4, contratado: true }, abierto], { proceso_vigente_id: 9 });
      expect(procesoVigente(c)).toBe(abierto);
      expect(procesoDeAntecedentes(c)).toBe(abierto);
    });

    it('sin proceso_vigente_id (backend viejo) cae al primero que exista', () => {
      const primero = { id: 4 };
      expect(procesoVigente(cand([primero, { id: 9 }]))).toBe(primero);
    });

    it('un id que no está en la lista no rompe: cae a la heurística', () => {
      const primero = { id: 4 };
      expect(procesoVigente(cand([primero], { proceso_vigente_id: 999 }))).toBe(primero);
    });

    it('salta la entrevista sin proceso (turno nuevo recién abierto)', () => {
      const proc = { id: 7 };
      expect(procesoVigente(cand([null, proc]))).toBe(proc);
    });

    it('sin entrevistas / sin procesos devuelve null', () => {
      expect(procesoVigente(null)).toBeNull();
      expect(procesoVigente({ entrevistas: [] })).toBeNull();
      expect(procesoVigente(cand([null]))).toBeNull();
    });
  });

  describe('procesoDelContrato', () => {
    const cand = (procesos: any[], extra: Record<string, any> = {}) => ({
      ...extra,
      entrevistas: procesos.map(proc => ({ proceso: proc })),
    });

    it('obedece el proceso_contrato_id del servidor aunque no sea el vigente', () => {
      const conContrato = { id: 4, contratado: true };
      const c = cand([{ id: 9 }, conContrato], { proceso_contrato_id: 4 });
      expect(procesoDelContrato(c)).toBe(conContrato);
    });

    // Caso CC 1006913166: el contrato vive en el turno anterior, ya terminal,
    // mientras el vigente es el turno nuevo sin contrato.
    it('sin ids del servidor encuentra el contrato en un turno anterior', () => {
      const conContrato = { id: 4, contratado: true, contrato: { contrato_activo: true } };
      expect(procesoDelContrato(cand([{ id: 9 }, conContrato]))).toBe(conContrato);
    });
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
