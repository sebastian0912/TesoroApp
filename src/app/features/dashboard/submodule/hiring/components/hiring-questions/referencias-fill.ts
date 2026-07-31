/**
 * Carta de REFERENCIA PERSONAL / FAMILIAR.
 *
 * Es el texto que emite quien da la referencia, redactado en primera persona.
 * Se genera con los datos que ya están capturados en el sistema: de la
 * referencia su nombre, parentesco, ocupación y teléfono.
 *
 * No se mencionan cédulas ni correos: no están en la base y no se inventan.
 * Tampoco lleva espacio de firma ni el tiempo que lleva conociendo al
 * candidato: se quitaron por pedido del área.
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
}

export interface DatosCartaReferencia {
  candidatoNombre: string;
  /** Ciudad de residencia del candidato; si falta, queda la línea. */
  ciudad: string;
  /** dd/mm/aaaa */
  fecha: string;
  referencia: DatosReferencia;
}

const s = (v: unknown) => String(v ?? '').trim();

/** Valor capturado, o una línea del largo indicado para llenar a mano. */
const val = (v: unknown, largo = 28) => {
  const t = s(v);
  return t !== '' ? t : '_'.repeat(largo);
};

export function buildCartaReferenciaPdf(d: DatosCartaReferencia): Blob {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const mL = 25;
  const maxW = pageW - mL * 2;
  const mBottom = 25;
  const GRIS = 120;

  const esFamiliar = s(d.referencia.tipo).toUpperCase().startsWith('FAMILIAR');
  const r = d.referencia;

  let y = 30;

  const saltoSiHaceFalta = (alto: number) => {
    if (y + alto > pageH - mBottom) {
      doc.addPage();
      y = 30;
    }
  };

  /** Párrafo justificado. La última línea va sin justificar, como se escribe. */
  const parrafo = (texto: string, interlinea = 5.6) => {
    doc.setTextColor(20).setFont('times', 'normal').setFontSize(11.5);
    const lineas = doc.splitTextToSize(texto, maxW) as string[];
    for (let i = 0; i < lineas.length; i++) {
      saltoSiHaceFalta(interlinea);
      const ultima = i === lineas.length - 1;
      if (ultima) doc.text(lineas[i], mL, y);
      else doc.text(lineas[i], mL, y, { align: 'justify', maxWidth: maxW });
      y += interlinea;
    }
    y += 4.5;
  };

  // ───────────────────────── Encabezado ─────────────────────────
  doc.setTextColor(20).setFont('times', 'bold').setFontSize(16);
  doc.text(esFamiliar ? 'REFERENCIA FAMILIAR' : 'REFERENCIA PERSONAL', pageW / 2, y, { align: 'center' });
  y += 4;

  // Doble filete bajo el título: una línea gruesa corta y otra fina completa.
  doc.setDrawColor(20).setLineWidth(0.8);
  doc.line(pageW / 2 - 26, y, pageW / 2 + 26, y);
  y += 1.6;
  doc.setDrawColor(GRIS).setLineWidth(0.2);
  doc.line(mL, y, pageW - mL, y);
  y += 13;

  const candidato = s(d.candidatoNombre).toUpperCase();
  const nombreRef = val(r.nombre, 36);

  // ───────────────────────── Cuerpo ─────────────────────────
  if (esFamiliar) {
    const parentesco = s(r.parentesco) !== '' ? s(r.parentesco).toLowerCase() : '__________';
    parrafo(
      `Yo, ${nombreRef}, manifiesto que soy ${parentesco} del(la) señor(a) ${candidato} y que puedo ` +
      `dar fe de sus valores, principios y comportamiento tanto en el ámbito familiar como en el ` +
      `personal.`,
    );
    parrafo(
      'Ha demostrado ser una persona responsable, respetuosa, honesta y ' +
      'comprometida con su familia y con cada uno de los proyectos que emprende. Se caracteriza por ' +
      'actuar siempre con ética, mantener una actitud positiva frente a las dificultades y asumir ' +
      'con seriedad las responsabilidades que adquiere.',
    );
    parrafo(
      'En el entorno familiar ha sido un ejemplo de solidaridad, colaboración y respeto. Mantiene ' +
      'excelentes relaciones con sus familiares y personas cercanas, contribuyendo siempre a un ' +
      'ambiente de armonía y convivencia. Es una persona de buenos principios, con valores firmes y ' +
      'una conducta intachable.',
    );
    parrafo(
      'También puedo afirmar que posee habilidades para trabajar en equipo, escuchar a los demás, ' +
      'solucionar conflictos mediante el diálogo y adaptarse fácilmente a nuevos ambientes laborales ' +
      'y sociales. Siempre demuestra disposición para ayudar, aprender y cumplir los objetivos que ' +
      'se propone.',
    );
    parrafo(
      'Su honestidad, disciplina y compromiso son cualidades que lo distinguen, razón por la cual ' +
      'considero que es una persona completamente confiable para asumir responsabilidades laborales, ' +
      'académicas o personales.',
    );
    parrafo(
      `Por todo lo anterior, recomiendo ampliamente al(la) señor(a) ${candidato}, convencido(a) de ` +
      `que responderá con dedicación, responsabilidad y profesionalismo en cualquier actividad que ` +
      `desempeñe.`,
    );
    parrafo(
      'La presente referencia se expide a solicitud del interesado para los fines que estime ' +
      'convenientes.',
    );
  } else {
    parrafo(
      `Yo, ${nombreRef}, manifiesto que conozco al(la) señor(a) ${candidato}, con quien he ` +
      `mantenido una relación de amistad y confianza que me ha permitido conocer ampliamente sus ` +
      `cualidades personales, humanas y éticas.`,
    );
    parrafo(
      'He podido evidenciar que es una persona ' +
      'íntegra, honesta, responsable y respetuosa, que siempre actúa con transparencia y rectitud ' +
      'en todas las actividades que realiza. Se caracteriza por cumplir oportunamente con los ' +
      'compromisos adquiridos, mantener una excelente actitud frente al trabajo y desenvolverse con ' +
      'profesionalismo en los diferentes entornos en los que participa.',
    );
    parrafo(
      'Asimismo, puedo afirmar que posee una alta capacidad para trabajar en equipo, establecer ' +
      'relaciones interpersonales basadas en el respeto y la cordialidad, resolver situaciones con ' +
      'serenidad y asumir nuevos retos con disposición y compromiso. Es una persona organizada, ' +
      'disciplinada, con deseos permanentes de superación y aprendizaje, lo que le ha permitido ' +
      'destacarse por su responsabilidad y dedicación.',
    );
    parrafo(
      'En el ámbito personal siempre ha demostrado ser alguien solidario, colaborador, prudente y ' +
      'confiable. Goza de buena reputación entre quienes lo conocen y mantiene un comportamiento ' +
      'acorde con los principios y valores que promueve, siendo respetuoso con las normas, la ' +
      'convivencia y las personas que lo rodean.',
    );
    parrafo(
      `Por todas estas razones, considero que cuenta con las capacidades personales y morales ` +
      `necesarias para desempeñar satisfactoriamente cualquier actividad laboral o responsabilidad ` +
      `que le sea asignada. Recomiendo ampliamente al(la) señor(a) ${candidato}, ya que tengo la ` +
      `plena confianza de que responderá con honestidad, compromiso y excelencia.`,
    );
    parrafo(
      'Expido la presente referencia a solicitud del interesado para los fines que considere ' +
      'pertinentes.',
    );
  }

  // ───────────────────── Datos de quien la expide ─────────────────────
  saltoSiHaceFalta(56);
  y += 6;
  doc.setTextColor(20).setFont('times', 'normal').setFontSize(11.5);
  doc.text('Atentamente,', mL, y);
  // Sin línea de firma: la carta se entrega ya diligenciada.
  y += 10;

  const campos: Array<[string, string]> = [['Nombre', val(r.nombre, 36)]];
  if (esFamiliar) campos.push(['Parentesco', val(r.parentesco, 30)]);
  campos.push(
    ['Ocupación', val(r.ocupacion, 30)],
    ['Teléfono', val(r.telefono, 24)],
    ['Ciudad', val(d.ciudad, 26)],
    ['Fecha', val(d.fecha, 20)],
  );

  const anchoRotulo = 34;
  for (const [rotulo, valor] of campos) {
    saltoSiHaceFalta(7.5);
    doc.setTextColor(GRIS).setFont('times', 'normal').setFontSize(10);
    doc.text(rotulo.toUpperCase(), mL, y);
    doc.setTextColor(20).setFont('times', 'bold').setFontSize(11.5);
    doc.text(valor, mL + anchoRotulo, y);
    y += 7.5;
  }

  return doc.output('blob');
}
