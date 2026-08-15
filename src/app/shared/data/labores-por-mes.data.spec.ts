/**
 * La descripción de la obra es la causa objetiva del contrato temporal: si sale
 * del mes equivocado, el contrato queda mal justificado. Estas pruebas fijan las
 * reglas que más fácil se rompen.
 */
import {
  AREA_POR_CARGO_APOYO,
  AREA_POR_CARGO_ALIANZA,
  LABOR_POR_MES_AREA_APOYO,
  LABOR_POR_MES_AREA_BLU,
  LABOR_POR_MES_AREA_ALIANZA,
  areaDeCargo,
  claveDescripcion,
  descripcionEsDeOtroMes,
  esDescripcionGenerada,
  fechaParaDescripcionVacante,
  juegoDeLabores,
  mesDe,
  resolverCodigoCompania,
  resolverDescripcionObra,
} from './labores-por-mes.data';

const CARGO_POSCOSECHA = 'OPERARIO DE POSCOSECHA Y/U OFICIOS VARIOS';   // área PO
const CARGO_CULTIVO = 'OPERARIO DE CULTIVO Y/U OFICIOS VARIOS';        // área CU

describe('mesDe', () => {
  it('lee YYYY-MM-DD sin correrse de mes por zona horaria', () => {
    // new Date('2026-08-01') es medianoche UTC = 31/jul en Colombia (UTC-5).
    // Si se usara getMonth() sobre eso, la obra saldría de julio.
    expect(mesDe('2026-08-01')).toBe(8);
    expect(mesDe('2026-01-01')).toBe(1);
    expect(mesDe('2026-12-31')).toBe(12);
  });

  it('acepta ISO con hora y objetos Date', () => {
    expect(mesDe('2026-03-15T00:00:00Z')).toBe(3);
    expect(mesDe(new Date(2026, 7, 1))).toBe(8);   // mes 7 = agosto
  });

  it('devuelve null si falta o es inválida', () => {
    expect(mesDe(null)).toBeNull();
    expect(mesDe(undefined)).toBeNull();
    expect(mesDe('')).toBeNull();
    expect(mesDe('no es fecha')).toBeNull();
  });
});

describe('resolverDescripcionObra · mes de ingreso', () => {
  it('usa el mes de la fecha de ingreso, no el de publicación', () => {
    const julio = resolverDescripcionObra(CARGO_POSCOSECHA, '2026-07-28');
    const agosto = resolverDescripcionObra(CARGO_POSCOSECHA, '2026-08-03');

    expect(julio).toContain('7PO');
    expect(agosto).toContain('8PO');
    expect(julio).not.toBe(agosto);
  });

  it('el primer día del mes NO cae en el mes anterior', () => {
    // Caso real del bug de zona horaria: prueba el 31/07, ingreso el 01/08.
    expect(resolverDescripcionObra(CARGO_POSCOSECHA, '2026-08-01')).toContain('8PO');
  });

  it('devuelve null sin fecha de ingreso', () => {
    expect(resolverDescripcionObra(CARGO_POSCOSECHA, null)).toBeNull();
  });
});

describe('fechaParaDescripcionVacante · qué fecha usa la VACANTE', () => {
  it('la fecha de ingreso manda cuando existe', () => {
    expect(fechaParaDescripcionVacante('2026-09-01', '2026-07-11', '2026-08-05'))
      .toBe('2026-09-01');
  });

  it('sin ingreso usa la de PRUEBA TÉCNICA, no la de publicación', () => {
    // Caso reportado: vacante publicada el 05/08 con prueba el 11/07.
    // Antes caía a la de publicación y proponía la obra de AGOSTO.
    expect(fechaParaDescripcionVacante(null, '2026-07-11', '2026-08-05'))
      .toBe('2026-07-11');
  });

  it('la de publicación es el último recurso', () => {
    expect(fechaParaDescripcionVacante(null, null, '2026-08-05')).toBe('2026-08-05');
    expect(fechaParaDescripcionVacante(null, null, null)).toBeNull();
  });

  it('el caso del reporte da 7AD y no 8AD', () => {
    const fecha = fechaParaDescripcionVacante(null, '2026-07-11', '2026-08-05');
    const desc = resolverDescripcionObra(
      'ALMACENISTA Y/U OFICIOS VARIOS',   // área AD
      fecha,
      'APOYO POSCOSECHAS',
      'APOYO LABORAL SAS',
      'THE ELITE FLOWER S.A.S. C.I.',
    );
    expect(desc).toBe(LABOR_POR_MES_AREA_APOYO['7AD']);
    expect(desc).not.toBe(LABOR_POR_MES_AREA_APOYO['8AD']);
  });

  it('la de contratación corrige después a la de ingreso real', () => {
    // La vacante propuso 7AD por la prueba de julio; la persona entra en agosto.
    const enVacante = LABOR_POR_MES_AREA_APOYO['7AD'];
    expect(descripcionEsDeOtroMes(enVacante, '2026-08-03')).toBeTrue();

    const enContratacion = resolverDescripcionObra(
      'ALMACENISTA Y/U OFICIOS VARIOS', '2026-08-03',
    );
    expect(enContratacion).toBe(LABOR_POR_MES_AREA_APOYO['8AD']);
  });
});

describe('juegoDeLabores', () => {
  it('Elite Blu manda sobre la temporal (sus filas son de Apoyo)', () => {
    expect(juegoDeLabores('Apoyo Laboral TS', 'ELITE BLU S.A.S.')).toBe('BLU');
    expect(juegoDeLabores('APOYO LABORAL SAS', 'ELITE BLU S.A.S')).toBe('BLU');
  });

  it('Tu Alianza usa su propia hoja', () => {
    expect(juegoDeLabores('TU ALIANZA SAS', 'HMVE S.A.S')).toBe('ALIANZA');
    expect(juegoDeLabores('TU ALIANZA S.A.S', null)).toBe('ALIANZA');
  });

  it('el resto cae en Apoyo', () => {
    expect(juegoDeLabores('Apoyo Laboral TS', 'THE ELITE FLOWER S.A.S. C.I.')).toBe('APOYO');
    expect(juegoDeLabores(null, null)).toBe('APOYO');
  });

  it('una finca de Blu no recibe labores de rosas', () => {
    const blu = resolverDescripcionObra(
      CARGO_CULTIVO, '2026-03-10', null, 'Apoyo Laboral TS', 'ELITE BLU S.A.S.',
    );
    const apoyo = resolverDescripcionObra(
      CARGO_CULTIVO, '2026-03-10', null, 'Apoyo Laboral TS', 'THE ELITE FLOWER S.A.S. C.I.',
    );
    expect(blu).toBe(LABOR_POR_MES_AREA_BLU['3CU']);
    expect(apoyo).toBe(LABOR_POR_MES_AREA_APOYO['3CU']);
    expect(blu).not.toBe(apoyo);
  });
});

describe('áreas sin labores', () => {
  it('los cargos de jardinería de Tu Alianza (JAR) no resuelven', () => {
    const cargoJar = Object.keys(AREA_POR_CARGO_ALIANZA)
      .find(c => AREA_POR_CARGO_ALIANZA[c] === 'JAR');
    expect(cargoJar).toBeDefined();

    expect(areaDeCargo(cargoJar!, 'ALIANZA')).toBe('JAR');
    expect(LABOR_POR_MES_AREA_ALIANZA['1JAR']).toBeUndefined();
    expect(
      resolverDescripcionObra(cargoJar!, '2026-08-03', null, 'TU ALIANZA SAS', 'HMVE S.A.S'),
    ).toBeNull();
  });

  it('un cargo desconocido devuelve null en vez de inventar', () => {
    expect(resolverDescripcionObra('CARGO QUE NO EXISTE', '2026-08-03')).toBeNull();
  });
});

describe('LAS DELICIAS usa área fija DEL', () => {
  it('ignora el área del cargo', () => {
    const conDelicias = resolverDescripcionObra(
      CARGO_POSCOSECHA, '2026-05-10', 'THE ELITE FLOWER LAS DELICIAS',
    );
    expect(conDelicias).toBe(LABOR_POR_MES_AREA_APOYO['5DEL']);
    expect(conDelicias).not.toBe(LABOR_POR_MES_AREA_APOYO['5PO']);
  });
});

describe('claveDescripcion / descripcionEsDeOtroMes', () => {
  it('descompone el prefijo', () => {
    expect(claveDescripcion('8PO APOYO RECEPCIÓN…')).toEqual({ mes: 8, area: 'PO' });
    expect(claveDescripcion('12DEL ALGO')).toEqual({ mes: 12, area: 'DEL' });
    expect(claveDescripcion('Texto redactado a mano')).toBeNull();
    expect(claveDescripcion('')).toBeNull();
  });

  it('detecta la descripción que quedó del mes de la prueba técnica', () => {
    const deJulio = LABOR_POR_MES_AREA_APOYO['7PO'];
    expect(descripcionEsDeOtroMes(deJulio, '2026-08-03')).toBeTrue();
    expect(descripcionEsDeOtroMes(deJulio, '2026-07-28')).toBeFalse();
  });

  it('no marca texto a mano ni fechas ausentes', () => {
    expect(descripcionEsDeOtroMes('Apoyo especial de temporada', '2026-08-03')).toBeFalse();
    expect(descripcionEsDeOtroMes(LABOR_POR_MES_AREA_APOYO['7PO'], null)).toBeFalse();
  });
});

describe('esDescripcionGenerada', () => {
  it('reconoce las tres hojas', () => {
    expect(esDescripcionGenerada(LABOR_POR_MES_AREA_APOYO['1CU'])).toBeTrue();
    expect(esDescripcionGenerada(LABOR_POR_MES_AREA_BLU['6PO'])).toBeTrue();
    expect(esDescripcionGenerada(LABOR_POR_MES_AREA_ALIANZA['9AD'])).toBeTrue();
  });

  it('no reconoce texto propio', () => {
    expect(esDescripcionGenerada('Apoyo especial de temporada')).toBeFalse();
    expect(esDescripcionGenerada('')).toBeFalse();
    expect(esDescripcionGenerada(null)).toBeFalse();
  });
});

describe('resolverCodigoCompania', () => {
  it('mapea las empresas de la tabla', () => {
    expect(resolverCodigoCompania('THE ELITE FLOWER S.A.S. C.I.')).toBe('001');
    expect(resolverCodigoCompania('FANTASY FLOWERS S.A.S.')).toBe('004');
  });

  it('cruza pese a las variantes que en el Excel nunca hacían match', () => {
    // El SUBSTITUTE original buscaba "MERCEDES S.A.S.  EN REORGANIZACION" y
    // "WAYUU FLOWERS S A S"; el maestro dice otra cosa.
    expect(resolverCodigoCompania('MERCEDES S.A.S.')).toBe('005');
    expect(resolverCodigoCompania('MERCEDES S.A.S. EN REORGANIZACION')).toBe('005');
    expect(resolverCodigoCompania('WAYUU FLOWERS S.A.S.')).toBe('011');
    expect(resolverCodigoCompania('WAYUU FLOWERS S A S')).toBe('011');
  });

  it('devuelve vacío para empresas sin código, nunca el nombre', () => {
    // El Excel, al no encontrarla, dejaba pasar el nombre como si fuera código.
    for (const e of ['PETALIA S.A.S.', 'ELITE BLU S.A.S.', 'HMVE S.A.S', 'FLORALEZA S.A.S']) {
      expect(resolverCodigoCompania(e)).toBe('');
    }
    expect(resolverCodigoCompania(null)).toBe('');
  });
});

describe('integridad de las tablas transcritas del Excel', () => {
  it('conserva el número de filas de cada hoja', () => {
    expect(Object.keys(LABOR_POR_MES_AREA_APOYO).length).toBe(216);
    expect(Object.keys(LABOR_POR_MES_AREA_BLU).length).toBe(132);
    expect(Object.keys(LABOR_POR_MES_AREA_ALIANZA).length).toBe(84);
    expect(Object.keys(AREA_POR_CARGO_ALIANZA).length).toBe(129);
  });

  it('cada hoja cubre los 12 meses de todas sus áreas', () => {
    for (const tabla of [
      LABOR_POR_MES_AREA_APOYO, LABOR_POR_MES_AREA_BLU, LABOR_POR_MES_AREA_ALIANZA,
    ]) {
      const areas = new Set(Object.keys(tabla).map(k => k.replace(/^\d+/, '')));
      for (const area of areas) {
        for (let mes = 1; mes <= 12; mes++) {
          expect(tabla[`${mes}${area}`]).withContext(`${mes}${area}`).toBeDefined();
        }
      }
    }
  });

  it('el texto empieza por su propia clave (fórmula =+A&B&" "&UPPER(E))', () => {
    for (const tabla of [
      LABOR_POR_MES_AREA_APOYO, LABOR_POR_MES_AREA_BLU, LABOR_POR_MES_AREA_ALIANZA,
    ]) {
      for (const [clave, texto] of Object.entries(tabla)) {
        expect(texto.startsWith(`${clave} `)).withContext(clave).toBeTrue();
      }
    }
  });

  it('todo cargo del maestro apunta a un área de 2 o 3 letras', () => {
    for (const tabla of [AREA_POR_CARGO_APOYO, AREA_POR_CARGO_ALIANZA]) {
      for (const [cargo, area] of Object.entries(tabla)) {
        expect(area).withContext(cargo).toMatch(/^[A-Z]{2,3}$/);
      }
    }
  });
});
