/**
 * Blindaje anti "texto sobre texto" para los PDF generados con jsPDF.
 *
 * PROBLEMA QUE RESUELVE
 * ---------------------
 * Los formatos de contratación se dibujan con coordenadas fijas (mm) y datos de
 * longitud impredecible: nombres compuestos, razones sociales, direcciones,
 * correos, descripciones de obra/labor. jsPDF NO recorta ni acota nada:
 *
 *   1. `doc.text(valor, x, y)`            → si el valor es largo se pinta encima
 *                                            de la columna vecina o se sale de la hoja.
 *   2. `doc.text(valor, x, y, {maxWidth})`→ jsPDF parte el valor en varias líneas
 *                                            HACIA ABAJO. Como el llamador siguió
 *                                            usando su `y` fijo, la línea 2 cae
 *                                            justo encima de la fila siguiente.
 *
 * El caso (2) es el que más se ve: el texto no se sale de la hoja, se **monta**
 * sobre el renglón de abajo.
 *
 * SOLUCIÓN
 * --------
 * Toda pieza de texto variable se dibuja dentro de una CAJA declarada
 * (ancho y, cuando aplica, alto máximo). Nunca se pinta fuera de ella:
 *
 *   - `textoUnaLinea()`  → una sola línea, jamás más ancha que `maxWidth`.
 *                          Primero reduce el tamaño de fuente; si aun así no
 *                          cabe, recorta con "...". Devuelve el ancho pintado.
 *   - `textoCaja()`      → texto con wrap dentro de un rectángulo. Devuelve la Y
 *                          siguiente REAL, para que el llamador apile sin pisar.
 *   - `medirCaja()`      → la misma medida sin pintar (para reservar espacio).
 *   - `etiquetaValor()`  → "Rótulo: valor" en un renglón, ambos acotados.
 *
 * Y como última red de seguridad, `instalarGuardiaTexto(doc)` envuelve
 * `doc.text` para que NINGÚN texto —ni el que no pasa por los helpers— se salga
 * del área imprimible de la página.
 *
 * Reglas de las funciones de este módulo:
 *   - Nunca lanzan. Ante cualquier problema caen al comportamiento nativo.
 *   - Siempre restauran el tamaño de fuente que encontraron.
 *   - `maxWidth`/`maxAlto` son límites DUROS: el texto se reduce o se recorta,
 *     nunca se desborda.
 */

import type jsPDF from 'jspdf';

/** Marcador de recorte. Se usa '...' (3 puntos ASCII) porque es el único que
 *  está garantizado en las 14 fuentes estándar sin depender de la codificación. */
const ELIPSIS = '...';

/** Holgura de medida (mm). Evita reducir fuentes por errores de redondeo. */
const TOLERANCIA = 0.25;

/** Tamaño de fuente mínimo absoluto (pt) al que se permite reducir. */
const TAM_MINIMO_ABS = 3;

// ────────────────────────────────────────────────────────────────
// Medición
// ────────────────────────────────────────────────────────────────

/** Ancho en mm de `texto` con la fuente y tamaño ACTUALES del documento. */
export function anchoTexto(doc: jsPDF, texto: unknown): number {
  const t = String(texto ?? '');
  if (!t) return 0;
  try {
    const w = doc.getTextWidth(t);
    return Number.isFinite(w) ? w : 0;
  } catch {
    return 0;
  }
}

/** Alto en mm de una línea con el tamaño de fuente actual. */
export function altoLinea(doc: jsPDF, factor?: number): number {
  try {
    const escala = (doc as any).internal?.scaleFactor || 1;
    const f =
      factor ??
      (typeof (doc as any).getLineHeightFactor === 'function'
        ? (doc as any).getLineHeightFactor()
        : 1.15);
    return (doc.getFontSize() * f) / escala;
  } catch {
    return 4;
  }
}

/**
 * Parte `texto` en líneas que caben en `maxWidth`.
 * `splitTextToSize` de jsPDF también parte palabras sueltas más anchas que la
 * caja (correos, URLs, códigos), así que ninguna línea desborda.
 */
export function partirTexto(doc: jsPDF, texto: unknown, maxWidth: number): string[] {
  const t = String(texto ?? '');
  if (!t) return [];
  if (!(maxWidth > 0)) return [t];
  try {
    const r = doc.splitTextToSize(t, maxWidth);
    if (Array.isArray(r)) return r.length ? r : [''];
    return [String(r)];
  } catch {
    return [t];
  }
}

// ────────────────────────────────────────────────────────────────
// Ajuste de una línea
// ────────────────────────────────────────────────────────────────

/**
 * Recorta `texto` con "..." hasta que quepa en `maxWidth`.
 * Garantiza que el resultado NUNCA es más ancho que `maxWidth`.
 */
export function recortarTexto(
  doc: jsPDF,
  texto: unknown,
  maxWidth: number,
  elipsis: string = ELIPSIS,
): string {
  const t = String(texto ?? '');
  if (!t || !(maxWidth > 0)) return '';
  if (anchoTexto(doc, t) <= maxWidth) return t;

  /** Mayor prefijo de `t` cuyo ancho no supera `limite`. */
  const mayorPrefijo = (limite: number): number => {
    let lo = 0;
    let hi = t.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (anchoTexto(doc, t.slice(0, mid)) <= limite) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  };

  const anchoElipsis = anchoTexto(doc, elipsis);
  if (anchoElipsis > maxWidth) {
    // Ni el marcador cabe: se corta a secas.
    return t.slice(0, mayorPrefijo(maxWidth));
  }
  const corte = mayorPrefijo(maxWidth - anchoElipsis);
  if (corte <= 0) return elipsis;
  return t.slice(0, corte).replace(/\s+$/, '') + elipsis;
}

/**
 * Tamaño de fuente (≤ el actual) con el que `texto` cabe en una línea de
 * `maxWidth`. En jsPDF el ancho es lineal respecto al tamaño, así que el
 * cálculo es exacto.
 */
export function tamanoQueCabe(
  doc: jsPDF,
  texto: unknown,
  maxWidth: number,
  minFontSize?: number,
): number {
  const actual = doc.getFontSize();
  const ancho = anchoTexto(doc, texto);
  if (ancho <= 0 || !(maxWidth > 0) || ancho <= maxWidth) return actual;
  const minimo = Math.max(TAM_MINIMO_ABS, minFontSize ?? actual * 0.62);
  const ideal = (actual * maxWidth) / ancho;
  return Math.max(minimo, Math.floor(ideal * 100) / 100);
}

export interface OpcionesUnaLinea {
  /** Tamaño mínimo (pt) al que se puede reducir. Default: 62% del actual. */
  minFontSize?: number;
  /** Marcador de recorte. Default '...'. */
  elipsis?: string;
  /** Alineación del anclaje (x). Default 'left'. */
  align?: 'left' | 'center' | 'right';
  /** Si es false no reduce la fuente: recorta directamente. Default true. */
  reducir?: boolean;
  /** charSpace a forzar en el `doc.text` (algunos formatos lo fijan en 0). */
  charSpace?: number;
}

/**
 * Dibuja UNA línea garantizando que no supera `maxWidth`.
 * Estrategia: cabe tal cual → reducir tamaño → recortar con "...".
 * Restaura el tamaño de fuente. Devuelve el ancho realmente pintado (mm).
 */
export function textoUnaLinea(
  doc: jsPDF,
  texto: unknown,
  x: number,
  y: number,
  maxWidth: number,
  opciones: OpcionesUnaLinea = {},
): number {
  const t = String(texto ?? '').replace(/[\r\n]+/g, ' ');
  if (!t) return 0;

  const tamOriginal = doc.getFontSize();
  let salida = t;

  if (maxWidth > 0 && anchoTexto(doc, t) > maxWidth + TOLERANCIA) {
    if (opciones.reducir !== false) {
      const tam = tamanoQueCabe(doc, t, maxWidth, opciones.minFontSize);
      if (tam < tamOriginal) doc.setFontSize(tam);
    }
    if (anchoTexto(doc, salida) > maxWidth + TOLERANCIA) {
      salida = recortarTexto(doc, salida, maxWidth, opciones.elipsis);
    }
  }

  const anchoPintado = anchoTexto(doc, salida);
  const cfg: any = {};
  if (opciones.align) cfg.align = opciones.align;
  if (opciones.charSpace !== undefined) cfg.charSpace = opciones.charSpace;

  try {
    if (Object.keys(cfg).length) doc.text(salida, x, y, cfg);
    else doc.text(salida, x, y);
  } catch {
    /* jsPDF sólo falla con entradas no-string; `salida` siempre lo es. */
  }

  if (doc.getFontSize() !== tamOriginal) doc.setFontSize(tamOriginal);
  return anchoPintado;
}

// ────────────────────────────────────────────────────────────────
// Cajas de texto con wrap
// ────────────────────────────────────────────────────────────────

export interface OpcionesCaja {
  /** Separación entre líneas (mm). Default: alto de línea de la fuente actual. */
  lineHeight?: number;
  /** Máximo de líneas. Se recorta la última con "...". */
  maxLineas?: number;
  /** Alto máximo (mm). Equivale a `floor(maxAlto / lineHeight)` líneas. */
  maxAlto?: number;
  /** Alineación. Default 'left'. */
  align?: 'left' | 'center' | 'right';
  /** Si el texto no cabe en las líneas disponibles, reduce la fuente antes de
   *  recortar. Default true. */
  reducir?: boolean;
  /** Tamaño mínimo (pt) al reducir. Default: 62% del actual. */
  minFontSize?: number;
  /** Marcador de recorte. Default '...'. */
  elipsis?: string;
}

interface CajaMedida {
  lineas: string[];
  lineHeight: number;
  fontSize: number;
  alto: number;
  /** true si hubo que recortar contenido para que cupiera. */
  recortado: boolean;
}

/** Calcula el reparto en líneas de `texto` dentro de la caja, sin pintar. */
function calcularCaja(
  doc: jsPDF,
  texto: unknown,
  maxWidth: number,
  opciones: OpcionesCaja,
): CajaMedida {
  const tamOriginal = doc.getFontSize();
  const t = String(texto ?? '').replace(/\r/g, '');
  const ancho = Math.max(1, maxWidth);

  const lhBase = opciones.lineHeight;
  const limiteLineas = (lh: number): number => {
    const porOpcion = opciones.maxLineas ?? Number.POSITIVE_INFINITY;
    const porAlto = opciones.maxAlto ? Math.max(1, Math.floor(opciones.maxAlto / lh + 1e-6)) : Number.POSITIVE_INFINITY;
    return Math.min(porOpcion, porAlto);
  };

  if (!t) {
    const lh = lhBase ?? altoLinea(doc);
    return { lineas: [], lineHeight: lh, fontSize: tamOriginal, alto: 0, recortado: false };
  }

  let tam = tamOriginal;
  let lh = lhBase ?? altoLinea(doc);
  let lineas = partirTexto(doc, t, ancho);
  let maxLineas = limiteLineas(lh);

  // Reducir la fuente mientras el texto no quepa en las líneas disponibles.
  if (opciones.reducir !== false && Number.isFinite(maxLineas) && lineas.length > maxLineas) {
    const minimo = Math.max(TAM_MINIMO_ABS, opciones.minFontSize ?? tamOriginal * 0.62);
    while (tam > minimo && lineas.length > maxLineas) {
      tam = Math.max(minimo, Math.floor((tam - 0.25) * 100) / 100);
      doc.setFontSize(tam);
      lh = lhBase ?? altoLinea(doc);
      lineas = partirTexto(doc, t, ancho);
      maxLineas = limiteLineas(lh);
    }
  }

  let recortado = false;
  if (Number.isFinite(maxLineas) && lineas.length > maxLineas) {
    const corte = Math.max(1, maxLineas as number);
    const ultima = lineas.slice(corte - 1).join(' ');
    lineas = lineas.slice(0, corte - 1);
    lineas.push(recortarTexto(doc, ultima, ancho, opciones.elipsis));
    recortado = true;
  }

  const medida: CajaMedida = {
    lineas,
    lineHeight: lh,
    fontSize: tam,
    alto: lineas.length * lh,
    recortado,
  };
  if (doc.getFontSize() !== tamOriginal) doc.setFontSize(tamOriginal);
  return medida;
}

/** Mide (sin pintar) el espacio que ocuparía `textoCaja`. */
export function medirCaja(
  doc: jsPDF,
  texto: unknown,
  maxWidth: number,
  opciones: OpcionesCaja = {},
): { lineas: string[]; alto: number; lineHeight: number } {
  const m = calcularCaja(doc, texto, maxWidth, opciones);
  return { lineas: m.lineas, alto: m.alto, lineHeight: m.lineHeight };
}

/**
 * Dibuja `texto` con wrap dentro de una caja de `maxWidth` (y `maxAlto`/
 * `maxLineas` si se indican) empezando en la línea base `y`.
 *
 * Devuelve la Y de la línea SIGUIENTE (y + líneas·lineHeight). Ese valor es el
 * que debe usar el llamador para seguir apilando: es lo que evita que la
 * siguiente fila quede debajo del texto desbordado.
 */
export function textoCaja(
  doc: jsPDF,
  texto: unknown,
  x: number,
  y: number,
  maxWidth: number,
  opciones: OpcionesCaja = {},
): number {
  const tamOriginal = doc.getFontSize();
  const m = calcularCaja(doc, texto, maxWidth, opciones);
  if (!m.lineas.length) return y;

  if (m.fontSize !== tamOriginal) doc.setFontSize(m.fontSize);
  const cfg: any = opciones.align ? { align: opciones.align } : undefined;

  let cy = y;
  for (const linea of m.lineas) {
    try {
      if (cfg) doc.text(linea, x, cy, cfg);
      else doc.text(linea, x, cy);
    } catch {
      /* nunca debe tumbar la generación del PDF */
    }
    cy += m.lineHeight;
  }

  if (doc.getFontSize() !== tamOriginal) doc.setFontSize(tamOriginal);
  return cy;
}

// ────────────────────────────────────────────────────────────────
// Renglón "rótulo: valor"
// ────────────────────────────────────────────────────────────────

export interface OpcionesEtiquetaValor {
  /** Ancho reservado al rótulo. Si se omite se mide el rótulo real + `separacion`. */
  anchoEtiqueta?: number;
  /** Separación mínima entre rótulo y valor (mm). Default 1.5. */
  separacion?: number;
  /** Estilo del rótulo. Default 'normal'. */
  estiloEtiqueta?: 'normal' | 'bold' | 'italic' | 'bolditalic';
  /** Estilo del valor. Default 'bold'. */
  estiloValor?: 'normal' | 'bold' | 'italic' | 'bolditalic';
  /** Familia tipográfica. Default 'helvetica'. */
  fuente?: string;
  /** Separación entre líneas del valor (mm). */
  lineHeight?: number;
  /** Máximo de líneas del valor. Default 1 (nunca invade el renglón de abajo). */
  maxLineas?: number;
  /** charSpace a forzar. */
  charSpace?: number;
  /** Tamaño mínimo (pt) al reducir. */
  minFontSize?: number;
}

/**
 * Pinta "rótulo: valor" dentro de un ancho total `ancho`, empezando en `x`.
 *
 * - El rótulo se acota a `anchoEtiqueta` (nunca invade la zona del valor).
 * - El valor se acota al resto del ancho (nunca invade la columna vecina).
 * - Con `maxLineas > 1` el valor envuelve; el retorno indica cuánto bajó.
 *
 * Devuelve la Y siguiente (`y + líneas·lineHeight`).
 */
export function etiquetaValor(
  doc: jsPDF,
  etiqueta: string,
  valor: unknown,
  x: number,
  y: number,
  ancho: number,
  opciones: OpcionesEtiquetaValor = {},
): number {
  const fuente = opciones.fuente ?? 'helvetica';
  const separacion = opciones.separacion ?? 1.5;
  const maxLineas = Math.max(1, opciones.maxLineas ?? 1);

  doc.setFont(fuente, opciones.estiloEtiqueta ?? 'normal');
  const anchoEtiqueta =
    opciones.anchoEtiqueta ?? Math.min(ancho * 0.7, anchoTexto(doc, etiqueta) + separacion);

  textoUnaLinea(doc, etiqueta, x, y, Math.max(1, anchoEtiqueta - separacion), {
    charSpace: opciones.charSpace,
    minFontSize: opciones.minFontSize,
  });

  doc.setFont(fuente, opciones.estiloValor ?? 'bold');
  const xValor = x + anchoEtiqueta;
  const anchoValor = Math.max(1, ancho - anchoEtiqueta);

  let siguiente: number;
  if (maxLineas === 1) {
    textoUnaLinea(doc, valor, xValor, y, anchoValor, {
      charSpace: opciones.charSpace,
      minFontSize: opciones.minFontSize,
    });
    siguiente = y + (opciones.lineHeight ?? altoLinea(doc));
  } else {
    siguiente = textoCaja(doc, valor, xValor, y, anchoValor, {
      lineHeight: opciones.lineHeight,
      maxLineas,
      minFontSize: opciones.minFontSize,
    });
    if (siguiente === y) siguiente = y + (opciones.lineHeight ?? altoLinea(doc));
  }

  doc.setFont(fuente, 'normal');
  return siguiente;
}

// ────────────────────────────────────────────────────────────────
// Guardia global de ancho
// ────────────────────────────────────────────────────────────────

export interface OpcionesGuardia {
  /** Borde izquierdo imprimible (mm). Default 2. */
  margenIzquierdo?: number;
  /** Distancia desde el borde derecho de la hoja (mm). Default 2. */
  margenDerecho?: number;
  /** Fracción mínima del tamaño de fuente al reducir (0..1). Default 0.6. */
  minRatio?: number;
  /** Holgura de medida (mm). Default 0.25. */
  tolerancia?: number;
}

const MARCA_GUARDIA = '__guardiaTextoInstalada';

/**
 * Envuelve `doc.text` para que ningún texto se salga del área imprimible.
 *
 * Es la RED DE SEGURIDAD, no el mecanismo principal: sólo conoce los bordes de
 * la hoja, así que evita que un dato largo se derrame fuera de la página, pero
 * no sabe dónde empieza la columna vecina. Para eso están `textoUnaLinea` /
 * `textoCaja` / `etiquetaValor`, que sí reciben el ancho de la celda.
 *
 * Comportamiento por llamada:
 *   - Con `maxWidth`: se acota `maxWidth` al ancho disponible (jsPDF envuelve).
 *   - Sin `maxWidth`: si el texto desborda, se reduce la fuente hasta `minRatio`
 *     y, si aun así no cabe, se recorta con "...".
 *   - Texto rotado o con transformación: se deja intacto.
 *
 * Idempotente: instalarla dos veces sobre el mismo `doc` no hace nada.
 */
export function instalarGuardiaTexto(doc: jsPDF, opciones: OpcionesGuardia = {}): jsPDF {
  const d = doc as any;
  if (!d || typeof d.text !== 'function' || d[MARCA_GUARDIA]) return doc;

  const nativo = d.text.bind(d);
  const margenIzq = opciones.margenIzquierdo ?? 2;
  const margenDer = opciones.margenDerecho ?? 2;
  const minRatio = Math.min(1, Math.max(0.3, opciones.minRatio ?? 0.6));
  const tol = opciones.tolerancia ?? TOLERANCIA;

  d.text = function (texto: any, x: any, y: any, cfg?: any, transform?: any) {
    // Fuera de la firma habitual (o rotado/transformado): no se toca.
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      transform !== undefined ||
      (cfg && (cfg.angle !== undefined || cfg.rotationDirection !== undefined))
    ) {
      return nativo(texto, x, y, cfg, transform);
    }

    try {
      const anchoPagina = doc.internal.pageSize.getWidth();
      const limIzq = margenIzq;
      const limDer = anchoPagina - margenDer;
      const align = (cfg && cfg.align) || 'left';

      let disponible: number;
      if (align === 'center') disponible = 2 * Math.min(x - limIzq, limDer - x);
      else if (align === 'right') disponible = x - limIzq;
      else disponible = limDer - x;

      if (!(disponible > 0)) return nativo(texto, x, y, cfg, transform);

      // El llamador ya pidió wrap: sólo se acota el ancho de wrap.
      if (cfg && typeof cfg.maxWidth === 'number' && cfg.maxWidth > 0) {
        if (cfg.maxWidth > disponible + tol) {
          return nativo(texto, x, y, { ...cfg, maxWidth: disponible }, transform);
        }
        return nativo(texto, x, y, cfg, transform);
      }

      const esArreglo = Array.isArray(texto);
      const lineas: string[] = esArreglo
        ? (texto as any[]).map(l => String(l ?? ''))
        : [String(texto ?? '')];

      let ancho = 0;
      for (const l of lineas) ancho = Math.max(ancho, anchoTexto(doc, l));
      if (ancho <= disponible + tol) return nativo(texto, x, y, cfg, transform);

      const tamOriginal = doc.getFontSize();
      const tamMinimo = Math.max(TAM_MINIMO_ABS, tamOriginal * minRatio);
      const tamNecesario = (tamOriginal * disponible) / ancho;
      const tamFinal = Math.max(tamMinimo, Math.floor(tamNecesario * 100) / 100);
      if (tamFinal < tamOriginal) doc.setFontSize(tamFinal);

      let salida = lineas;
      let sobra = false;
      for (const l of lineas) {
        if (anchoTexto(doc, l) > disponible + tol) {
          sobra = true;
          break;
        }
      }
      if (sobra) salida = lineas.map(l => recortarTexto(doc, l, disponible));

      const resultado = nativo(esArreglo ? salida : salida[0], x, y, cfg, transform);
      if (doc.getFontSize() !== tamOriginal) doc.setFontSize(tamOriginal);
      return resultado;
    } catch {
      return nativo(texto, x, y, cfg, transform);
    }
  };

  d[MARCA_GUARDIA] = true;
  return doc;
}

// ────────────────────────────────────────────────────────────────
// Ayudas verticales
// ────────────────────────────────────────────────────────────────

/**
 * Garantiza que hay `alto` mm libres antes de `limiteInferior`; si no, salta de
 * página y devuelve la Y de inicio de la nueva. Evita que un bloque se pinte
 * encima del pie de página o se salga de la hoja.
 */
export function asegurarEspacio(
  doc: jsPDF,
  y: number,
  alto: number,
  limiteInferior: number,
  yNuevaPagina: number,
): number {
  if (y + alto <= limiteInferior) return y;
  doc.addPage();
  return yNuevaPagina;
}
