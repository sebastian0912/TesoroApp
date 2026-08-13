import { claveTitular, elegirDocDelTitular } from './titular.rules';

/** Documento como llega de gestión documental (solo los campos que se usan). */
function doc(over: Record<string, any> = {}) {
  return { id: 1, type: 32, file_url: '/api/doc/1', ...over };
}

describe('titular.rules', () => {
  describe('claveTitular', () => {
    it('llavea por tipo|número: CC y CE con el mismo número son titulares distintos', () => {
      const cc = claveTitular({ tipo_doc: 'CC', numero_documento: '1097727446' });
      const ce = claveTitular({ tipo_doc: 'CE', numero_documento: '1097727446' });
      expect(cc).toBe('CC|1097727446');
      expect(ce).toBe('CE|1097727446');
      expect(cc).not.toBe(ce);
    });

    it('normaliza espacios y mayúsculas, y cae a CC sin tipo', () => {
      expect(claveTitular({ tipo_doc: ' cc ', numero_documento: ' 123 ' })).toBe('CC|123');
      expect(claveTitular({ numero_documento: 123 })).toBe('CC|123');
    });

    it('sin número de documento no hay llave', () => {
      expect(claveTitular(null)).toBeNull();
      expect(claveTitular({ tipo_doc: 'CC' })).toBeNull();
      expect(claveTitular({ tipo_doc: 'CC', numero_documento: '   ' })).toBeNull();
    });
  });

  describe('elegirDocDelTitular', () => {
    // Caso real: getDocuments("123") devuelve el examen del CC (owner_id "123")
    // Y el del extranjero homónimo (owner_id "x123"). docs[0] a ciegas mostraba
    // el del otro titular.
    it('para un CC elige el doc con owner_id = cédula, no docs[0]', () => {
      const ajeno = doc({ id: 1, owner_id: 'x123' });
      const propio = doc({ id: 2, owner_id: '123' });
      expect(elegirDocDelTitular([ajeno, propio], '123', 'CC')).toBe(propio);
    });

    it('para un no-CC elige el doc con prefijo x (case-insensitive)', () => {
      const deCC = doc({ id: 1, owner_id: '123' });
      const propio = doc({ id: 2, owner_id: 'X123' });
      expect(elegirDocDelTitular([deCC, propio], '123', 'CE')).toBe(propio);
    });

    it("normaliza el tipo con puntos: 'C.C' es CC, no extranjero", () => {
      const propio = doc({ id: 1, owner_id: '123' });
      const ajeno = doc({ id: 2, owner_id: 'x123' });
      expect(elegirDocDelTitular([ajeno, propio], '123', 'C.C')).toBe(propio);
      expect(elegirDocDelTitular([ajeno, propio], '123', 'C.C.')).toBe(propio);
    });

    it('tolera la cédula ya prefijada con x al comparar', () => {
      const propio = doc({ id: 1, owner_id: 'x123' });
      expect(elegirDocDelTitular([propio], 'x123', 'CE')).toBe(propio);
    });

    it('si hay owner_id pero ninguno es del titular, devuelve null (no muestra el ajeno)', () => {
      const ajeno = doc({ id: 1, owner_id: 'x123' });
      expect(elegirDocDelTitular([ajeno], '123', 'CC')).toBeNull();
    });

    it('payload viejo sin owner_id: conserva el comportamiento anterior (docs[0])', () => {
      const a = doc({ id: 1 });
      const b = doc({ id: 2 });
      expect(elegirDocDelTitular([a, b], '123', 'CC')).toBe(a);
    });

    it('lista vacía o nula → null', () => {
      expect(elegirDocDelTitular([], '123', 'CC')).toBeNull();
      expect(elegirDocDelTitular(null, '123', 'CC')).toBeNull();
      expect(elegirDocDelTitular(undefined, '123', 'CC')).toBeNull();
    });
  });
});
