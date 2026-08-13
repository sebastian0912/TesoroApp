import { canonTipoDoc, docKey, docParaEnviar, tipoDocLabel } from './tipo-doc.util';

describe('tipo-doc.util', () => {

  describe('docParaEnviar (la X marca "no es cédula de ciudadanía")', () => {

    // La fábrica de duplicados: con el tipo CRUDO, 'C.C' no era 'CC' y se
    // mandaba X<cédula>, creando un Candidato nuevo de una persona existente
    // (13793 filas 'C.C' medidas en prod).
    it("'C.C' se canoniza a CC: NO antepone la X", () => {
      expect(docParaEnviar('C.C', '1128324722')).toBe('1128324722');
    });

    it("'CC' directo tampoco lleva X", () => {
      expect(docParaEnviar('CC', '1128324722')).toBe('1128324722');
    });

    it('alias de cédula (CEDULA DE CIUDADANIA, ccc) también sin X', () => {
      expect(docParaEnviar('CEDULA DE CIUDADANIA', '99')).toBe('99');
      expect(docParaEnviar('ccc', '99')).toBe('99');
    });

    it("extranjería ('CE', 'C.E') SÍ lleva X", () => {
      expect(docParaEnviar('CE', '1002498616')).toBe('X1002498616');
      expect(docParaEnviar('C.E', '1002498616')).toBe('X1002498616');
    });

    it('el número se reduce a dígitos (quita puntos, espacios y X previas)', () => {
      expect(docParaEnviar('CC', '1.128.324.722')).toBe('1128324722');
      expect(docParaEnviar('CE', 'X1002498616')).toBe('X1002498616');
    });

    it('sin dígitos devuelve vacío', () => {
      expect(docParaEnviar('CC', '')).toBe('');
      expect(docParaEnviar('CC', null)).toBe('');
    });
  });

  describe('canonTipoDoc', () => {
    it("'C.C' → 'CC' (mata puntos)", () => {
      expect(canonTipoDoc('C.C')).toBe('CC');
    });

    it("permisos: 'PPT'/'PEP'/'PET' aterrizan en el canónico vigente ('PET')", () => {
      expect(canonTipoDoc('PPT')).toBe('PET');
      expect(canonTipoDoc('PEP')).toBe('PET');
      expect(canonTipoDoc('PET')).toBe('PET');
    });

    it("'TI' se tolera aunque no esté en el catálogo activo", () => {
      expect(canonTipoDoc('TI')).toBe('TI');
    });

    it('valores que no son un tipo de documento → null', () => {
      expect(canonTipoDoc('')).toBeNull();
      expect(canonTipoDoc('123')).toBeNull();
      expect(canonTipoDoc('ZZZ')).toBeNull();
    });
  });

  describe('docKey', () => {
    it("quita la X inicial: 'X1002498616' y '1002498616' son la misma persona", () => {
      expect(docKey('X1002498616')).toBe(docKey('1002498616'));
    });
  });

  describe('tipoDocLabel', () => {
    it('pinta el canónico, nunca el crudo', () => {
      expect(tipoDocLabel('c.c')).toBe('CC');
    });
  });
});
