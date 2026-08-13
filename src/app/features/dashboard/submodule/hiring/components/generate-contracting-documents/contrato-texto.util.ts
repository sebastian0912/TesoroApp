/**
 * Lógica de texto PURA del contrato de obra o labor (plantilla TA CO-RE-1).
 *
 * Extraída del componente generate-contracting-documents para poder probarla
 * sin jsPDF ni Angular: el tokenizador decide cómo se imprimen nombres y
 * domicilios en un documento legal, y las fechas de la ficha del contrato
 * deben salir SIEMPRE en dd/mm/yyyy.
 */

/**
 * Normaliza el texto de una celda de la ficha del contrato: quita invisibles y
 * espacios raros, y une letras SUELTAS ("H E I D Y" → "HEIDY", artefacto del
 * charSpace de jsPDF sobre datos copiados de PDFs).
 *
 * Los dígitos sueltos NO se juntan: el domicilio "CLL 7 4 49" debe salir tal
 * cual, no "CLL 74 49" — juntarlos corrompía direcciones reales.
 */
export function normalizeTextoContrato(v: any): string {
  let s = String(v ?? '');

  // Normaliza unicode (por si vienen combinaciones raras)
  if (typeof (s as any).normalize === 'function') {
    s = s.normalize('NFKD');
  }

  // Elimina invisibles típicos (ZWSP/ZWNJ/ZWJ/BOM/WJ/soft-hyphen, etc.)
  s = s.replace(/[\u200B-\u200D\uFEFF\u2060-\u2064\u00AD]/g, '');

  // Quita marcas combinantes (tildes “separadas”)
  // (si no soporta \p{M}, cae sin problema porque la mayoría no trae esto)
  try {
    s = s.replace(/\p{M}+/gu, '');
  } catch {
    // fallback: rango común de diacríticos combinantes
    s = s.replace(/[\u0300-\u036F]+/g, '');
  }

  // Espacios raros -> espacio normal
  s = s.replace(/[\u00A0\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  // Colapsa whitespace
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return '';

  const tokens = s.split(' ');
  const out: string[] = [];

  let buf = '';
  let kind: 'L' | 'D' | null = null;

  const flush = () => {
    if (buf) out.push(buf);
    buf = '';
    kind = null;
  };

  const isSingleLetter = (t: string) => {
    // unicode letter si está disponible
    try { return /^\p{L}$/u.test(t); } catch { return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]$/.test(t); }
  };

  for (const t of tokens) {
    if (!t) continue;

    if (isSingleLetter(t)) {
      if (kind && kind !== 'L') flush();
      kind = 'L';
      buf += t;
      continue;
    }

    // Los dígitos sueltos NO se juntan: el domicilio "CLL 7 4 49" debe
    // salir tal cual, no "CLL 74 49". Solo se juntan letras espaciadas
    // (tipo "H E I D Y" → "HEIDY").

    flush();
    out.push(t);
  }

  flush();
  return out.join(' ');
}

/**
 * Fecha en dd/mm/yyyy para la ficha del contrato. Acepta 'YYYY-MM-DD' (con o
 * sin hora), 'DD/MM/YYYY' (pasa tal cual), Date y timestamp numérico.
 * Devuelve '' si no hay fecha interpretable (el llamador decide el fallback).
 */
export function parseDateToDDMMYYYY(v: any): string {
  if (v === null || v === undefined) return '';

  // Si llega como string
  if (typeof v === 'string') {
    const s = v.trim();
    if (!s) return '';

    // ✅ corta hora: "YYYY-MM-DDTHH:mm:ss" o "YYYY-MM-DD HH:mm:ss"
    const datePart = s.split('T')[0].split(' ')[0].trim();

    // Si viene "YYYY-MM-DD"
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;

    // Si ya viene "DD/MM/YYYY"
    const m2 = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(datePart);
    if (m2) return `${m2[1]}/${m2[2]}/${m2[3]}`;

    // Fallback: intenta parsear igual (por si viene ISO raro)
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    return '';
  }

  // Si llega Date
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const dd = String(v.getDate()).padStart(2, '0');
    const mm = String(v.getMonth() + 1).padStart(2, '0');
    const yyyy = v.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  // Si llega timestamp numérico
  if (typeof v === 'number') {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  }

  return '';
}
