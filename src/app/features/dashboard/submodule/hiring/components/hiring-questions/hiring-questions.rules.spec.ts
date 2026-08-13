import { campoDeFila, toNumeroDecimal } from './hiring-questions.rules';
import {
  LABOR_POR_MES_AREA_APOYO,
  claveDescripcion,
  descripcionEsDeOtroMes,
  esDescripcionGenerada,
  juegoDeLabores,
  resolverCodigoCompania,
  resolverDescripcionObra,
} from './labores-por-mes.data';

describe('hiring-questions.rules', () => {

  // ─────────────────────────────────────────────────────────────
  describe('toNumeroDecimal (el %ARL con coma)', () => {

    it("acepta coma decimal: '0,522' es 0.522, no NaN→null", () => {
      // Con Number() a secas el %ARL digitado con coma se perdía en silencio.
      expect(toNumeroDecimal('0,522')).toBe(0.522);
    });

    it('acepta punto decimal y números ya numéricos', () => {
      expect(toNumeroDecimal('0.522')).toBe(0.522);
      expect(toNumeroDecimal(4.35)).toBe(4.35);
      expect(toNumeroDecimal(' 2,436 ')).toBe(2.436);
    });

    it('vacío y null van a null (el backend los acepta)', () => {
      expect(toNumeroDecimal('')).toBeNull();
      expect(toNumeroDecimal(null)).toBeNull();
      expect(toNumeroDecimal(undefined)).toBeNull();
    });

    it('la basura no numérica va a null, nunca NaN', () => {
      expect(toNumeroDecimal('abc')).toBeNull();
      expect(toNumeroDecimal('1,2,3')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('campoDeFila (claves del maestro tal cual el Excel)', () => {

    // GET /gestion_centros_costos/ responde con las claves del Excel:
    // 'Empresa ' CON espacio final, 'Categoría' con tilde. Leer solo la
    // minúscula dejaba todo undefined y el autollenado era un no-op.
    const filaExcel = {
      'Ccostos': 'SAN CARLOS',
      'Empresa ': 'THE ELITE FLOWER',
      'Categoría': 'FLO',
      'Operación': 'OP1',
    };

    it("lee 'Empresa ' con espacio final probando varias claves", () => {
      expect(campoDeFila(filaExcel, 'Empresa ', 'Empresa', 'empresa')).toBe('THE ELITE FLOWER');
    });

    it("lee 'Categoría' con tilde", () => {
      expect(campoDeFila(filaExcel, 'Categoría', 'categoria')).toBe('FLO');
    });

    it('la misma lectura sirve con la respuesta snake_case de /resolver/', () => {
      const filaResolver = { empresa: 'FANTASY FLOWERS', categoria: 'PO' };
      expect(campoDeFila(filaResolver, 'Empresa ', 'Empresa', 'empresa')).toBe('FANTASY FLOWERS');
      expect(campoDeFila(filaResolver, 'Categoría', 'categoria')).toBe('PO');
    });

    it('clave ausente o vacía devuelve cadena vacía sin reventar', () => {
      expect(campoDeFila(filaExcel, 'Sublabor', 'sublabor')).toBe('');
      expect(campoDeFila({ Sublabor: '   ' }, 'Sublabor', 'sublabor')).toBe('');
      expect(campoDeFila(undefined as any, 'Empresa ')).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('descripción de obra por mes (labores-por-mes)', () => {

    const OPERARIO_PO = 'OPERARIO DE POSCOSECHA Y/U OFICIOS VARIOS'; // área PO en Apoyo

    it('resuelve la labor del mes de la FECHA DE INGRESO', () => {
      const jul = resolverDescripcionObra(OPERARIO_PO, '2026-07-15');
      const ago = resolverDescripcionObra(OPERARIO_PO, '2026-08-15');
      expect(jul).toBe(LABOR_POR_MES_AREA_APOYO['7PO']);
      expect(ago).toBe(LABOR_POR_MES_AREA_APOYO['8PO']);
      expect(jul).not.toBe(ago);
    });

    it('una descripción de julio con ingreso en agosto ES de otro mes', () => {
      // El caso real: la vacante se publica con la fecha de prueba técnica
      // (28 de julio) y la persona ingresa el 3 de agosto: el contrato tiene
      // que decir la obra de agosto.
      const deJulio = LABOR_POR_MES_AREA_APOYO['7PO'];
      expect(descripcionEsDeOtroMes(deJulio, '2026-08-03')).toBeTrue();
      expect(descripcionEsDeOtroMes(deJulio, '2026-07-28')).toBeFalse();
    });

    it('un texto redactado a mano no se marca como de otro mes', () => {
      expect(descripcionEsDeOtroMes('APOYO EN LABORES DE BODEGA', '2026-08-03')).toBeFalse();
      expect(claveDescripcion('APOYO EN LABORES DE BODEGA')).toBeNull();
      expect(esDescripcionGenerada('APOYO EN LABORES DE BODEGA')).toBeFalse();
    });

    it("'2026-08-01' es agosto, no julio (medianoche UTC en Colombia)", () => {
      const ago = resolverDescripcionObra(OPERARIO_PO, '2026-08-01');
      expect(ago).toBe(LABOR_POR_MES_AREA_APOYO['8PO']);
    });

    it('la empresa decide la hoja: Elite Blu no usa las labores de Apoyo', () => {
      // Elite Blu tiene `temporal = 'Apoyo Laboral TS'` en el maestro; por
      // temporal caería en la hoja de Apoyo y le pondría labores de rosas a
      // una finca de arándanos. La empresa se mira ANTES a propósito.
      const ALMACENISTA = 'ALMACENISTA Y/U OFICIOS VARIOS'; // área AD, difiere en agosto
      const apoyo = resolverDescripcionObra(ALMACENISTA, '2026-08-15', '', 'APOYO LABORAL TS SAS', '');
      const blu = resolverDescripcionObra(ALMACENISTA, '2026-08-15', '', 'APOYO LABORAL TS SAS', 'ELITE BLU SAS');
      expect(juegoDeLabores('APOYO LABORAL TS SAS', 'ELITE BLU SAS')).toBe('BLU');
      expect(apoyo).toBe(LABOR_POR_MES_AREA_APOYO['8AD']);
      expect(blu).not.toBe(apoyo);
    });

    it('cargo sin labor definida en la hoja que aplica devuelve null, no inventa', () => {
      // Los cargos de jardinería de Tu Alianza (área JAR) no tienen labores
      // en su hoja: el formulario debe avisar, no imprimir cualquier cosa.
      expect(juegoDeLabores('TU ALIANZA SAS', '')).toBe('ALIANZA');
      expect(resolverDescripcionObra('AGRICULTOR Y/U OFICIOS VARIOS', '2026-08-15', '', 'TU ALIANZA SAS', ''))
        .toBeNull();
      expect(resolverDescripcionObra('CARGO INVENTADO XYZ', '2026-08-15')).toBeNull();
    });

    it('el código de compañía sale de la tabla fija, con y sin sufijos societarios', () => {
      expect(resolverCodigoCompania('THE ELITE FLOWER')).toBe('001');
      expect(resolverCodigoCompania('THE ELITE FLOWER C.I.')).toBe('001');
      expect(resolverCodigoCompania('EMPRESA DESCONOCIDA')).toBe('');
    });
  });
});
