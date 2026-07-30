/**
 * Formato de VERIFICACIÓN DE REFERENCIAS (personal / familiar).
 *
 * Qué imprime y qué NO
 * --------------------
 * Imprime únicamente datos que ya están capturados en el sistema: el
 * candidato, y de la referencia su nombre, parentesco, teléfono, ocupación y
 * hace cuánto lo conoce (`Referencia` en gestion_contratacion).
 *
 * Las respuestas de la llamada se imprimen SOLO si alguien las registró en
 * `referenciacion`. Si no hay nada, el formato sale con las líneas en blanco
 * para que quien llama las diligencie. No se inventa el contenido de una
 * verificación que no ocurrió: el documento sustenta la debida diligencia y
 * termina en el expediente laboral y ante la empresa usuaria.
 */
import jsPDF from 'jspdf';

export interface DatosReferencia {
  /** 'PERSONAL' | 'FAMILIAR' */
  tipo: string;
  /** 1 o 2 — cuál de las dos referencias de ese tipo. */
  slot: number;
  nombre: string;
  parentesco: string;
  telefono: string;
  ocupacion: string;
  tiempoConoce: string;
  /** Respuesta registrada por quien hizo la llamada. Vacío = línea en blanco. */
  referenciacion: string;
}

export interface DatosVerificacion {
  candidatoNombre: string;
  candidatoCedula: string;
  cargo: string;
  empresaUsuaria: string;
  temporal: string;
  /** Quien realiza la verificación (usuario logueado). */
  verificadoPor: string;
  /** dd/mm/aaaa */
  fecha: string;
  referencia: DatosReferencia;
}

const s = (v: unknown) => String(v ?? '').trim();

/** Preguntas del guion de verificación, en el orden en que se hacen. */
const PREGUNTAS = [
  '¿Hace cuánto tiempo conoce al candidato y en qué contexto?',
  '¿Cómo describiría su responsabilidad y cumplimiento?',
  '¿Cómo es su relación con las personas de su entorno?',
  '¿Conoce alguna situación que afecte su desempeño laboral?',
  '¿Lo recomendaría para el cargo al que aspira?',
];

export function buildVerificacionReferenciaPdf(d: DatosVerificacion): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const mL = 18;
  const maxW = pageW - mL * 2;
  let y = 20;

  const linea = (yy: number) => {
    doc.setLineWidth(0.2);
    doc.line(mL, yy, pageW - mL, yy);
  };

  // ── Encabezado ──
  doc.setFont('helvetica', 'bold').setFontSize(13);
  doc.text('VERIFICACIÓN DE REFERENCIAS', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(10);
  const titulo = d.referencia.tipo.toUpperCase() === 'FAMILIAR'
    ? `Referencia familiar ${d.referencia.slot}`
    : `Referencia personal ${d.referencia.slot}`;
  doc.text(titulo.toUpperCase(), pageW / 2, y, { align: 'center' });
  y += 5;
  linea(y);
  y += 7;

  // ── Datos del candidato ──
  const campo = (rotulo: string, valor: string, yy: number, ancho = maxW) => {
    doc.setFont('helvetica', 'bold').setFontSize(8.5);
    doc.text(rotulo, mL, yy);
    const x = mL + doc.getTextWidth(rotulo) + 2;
    doc.setFont('helvetica', 'normal');
    doc.text(s(valor) || '________________________', x, yy, { maxWidth: ancho - (x - mL) });
  };

  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text('DATOS DEL ASPIRANTE', mL, y);
  y += 5;
  campo('Nombre:', d.candidatoNombre, y); y += 5;
  campo('Cédula:', d.candidatoCedula, y); y += 5;
  campo('Cargo al que aspira:', d.cargo, y); y += 5;
  campo('Empresa usuaria:', d.empresaUsuaria, y); y += 5;
  campo('Empresa temporal:', d.temporal, y); y += 7;

  linea(y);
  y += 7;

  // ── Datos de la referencia ──
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text('DATOS DE LA REFERENCIA', mL, y);
  y += 5;
  campo('Nombre:', d.referencia.nombre, y); y += 5;
  campo(
    d.referencia.tipo.toUpperCase() === 'FAMILIAR' ? 'Parentesco:' : 'Relación:',
    d.referencia.parentesco, y,
  ); y += 5;
  campo('Teléfono:', d.referencia.telefono, y); y += 5;
  campo('Ocupación:', d.referencia.ocupacion, y); y += 5;
  campo('Tiempo de conocerlo:', d.referencia.tiempoConoce, y); y += 7;

  linea(y);
  y += 7;

  // ── Guion de la llamada ──
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text('VERIFICACIÓN TELEFÓNICA', mL, y);
  y += 3;
  doc.setFont('helvetica', 'normal').setFontSize(7.5);
  doc.text('Fecha y hora de la llamada: ____ / ____ / ______     Hora: ______',
    pageW - mL, y, { align: 'right' });
  y += 6;

  doc.setFontSize(8.5);
  for (const p of PREGUNTAS) {
    doc.setFont('helvetica', 'bold');
    const alto = doc.splitTextToSize(p, maxW) as string[];
    doc.text(alto, mL, y);
    y += alto.length * 4 + 1;

    doc.setFont('helvetica', 'normal');
    // Solo la primera pregunta se responde con lo ya registrado; el resto
    // queda en blanco porque el sistema no guarda esas respuestas por separado.
    const respuesta = s(d.referencia.referenciacion);
    if (p === PREGUNTAS[0] && respuesta) {
      const r = doc.splitTextToSize(respuesta, maxW) as string[];
      doc.text(r, mL, y);
      y += r.length * 4 + 2;
    } else {
      linea(y + 1); y += 6;
      linea(y + 1); y += 8;
    }
  }

  y += 4;
  linea(y);
  y += 7;

  // ── Cierre y firma ──
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text('CONCEPTO DE QUIEN VERIFICA', mL, y);
  y += 6;
  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  linea(y + 1); y += 7;
  linea(y + 1); y += 12;

  doc.setLineWidth(0.4);
  doc.line(mL, y, mL + 70, y);
  y += 4;
  doc.setFont('helvetica', 'bold').setFontSize(8.5);
  doc.text('Verificado por:', mL, y);
  doc.setFont('helvetica', 'normal');
  doc.text(s(d.verificadoPor) || '', mL + doc.getTextWidth('Verificado por: '), y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', mL, y);
  doc.setFont('helvetica', 'normal');
  doc.text(s(d.fecha), mL + doc.getTextWidth('Fecha: '), y);

  return doc.output('blob');
}
