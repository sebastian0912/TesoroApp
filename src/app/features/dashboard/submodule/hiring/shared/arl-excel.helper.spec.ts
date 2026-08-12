import * as XLSX from 'xlsx';

import {
  ArlExcelError,
  aIsoLocal,
  formatearFecha,
  leerArlExcel,
  normalizarCedula,
  parseFechaArl,
  validarCedulaContraArl,
} from './arl-excel.helper';

/**
 * Arma un File con un Excel de verdad para probar el parser completo (headers,
 * seriales, formatos mezclados). Con un mock del index no se probaría lo que
 * más se rompe: la lectura del archivo real que exporta el portal.
 */
function excelArl(filas: any[][], headers: string[] = ['DNI TRABAJADOR', 'INICIO VIGENCIA']): File {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...filas]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hoja1');
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new File([out], 'arl.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

describe('normalizarCedula', () => {
  it('deja solo dígitos', () => {
    expect(normalizarCedula('1.002.683.090')).toBe('1002683090');
    expect(normalizarCedula(' 1002683090 ')).toBe('1002683090');
  });

  it('conserva el prefijo X de los documentos especiales', () => {
    expect(normalizarCedula('x5005888')).toBe('X5005888');
    expect(normalizarCedula('X 500.5888')).toBe('X5005888');
  });

  it('devuelve vacío para nulos', () => {
    expect(normalizarCedula(null)).toBe('');
    expect(normalizarCedula(undefined)).toBe('');
    expect(normalizarCedula('')).toBe('');
  });
});

describe('parseFechaArl', () => {
  it('lee DD/MM/YYYY (formato LATAM)', () => {
    const d = parseFechaArl('03/08/2026')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7); // agosto
    expect(d.getDate()).toBe(3);
  });

  it('detecta formato US cuando el mes se pasa de 12', () => {
    // 08/25/2026 solo puede ser MM/DD/YYYY.
    const d = parseFechaArl('08/25/2026')!;
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(25);
  });

  it('lee ISO YYYY-MM-DD', () => {
    const d = parseFechaArl('2026-08-03')!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(3);
  });

  it('lee DD-MM-YYYY', () => {
    const d = parseFechaArl('03-08-2026')!;
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(3);
  });

  it('lee el serial de Excel', () => {
    // 46237 = 2026-08-03 en el calendario de Excel (base 1899-12-30).
    const serial = Math.round(
      (Date.UTC(2026, 7, 3) - Date.UTC(1899, 11, 30)) / (24 * 60 * 60 * 1000),
    );
    const d = parseFechaArl(serial)!;
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(3);
  });

  it('expande años de 2 dígitos con pivote en 30', () => {
    expect(parseFechaArl('03/08/26')!.getFullYear()).toBe(2026);
    expect(parseFechaArl('03/08/94')!.getFullYear()).toBe(1994);
  });

  it('devuelve null para basura', () => {
    expect(parseFechaArl('')).toBeNull();
    expect(parseFechaArl(null)).toBeNull();
    expect(parseFechaArl('sin fecha')).toBeNull();
  });

  it('no arrastra hora: siempre medianoche local', () => {
    const d = parseFechaArl('03/08/2026')!;
    expect([d.getHours(), d.getMinutes(), d.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe('aIsoLocal', () => {
  it('no corre el día por zona horaria', () => {
    // toISOString() sobre medianoche local en Colombia (UTC-5) devolvería el
    // día anterior. Por eso el helper formatea con los getters locales.
    expect(aIsoLocal(new Date(2026, 7, 3))).toBe('2026-08-03');
    expect(aIsoLocal(new Date(2026, 0, 1))).toBe('2026-01-01');
  });

  it('devuelve null si no hay fecha', () => {
    expect(aIsoLocal(null)).toBeNull();
  });
});

describe('formatearFecha', () => {
  it('formatea DD/MM/YYYY con ceros', () => {
    expect(formatearFecha(new Date(2026, 7, 3))).toBe('03/08/2026');
  });

  it('devuelve vacío si no hay fecha', () => {
    expect(formatearFecha(null)).toBe('');
  });
});

describe('leerArlExcel', () => {
  it('indexa por cédula normalizada', async () => {
    const index = await leerArlExcel(excelArl([['1.002.683.090', '03/08/2026']]));

    expect(index.totalFilas).toBe(1);
    expect(index.porCedula.has('1002683090')).toBeTrue();
  });

  it('encuentra las columnas sin importar la posición ni el texto exacto', async () => {
    const index = await leerArlExcel(
      excelArl(
        [['CONTRATO-1', '1002683090', '03/08/2026']],
        ['NRO CONTRATO', 'Dni Trabajador Afiliado', 'Fecha Inicio Vigencia'],
      ),
    );

    expect(index.porCedula.get('1002683090')?.length).toBe(1);
  });

  it('agrupa las filas repetidas de la misma cédula', async () => {
    const index = await leerArlExcel(
      excelArl([
        ['1002683090', '03/08/2026'],
        ['1002683090', '10/08/2026'],
      ]),
    );

    expect(index.porCedula.get('1002683090')?.length).toBe(2);
  });

  it('falla con detalle si faltan las columnas', async () => {
    await expectAsync(
      leerArlExcel(excelArl([['1002683090', '03/08/2026']], ['CEDULA', 'FECHA'])),
    ).toBeRejectedWithError(ArlExcelError, /no tiene las columnas necesarias/i);
  });

  it('falla si el archivo solo trae encabezado', async () => {
    await expectAsync(leerArlExcel(excelArl([]))).toBeRejectedWithError(
      ArlExcelError,
      /vacío/i,
    );
  });
});

describe('validarCedulaContraArl', () => {
  const FECHA_INGRESO = '2026-08-03';

  it('pasa cuando la fecha del ARL coincide con la de ingreso', async () => {
    const index = await leerArlExcel(excelArl([['1002683090', '03/08/2026']]));
    const res = validarCedulaContraArl(index, '1002683090', FECHA_INGRESO);

    expect(res.ok).toBeTrue();
    expect(res.hallazgos.length).toBe(0);
    expect(res.fechaIso).toBe('2026-08-03');
  });

  it('cruza aunque el ARL traiga la fecha como serial de Excel', async () => {
    const serial = Math.round(
      (Date.UTC(2026, 7, 3) - Date.UTC(1899, 11, 30)) / (24 * 60 * 60 * 1000),
    );
    const index = await leerArlExcel(excelArl([['1002683090', serial]]));

    expect(validarCedulaContraArl(index, '1002683090', FECHA_INGRESO).ok).toBeTrue();
  });

  it('cruza aunque el ARL traiga ISO y el contrato también', async () => {
    const index = await leerArlExcel(excelArl([['1002683090', '2026-08-03']]));

    expect(validarCedulaContraArl(index, '1002683090', FECHA_INGRESO).ok).toBeTrue();
  });

  it('reporta sin_arl cuando la cédula no está en el archivo', async () => {
    const index = await leerArlExcel(excelArl([['9999999999', '03/08/2026']]));
    const res = validarCedulaContraArl(index, '1002683090', FECHA_INGRESO);

    expect(res.ok).toBeFalse();
    expect(res.hallazgos.map((h) => h.tipo)).toEqual(['sin_arl']);
    expect(res.hallazgos[0].mensaje).toBe('No existe en ARL');
  });

  it('reporta fecha_distinta y nombra las dos fechas', async () => {
    const index = await leerArlExcel(excelArl([['1002683090', '10/08/2026']]));
    const res = validarCedulaContraArl(index, '1002683090', FECHA_INGRESO);

    expect(res.ok).toBeFalse();
    expect(res.hallazgos.map((h) => h.tipo)).toEqual(['fecha_distinta']);
    expect(res.hallazgos[0].mensaje).toContain('03/08/2026');
    expect(res.hallazgos[0].mensaje).toContain('10/08/2026');
  });

  it('avisa de duplicados pero NO bloquea si alguna fecha cuadra', async () => {
    const index = await leerArlExcel(
      excelArl([
        ['1002683090', '10/08/2026'],
        ['1002683090', '03/08/2026'],
      ]),
    );
    const res = validarCedulaContraArl(index, '1002683090', FECHA_INGRESO);

    // La afiliación existe y la fecha coincide: pasa, pero deja el hallazgo
    // porque un duplicado genera cobro doble si la persona se retira.
    expect(res.ok).toBeTrue();
    expect(res.hallazgos.map((h) => h.tipo)).toEqual(['duplicado']);
  });

  it('duplicados + ninguna fecha coincide: reporta los dos hallazgos', async () => {
    const index = await leerArlExcel(
      excelArl([
        ['1002683090', '10/08/2026'],
        ['1002683090', '11/08/2026'],
      ]),
    );
    const res = validarCedulaContraArl(index, '1002683090', FECHA_INGRESO);

    expect(res.ok).toBeFalse();
    expect(res.hallazgos.map((h) => h.tipo).sort()).toEqual(['duplicado', 'fecha_distinta']);
  });

  it('normaliza la cédula de entrada antes de buscar', async () => {
    const index = await leerArlExcel(excelArl([['1002683090', '03/08/2026']]));

    expect(validarCedulaContraArl(index, '1.002.683.090', FECHA_INGRESO).ok).toBeTrue();
  });

  it('sin fecha de ingreso no puede cuadrar', async () => {
    const index = await leerArlExcel(excelArl([['1002683090', '03/08/2026']]));
    const res = validarCedulaContraArl(index, '1002683090', null);

    expect(res.ok).toBeFalse();
    expect(res.hallazgos.map((h) => h.tipo)).toEqual(['fecha_distinta']);
  });

  it('acepta un Date como fecha de ingreso', async () => {
    const index = await leerArlExcel(excelArl([['1002683090', '03/08/2026']]));

    expect(validarCedulaContraArl(index, '1002683090', new Date(2026, 7, 3)).ok).toBeTrue();
  });
});
