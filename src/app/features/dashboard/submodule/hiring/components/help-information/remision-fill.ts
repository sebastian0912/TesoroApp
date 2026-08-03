/**
 * REMISIÓN PARA ENTREVISTA Y/O PRUEBA TÉCNICA.
 *
 * Réplica del formato de calidad que hoy se llena a mano en Excel. Hay dos
 * variantes que solo cambian en el encabezado (logo + código) y en el texto del
 * QR; el cuerpo es idéntico:
 *
 *   Apoyo Laboral TS  -> código AL SE-RE-4, "apoyo laboral ts"
 *   Tu Alianza SAS    -> código TA SE-RE-4, "Tu Alianza SAS"
 *
 * Se dibuja con jsPDF (texto y vectores, no una imagen) para que cualquiera lo
 * pueda abrir y editar, igual que el carnet.
 *
 * Las líneas de los campos se dibujan SIEMPRE, tenga o no dato: el formato se
 * imprime y se termina de llenar a mano cuando algo falta.
 */
import jsPDF from 'jspdf';

export type TemporalRemision = 'apoyo' | 'alianza';

export interface DatosRemision {
  temporal: TemporalRemision;
  /** dd/mm/aaaa */
  fecha: string;
  empresaUsuaria: string;
  cargo: string;
  /** 'SI' | 'NO' | '' */
  experienciaSector: string;
  tiempoExperiencia: string;
  nombreCandidato: string;
  cedula: string;
  /** Área a la que se presenta a entrevista. */
  area: string;
  /** dd/mm/aaaa de la cita. */
  dia: string;
  /** HH:mm de la cita. */
  hora: string;
  preguntarPor: string;
  direccionEmpresa: string;
  /** Quien firma como Gestión Humana (Temporal). */
  gestionHumana: string;
  /** Código de contrato: va en el recuadro. Vacío = recuadro en blanco. */
  consecutivo?: string;
  /** DataURL del logo y del QR; si faltan, se omiten sin romper. */
  logoDataUrl?: string | null;
  qrDataUrl?: string | null;
}

const CONFIG: Record<TemporalRemision, { codigo: string; buscar: string }> = {
  apoyo: { codigo: 'AL SE-RE-4', buscar: 'apoyo laboral ts' },
  alianza: { codigo: 'TA SE-RE-4', buscar: 'Tu Alianza SAS' },
};

const OFICINAS =
  'Nuestras oficinas: Facatativá Principal: Carrera 2 # 8 – 156 centro Frente a tornillos 777. '
  + 'Facatativá Primera: Carrera 1 #5 78 junto a la agencia omega. Cartagenita: Carrera 2 # 6-123 (Frente al Toloza). '
  + 'El Rosal: Calle 10 # 6 -34 (2 piso) ofc.213 centro comercial el rubí. Madrid: Calle 7 # 4 – 49 centro frente a Enel condensa. '
  + 'Funza: Calle 9 # 10 - 07 (A media cuadra del Puente Colanta diagonal al conjunto La Wuayra). '
  + 'Soacha: Calle 21 a # 3 a - 20 barrió el sol. A 5 casas de la clínica San Luis. '
  + 'Fontibón: Carrera 112 a # 18 a 05 barrió Flandes. Suba: Carrera 103d 150c 45 barrio Turingia frente a plaza imperial. '
  + 'Tocancipá: Carrera 8 # 9 - 53 Al lado de la Nueva Eps 1er piso. Bosa: Calle 59 #77L - 05 (Bosa Andalucía). '
  + 'Zipaquirá: Cl. 7 #7-17 A media cuadra del Centro cultural de Gabo. '
  + 'PBX: 7444002- EXT 1010-1050 WhatsApp: 3126469000';

const s = (v: unknown) => String(v ?? '').trim();

export function buildRemisionPdf(d: DatosRemision): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();
  const mL = 12;
  const mR = W - 12;
  const ancho = mR - mL;
  const cfg = CONFIG[d.temporal] ?? CONFIG.apoyo;

  doc.setProperties({ title: `Remision_${s(d.cedula) || 'candidato'}` });

  // ─────────────────────── Encabezado de calidad ───────────────────────
  // Rejilla: logo | 3 filas de título y metadatos.
  const hLogo = 22;
  const xLogo = mL + 42;
  doc.setDrawColor(0).setLineWidth(0.4);
  doc.rect(mL, 12, ancho, hLogo);
  doc.line(xLogo, 12, xLogo, 12 + hLogo);
  doc.line(xLogo, 12 + hLogo / 3, mR, 12 + hLogo / 3);
  doc.line(xLogo, 12 + (hLogo * 2) / 3, mR, 12 + (hLogo * 2) / 3);

  if (d.logoDataUrl) {
    try { doc.addImage(d.logoDataUrl, 'PNG', mL + 2, 14, 38, 18); } catch { /* sin logo */ }
  }

  doc.setFont('helvetica', 'bold').setFontSize(9).setTextColor(0);
  doc.text('PROCESO DE SELECCIÓN', (xLogo + mR) / 2, 12 + hLogo / 3 - 2.4, { align: 'center' });
  doc.text('REMISION PARA ENTREVISTA Y/O PRUEBA TECNICA', (xLogo + mR) / 2, 12 + (hLogo * 2) / 3 - 2.4, { align: 'center' });

  // Fila de metadatos, en 4 celdas.
  const yMeta = 12 + (hLogo * 2) / 3;
  const anchoMeta = mR - xLogo;
  const cortes = [xLogo, xLogo + anchoMeta * 0.3, xLogo + anchoMeta * 0.52, xLogo + anchoMeta * 0.78, mR];
  for (const x of cortes.slice(1, -1)) doc.line(x, yMeta, x, 12 + hLogo);
  doc.setFontSize(8);
  const meta = [
    `Código: ${cfg.codigo}`,
    'Versión: 02',
    'Fecha de Emisión: Julio 01 -22',
    'Página: 1 de 1',
  ];
  meta.forEach((txt, i) => {
    doc.text(txt, (cortes[i] + cortes[i + 1]) / 2, 12 + hLogo - 2.4, { align: 'center' });
  });

  // Banda del título repetido (como en el formato original).
  let y = 12 + hLogo;
  doc.rect(mL, y, ancho, 7);
  doc.setFontSize(9.5);
  doc.text('REMISION PARA ENTREVISTA Y/O PRUEBA TECNICA', W / 2, y + 4.8, { align: 'center' });
  y += 7;

  // ─────────────────────── Cuerpo ───────────────────────
  const etiqueta = (txt: string, x: number, yy: number, size = 10) => {
    doc.setFont('helvetica', 'bold').setFontSize(size).text(txt, x, yy);
  };
  const valor = (txt: string, x: number, yy: number, size = 10) => {
    doc.setFont('helvetica', 'normal').setFontSize(size).text(s(txt), x, yy);
  };
  /** Línea sobre la que se escribe (queda visible aunque no haya dato). */
  const linea = (x1: number, x2: number, yy: number) => {
    doc.setDrawColor(90).setLineWidth(0.2).line(x1, yy + 1.4, x2, yy + 1.4);
    doc.setDrawColor(0).setLineWidth(0.4);
  };

  y += 11;
  etiqueta('Fecha:', mL + 2, y);
  valor(d.fecha, mL + 30, y);
  linea(mL + 28, mL + 120, y);

  // Recuadro del código de contrato, arriba a la derecha.
  doc.rect(mR - 46, y - 7, 46, 11);
  if (s(d.consecutivo)) {
    doc.setFont('helvetica', 'normal').setFontSize(11);
    doc.text(s(d.consecutivo), mR - 3, y, { align: 'right' });
  }

  y += 11;
  etiqueta('EMPRESA USUARIA', mL + 2, y);
  valor(d.empresaUsuaria, mL + 48, y);
  linea(mL + 46, mL + 118, y);
  etiqueta('Cargo:', mL + 122, y);
  valor(d.cargo, mL + 138, y);
  linea(mL + 136, mR - 2, y);

  y += 11;
  etiqueta('Experiencia en el Sector:', mL + 2, y);
  valor(d.experienciaSector, mL + 56, y);
  linea(mL + 54, mL + 78, y);
  etiqueta('¿Cuánto tiempo?', mL + 92, y);
  valor(d.tiempoExperiencia, mL + 130, y);
  linea(mL + 128, mR - 2, y);

  y += 12;
  etiqueta('Respetados Señores:', mL + 2, y);

  y += 11;
  valor('Muy comedidamente presentamos al señor (a)', mL + 2, y);
  doc.setFont('helvetica', 'bold');
  doc.text(s(d.nombreCandidato), mL + 88, y);
  linea(mL + 86, mR - 2, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  valor('Identificado (a) con cédula de ciudadania número:', mL + 2, y);
  doc.setFont('helvetica', 'bold');
  doc.text(s(d.cedula), mL + 98, y);
  linea(mL + 96, mR - 2, y);

  y += 7;
  doc.setFont('helvetica', 'normal');
  valor('Para presentar entrevista al area de:', mL + 2, y);
  valor(d.area, mL + 76, y);
  linea(mL + 74, mR - 2, y);

  y += 11;
  etiqueta('EN LAS INSTALACIONES DE LA EMPRESA', mL + 2, y);

  // Recuadro de la dirección, a la derecha.
  const xDir = mL + 108;
  doc.rect(xDir, y - 5, mR - xDir, 8);
  doc.setFontSize(9.5);
  doc.text('DIRECCIÓN DE LA EMPRESA', (xDir + mR) / 2, y, { align: 'center' });
  doc.rect(xDir, y + 3, mR - xDir, 18);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  const dirLineas = doc.splitTextToSize(s(d.direccionEmpresa), mR - xDir - 6);
  doc.text(dirLineas.slice(0, 4), (xDir + mR) / 2, y + 9, { align: 'center' });

  y += 7;
  etiqueta('EL DIA:', mL + 2, y);
  valor(d.dia, mL + 22, y);
  linea(mL + 20, mL + 54, y);
  etiqueta('HORA:', mL + 60, y);
  valor(d.hora, mL + 76, y);
  linea(mL + 74, mL + 104, y);

  y += 7;
  etiqueta('PREGUNTAR POR:', mL + 2, y);
  valor(d.preguntarPor, mL + 42, y);
  linea(mL + 40, mL + 104, y);

  // ─────────────────────── Bloque QR + firma ───────────────────────
  y += 18;
  const yBloque = y;
  const xQR = mL + 96;
  doc.setLineWidth(0.4).rect(xQR, yBloque, mR - xQR, 44);

  doc.setFont('helvetica', 'bold').setFontSize(8.2);
  const textoQR = doc.splitTextToSize(
    'Para dar inico al proceso de contratación por favor Registrese escaneando el QR o a través de '
    + `facebook o Google así: En el buscador escriba ${cfg.buscar}, dele click en la pestaña de `
    + 'registrarse o más información y diligencie todo el formulario y al final de la página presione '
    + 'click en "siguiente" para terminar.',
    (mR - xQR) - 40,
  );
  doc.text(textoQR, xQR + 3, yBloque + 6);

  if (d.qrDataUrl) {
    try { doc.addImage(d.qrDataUrl, 'PNG', mR - 36, yBloque + 4, 33, 33); } catch { /* sin QR */ }
  } else {
    doc.setDrawColor(150).rect(mR - 36, yBloque + 4, 33, 33);
    doc.setDrawColor(0);
  }

  // Firma de gestión humana, a la izquierda del bloque QR.
  const yFirma = yBloque + 30;
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text(s(d.gestionHumana), mL + 40, yFirma, { align: 'center' });
  doc.setLineWidth(0.3).line(mL + 6, yFirma + 2, mL + 74, yFirma + 2);
  doc.setFontSize(9.5);
  doc.text('GESTIÓN HUMANA (Temporal)', mL + 40, yFirma + 7, { align: 'center' });

  // ─────────────────────── Pie ───────────────────────
  let yPie = yBloque + 50;
  doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(60);
  doc.text('Horario de Atención: LUNES a VIERNES DE 08:00 am - 12:00 pm y  DE 2:00 pm - 5:00 pm',
    W / 2, yPie, { align: 'center' });

  yPie += 6;
  doc.setFontSize(7).setTextColor(90);
  const pie = doc.splitTextToSize(OFICINAS, ancho - 4);
  doc.text(pie, W / 2, yPie, { align: 'center' });

  return doc.output('blob');
}
