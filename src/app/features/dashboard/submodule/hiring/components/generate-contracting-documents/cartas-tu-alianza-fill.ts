/**
 * Cartas / autorizaciones de la temporal TU ALIANZA S.A.S.
 *
 * Genera con jsPDF los tres formatos que hasta ahora sólo se podían subir
 * escaneados (perfil "Jardines de los Andes" en `documentos-por-empresa.config.ts`):
 *
 *   1. Carta Descuento de Flor          → TA CO-RE-12 V1 (30-04-21)
 *   2. Formato Timbre Ingreso/Salida    → Ref. Timbre en hora de Ingreso Salida
 *   3. Carta Autorización Correo        → Autorización notificación por vía electrónica
 *
 * El componente resuelve los assets (logo, firmas) y los datos del candidato, y
 * pasa todo por `CartaTuAlianzaCtx`; estas funciones son puras y sólo devuelven
 * el Blob del PDF — misma dirección que el resto de los `*-fill.ts`.
 */

import jsPDF from 'jspdf';

export interface CartaTuAlianzaCtx {
  /** Nombre completo del trabajador, ya en mayúsculas. */
  nombreCompleto: string;
  cedula: string;
  /** Sólo se usa en la Carta Autorización Correo Electrónico. */
  telefono?: string;
  /** Sólo se usa en la Carta Autorización Correo Electrónico. */
  correo?: string;
  /** Fecha que se imprime en el cuerpo (normalmente `fecha_contrato`). */
  fecha: Date;
  /** data URL del logo Tu Alianza; si es null se omite el logo. */
  logoDataUrl?: string | null;
  /** data URL de la firma del trabajador; si es null queda la línea en blanco. */
  firmaTrabajadorDataUrl?: string | null;
  /** data URL de la firma del Jefe de Gestión Humana (sólo Formato Timbre). */
  firmaJefeGhDataUrl?: string | null;
}

// ────────────────────────────────────────────────────────────────
// Constantes del formato
// ────────────────────────────────────────────────────────────────

const NIT = '900. 864.596-1';
const RAZON_SOCIAL = 'TU ALIANZA S.A.S';
const CIUDAD = 'Madrid– Cundinamarca';

const MESES_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

interface Run {
  text: string;
  style?: FontStyle;
}

// ────────────────────────────────────────────────────────────────
// Helpers de composición
// ────────────────────────────────────────────────────────────────

/** Fecha en formato `dd de MM de yyyy` (numérico, como se diligencia a mano). */
function fechaNumerica(d: Date): string {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd} de ${mm} de ${d.getFullYear()}`;
}

/**
 * Escribe runs con estilos mezclados, con wrap + justificación por línea.
 * Devuelve la Y siguiente al último renglón.
 */
function justifyRuns(
  doc: jsPDF,
  runs: Run[],
  x: number,
  yStart: number,
  width: number,
  lineH: number,
): number {
  // 1) Tokenizar en palabras conservando el estilo de su run.
  const words: { text: string; style: FontStyle; w: number }[] = [];
  for (const run of runs) {
    const style = run.style ?? 'normal';
    for (const token of run.text.split(/\s+/)) {
      if (!token) continue;
      doc.setFont('helvetica', style);
      words.push({ text: token, style, w: doc.getTextWidth(token) });
    }
  }
  if (!words.length) return yStart;

  doc.setFont('helvetica', 'normal');
  const spaceW = doc.getTextWidth(' ');

  // 2) Wrap greedy.
  const lines: (typeof words)[] = [];
  let current: typeof words = [];
  let currentW = 0;
  for (const word of words) {
    const extra = current.length ? spaceW + word.w : word.w;
    if (current.length && currentW + extra > width) {
      lines.push(current);
      current = [word];
      currentW = word.w;
    } else {
      current.push(word);
      currentW += extra;
    }
  }
  if (current.length) lines.push(current);

  // 3) Render, justificando todas menos la última.
  let y = yStart;
  lines.forEach((line, idx) => {
    const isLast = idx === lines.length - 1;
    const gaps = line.length - 1;
    const wordsW = line.reduce((sum, w) => sum + w.w, 0);
    const gapW = !isLast && gaps > 0 ? (width - wordsW) / gaps : spaceW;

    let cx = x;
    for (const word of line) {
      doc.setFont('helvetica', word.style);
      doc.text(word.text, cx, y);
      cx += word.w + gapW;
    }
    y += lineH;
  });

  doc.setFont('helvetica', 'normal');
  return y;
}

/** Atajo para párrafos de un solo estilo. */
function justifyText(
  doc: jsPDF,
  text: string,
  x: number,
  yStart: number,
  width: number,
  lineH: number,
  style: FontStyle = 'normal',
): number {
  return justifyRuns(doc, [{ text, style }], x, yStart, width, lineH);
}

/** Logo + NIT en la esquina superior izquierda. Devuelve la Y siguiente. */
function drawHeader(doc: jsPDF, ctx: CartaTuAlianzaCtx, x: number, y: number, nitLabel: string): number {
  let cy = y;
  if (ctx.logoDataUrl) {
    try {
      doc.addImage(ctx.logoDataUrl, 'PNG', x, cy, 40, 12);
    } catch (e) {
      console.error('[cartas-tu-alianza] no se pudo insertar el logo', e);
    }
  }
  cy += 15;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(nitLabel, x, cy);
  doc.setFont('helvetica', 'normal');
  return cy + 8;
}

/** Pie de página institucional (idéntico al resto de documentos Tu Alianza). */
function drawFooter(doc: jsPDF, pbx = '744 4002', tel = '890 29 70'): void {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - 15;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 100, 100);
  doc.text(`Tu Alianza S.A.S., Oficina Madrid: Cl 7 #4-49 Centro, PBX ${pbx};`, pageW / 2, footerY, { align: 'center' });
  doc.text(
    `Oficina Facatativá Cra. 2 # 8-156 Centro Tel: ${tel}. Mail: servicioalcliente@tsservicios.co`,
    pageW / 2,
    footerY + 3.5,
    { align: 'center' },
  );
  doc.setTextColor(0, 0, 0);
}

/** Firma (si existe) sobre la línea, y la línea. Devuelve la Y bajo la línea. */
function drawSignatureLine(
  doc: jsPDF,
  dataUrl: string | null | undefined,
  x: number,
  y: number,
  lineWidth = 55,
): number {
  if (dataUrl) {
    try {
      doc.addImage(dataUrl, 'PNG', x, y - 18, 45, 18);
    } catch (e) {
      console.error('[cartas-tu-alianza] no se pudo insertar la firma', e);
    }
  }
  doc.setLineWidth(0.4);
  doc.line(x, y, x + lineWidth, y);
  return y + 4.5;
}

/** Etiqueta en negrita + valor en normal sobre la misma línea. */
function labelValue(doc: jsPDF, label: string, value: string, x: number, y: number): void {
  doc.setFont('helvetica', 'bold');
  doc.text(label, x, y);
  const offset = doc.getTextWidth(`${label} `);
  doc.setFont('helvetica', 'normal');
  doc.text(value, x + offset, y);
}

// ────────────────────────────────────────────────────────────────
// 1) Carta Descuento de Flor — TA CO-RE-12 V1
// ────────────────────────────────────────────────────────────────

export function buildCartaDescuentoFlorPdf(ctx: CartaTuAlianzaCtx): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  doc.setProperties({ title: `CARTA_DESCUENTO_FLOR_${ctx.cedula}.pdf` });

  const pageW = doc.internal.pageSize.getWidth();
  const mL = 25.4;
  const maxW = pageW - mL * 2;
  const lineH = 5.6;

  // Código de formato (esquina superior derecha)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('TA CO-RE-12 V1 Fecha de Emisión: 30-04-21', pageW - mL, 22, { align: 'right' });

  let y = drawHeader(doc, ctx, mL, 18, `NIT ${NIT}`);

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('AUTORIZACIÓN DESCUENTO POR NÓMINA VENTA DE FLOR A EMPLEADOS', pageW / 2, y, { align: 'center' });
  y += 16;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.text(`${CIUDAD}; ${fechaNumerica(ctx.fecha)}`, mL, y);
  y += 12;

  doc.text('Señores:', mL, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text(RAZON_SOCIAL, mL, y);
  doc.setFont('helvetica', 'normal');
  y += 12;

  doc.text('Apreciados señores:', mL, y);
  y += 12;

  y = justifyRuns(
    doc,
    [
      {
        text:
          'Por medio de la presente autorizo a la empresa para que descuente del valor que haya de ' +
          'pagarme por concepto de salarios, cesantías, intereses de cesantías, primas de servicios, ' +
          'vacaciones, bonificaciones, premios, indemnizaciones o cualquier otra suma, el valor ' +
          'correspondiente a la ',
      },
      { text: 'COMPRA DE FLOR NACIONAL', style: 'normal' },
      {
        text:
          ' que realice a la compañía durante el tiempo que me encuentre al servicio de la misma. ' +
          'Manifiesto expresamente que asumo plenamente el valor fijado por la empresa y autorizo su ' +
          'descuento por nómina o en la liquidación final del contrato de trabajo, con previa solicitud ' +
          'de cada pedido y de acuerdo a la disponibilidad de inventario de flor para la venta.',
      },
    ],
    mL,
    y,
    maxW,
    lineH,
  );
  y += 12;

  doc.text('Cordialmente,', mL, y);
  y += 30;

  // Firma del trabajador
  y = drawSignatureLine(doc, ctx.firmaTrabajadorDataUrl, mL, y);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Firma del trabajador', mL, y);
  y += 5;
  labelValue(doc, 'Nombre:', ctx.nombreCompleto, mL, y);
  y += 5;
  labelValue(doc, 'No de Identificación:', ctx.cedula, mL, y);

  drawFooter(doc);
  return doc.output('blob');
}

// ────────────────────────────────────────────────────────────────
// 2) Formato Timbre Ingreso/Salida
// ────────────────────────────────────────────────────────────────

export function buildFormatoTimbrePdf(ctx: CartaTuAlianzaCtx): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  doc.setProperties({ title: `FORMATO_TIMBRE_INGRESO_SALIDA_${ctx.cedula}.pdf` });

  const pageW = doc.internal.pageSize.getWidth();
  const mL = 25.4;
  const maxW = pageW - mL * 2;
  const lineH = 5.4;

  let y = drawHeader(doc, ctx, mL, 20, `Nit. ${NIT}`);
  y += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  doc.text(`${CIUDAD}; ${fechaNumerica(ctx.fecha)}`, mL, y);
  y += 14;

  doc.text('Respetado (a).', mL, y);
  y += 7;
  doc.text('E.   S.   M.', mL, y);
  y += 9;

  // Referencia
  doc.setFont('helvetica', 'bold');
  doc.text('Ref.', mL + 40, y);
  doc.text('Timbre en hora de Ingreso Salida.', mL + 40 + doc.getTextWidth('Ref. '), y);
  doc.setFont('helvetica', 'normal');
  y += 12;

  doc.text('Apreciado señor (a):', mL, y);
  y += 10;

  y = justifyRuns(
    doc,
    [
      {
        text:
          'Nos permitimos recordarle la importancia y obligatoriedad de registrar sus horarios de ' +
          'Entrada y Salida de la Empresa usuaria, todo lo anterior basado y sustentado en lo descrito ' +
          'en el reglamento interno de Trabajo de la misma Art. 66. Numeral 11 ',
      },
      {
        text:
          '"Timbrar las tarjetas o firmar el registro de entradas y salidas de los lugares en donde la ' +
          'Empresa los establezca".',
        style: 'italic',
      },
    ],
    mL,
    y,
    maxW,
    lineH,
  );
  y += 6;

  y = justifyText(
    doc,
    'Adicionalmente, este registro será fundamental para la liquidación de la Nómina, respecto a ' +
    'turnos de trabajo, horas extras, recargos, entre otros.',
    mL,
    y,
    maxW,
    lineH,
  );
  y += 6;

  y = justifyText(
    doc,
    'Esperamos contar con su acostumbrada colaboración y compromiso con la compañía y los procesos.',
    mL,
    y,
    maxW,
    lineH,
  );
  y += 10;

  doc.text('Cordialmente.', mL, y);
  y += 32;

  // Firma Jefe de Gestión Humana
  y = drawSignatureLine(doc, ctx.firmaJefeGhDataUrl, mL, y, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Jefe Gestión Humana', mL, y);
  doc.setFont('helvetica', 'normal');
  y += 32;

  // Firma del trabajador
  y = drawSignatureLine(doc, ctx.firmaTrabajadorDataUrl, mL, y);
  doc.setFont('helvetica', 'bold');
  doc.text('Firma del trabajador', mL, y);
  y += 5;
  labelValue(doc, 'Nombre:', ctx.nombreCompleto, mL, y);
  y += 5;
  labelValue(doc, 'No de Identificación:', ctx.cedula, mL, y);

  drawFooter(doc);
  return doc.output('blob');
}

// ────────────────────────────────────────────────────────────────
// 3) Carta Autorización Correo Electrónico
// ────────────────────────────────────────────────────────────────

export function buildCartaAutorizacionCorreoPdf(ctx: CartaTuAlianzaCtx): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  doc.setProperties({ title: `AUTORIZACION_NOTIFICACION_ELECTRONICA_${ctx.cedula}.pdf` });

  const pageW = doc.internal.pageSize.getWidth();
  const mL = 20;
  const maxW = pageW - mL * 2;
  const lineH = 4.6;

  let y = drawHeader(doc, ctx, mL, 16, 'NIT 900864596-1');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('AUTORIZACIÓN PARA NOTIFICACIÓN POR VIA ELECTRÓNICA', pageW / 2, y, { align: 'center' });
  y += 12;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  y = justifyText(
    doc,
    'En los términos legales, la notificación se entiende surtida cuando es recibido el correo ' +
    'electrónico como instrumento de enteramiento, conforme a lo dispuesto por la ley 527 de 1999, ' +
    'contempla que las notificaciones que deban hacerse personalmente también podrán efectuarse con ' +
    'el envío de la del documento o información mediante mensaje de datos a la dirección electrónica ' +
    'o sitio que suministre y autorice el interesado en que se realice la notificación.',
    mL,
    y,
    maxW,
    lineH,
  );
  y += 5;

  y = justifyText(
    doc,
    'Teniendo en cuenta lo anterior, en mi condición de Trabajador(a) AUTORIZO que cualquier ' +
    'información o documento relacionado con el contrato de trabajo se notifique al siguiente correo ' +
    'electrónico:',
    mL,
    y,
    maxW,
    lineH,
  );
  y += 8;

  // Campos diligenciados (etiqueta en negrita + valor sobre línea)
  const campos: [string, string][] = [
    ['NOMBRE:', ctx.nombreCompleto],
    ['DOCUMENTO DE IDENTIFICACIÓN:', ctx.cedula],
    ['TELÉFONO DE CONTACTO:', ctx.telefono ?? ''],
    ['CORREO ELECTRONICO:', ctx.correo ?? ''],
  ];
  doc.setFontSize(9.5);
  for (const [label, value] of campos) {
    doc.setFont('helvetica', 'bold');
    doc.text(label, mL, y);
    const valueX = mL + doc.getTextWidth(`${label} `);
    doc.setFont('helvetica', 'normal');
    doc.text(value, valueX + 2, y);
    doc.setLineWidth(0.2);
    doc.line(valueX, y + 1.2, pageW - mL, y + 1.2);
    y += 9;
  }
  y += 2;

  doc.setFontSize(9);
  y = justifyRuns(
    doc,
    [
      { text: 'LOS TÉRMINOS Y CONDICIONES QUE APLICAN:', style: 'bold' },
      {
        text:
          ' De acuerdo a la veracidad de la dirección electrónica suministrada por el Trabajador se ' +
          'presume propia, el Trabajador se obliga a utilizarla directamente y no podrá alegar en ningún ' +
          'caso, desconocimiento de los actos notificados por operaciones en el buzón delegadas en ' +
          'terceros. Y para el fin de este consentimiento el Trabajador se compromete a verificar y ' +
          'mantener el correo con capacidad suficiente para recibir los comprobantes de pago en esta ' +
          'dirección electrónica ya que será el medio escogido para suministrar la información referente ' +
          `a su salario, en tanto presente una relación laboral activa con ${RAZON_SOCIAL}`,
      },
    ],
    mL,
    y,
    maxW,
    lineH,
  );
  y += 5;

  y = justifyText(
    doc,
    `Cualquier cambio de dirección de notificación electrónica deberá ser informado por el Trabajador ` +
    `a ${RAZON_SOCIAL}., so pena que se entienda realizada la notificación al correo electrónico aquí ` +
    `indicado y autorizado para este fin.`,
    mL,
    y,
    maxW,
    lineH,
  );
  y += 5;

  const dia = String(ctx.fecha.getDate()).padStart(2, '0');
  const mesNombre = MESES_ES[ctx.fecha.getMonth()];
  y = justifyText(
    doc,
    'Así, declaro haber leído, entendido y aceptado la totalidad de los términos y condiciones ' +
    'contenidos el presente documento, en prueba de lo cual lo suscribo en Madrid Cundinamarca a ' +
    `los ${dia} días del mes de ${mesNombre} del año ${ctx.fecha.getFullYear()}`,
    mL,
    y,
    maxW,
    lineH,
  );
  y += 30;

  // Firma de recibido
  y = drawSignatureLine(doc, ctx.firmaTrabajadorDataUrl, mL, y);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text('Firma de Recibido', mL, y);
  y += 5;
  labelValue(doc, 'Documento de identificación:', ctx.cedula, mL, y);
  y += 12;

  // Nota final (subrayada, como en el formato impreso)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  const nota =
    `"A partir de la fecha descrita en el presente formato ${RAZON_SOCIAL} cuenta con la autorización ` +
    'de su parte para realizar las notificaciones formales respecto a la comunicación de interés y ' +
    'carácter prioritario que se presenten durante la relación laboral"';
  const notaLines: string[] = doc.splitTextToSize(nota, maxW);
  doc.setLineWidth(0.2);
  for (const line of notaLines) {
    doc.text(line, mL, y);
    doc.line(mL, y + 1, mL + doc.getTextWidth(line), y + 1);
    y += 4.6;
  }
  doc.setFont('helvetica', 'normal');

  drawFooter(doc, '601 744 4002', '601 744 40 02');
  return doc.output('blob');
}
