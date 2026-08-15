/**
 * Resuelve el campo "Título Obtenido o Último Año Cursado" de las fichas.
 *
 * El formulario público captura la escolaridad de dos maneras distintas y hay
 * que tratarlas distinto:
 *
 *   - `nivel` numérico (1..11): es el ÚLTIMO GRADO CURSADO, no un título. En
 *     prod hay 23.644 formaciones así con `titulo_obtenido` vacío, que hoy
 *     salen en blanco en la ficha pese a que sí sabemos hasta dónde estudió.
 *   - `nivel` de texto (EDUCACIÓN MEDIA ACADÉMICA, EDUCACIÓN TÉCNICA, ...):
 *     ahí el título sí es un título.
 *
 * `estudios_extra` se anexa cuando aporta algo. Ojo: el migrador legacy dejó
 * 17.500 registros con el formato "tecnico: X | tecnologo: X | profesional: X"
 * donde X es el MISMO valor repetido -- y cuando trae contenido suele ser un
 * apellido que se corrió de columna, no un estudio. Ese formato se descarta
 * entero; solo pasan los valores limpios (TÉCNICO, TECNÓLOGO, UNIVERSIDAD...).
 */

const NIVEL_NUMERICO = /^\d{1,2}$/;

/**
 * Grado -> nivel educativo colombiano (Ley 115 / MEN).
 *
 *   Básica primaria    grados 1 a 5
 *   Básica secundaria  grados 6 a 9
 *   Media              grados 10 y 11; culmina con el TÍTULO DE BACHILLER
 *
 * Por eso el 11 es el único que devuelve un título ("BACHILLER"): los demás
 * grados no otorgan uno, así que se nombra el nivel y entre paréntesis hasta
 * qué grado llegó.
 */
function nivelColombiano(grado: number): string {
  if (grado >= 11) return 'BACHILLER';
  if (grado === 10) return 'EDUCACIÓN MEDIA (10°)';
  if (grado >= 6) return `EDUCACIÓN BÁSICA SECUNDARIA (${grado}°)`;
  if (grado >= 1) return `EDUCACIÓN BÁSICA PRIMARIA (${grado}°)`;
  return 'PREESCOLAR';
}

/** Valores que significan "nada" y no deben imprimirse. */
const SIN_CONTENIDO = new Set([
  '', '-', '.', '0', 'N/A', 'NA', 'NO', 'NINGUNO', 'NINGUNA',
  'NO APLICA', 'NO REGISTRA', 'SIN INFORMACION', 'SIN INFORMACIÓN',
]);

/** Firma del concatenado que dejó el migrador legacy. */
const LEGACY_CONCAT = /\b(tecnico|tecnologo|profesional|especializacion)\s*:/i;

const limpio = (v: any): string => String(v ?? '').trim().replace(/\s+/g, ' ');
const vacio = (v: string): boolean => SIN_CONTENIDO.has(v.toUpperCase());

/** Estudios adicionales, o '' si lo que hay no aporta nada. */
export function estudiosExtraLimpios(valor: any): string {
  const v = limpio(valor);
  if (!v || vacio(v) || LEGACY_CONCAT.test(v)) return '';
  // "NINGUNA || algo real" -> se queda con lo real
  const partes = v.split('||').map(limpio).filter((p) => p && !vacio(p) && !LEGACY_CONCAT.test(p));
  return partes.join(' / ');
}

/**
 * Texto para "Título Obtenido o Último Año Cursado".
 *
 * @param formacion fila de `formaciones` (nivel, titulo_obtenido, estudios_extra)
 */
export function tituloOUltimoGrado(formacion: any): string {
  const f = formacion || {};
  const nivel = limpio(f.nivel);
  const titulo = limpio(f.titulo_obtenido);
  const extra = estudiosExtraLimpios(f.estudios_extra);

  let base = vacio(titulo) ? '' : titulo;

  if (!base) {
    if (NIVEL_NUMERICO.test(nivel)) {
      // 1..11 es el grado hasta donde llegó: se traduce al nivel del MEN
      base = nivelColombiano(parseInt(nivel, 10));
    } else if (nivel.toUpperCase() === 'SIN ESTUDIOS') {
      base = 'SIN ESTUDIOS';
    }
    // Con nivel de texto y sin título se deja vacío a propósito: el nivel ya
    // va en "Grado de Escolaridad" y repetirlo no agrega nada.
  }

  return [base, extra].filter(Boolean).join(' - ');
}
