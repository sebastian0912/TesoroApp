/**
 * Llenado del formulario "Hoja de Vida Minerva" (Docs/minerva.pdf).
 *
 * El PDF tiene 4 páginas y nombra todos sus campos así:
 *   topmostSubform[0].PageK[0].CampoTexto1[0]              — único título
 *   topmostSubform[0].PageK[0].CampoTexto2[N]              — 250 campos de texto
 *   topmostSubform[0].PageK[0].CasillaVerificación1[N]     — 240 checkboxes
 *
 * El mapeo `índice → significado` se reconstruyó por proximidad de etiquetas
 * (pdfminer + pypdf) sobre el PDF físico ubicado en TesoroApp/public/Docs/minerva.pdf.
 *
 * Datos consumidos provienen de gestion_contratacion.CandidatoDetailSerializer
 * (snake_case nativo). Si un campo del candidato no existe se deja en blanco;
 * NUNCA lanza error.
 */

import type { PDFDocument, PDFForm, PDFFont } from 'pdf-lib';

type AnyObj = any;

const s = (v: any): string => (v === null || v === undefined ? '' : String(v).trim());

const norm = (v: any): string => s(v).normalize('NFC');

const checkboxName = (page: 1 | 2 | 3 | 4, idx: number): string =>
  `topmostSubform[0].Page${page}[0].CasillaVerificación1[${idx}]`;

const textName = (page: 1 | 2 | 3 | 4, idx: number, family: 1 | 2 = 2): string =>
  `topmostSubform[0].Page${page}[0].CampoTexto${family}[${idx}]`;

/** Devuelve la primera "experiencia laboral" considerada actual (sin fecha_retiro). */
function getActualEmpresa(experiencias: AnyObj[]): AnyObj | null {
  if (!Array.isArray(experiencias) || experiencias.length === 0) return null;
  const sin_retiro = experiencias.find(e => !e?.fecha_retiro);
  return sin_retiro || null;
}

/** Devuelve experiencias ordenadas (más recientes primero) para los 3 bloques de Page 3. */
function getExperienciasOrdenadas(experiencias: AnyObj[]): AnyObj[] {
  if (!Array.isArray(experiencias)) return [];
  return [...experiencias].sort((a, b) => {
    const da = a?.fecha_retiro ? Date.parse(a.fecha_retiro) : Number.POSITIVE_INFINITY;
    const db = b?.fecha_retiro ? Date.parse(b.fecha_retiro) : Number.POSITIVE_INFINITY;
    return db - da; // más recientes (incl. sin fecha_retiro) primero
  });
}

/** Devuelve la formación que coincida con `niveles` (lista de strings, case-insensitive, contains). */
function findFormacion(formaciones: AnyObj[], niveles: string[]): AnyObj | null {
  if (!Array.isArray(formaciones)) return null;
  const targets = niveles.map(n => n.toLowerCase());
  return formaciones.find(f => {
    const n = s(f?.nivel).toLowerCase();
    return targets.some(t => n.includes(t));
  }) || null;
}

/** Familiar por tipo (CONYUGUE/PADRE/MADRE/EMERGENCIA). */
function getFamiliar(familiares: AnyObj[], tipo: string): AnyObj | null {
  if (!Array.isArray(familiares)) return null;
  return familiares.find(f => s(f?.tipo).toUpperCase() === tipo) || null;
}

/** Splits texto largo en N líneas con corte por palabra. */
function splitInLines(text: string, lines: number, lineLen = 110): string[] {
  const out: string[] = [];
  if (!text) return Array(lines).fill('');
  const words = text.split(/\s+/);
  let cur = '';
  for (const w of words) {
    const tentative = cur ? `${cur} ${w}` : w;
    if (tentative.length <= lineLen) {
      cur = tentative;
    } else {
      out.push(cur);
      cur = w;
      if (out.length >= lines - 1) break;
    }
  }
  if (cur) out.push(cur);
  while (out.length < lines) out.push('');
  return out.slice(0, lines);
}

/** Formatea fecha YYYY-MM-DD a [DD, MM, YYYY]. */
function fechaPartes(iso: string | null | undefined): { d: string; m: string; a: string } {
  if (!iso) return { d: '', m: '', a: '' };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s(iso));
  if (!m) return { d: '', m: '', a: '' };
  return { d: m[3], m: m[2], a: m[1] };
}

/**
 * Llena el formulario Minerva con los datos del candidato.
 * @param pdfDoc instancia ya creada (necesaria para el font embed externo).
 * @param form pdfDoc.getForm()
 * @param customFont fuente embebida (Roboto u otra que soporte tildes).
 * @param candidato objeto del backend (CandidatoDetailSerializer).
 * @param vacante (opcional) info de la vacante seleccionada.
 */
export function fillMinervaPdf(
  pdfDoc: PDFDocument,
  form: PDFForm,
  customFont: PDFFont,
  candidato: AnyObj,
  vacante: AnyObj | null = null
): void {
  // ─────── helpers ───────
  const setText = (name: string, value: string): void => {
    if (value === undefined || value === null) return;
    try {
      const field = form.getTextField(name);
      field.setText(s(value));
      field.updateAppearances(customFont);
    } catch {
      // campo no existe en el template — se ignora
    }
  };

  const setT = (page: 1 | 2 | 3 | 4, idx: number, value: any): void => {
    setText(textName(page, idx), s(value));
  };

  const setT1 = (page: 1 | 2 | 3 | 4, idx: number, value: any): void => {
    setText(textName(page, idx, 1), s(value));
  };

  const check = (page: 1 | 2 | 3 | 4, idx: number): void => {
    try {
      form.getCheckBox(checkboxName(page, idx)).check();
    } catch {
      // checkbox no existe — se ignora
    }
  };

  // ─────── derivados ───────
  const cand = candidato || {};
  const contacto: AnyObj = cand.contacto || {};
  const residencia: AnyObj = cand.residencia || {};
  const infoCc: AnyObj = cand.info_cc || {};
  const vivienda: AnyObj = cand.vivienda || {};
  const expRes: AnyObj = cand.experiencia_resumen || {};
  const familiares: AnyObj[] = Array.isArray(cand.familiares) ? cand.familiares : [];
  const referencias: AnyObj[] = Array.isArray(cand.referencias) ? cand.referencias : [];
  const formaciones: AnyObj[] = Array.isArray(cand.formaciones) ? cand.formaciones : [];
  const experiencias: AnyObj[] = Array.isArray(cand.experiencias) ? cand.experiencias : [];
  const hijos: AnyObj[] = Array.isArray(cand.hijos) ? cand.hijos : [];
  const entrevista: AnyObj = (Array.isArray(cand.entrevistas) && cand.entrevistas[0]) || {};

  const conyuge = getFamiliar(familiares, 'CONYUGUE');
  const padre = getFamiliar(familiares, 'PADRE');
  const madre = getFamiliar(familiares, 'MADRE');
  const emergencia = getFamiliar(familiares, 'EMERGENCIA');

  const apellidos = norm([s(cand.primer_apellido), s(cand.segundo_apellido)].filter(Boolean).join(' '));
  const nombres = norm([s(cand.primer_nombre), s(cand.segundo_nombre)].filter(Boolean).join(' '));

  const direccionBarrio = [s(residencia.direccion), s(residencia.barrio)].filter(Boolean).join(' / ');

  // ════════════════════════════════════════════════════════════════════
  // PÁGINA 1 — Cabecera, Información General, Documentación, Información Personal
  // ════════════════════════════════════════════════════════════════════

  // Título
  setT1(1, 0, 'HOJA DE VIDA');

  // Fecha actual (D / M / A)
  const now = new Date();
  setT(1, 0, now.getDate().toString().padStart(2, '0'));
  setT(1, 1, (now.getMonth() + 1).toString().padStart(2, '0'));
  setT(1, 2, now.getFullYear().toString());

  // Empleo / cargo / código (si llegó vacante)
  const cargoVacante = s(vacante?.cargo?.nombredelavacante || vacante?.cargo || vacante?.nombre_cargo);
  setT(1, 3, cargoVacante);
  setT(1, 4, s(vacante?.codigo || vacante?.codigo_cargo));

  // Nombre / Apellidos
  setT(1, 5, apellidos);
  setT(1, 6, nombres);

  // Dirección + Barrio | Ciudad
  setT(1, 7, direccionBarrio);
  setT(1, 8, s(cand.municipio));

  // Teléfono | Celular
  // (no hay teléfono fijo en el modelo; usamos celular como fallback)
  setT(1, 9, s(contacto.celular));
  setT(1, 10, s(contacto.celular || contacto.whatsapp));

  // Correo electrónico | Nacionalidad
  setT(1, 11, s(contacto.email));
  setT(1, 12, 'Colombiana');

  // Profesión, ocupación u oficio | Estado civil | Años exp.
  const profesion = s(formaciones[0]?.titulo_obtenido || expRes.area_experiencia);
  setT(1, 13, profesion);
  setT(1, 14, s(cand.estado_civil));
  setT(1, 15, s(expRes.anios_experiencia ?? expRes.tiempo_experiencia_texto));

  // Documentación: Cédula Nº | Expedida en
  setT(1, 16, s(cand.numero_documento));
  setT(1, 17, s(infoCc.mpio_expedicion));

  // Tipo de documento (checkboxes correctos: [2]=CC, [3]=CE)
  const tipoDoc = s(cand.tipo_doc).toUpperCase();
  if (tipoDoc === 'CC') check(1, 2);
  else if (tipoDoc === 'CE') check(1, 3);

  // Información personal — empresa actual (si tiene_experiencia)
  const empresaActual = getActualEmpresa(experiencias);
  if (empresaActual) {
    check(1, 6); // ¿Está trabajando actualmente? Sí
    setT(1, 23, s(empresaActual.empresa));
  } else {
    check(1, 7); // No
  }

  // Recomendado por alguien de la empresa
  const referenciado = s(entrevista.referenciado).toLowerCase();
  const nombreRef = s(entrevista.nombre_referenciado);
  if (nombreRef) {
    check(1, 14); // Sí
    setT(1, 28, nombreRef);
  } else if (referenciado === 'no') {
    check(1, 15);
  }

  // Cómo conoció la vacante
  const comoSeEntero = s(entrevista.como_se_entero).toUpperCase();
  if (comoSeEntero) {
    if (comoSeEntero.includes('ANUNCIO') || comoSeEntero.includes('PERIÓDICO') || comoSeEntero.includes('PERIODICO')) {
      check(1, 18);
    } else if (comoSeEntero.includes('AGENCIA')) {
      check(1, 19);
    } else if (comoSeEntero.includes('AMIGO') || comoSeEntero.includes('REFERID')) {
      check(1, 20);
    } else {
      check(1, 21); // Otro
      setT(1, 32, s(entrevista.como_se_entero));
    }
  }

  // Lugar donde ha vivido / regiones donde ha trabajado / hace cuánto vive aquí
  setT(1, 33, s(residencia.lugar_anterior || cand.municipio));
  setT(1, 34, s(residencia.zonas_del_pais));
  setT(1, 35, s(residencia.hace_cuanto_vive));

  // Tipo de vivienda (Familiar / Propia / Alquilada / Otro)
  const tipoVivienda = s(vivienda.tipo_vivienda).toLowerCase();
  if (tipoVivienda) {
    if (tipoVivienda.includes('familia')) check(1, 24);
    else if (tipoVivienda.includes('propia')) check(1, 26);
    else if (tipoVivienda.includes('alquila') || tipoVivienda.includes('arrend')) check(1, 27);
  }

  // Aspiración salarial (vacante salario si llegó)
  setT(1, 40, s(vacante?.salario));

  // OBJETIVO — expectativas de vida (3 líneas)
  const expectativas = s(vivienda.expectativas_de_vida);
  if (expectativas) {
    const [l1, l2, l3] = splitInLines(expectativas, 3, 110);
    setT(1, 46, l1);
    setT(1, 47, l2);
    setT(1, 48, l3);
  }

  // ════════════════════════════════════════════════════════════════════
  // PÁGINA 2 — Familia, Educación, Otros conocimientos, Áreas/sectores
  // ════════════════════════════════════════════════════════════════════

  // ── Cónyuge ──
  if (conyuge) {
    const nomCony = norm([s(conyuge.nombre), s(conyuge.apellido)].filter(Boolean).join(' '));
    setT(2, 0, nomCony);
    setT(2, 1, s(conyuge.ocupacion));
    setT(2, 4, s(conyuge.direccion));
    setT(2, 5, s(conyuge.telefono));
  }

  // ── Personas que dependen económicamente / hijos ──
  const numDep = vivienda.num_hijos_dependen_economicamente ?? hijos.length;
  setT(2, 7, s(numDep));
  if (hijos.length > 0) {
    setT(2, 8, 'Hijos');
    const edades = hijos
      .map(h => s(h.edad))
      .filter(Boolean)
      .join(', ');
    setT(2, 9, edades);
  }

  // ── Padre / Madre ──
  // Fila 1 (padre): nombre[10], profesión[11], teléfono[12]
  if (padre) {
    setT(2, 10, norm([s(padre.nombre), s(padre.apellido)].filter(Boolean).join(' ')));
    setT(2, 11, s(padre.ocupacion));
    setT(2, 12, s(padre.telefono));
  }
  // Fila 2 (madre): nombre[16], profesión[17], teléfono[13]
  if (madre) {
    setT(2, 16, norm([s(madre.nombre), s(madre.apellido)].filter(Boolean).join(' ')));
    setT(2, 17, s(madre.ocupacion));
    setT(2, 13, s(madre.telefono));
  }
  // Hermanos no existen en gestion_contratacion → filas 3-4 (campos 18,20,14 / 21,19,15) quedan vacías.

  // ── Educación / Formación ──
  // Layout (de arriba hacia abajo en el PDF):
  //   y=507 fila 1 (Primaria):       cols [22(año), 23(cursados), 24(título), 25(institución), 26(ciudad)]
  //   y=488 fila 2 (Bachillerato):   [27, 28, 29, 30, 31]
  //   y=470 fila 3 (Bach. Técnico):  [32, 53, 54, 55, 56]
  //   y=453 fila 4 (Técnico):        [52, 51, 50, 49, 33]   ← orden invertido por columnas
  //   y=434 fila 5 (Tecnológico):    [34, 45, 46, 47, 48]
  //   y=416 fila 6 (Profesional):    [44, 43, 42, 41, 35]
  //   y=398 fila 7 (Postgrado):      [36, 37, 38, 39, 40]
  type EduRow = {
    keys: string[];
    cols: [number, number, number, number, number]; // [añoFin, añosCursados, titulo, institucion, ciudad]
  };
  const eduRows: EduRow[] = [
    { keys: ['primaria'], cols: [22, 23, 24, 25, 26] },
    { keys: ['bachiller', 'secundaria'], cols: [27, 28, 29, 30, 31] },
    { keys: ['bach_tec', 'comercial'], cols: [32, 53, 54, 55, 56] },
    { keys: ['técnico', 'tecnico'], cols: [52, 51, 50, 49, 33] },
    { keys: ['tecnológico', 'tecnologico'], cols: [34, 45, 46, 47, 48] },
    { keys: ['profesional', 'universitar', 'pregrado'], cols: [44, 43, 42, 41, 35] },
    { keys: ['postgrado', 'posgrado', 'maestr', 'doctor', 'especializ'], cols: [36, 37, 38, 39, 40] },
  ];

  for (const row of eduRows) {
    const f = findFormacion(formaciones, row.keys);
    if (!f) continue;
    const [cAnio, cCursados, cTitulo, cInst, cCiudad] = row.cols;
    setT(2, cAnio, s(f.anio_finalizacion));
    // años cursados — no lo guardamos; queda vacío.
    setT(2, cCursados, '');
    setT(2, cTitulo, s(f.titulo_obtenido));
    setT(2, cInst, s(f.institucion));
    // ciudad — no la guardamos en formaciones; queda vacía.
    setT(2, cCiudad, '');
  }

  // ── Otros estudios (cursos, diplomados…) ──
  // [57] Intensidad horaria | [58] Nombre del programa | [59] Institución
  const estudiosExtra = formaciones.map(f => s(f.estudios_extra)).filter(Boolean).join(' ');
  if (estudiosExtra) {
    // dejamos solo la primera línea como "Nombre del programa"
    setT(2, 58, estudiosExtra.slice(0, 200));
  }

  // ── ¿Cursa estudios actualmente? ──
  if (vivienda.estudia_actualmente) {
    check(2, 1); // Sí (probable)
  }

  // ════════════════════════════════════════════════════════════════════
  // PÁGINA 3 — 3 últimas experiencias laborales
  // ════════════════════════════════════════════════════════════════════
  const expsOrdenadas = getExperienciasOrdenadas(experiencias);

  type ExpBlock = {
    empresa: number;
    direccion: number;
    telefono: number;
    cargo: number;
    jefe: number;
    fechaIngresoD: number; fechaIngresoM: number; fechaIngresoA: number;
    fechaRetiroD: number;  fechaRetiroM: number;  fechaRetiroA: number;
    totalTiempo: number;
    sueldoInicial: number;
    sueldoFinal: number;
    logros: number;
    motivoRetiro: number;
  };
  const blocks: ExpBlock[] = [
    {
      empresa: 0, direccion: 1, telefono: 2,
      cargo: 3, jefe: 4,
      fechaIngresoD: 5, fechaIngresoM: 6, fechaIngresoA: 10,
      fechaRetiroD: 8, fechaRetiroM: 9, fechaRetiroA: 43,
      totalTiempo: 11, sueldoInicial: 12, sueldoFinal: 13,
      logros: 17, motivoRetiro: 16,
    },
    {
      empresa: 41, direccion: 41, telefono: 40, // empresa[0] no, [41] dirección, [40] tel — hay solo nombre+dir+tel en bloque 2
      // (los campos del bloque 2 son: nombre→[?], dirección→[41], teléfono→[40], cargo→[38], jefe→[39],
      //  fecha_ingreso D/M/A → [37,36,?], fecha_retiro D/M/A → [35,34,33], total → [32], $ inicial → [31], $ final → [30],
      //  logros → [26], $ algo → [27,28]
      cargo: 38, jefe: 39,
      fechaIngresoD: 37, fechaIngresoM: 36, fechaIngresoA: 33,
      fechaRetiroD: 35, fechaRetiroM: 34, fechaRetiroA: 33,
      totalTiempo: 32, sueldoInicial: 31, sueldoFinal: 30,
      logros: 26, motivoRetiro: 27,
    },
    {
      empresa: 65, direccion: 65, telefono: 64,
      cargo: 62, jefe: 63,
      fechaIngresoD: 61, fechaIngresoM: 60, fechaIngresoA: 56,
      fechaRetiroD: 58, fechaRetiroM: 57, fechaRetiroA: 56,
      totalTiempo: 55, sueldoInicial: 54, sueldoFinal: 53,
      logros: 49, motivoRetiro: 50,
    },
  ];

  // Bloque 1 — campos especiales fuera del molde
  const exp1 = expsOrdenadas[0];
  if (exp1) {
    const fi = fechaPartes(exp1.fecha_ingreso || exp1.fechaIngreso);
    const fr = fechaPartes(exp1.fecha_retiro);
    setT(3, 0, s(exp1.empresa));
    setT(3, 1, s(exp1.direccion));
    setT(3, 2, s(exp1.telefonos));
    setT(3, 3, s(exp1.cargo));
    setT(3, 4, s(exp1.nombre_jefe));
    setT(3, 5, fi.d); setT(3, 6, fi.m); setT(3, 10, fi.a);
    setT(3, 8, fr.d); setT(3, 9, fr.m); setT(3, 43, fr.a);
    setT(3, 11, s(exp1.tiempo_trabajado));
    setT(3, 17, s(exp1.labores_principales || exp1.labores_realizadas));
    setT(3, 16, s(exp1.motivo_retiro));
  }

  // Bloque 2
  const exp2 = expsOrdenadas[1];
  if (exp2) {
    const fi = fechaPartes(exp2.fecha_ingreso || exp2.fechaIngreso);
    const fr = fechaPartes(exp2.fecha_retiro);
    // Nombre de la empresa (col1) — el campo del molde no existe explícito;
    // usamos [41]=Dirección, así que ponemos empresa+dirección concatenados al campo Dirección si la empresa
    // no tiene un campo propio en este bloque.
    setT(3, 41, [s(exp2.empresa), s(exp2.direccion)].filter(Boolean).join(' — '));
    setT(3, 40, s(exp2.telefonos));
    setT(3, 38, s(exp2.cargo));
    setT(3, 39, s(exp2.nombre_jefe));
    setT(3, 37, fi.d); setT(3, 36, fi.m);
    setT(3, 35, fr.d); setT(3, 34, fr.m); setT(3, 33, fr.a);
    setT(3, 32, s(exp2.tiempo_trabajado));
    setT(3, 26, s(exp2.labores_principales || exp2.labores_realizadas));
    setT(3, 27, s(exp2.motivo_retiro));
  }

  // Bloque 3
  const exp3 = expsOrdenadas[2];
  if (exp3) {
    const fi = fechaPartes(exp3.fecha_ingreso || exp3.fechaIngreso);
    const fr = fechaPartes(exp3.fecha_retiro);
    setT(3, 65, [s(exp3.empresa), s(exp3.direccion)].filter(Boolean).join(' — '));
    setT(3, 64, s(exp3.telefonos));
    setT(3, 62, s(exp3.cargo));
    setT(3, 63, s(exp3.nombre_jefe));
    setT(3, 61, fi.d); setT(3, 60, fi.m); setT(3, 56, fi.a);
    setT(3, 58, fr.d); setT(3, 57, fr.m);
    setT(3, 55, s(exp3.tiempo_trabajado));
    setT(3, 49, s(exp3.labores_principales || exp3.labores_realizadas));
    setT(3, 50, s(exp3.motivo_retiro));
  }
  void blocks; // estructura conservada para documentación; el llenado va arriba.

  // ════════════════════════════════════════════════════════════════════
  // PÁGINA 4 — Referencias + Familiar de contacto + Firma
  // ════════════════════════════════════════════════════════════════════

  // Referencias personales/laborales (3 filas)
  // Fila 1: [0]=Nombre, [4]=Ocupación, [6]=Dirección, [9]=Teléfono
  // Fila 2: [1]=Nombre, [3]=Ocupación, [7]=Dirección, [10]=Teléfono
  // Fila 3: [2]=Nombre, [5]=Ocupación, [8]=Dirección, [11]=Teléfono
  const refsP = referencias.filter(r => {
    const t = s(r.tipo).toUpperCase();
    return t === 'PERSONAL' || t === 'LABORAL';
  });
  const refRows: { nombre: number; ocupacion: number; direccion: number; telefono: number }[] = [
    { nombre: 0, ocupacion: 4, direccion: 6, telefono: 9 },
    { nombre: 1, ocupacion: 3, direccion: 7, telefono: 10 },
    { nombre: 2, ocupacion: 5, direccion: 8, telefono: 11 },
  ];
  for (let i = 0; i < refRows.length && i < refsP.length; i++) {
    const r = refsP[i];
    const row = refRows[i];
    setT(4, row.nombre, s(r.nombre));
    setT(4, row.ocupacion, s(r.ocupacion));
    setT(4, row.direccion, s(r.direccion));
    setT(4, row.telefono, s(r.telefono));
  }

  // Familiar de contacto (3 filas) — usamos: emergencia, familiares[FAMILIAR1], familiares[FAMILIAR2]
  // Solo tenemos 1 EMERGENCIA en el modelo + referencias[].tipo='FAMILIAR'
  const refsF = referencias.filter(r => s(r.tipo).toUpperCase() === 'FAMILIAR');
  const familiarRows = [
    emergencia,
    refsF[0] || null,
    refsF[1] || null,
  ];
  // Cada celda completa va al campo único [12], [13], [14] (línea ancha)
  // formato: "Nombre | Parentesco | Tel | Dirección"
  familiarRows.forEach((fam, i) => {
    if (!fam) return;
    const partes = [
      norm([s(fam.nombre), s(fam.apellido)].filter(Boolean).join(' ')),
      s(fam.parentesco),
      s(fam.telefono),
      s(fam.direccion),
    ].filter(Boolean);
    setT(4, 12 + i, partes.join('  ·  '));
  });

  // Firma del solicitante — C.C.
  setT(4, 15, `C.C. ${s(cand.numero_documento)}`);
}
