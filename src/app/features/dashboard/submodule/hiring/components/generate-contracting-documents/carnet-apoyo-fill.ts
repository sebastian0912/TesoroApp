/**
 * Carnet de Apoyo Laboral TS — 2 páginas CARTA, una por cara.
 *
 * Página 1 = frente, página 2 = reverso. El carnet va centrado en la hoja y
 * en la MISMA posición en ambas, para que al imprimir a doble cara por borde
 * corto el reverso quede alineado con el frente. Se recorta por las marcas.
 *
 * Se dibuja con jsPDF (texto y vectores reales, no una imagen) para que
 * cualquier editor de PDF lo abra y lo pueda editar.
 */
import jsPDF from 'jspdf';

/** Tamaño del carnet en mm (CR80, el estándar). */
export const CARNET_ANCHO = 85.6;
export const CARNET_ALTO = 54;

/** Apoyo tiene una sola ARL y una sola caja de compensación para todos. */
export const ARL_FIJA = 'SURA';
export const CCF_FIJA = 'COMPENSAR';

/** Teléfono del coordinador impreso en el reverso. */
export const TELEFONO_COORDINADOR = '3102518013';

export interface DatosCarnet {
  nombreCompleto: string;
  cedula: string;
  centroCostos: string;
  cargo: string;
  /** Consecutivo del carnet (el "Con." amarillo). */
  consecutivo: string;
  /** Fecha de ingreso, dd/mm/aaaa. */
  fechaIngreso: string;
  eps: string;
  afp: string;
  emergenciaNombre: string;
  emergenciaTelefono: string;
  /** DataURL del logo y de la foto; si faltan, se omiten sin romper. */
  logoDataUrl?: string | null;
  fotoDataUrl?: string | null;
}

const s = (v: unknown) => String(v ?? '').trim();

export function buildCarnetApoyoPdf(d: DatosCarnet): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  doc.setProperties({ title: `Carnet_${d.cedula}` });

  const hojaW = doc.internal.pageSize.getWidth();   // 215.9
  const W = CARNET_ANCHO;
  const H = CARNET_ALTO;

  // Origen del carnet dentro de la hoja: centrado horizontal, 40 mm desde
  // arriba. IDÉNTICO en las dos páginas; de eso depende que calce el duplex.
  const OX = (hojaW - W) / 2;
  const OY = 40;

  // Todo el trazado se escribe en coordenadas del carnet (0,0 = esquina
  // superior izquierda) y estos helpers lo trasladan a la hoja.
  const X = (v: number) => OX + v;
  const Y = (v: number) => OY + v;

  /** Marcas de corte en las 4 esquinas, para recortar sin adivinar. */
  const marcasDeCorte = () => {
    const m = 4;
    doc.setDrawColor(120).setLineWidth(0.15);
    const esquinas: Array<[number, number, number, number]> = [
      [OX, OY, -m, 0], [OX, OY, 0, -m],
      [OX + W, OY, m, 0], [OX + W, OY, 0, -m],
      [OX, OY + H, -m, 0], [OX, OY + H, 0, m],
      [OX + W, OY + H, m, 0], [OX + W, OY + H, 0, m],
    ];
    for (const [px, py, dx, dy] of esquinas) doc.line(px, py, px + dx, py + dy);
  };

  const marco = () => {
    doc.setDrawColor(0).setLineWidth(0.4);
    doc.rect(OX, OY, W, H);
  };

  // ─────────────────────── CARA 1 (frente) ───────────────────────
  marcasDeCorte();
  marco();

  if (d.logoDataUrl) {
    try { doc.addImage(d.logoDataUrl, 'PNG', X(3.5), Y(3), 28, 10); } catch { }
  }
  doc.setTextColor(0).setFont('helvetica', 'bold').setFontSize(6);
  doc.text('Nit. 900.814.587-1', X(3.5), Y(16.5));

  // Foto a la derecha, proporción 3:4.
  const fotoW = 24, fotoH = 30, fotoX = W - fotoW - 3.5, fotoY = 3;
  if (d.fotoDataUrl) {
    try { doc.addImage(d.fotoDataUrl, 'JPEG', X(fotoX), Y(fotoY), fotoW, fotoH); } catch { }
  } else {
    doc.setDrawColor(150).setLineWidth(0.2);
    doc.rect(X(fotoX), Y(fotoY), fotoW, fotoH);
  }

  const anchoIzq = fotoX - 3.5;
  const centroIzq = 3.5 + anchoIzq / 2;

  doc.setFont('helvetica', 'bold').setFontSize(7);
  const nombre = doc.splitTextToSize(s(d.nombreCompleto).toUpperCase(), anchoIzq) as string[];
  let y = 22;
  doc.text(nombre, X(centroIzq), Y(y), { align: 'center' });
  y += nombre.length * 3.2 + 1;

  // Los asteriscos son el delimitador del código de barras (Code 39).
  doc.setFontSize(8);
  doc.text(`*${s(d.cedula)}*`, X(centroIzq), Y(y), { align: 'center' });
  y += 5;

  doc.setFont('helvetica', 'normal').setFontSize(5.5);
  doc.text('Centro de Costos', X(3.5), Y(y));
  doc.setFont('helvetica', 'bold').setFontSize(6);
  doc.text(s(d.centroCostos).toUpperCase(), X(27), Y(y));
  y += 4.5;

  doc.setFont('helvetica', 'normal').setFontSize(5.5);
  const cargo = doc.splitTextToSize(s(d.cargo).toUpperCase(), anchoIzq) as string[];
  doc.text(cargo, X(centroIzq), Y(y), { align: 'center' });

  // Consecutivo y fecha de ingreso, abajo a la derecha.
  const cajaY = H - 11;
  doc.setFont('helvetica', 'normal').setFontSize(5.5);
  doc.text('Con.', X(W - 30), Y(cajaY + 3));
  doc.text('Ing.', X(W - 30), Y(cajaY + 8));

  doc.setFillColor(255, 242, 0);            // amarillo del consecutivo
  doc.rect(X(W - 24), Y(cajaY), 20.5, 4.6, 'F');
  doc.setDrawColor(0).setLineWidth(0.2);
  doc.rect(X(W - 24), Y(cajaY), 20.5, 4.6);
  doc.setFont('helvetica', 'bold').setFontSize(8);
  doc.text(s(d.consecutivo), X(W - 13.75), Y(cajaY + 3.5), { align: 'center' });

  doc.setFontSize(7);
  doc.text(s(d.fechaIngreso), X(W - 13.75), Y(cajaY + 8.5), { align: 'center' });

  // ─────────────────────── CARA 2 (reverso) ───────────────────────
  doc.addPage('letter', 'portrait');
  marcasDeCorte();
  marco();

  // Consecutivo tenue arriba a la derecha, para casar frente y reverso.
  doc.setTextColor(160).setFont('helvetica', 'bold').setFontSize(6);
  doc.text(s(d.consecutivo), X(W - 3), Y(5), { align: 'right' });
  doc.setTextColor(0);

  const filaY = 9;
  doc.setFontSize(6);
  const par = (rotulo: string, valor: string, x: number, yy: number) => {
    doc.setFont('helvetica', 'bold');
    doc.text(rotulo, X(x), Y(yy));
    doc.setFont('helvetica', 'normal');
    doc.text(s(valor).toUpperCase(), X(x + 10), Y(yy), { maxWidth: 30 });
  };
  par('EPS', d.eps, 4, filaY);
  par('AFP', d.afp, 47, filaY);
  par('ARL', ARL_FIJA, 4, filaY + 4.5);
  par('CCF', CCF_FIJA, 47, filaY + 4.5);

  let y2 = filaY + 11;
  doc.setFont('helvetica', 'bold').setFontSize(6.5);
  doc.text('Familiar en caso de emergencia', X(W / 2), Y(y2), { align: 'center' });
  y2 += 4.5;
  par('Nombre', d.emergenciaNombre, 4, y2);
  y2 += 4.5;
  par('Teléfono', d.emergenciaTelefono, 4, y2);

  y2 += 5.5;
  doc.setFont('helvetica', 'normal').setFontSize(6);
  const legal = doc.splitTextToSize(
    'Este carnet es personal e intransferible, esta prohibido realizar actividades ' +
    'diferentes a su uso. En caso de pérdida de este carnet por favor comunicarse ' +
    'con la empresa APOYO LABORAL TS S.A.S.',
    W - 8,
  ) as string[];
  doc.text(legal, X(W / 2), Y(y2), { align: 'center' });
  y2 += legal.length * 2.8 + 1;

  doc.setFontSize(5.5);
  doc.text('Carrera 2 No 8 -156 Facatativá-Cundinamarca.', X(W / 2), Y(y2), { align: 'center' });
  y2 += 3.5;

  doc.setDrawColor(0).setLineWidth(0.3);
  doc.rect(X(3), Y(y2 - 2.8), W - 6, 4.2);
  doc.setFont('helvetica', 'bold').setFontSize(6);
  doc.text(
    `Contacto Coordinador de la Temporal  ${TELEFONO_COORDINADOR}`,
    X(W / 2), Y(y2), { align: 'center' },
  );

  return doc.output('blob');
}
