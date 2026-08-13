import { alinearConCatalogo, claveComparable } from './selection-questions.rules';

/** Catálogo real de AFP del componente (en MAYÚSCULAS, como el resto). */
const AFP = ['PORVENIR', 'COLFONDOS', 'PROTECCION', 'COLPENSIONES', 'SKANDIA', 'NO TIENE', 'SIN BUSCAR'] as const;
const ESTADOS = ['CUMPLE', 'NO CUMPLE', 'SIN BUSCAR'] as const;

describe('selection-questions.rules', () => {

  describe('claveComparable', () => {
    it('quita tildes, sube a mayúsculas y colapsa espacios', () => {
      expect(claveComparable('  Protección  ')).toBe('PROTECCION');
      expect(claveComparable('sin   buscar')).toBe('SIN BUSCAR');
    });

    it('null/undefined/vacío dan clave vacía', () => {
      expect(claveComparable(null)).toBe('');
      expect(claveComparable(undefined)).toBe('');
      expect(claveComparable('   ')).toBe('');
    });

    it('los números se comparan por su texto', () => {
      expect(claveComparable(5)).toBe('5');
    });
  });

  describe('alinearConCatalogo', () => {
    // Caso real medido en prod: 17 filas con 'PROTECCIÓN ' (tilde + espacio
    // final) que el mat-select mostraba VACÍAS contra la opción 'PROTECCION'.
    it("'PROTECCIÓN ' con tilde y espacio final se alinea a 'PROTECCION'", () => {
      expect(alinearConCatalogo('PROTECCIÓN ', AFP)).toBe('PROTECCION');
    });

    it('un valor en minúsculas encuentra la opción del catálogo', () => {
      expect(alinearConCatalogo('sin buscar', AFP)).toBe('SIN BUSCAR');
      expect(alinearConCatalogo('Cumple', ESTADOS)).toBe('CUMPLE');
    });

    it('devuelve el valor EXACTO del catálogo, no el normalizado', () => {
      const out = alinearConCatalogo('no tiene', AFP);
      expect(out).toBe('NO TIENE');
      expect(AFP).toContain(out as any);
    });

    it('un valor que no existe en el catálogo se deja tal cual, sin inventar', () => {
      expect(alinearConCatalogo('COLFONDO', AFP)).toBe('COLFONDO');
      expect(alinearConCatalogo('NONE', AFP)).toBe('NONE');
    });

    it('vacíos y nulos pasan sin tocar (el form los interpreta como "sin dato")', () => {
      expect(alinearConCatalogo('', AFP)).toBe('');
      expect(alinearConCatalogo(null, AFP)).toBeNull();
      expect(alinearConCatalogo(undefined, AFP)).toBeUndefined();
    });

    it('los catálogos numéricos (medidas correctivas) alinean número y texto', () => {
      const medidas = [0, 1, 2, 3, 'CUMPLE'] as const;
      expect(alinearConCatalogo('2', medidas)).toBe(2);
      expect(alinearConCatalogo('cumple', medidas)).toBe('CUMPLE');
    });
  });
});
