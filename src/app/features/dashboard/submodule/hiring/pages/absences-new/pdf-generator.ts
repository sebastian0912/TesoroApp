import jsPDF from 'jspdf';

/* ══════════════════════════════════════════════════════════════
   Generador de PDFs de documentos legales – 100 % frontend
   Usa jsPDF para renderizar HTML→PDF sin depender del backend.
   ══════════════════════════════════════════════════════════════ */

// ── Helpers de fecha en español ──
const MESES = ['','enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIAS  = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function fechaEs(d: Date): string {
  return `${d.getDate()} de ${MESES[d.getMonth()+1]} de ${d.getFullYear()}`;
}
function fechaLargaEs(d: Date): string {
  return `${DIAS[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()+1]} de ${d.getFullYear()}`;
}
function parseDateStr(s: string): string {
  if (!s) return '';
  const parts = s.split('-');
  if (parts.length === 3) {
    const d = new Date(+parts[0], +parts[1]-1, +parts[2]);
    return fechaEs(d);
  }
  return s;
}

// ── Datos de empresa ──
interface EmpresaInfo {
  nombre: string;
  nit: string;
  logo: string;   // ruta a la imagen
  firmante: string;
  cargo: string;
}

const EMPRESAS: Record<string, EmpresaInfo> = {
  APOYO: {
    nombre: 'Apoyo Laboral TS S.A.S.',
    nit: '900.814.587-2',
    logo: 'logos/logo_apoyo.png',
    firmante: 'GESTIÓN HUMANA',
    cargo: 'Directora Administrativa y de Gestión Humana'
  },
  ALIANZA: {
    nombre: 'Tu Alianza S.A.S.',
    nit: '901.035.017-1',
    logo: 'logos/logo_alianza.png',
    firmante: 'GESTIÓN HUMANA',
    cargo: 'Directora Administrativa y de Gestión Humana'
  }
};

// ── Convertir imagen a base64 para incrustar en el HTML ──
async function imgToBase64(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('No se pudo cargar el logo'));
    img.src = url;
  });
}

// ══════════════════════════════════════════════════════════════
// Plantilla: Apertura de Proceso Disciplinario
// ══════════════════════════════════════════════════════════════
function htmlApertura(ctx: any): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:10pt; color:#000; line-height:1.45; padding:0;">

  <div style="margin-bottom:6px;">
    <img src="${ctx.logoBase64}" style="height:58px;" />
    <div style="font-size:9pt; font-weight:bold; margin-top:3px;">NIT ${ctx.nit}</div>
  </div>

  <p style="color:#FF6600; font-weight:bold; margin-top:6px; margin-bottom:12px;">
    ${ctx.ciudad} ${ctx.fechaDocumento}
  </p>

  <p style="text-align:center; font-weight:bold; font-size:11pt; margin-bottom:14px;">
    COMUNICACIÓN APERTURA DE PROCESO DISCIPLINARIO
  </p>

  <div style="background-color:#FFFF00; font-weight:bold; padding:4px 6px; margin-bottom:12px; line-height:1.6;">
    Señor (a):<br>
    ${ctx.nombre}<br>
    C.C. ${ctx.cedula}
  </div>

  <p style="text-align:justify; margin-bottom:9px;">
    En cumplimiento de lo dispuesto en el Reglamento Interno de Trabajo de la empresa y de
    conformidad con lo establecido en el artículo 115 del C.S.T., interpretado por la sentencia C-593
    de 2014 le comunicamos la apertura formal del proceso disciplinario en su contra, en
    consecuencia, se le imputarán las conductas posibles de sanción, así como las faltas disciplinarias a
    que den lugar sobre los hechos que se le atribuyen, y que se relacionan a continuación:
  </p>

  <p style="text-align:center; font-weight:bold; font-size:10.5pt; margin-top:14px; margin-bottom:9px;">1. HECHOS Y CONDUCTAS</p>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    1. La empresa usuaria informa que usted se encuentra ausente desde el día ${ctx.fechaAusencia}
    y, a la fecha, no ha radicado ningún soporte que justifique dicha ausencia.
  </div>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    2. Adicionalmente, se ha intentado establecer comunicación con usted desde el día ${ctx.fechaAusencia}
    a través del número telefónico ${ctx.numeroTrabajador} y al número de su familiar ${ctx.numeroFamiliar},
    suministrado por usted para contacto en caso de emergencia, sin obtener respuesta.
  </div>

  <p style="text-align:center; font-weight:bold; font-size:10.5pt; margin-top:14px; margin-bottom:9px;">2. FALTAS DISCIPLINARIAS</p>

  <p style="text-align:justify; margin-bottom:9px;">
    Su conducta constituye una violación grave de sus obligaciones legales, contractuales y
    reglamentarias, concretamente las establecidas en el Reglamento Interno de Trabajo, a saber:
  </p>

  <p style="font-style:italic; font-weight:bold; margin-bottom:9px; text-align:justify;">
    ARTÍCULO 75. Los trabajadores tienen como obligaciones los siguientes:
    "32. Reportar a la empresa las incapacidades otorgadas por la EPS o ARL respectiva y reportar
    el motivo de la incapacidad."
  </p>

  <p style="font-style:italic; margin-bottom:9px; text-align:justify;">
    "45. Dar aviso de forma inmediata tan pronto tenga conocimiento del hecho sobre su ausencia al
    trabajo por causas ajenas a su voluntad, incluso por una calamidad o incapacidad."
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Además, constituye grave violación de sus prohibiciones especiales como trabajador(a), conforme
    se establece en el reglamento interno de trabajo de la siguiente manera:
  </p>

  <p style="font-style:italic; font-weight:bold; margin-bottom:9px; text-align:justify;">ARTÍCULO 77. Se prohíbe a LOS TRABAJADORES:</p>

  <p style="font-style:italic; margin-bottom:9px; text-align:justify;">
    "4. Faltar al trabajo sin justa causa de impedimento, o sin permiso de la empresa, excepto en
    los casos de huelga, en los cuales deben abandonar el lugar de trabajo, quienes participen en
    ella. La falta al trabajo es grave para todos los trabajadores de la empresa, especialmente
    cuando se trata de trabajadores vinculados a proyectos especiales de la empresa. El trabajador
    que deba sucederlo en la labor sin autorización previa del superior que tenga facultad para
    conceder dicha autorización o permiso.
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Finalmente, se le informa que la violación antes aludida trae como consecuencia la adopción de las
    medidas disciplinarias consagradas en el artículo 83 del citado Reglamento o el despido por justa
    causa, conforme a la causal señalada en el numerales 2° y 60 del artículo 70 del Decreto 2351 de
    1965 y el numeral 6° del artículo 62 del Código Sustantivo del Trabajo, norma que señala como tal:
  </p>

  <p style="font-style:italic; margin-bottom:9px; text-align:justify;">
    "6. Cualquier violación grave de las obligaciones o prohibiciones especiales que incumben al
    trabajador, de acuerdo con los artículos 58 y 60 del Código Sustantivo del Trabajo, o cualquier
    falta grave calificada como tal en pactos o convenciones colectivas, fallos arbitrales, contratos
    individuales o reglamentos."
  </p>

  <p style="text-align:center; font-weight:bold; font-size:10.5pt; margin-top:14px; margin-bottom:9px;">3. PRUEBAS</p>

  <p style="text-align:justify; margin-bottom:9px;">
    Se acreditan los hechos de la violación que se le imputa con los siguientes hechos que se exponen
    a continuación:
  </p>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    1. La empresa usuaria informa que usted se encuentra ausente desde el día ${ctx.fechaAusencia}
    y, a la fecha, no ha radicado ningún soporte que justifique dicha ausencia.
  </div>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    2. Adicionalmente, se ha intentado establecer comunicación con usted desde el día ${ctx.fechaAusencia}
    a través del número telefónico ${ctx.numeroTrabajador} y al número de su familiar ${ctx.numeroFamiliar},
    suministrado por usted para contacto en caso de emergencia, sin obtener respuesta.
  </div>

  <p style="font-weight:bold; margin-top:14px; margin-bottom:7px;">CITACION A DESCARGOS</p>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:9px; text-align:justify;">
    Con el objeto de garantizarle el derecho a la defensa y el debido proceso, solicitamos su presencia
    el día ${ctx.fechaCitacion}, a las ${ctx.horaCitacion}, en ${ctx.lugarCitacion} para llevar a cabo
    la diligencia de descargos en Gestión humana, para que se manifieste sobre los hechos anteriormente
    relacionados, así como allegar las pruebas que justifiquen, esculpen, o exoneren la falta que se le
    endilga.
  </div>

  <p style="text-align:justify; margin-bottom:9px;">
    Su inasistencia a esta diligencia se entenderá como renuncia a su derecho a rendir los descargos
    correspondientes, toda vez que la diligencia de descargos es un proceso que busca que pueda
    ejercer su derecho de defensa para que sea escuchado antes de aplicarle cualquier tipo de sanción,
    por lo que, si este no asiste, se presume de que no desea defenderse y por lo tanto se darán por
    ciertos los hechos planteados en la presente, lo que acarreará sanciones disciplinarias laborales,
    que se medirán de conformidad a la falta.
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    En el evento en que el procedimiento disciplinario concluya con la imposición de una sanción
    disciplinaria, usted al ser notificado(a) de la misma podrá solicitar que esa medida sea revisada
    por el superior jerárquico de la persona que la impuso, o en su defecto podrá controvertirla
    acudiendo a la jurisdicción laboral ordinaria. La revisión solicitada deberá ser efectuada en
    forma inmediata para garantizar tanto el derecho de defensa del trabajador, así como el buen
    funcionamiento de LA EMPRESA.
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Si el procedimiento disciplinario concluye con el despido, por tratarse de una decisión definitiva
    que pone fin al contrato de trabajo, el trabajador solo podrá controvertir esa actuación ante la
    Jurisdicción Laboral.
  </p>

  <div style="margin-top:28px;">
    <p>Atentamente,</p>
    <img src="${ctx.logoBase64}" style="height:48px; margin:8px 0 4px 0;" />
    <div style="font-weight:bold; font-size:10pt; text-decoration:underline;">${ctx.firmante}</div>
    <div style="font-size:10pt;">${ctx.cargo}.</div>
    <div style="font-weight:bold; font-size:10pt;">${ctx.empresaNombre}.</div>
  </div>

  <div style="text-align:center; font-size:8pt; color:#1F5C9E; border-top:1px solid #1F5C9E; padding-top:3px; margin-top:30px;">
    Apoyo Laboral TS S.A.S., Oficina Madrid: Cl 7 #4-49 Centro, PBX 744 4002;
    Oficina Facatativá Cra. 2 # 8-156 Centro Tel: 890 29 70. Mail: servicioalcliente@tsservicios.co
  </div>
</div>`;
}

// ══════════════════════════════════════════════════════════════
// Plantilla: Terminación de Contrato
// ══════════════════════════════════════════════════════════════
function htmlTerminacion(ctx: any): string {
  return `
<div style="font-family:Arial,Helvetica,sans-serif; font-size:10pt; color:#000; line-height:1.45; padding:0;">

  <div style="margin-bottom:6px;">
    <img src="${ctx.logoBase64}" style="height:58px;" />
    <div style="font-size:9pt; font-weight:bold; margin-top:3px;">NIT ${ctx.nit}</div>
  </div>

  <p style="color:#FF6600; font-weight:bold; margin-top:6px; margin-bottom:12px;">
    ${ctx.ciudad} ${ctx.fechaDocumento}
  </p>

  <p style="text-align:center; font-weight:bold; font-size:11pt; margin-bottom:14px;">
    COMUNICACIÓN TERMINACIÓN DE CONTRATO
  </p>

  <div style="background-color:#FFFF00; font-weight:bold; padding:4px 6px; margin-bottom:12px; line-height:1.6;">
    Señor (a)<br>
    ${ctx.nombre}<br>
    C.C. ${ctx.cedula}
  </div>

  <p style="text-align:justify; margin-bottom:9px;">
    En cumplimiento de lo dispuesto en el Reglamento Interno de Trabajo de la empresa y de
    conformidad con lo establecido en el artículo 115 del C.S.T., interpretado por la sentencia C-593
    de 2014 le comunicamos la apertura formal del proceso disciplinario en su contra, en consecuencia,
    se le imputarán las conductas posibles de sanción, así como las faltas disciplinarias a que den lugar
    sobre los hechos que se le atribuyen, y que se relacionan a continuación:
  </p>

  <p style="text-align:center; font-weight:bold; font-size:10.5pt; margin-top:14px; margin-bottom:9px;">1. HECHOS Y CONDUCTAS</p>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    1. La empresa usuaria informa que usted se encuentra ausente desde el día ${ctx.fechaAusencia}
    y, a la fecha, no ha radicado ningún soporte que justifique dicha ausencia.
  </div>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    2. Adicionalmente, se ha intentado establecer comunicación con usted desde el día ${ctx.fechaAusencia}
    a través del número telefónico ${ctx.numeroTrabajador} y al número de su familiar ${ctx.numeroFamiliar},
    suministrado por usted para contacto en caso de emergencia, sin obtener respuesta.
  </div>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    3. El día ${ctx.fechaEnvioCorreo}, fue enviada al correo electrónico registrado por usted una
    citación para presentarse el día ${ctx.fechaCitacionPrevia} a las ${ctx.horaCitacionPrevia} en
    ${ctx.lugarCitacionPrevia}; sin embargo, no se presentó a dicha citación.
  </div>

  <p style="text-align:center; font-weight:bold; font-size:10.5pt; margin-top:14px; margin-bottom:9px;">2. FALTAS DISCIPLINARIAS</p>

  <p style="text-align:justify; margin-bottom:9px;">
    Su conducta constituye una violación grave de sus obligaciones legales, contractuales y
    reglamentarias, concretamente las establecidas en el Reglamento Interno de Trabajo, a saber:
  </p>

  <p style="font-style:italic; font-weight:bold; margin-bottom:9px; text-align:justify;">
    ARTÍCULO 75. Los trabajadores tienen como obligaciones los siguientes:
    "32. Reportar a la empresa las incapacidades otorgadas por la EPS o ARL respectiva y reportar
    el motivo de la incapacidad."
  </p>

  <p style="font-style:italic; margin-bottom:9px; text-align:justify;">
    "45. Dar aviso de forma inmediata tan pronto tenga conocimiento del hecho sobre su ausencia al
    trabajo por causas ajenas a su voluntad, incluso por una calamidad o incapacidad."
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Además, constituye grave violación de sus prohibiciones especiales como trabajador(a), conforme
    se establece en el reglamento interno de trabajo de la siguiente manera:
  </p>

  <p style="font-style:italic; font-weight:bold; margin-bottom:9px; text-align:justify;">ARTÍCULO 77. Se prohíbe a LOS TRABAJADORES:</p>

  <p style="font-style:italic; margin-bottom:9px; text-align:justify;">
    "4. Faltar al trabajo sin justa causa de impedimento, o sin permiso de la empresa, excepto en
    los casos de huelga, en los cuales deben abandonar el lugar de trabajo, quienes participen en
    ella. La falta al trabajo es grave para todos los trabajadores de la empresa, especialmente
    cuando se trata de trabajadores vinculados a proyectos especiales de la empresa. El trabajador
    que deba sucederlo en la labor sin autorización previa del superior que tenga facultad para
    conceder dicha autorización o permiso.
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Además, constituye grave violación de sus prohibiciones legales y especiales como trabajador(a),
    conforme se establece de la siguiente manera:
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Finalmente, se le informa que la violación antes aludida trae como consecuencia la adopción de las
    medidas disciplinarias consagradas en el artículo 83 del citado Reglamento o el despido por justa
    causa, conforme a la causal señalada en el numerales 2° y 60 del artículo 70 del Decreto 2351 de
    1965 y el numeral 6° del artículo 62 del Código Sustantivo del Trabajo, norma que señala como tal:
  </p>

  <p style="font-style:italic; margin-bottom:9px; text-align:justify;">
    "6. Cualquier violación grave de las obligaciones o prohibiciones especiales que incumben al
    trabajador, de acuerdo con los artículos 58 y 60 del Código Sustantivo del Trabajo, o cualquier
    falta grave calificada como tal en pactos o convenciones colectivas, fallos arbitrales, contratos
    individuales o reglamentos."
  </p>

  <p style="text-align:center; font-weight:bold; font-size:10.5pt; margin-top:14px; margin-bottom:9px;">3. PRUEBAS</p>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    1. La empresa usuaria informa que usted se encuentra ausente desde el día ${ctx.fechaAusencia}
    y, a la fecha, no ha radicado ningún soporte que justifique dicha ausencia.
  </div>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    2. Adicionalmente, se ha intentado establecer comunicación con usted desde el día ${ctx.fechaAusencia}
    a través del número telefónico ${ctx.numeroTrabajador} y al número de su familiar ${ctx.numeroFamiliar},
    suministrado por usted para contacto en caso de emergencia, sin obtener respuesta.
  </div>

  <div style="background-color:#FFFF00; padding:4px 6px; margin-bottom:7px; text-align:justify;">
    3. El día ${ctx.fechaEnvioCorreo}, fue enviada al correo electrónico registrado por usted una
    citación para presentarse el día ${ctx.fechaCitacionPrevia} a las ${ctx.horaCitacionPrevia} en
    ${ctx.lugarCitacionPrevia}; sin embargo, no se presentó a dicha citación.
  </div>

  <p style="text-align:center; font-weight:bold; font-size:10.5pt; margin-top:14px; margin-bottom:9px;">4. TERMINACIÓN DE CONTRATO</p>

  <p style="text-align:justify; margin-bottom:9px;">
    Tal como lo establece el reglamento interno de trabajo ARTÍCULO 83 TERMINACIÓN DE CONTRATO
    POR JUSTA CAUSA:
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    "La falta total del trabajador a sus labores durante el día, sin excusa suficiente por primera vez
    cuando cause perjuicios a la empresa".
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Debido a sus incomparecencias antes mencionadas y a la no justificación de sus ausencias se
    observa la incursión en las causales de terminación de contrato de trabajo con justa causa a partir
    <span style="background-color:#FFFF00; padding:2px 4px;">del día ${ctx.fechaTerminacion}.</span>
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Una vez finalizado su contrato de trabajo debe continuar con el proceso de Examen de Salud
    Ocupacional de Egreso con esta orden en el periodo no mayor a 5 días, en el centro médico
    MEDIEXPRESS o SIGMEDICAL solicitar la cita celular 3104765759.
  </p>

  <p style="text-align:justify; margin-bottom:9px;">
    Para el cobro de sus acreencias la empresa el día ${ctx.fechaLiquidacion} se le consignará su
    liquidación en la forma de pago que venía cobrando su nómina y el envío de soporte de liquidación
    y documentos de retiro serán enviados al correo que usted asignó en su contratación o al
    WhatsApp autorizado para envío de información.
  </p>

  <div style="margin-top:24px;">
    <p>Atentamente,</p>
    <img src="${ctx.logoBase64}" style="height:48px; margin:8px 0 4px 0;" />
    <div style="font-weight:bold; font-size:10pt; text-decoration:underline;">${ctx.firmante}</div>
    <div style="font-size:10pt;">${ctx.cargo}</div>
    <div style="font-weight:bold; font-size:10pt;">${ctx.empresaNombre}</div>
  </div>

  <div style="text-align:center; font-size:8pt; color:#1F5C9E; border-top:1px solid #1F5C9E; padding-top:3px; margin-top:30px;">
    Apoyo Laboral TS S.A.S., Oficina Madrid: Cl 7 #4-49 Centro, PBX 744 4002;
    Oficina Facatativá Cra. 2 # 8-156 Centro Tel: 890 29 70. Mail: servicioalcliente@tsservicios.co
  </div>
</div>`;
}


// ══════════════════════════════════════════════════════════════
// Función principal: genera y descarga el PDF
// ══════════════════════════════════════════════════════════════
export async function generarPdfAusentismo(
  element: any,
  payload: any
): Promise<void> {
  const empresaKey = payload.empresa || 'APOYO';
  const empresa = EMPRESAS[empresaKey] || EMPRESAS['APOYO'];

  // Cargar logo como base64
  const logoBase64 = await imgToBase64(empresa.logo);

  const now = new Date();
  const ctx: any = {
    logoBase64,
    nit: empresa.nit,
    empresaNombre: empresa.nombre,
    firmante: empresa.firmante,
    cargo: empresa.cargo,
    ciudad: 'Madrid Cundinamarca,',
    fechaDocumento: fechaLargaEs(now),
    nombre: element.nombre_completo || '',
    cedula: element.cedula || '',
    numeroTrabajador: element.numero_contacto || '',
    numeroFamiliar: payload.numero_familiar || '',
    fechaAusencia: element.fecha_inicio ? parseDateStr(element.fecha_inicio) : '',
  };

  let htmlContent: string;

  if (payload.tipo_documento === 'apertura') {
    ctx.fechaCitacion = parseDateStr(payload.fecha_citacion || '');
    ctx.horaCitacion = payload.hora_citacion || '';
    ctx.lugarCitacion = payload.lugar_citacion || '';
    htmlContent = htmlApertura(ctx);
  } else {
    ctx.fechaEnvioCorreo = parseDateStr(payload.fecha_envio_correo || '');
    ctx.fechaCitacionPrevia = parseDateStr(payload.fecha_citacion_previa || '');
    ctx.horaCitacionPrevia = payload.hora_citacion_previa || '';
    ctx.lugarCitacionPrevia = payload.lugar_citacion_previa || '';
    ctx.fechaTerminacion = parseDateStr(payload.fecha_terminacion || '');
    ctx.fechaLiquidacion = parseDateStr(payload.fecha_liquidacion || '');
    htmlContent = htmlTerminacion(ctx);
  }

  // Crear contenedor VISIBLE para que html2canvas pueda capturarlo.
  // Se posiciona detrás de todo con z-index negativo y opacity 0
  // para que el usuario no lo vea, pero el motor de render sí lo procese.
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '0';
  container.style.top = '0';
  container.style.width = '612px';
  container.style.background = 'white';
  container.style.zIndex = '-9999';
  container.style.opacity = '0.01';   // NO 0 → algunos navegadores omiten render
  container.style.pointerEvents = 'none';
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  // Esperar un frame para que el navegador renderice el DOM
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'letter'
  });

  try {
    // jsPDF.html() devuelve Promise cuando se usa callback
    await new Promise<void>((resolve, reject) => {
      doc.html(container, {
        callback: () => resolve(),
        x: 50,
        y: 30,
        width: 510,
        windowWidth: 612,
        autoPaging: 'text',
        margin: [30, 50, 50, 50],
        html2canvas: {
          scale: 0.75,
          useCORS: true,
          allowTaint: true,
          logging: false
        }
      });
    });

    const tipoLabel = payload.tipo_documento === 'apertura' ? 'Apertura' : 'Terminacion';
    const filename = `${tipoLabel}_${element.cedula || element.id}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;
    doc.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}
