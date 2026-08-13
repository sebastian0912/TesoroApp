import { normalizeTextoContrato, parseDateToDDMMYYYY } from './contrato-texto.util';

describe('contrato-texto.util', () => {

  describe('normalizeTextoContrato (tokenizador de la ficha del contrato)', () => {

    // El bug que motivó el fix: el tokenizador viejo juntaba también los
    // dígitos sueltos y corrompía domicilios reales.
    it('NO junta dígitos sueltos: "CLL 7 4 49" sale tal cual', () => {
      expect(normalizeTextoContrato('CLL 7 4 49')).toBe('CLL 7 4 49');
    });

    it('sí junta letras espaciadas (artefacto de charSpace): "H E I D Y" → "HEIDY"', () => {
      expect(normalizeTextoContrato('H E I D Y')).toBe('HEIDY');
    });

    it('mezcla real: nombre espaciado + domicilio con números', () => {
      expect(normalizeTextoContrato('H E I D Y CLL 7 4 49 SUR')).toBe('HEIDY CLL 7 4 49 SUR');
    });

    it('una letra suelta entre palabras no se pega a ellas', () => {
      // "TORRES" y "SOTELO" son tokens multi-caracter: no entran al buffer.
      expect(normalizeTextoContrato('TORRES B SOTELO')).toBe('TORRES B SOTELO');
    });

    it('quita invisibles (ZWSP/soft-hyphen) y espacios raros (NBSP)', () => {
      // \u00A0 = no-break space, \u200B = zero-width space, \u00AD = soft hyphen.
      expect(normalizeTextoContrato('CRA\u00A07\u200B #\u00AD12')).toBe('CRA 7 #12');
    });

    it('colapsa whitespace y recorta extremos', () => {
      expect(normalizeTextoContrato('  CRA   7   BIS  ')).toBe('CRA 7 BIS');
    });

    it('tolera null/undefined/vacío', () => {
      expect(normalizeTextoContrato(null)).toBe('');
      expect(normalizeTextoContrato(undefined)).toBe('');
      expect(normalizeTextoContrato('   ')).toBe('');
    });
  });

  describe('parseDateToDDMMYYYY (fechas de la ficha del contrato)', () => {

    it('ISO "YYYY-MM-DD" → "DD/MM/YYYY"', () => {
      expect(parseDateToDDMMYYYY('2026-08-03')).toBe('03/08/2026');
    });

    it('ISO con hora ("T" o espacio) corta la hora sin desplazar el día', () => {
      expect(parseDateToDDMMYYYY('2026-08-03T00:00:00')).toBe('03/08/2026');
      expect(parseDateToDDMMYYYY('2026-08-03 23:59:59')).toBe('03/08/2026');
    });

    it('"DD/MM/YYYY" pasa tal cual', () => {
      expect(parseDateToDDMMYYYY('03/08/2026')).toBe('03/08/2026');
    });

    it('Date se formatea en hora LOCAL (sin corrimiento UTC)', () => {
      expect(parseDateToDDMMYYYY(new Date(2026, 7, 3))).toBe('03/08/2026');
    });

    it('timestamp numérico se formatea', () => {
      expect(parseDateToDDMMYYYY(new Date(2026, 0, 15).getTime())).toBe('15/01/2026');
    });

    it('entrada no interpretable devuelve "" (el llamador decide el fallback)', () => {
      expect(parseDateToDDMMYYYY(null)).toBe('');
      expect(parseDateToDDMMYYYY(undefined)).toBe('');
      expect(parseDateToDDMMYYYY('')).toBe('');
      expect(parseDateToDDMMYYYY('sin fecha')).toBe('');
      expect(parseDateToDDMMYYYY(new Date('invalida'))).toBe('');
    });
  });
});
