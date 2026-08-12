import { CAMPOS_PAGO_TRANSPORTE, FALTA_GUARDAR, faltantesDePagoTransporte } from './pago-transporte.rules';

/** Contrato tal como lo devuelve ContratoCandidatoSerializer, todo completo. */
function contratoCompleto(over: Record<string, any> = {}) {
  return {
    forma_de_pago: 'Bancolombia',
    numero_para_pagos: '1234567890123456',
    identification_number_tarjeta: '9988',
    Ccentro_de_costos: 'CC-1',
    subcentro_de_costos: 'SUB-1',
    porcentaje_arl: '0.522',
    cesantias: 'Porvenir',
    grupo: 'G1',
    categoria: 'CAT1',
    operacion: 'OP1',
    fecha_ingreso: '2026-07-01',
    fecha_contrato: '2026-07-01',
    seguro_funerario: false,
    horas_extras: false,
    ...over,
  };
}

describe('faltantesDePagoTransporte', () => {
  it('solo exige campos que el serializer realmente devuelve', () => {
    // Copiado de ContratoCandidatoSerializer.Meta.fields
    // (back-tu-apo-django/gestion_contratacion/serializers.py:158-192).
    // `contrasenia_asignada` NO está: es write_only. Si se colara en la lista,
    // el valor llegaría siempre undefined y bloquearía a todo candidato que no
    // sea Daviplata, sin forma de desbloquearlo.
    const EXPUESTOS = [
      'proceso', 'codigo_contrato', 'forma_de_pago', 'numero_para_pagos', 'seguro_funerario',
      'Ccentro_de_costos', 'porcentaje_arl', 'cesantias', 'subcentro_de_costos', 'grupo',
      'categoria', 'operacion', 'horas_extras', 'fecha_ingreso', 'fecha_contrato',
      'desea_trasladarse', 'seleccion_eps', 'identification_number_tarjeta', 'carnet_generado',
      'carnet_fecha_ingreso', 'carnet_codigo', 'carnet_centro_costo', 'contrato_activo',
      'fecha_retiro', 'motivo_retiro', 'descripcion_de_obra', 'centro_costo_obra',
      'direccion_empresa', 'empresa_usuaria', 'created_at', 'updated_at',
    ];

    const exigidos = CAMPOS_PAGO_TRANSPORTE.map((c) => c.campo);

    expect(exigidos.length).toBeGreaterThan(0);
    exigidos.forEach((campo) => expect(EXPUESTOS).withContext(campo).toContain(campo));
    expect(exigidos).not.toContain('contrasenia_asignada');
  });

  it('con todo guardado no falta nada', () => {
    expect(faltantesDePagoTransporte(contratoCompleto())).toEqual([]);
  });

  it('sin contrato guardado pide guardar el sub-tab', () => {
    expect(faltantesDePagoTransporte(null)).toEqual([FALTA_GUARDAR]);
    expect(faltantesDePagoTransporte(undefined)).toEqual([FALTA_GUARDAR]);
  });

  it('nombra en español cada campo que falta', () => {
    const faltan = faltantesDePagoTransporte(contratoCompleto({
      Ccentro_de_costos: '',
      grupo: null,
      fecha_ingreso: null,
    }));

    expect(faltan).toEqual(['Centro de costos', 'Grupo', 'Fecha de ingreso']);
  });

  it('acepta 0 como porcentaje ARL válido', () => {
    // Con un chequeo por falsy, un 0 legítimo bloquearía la generación.
    expect(faltantesDePagoTransporte(contratoCompleto({ porcentaje_arl: 0 }))).toEqual([]);
  });

  it('trata los espacios en blanco como vacío', () => {
    expect(faltantesDePagoTransporte(contratoCompleto({ grupo: '   ' }))).toEqual(['Grupo']);
  });

  it('no exige número de tarjeta con Daviplata', () => {
    const contrato = contratoCompleto({ forma_de_pago: 'Daviplata', identification_number_tarjeta: null });

    expect(faltantesDePagoTransporte(contrato)).toEqual([]);
  });

  it('exige número de tarjeta con cualquier otra forma de pago', () => {
    const contrato = contratoCompleto({ forma_de_pago: 'Bancolombia', identification_number_tarjeta: '' });

    expect(faltantesDePagoTransporte(contrato)).toEqual(['Número de tarjeta']);
  });

  it('no exige tarjeta si aún no se eligió forma de pago (ya se reporta esa)', () => {
    const contrato = contratoCompleto({ forma_de_pago: '', identification_number_tarjeta: '' });

    expect(faltantesDePagoTransporte(contrato)).toEqual(['Forma de pago']);
  });

  it('los booleanos en false no bloquean', () => {
    const contrato = contratoCompleto({ seguro_funerario: false, horas_extras: false });

    expect(faltantesDePagoTransporte(contrato)).toEqual([]);
  });

  it('un contrato recién creado y vacío lista todo lo que falta', () => {
    const faltan = faltantesDePagoTransporte({ codigo_contrato: 'ABC-1' });

    expect(faltan).toEqual(CAMPOS_PAGO_TRANSPORTE.map((c) => c.etiqueta));
  });
});
