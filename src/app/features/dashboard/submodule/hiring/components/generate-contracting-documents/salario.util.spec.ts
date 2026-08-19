/**
 * salario.util — el texto que sale impreso en la carátula de los contratos.
 *
 * Funciones puras: se prueban directo, sin TestBed. Los casos vienen de los
 * datos reales que documenta el propio util: la cola decimal de DRF
 * ("1750905.00"), el separador de miles ("1.750.905") y las reglas del
 * español (apócope, CIEN/CIENTO, "millones DE pesos").
 */
import {
  SMMLV_VIGENTE,
  numeroALetrasCO,
  parseMontoCOP,
  formatoPesosCO,
  montoEnLetrasCOP,
  salarioContratoCO,
} from './salario.util';

describe('salario.util', () => {

  describe('parseMontoCOP — distingue cola decimal de separador de miles', () => {
    it('la cola decimal de DRF ("1750905.00") NO es separador de miles', () => {
      expect(parseMontoCOP('1750905.00')).toBe(1750905);
    });

    it('los puntos de miles ("1.750.905") no se leen como decimales', () => {
      expect(parseMontoCOP('1.750.905')).toBe(1750905);
    });

    it('aguanta el símbolo de pesos y espacios ("$ 2.500.000")', () => {
      expect(parseMontoCOP('$ 2.500.000')).toBe(2500000);
    });

    it('un número ya numérico pasa intacto', () => {
      expect(parseMontoCOP(1234.5)).toBe(1234.5);
    });

    it('vacío, null y basura devuelven null (el llamador decide el fallback)', () => {
      expect(parseMontoCOP('')).toBeNull();
      expect(parseMontoCOP(null)).toBeNull();
      expect(parseMontoCOP('sin dato')).toBeNull();
    });
  });

  describe('numeroALetrasCO — reglas del español', () => {
    it('cero', () => {
      expect(numeroALetrasCO(0)).toBe('CERO');
    });

    it('apócope solo cuando hay sustantivo masculino detrás (21 → VEINTIÚN)', () => {
      expect(numeroALetrasCO(21)).toBe('VEINTIUNO');
      expect(numeroALetrasCO(21, true)).toBe('VEINTIÚN');
    });

    it('CIEN exacto vs CIENTO con resto', () => {
      expect(numeroALetrasCO(100)).toBe('CIEN');
      expect(numeroALetrasCO(101)).toBe('CIENTO UNO');
    });

    it('MIL a secas, nunca "UN MIL"; los miles van apocopados', () => {
      expect(numeroALetrasCO(1000)).toBe('MIL');
      expect(numeroALetrasCO(21000)).toBe('VEINTIÚN MIL');
    });

    it('el SMMLV completo, como en la plantilla del contrato', () => {
      expect(numeroALetrasCO(1750905, true))
        .toBe('UN MILLÓN SETECIENTOS CINCUENTA MIL NOVECIENTOS CINCO');
    });
  });

  describe('montoEnLetrasCOP — la moneda pegada', () => {
    it('"DE pesos" solo cuando la cifra termina justa en millón', () => {
      expect(montoEnLetrasCOP(3000000)).toBe('TRES MILLONES DE PESOS M/C');
      expect(montoEnLetrasCOP(3500000)).toBe('TRES MILLONES QUINIENTOS MIL PESOS M/C');
    });

    it('un peso, en singular', () => {
      expect(montoEnLetrasCOP(1)).toBe('UN PESO M/C');
    });
  });

  describe('formatoPesosCO', () => {
    it('agrupa miles con punto', () => {
      expect(formatoPesosCO(1750905)).toBe('$ 1.750.905');
    });
  });

  describe('salarioContratoCO — la frase completa de la carátula', () => {
    it('el mínimo legal lleva el prefijo S.M.M.L.V', () => {
      expect(salarioContratoCO('1750905.00')).toBe(
        'S.M.M.L.V $ 1.750.905 UN MILLÓN SETECIENTOS CINCUENTA MIL NOVECIENTOS CINCO PESOS M/C'
      );
    });

    it('cualquier otro salario NO lleva el prefijo (sería falso)', () => {
      expect(salarioContratoCO('2500000')).toBe(
        '$ 2.500.000 DOS MILLONES QUINIENTOS MIL PESOS M/C'
      );
    });

    it('sin salario usable devuelve vacío para que el llamador decida', () => {
      expect(salarioContratoCO('')).toBe('');
      expect(salarioContratoCO('0')).toBe('');
      expect(salarioContratoCO(null)).toBe('');
    });

    it('el SMMLV vigente del util es el que usan los contratos (2026)', () => {
      expect(SMMLV_VIGENTE).toBe(1750905);
    });
  });
});
