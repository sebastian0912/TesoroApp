/**
 * Revisión VISUAL de los PDF que genera la app.
 *
 * Por qué existe
 * ==============
 * Todo lo de estos formatos se venía verificando solo con `ng build`, o sea que
 * "compila" era todo lo que sabíamos. Los problemas de estos documentos no son
 * de compilación sino de pintura: un texto que se sale del recuadro, una foto
 * acostada, un pie que no cabe en la hoja. Eso solo se ve mirando.
 *
 * Qué hace
 * ========
 * Llama a los MISMOS constructores que usa la app (no una copia), arma los PDF
 * con datos de ejemplo y deja cada página como PNG en `e2e/salida-pdf/`. Se
 * abren esas imágenes y se revisa.
 *
 * Además verifica lo que SÍ se puede afirmar sin ojos: que el PDF se genere,
 * que tenga el tamaño de página correcto y el número de páginas esperado.
 *
 * Cómo correrlo
 * =============
 *     npx playwright test e2e/pdf-visual.spec.ts
 *     # las imágenes quedan en e2e/salida-pdf/
 *
 * No necesita backend, ni login, ni datos reales: los constructores son
 * funciones puras.
 */
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import { buildRemisionPdf } from '../src/app/features/dashboard/submodule/hiring/components/help-information/remision-fill';
import {
  buildCarnetApoyoPdf,
  buildCarnetApoyoLotePdf,
} from '../src/app/features/dashboard/submodule/hiring/components/generate-contracting-documents/carnet-apoyo-fill';
import {
  buildCarnetsMasivoPdf,
  ARL_ALIANZA,
  TELEFONO_COORDINADOR_ALIANZA,
} from '../src/app/features/dashboard/submodule/hiring/components/generate-contracting-documents/carnet-masivo-fill';

const SALIDA = path.join(__dirname, 'salida-pdf');

/** Milímetros a puntos PDF, para comprobar el tamaño de página. */
const MM = 72 / 25.4;

test.beforeAll(() => {
  fs.mkdirSync(SALIDA, { recursive: true });
});

/**
 * Guarda el PDF y renderiza cada página a PNG con el visor de pdf.js que trae
 * Chromium. El PNG es lo que se revisa a ojo.
 */
async function aImagenes(page: any, blob: Blob, nombre: string): Promise<number> {
  const bytes = Buffer.from(await blob.arrayBuffer());
  const rutaPdf = path.join(SALIDA, `${nombre}.pdf`);
  fs.writeFileSync(rutaPdf, bytes);

  // pdf.js se carga desde el bundle de Chromium; sin red.
  const base64 = bytes.toString('base64');
  const paginas: string[] = await page.evaluate(async (b64: string) => {
    const pdfjsLib: any = (window as any).pdfjsLib;
    const datos = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const doc = await pdfjsLib.getDocument({ data: datos }).promise;
    const salida: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const p = await doc.getPage(i);
      const viewport = p.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await p.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      salida.push(canvas.toDataURL('image/png'));
    }
    return salida;
  }, base64);

  paginas.forEach((dataUrl, i) => {
    const png = Buffer.from(dataUrl.split(',')[1], 'base64');
    fs.writeFileSync(path.join(SALIDA, `${nombre}-pag${i + 1}.png`), png);
  });
  return paginas.length;
}

/**
 * Carga pdf.js en la página para poder rasterizar.
 *
 * El worker se inyecta como blob en vez de apuntar a un archivo: la página es
 * `about:blank`, así que no puede pedir rutas del disco, y sin `workerSrc`
 * pdf.js falla con "No 'GlobalWorkerOptions.workerSrc' specified".
 */
async function prepararVisor(page: any) {
  await page.goto('about:blank');

  await page.addScriptTag({
    path: require.resolve('pdfjs-dist/build/pdf.min.mjs'),
    type: 'module',
  });
  await page.waitForFunction(() => !!(window as any).pdfjsLib, null, { timeout: 20000 });

  const worker = fs.readFileSync(
    require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'), 'utf8');
  await page.evaluate((codigo: string) => {
    const blob = new Blob([codigo], { type: 'text/javascript' });
    (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
  }, worker);
}

// ─────────────────────────── datos de ejemplo ───────────────────────────
const CANDIDATO = {
  nombreCompleto: 'BAZA GARCIA LEIVIS ESTHER',
  cedula: '1082490391',
  centroCostos: 'FANTASY FLOWERS',
  cargo: 'CULTIVO CLAVEL',
  consecutivo: '180005',
  fechaIngreso: '04/08/2026',
  eps: 'SURA',
  afp: 'PORVENIR',
  emergenciaNombre: 'MARIA GARCIA',
  emergenciaTelefono: '3001234567',
  logoDataUrl: null,
  fotoDataUrl: null,
};

const FILA_ALIANZA = {
  CEDULA: '1082490391',
  CODIGO: '180005',
  APELLIDOS: 'BAZA GARCIA',
  NOMBRES: 'LEIVIS ESTHER',
  FECHA_INGRESO: '04/08/2026',
  CENTRO_COSTO: 'FANTASY FLOWERS',
  FAMILIAR_EMERGENCIA_NOMBRE: 'MARIA GARCIA',
  FAMILIAR_EMERGENCIA_TELEFONO: '3001234567',
  fotoDataUrl: null,
  qrDataUrl: null,
};

// ─────────────────────────────── pruebas ────────────────────────────────
test.describe('PDF que genera la app', () => {

  test('remisión de entrevista — debe caber en MEDIA CARTA', async ({ page }) => {
    await prepararVisor(page);

    const blob = buildRemisionPdf({
      temporal: 'apoyo',
      fecha: '04/08/2026',
      empresaUsuaria: 'FANTASY FLOWERS S.A.S.',
      cargo: 'CULTIVO CLAVEL',
      experienciaSector: 'NO',
      tiempoExperiencia: '',
      nombreCandidato: 'LEIVIS ESTHER BAZA GARCÍA',
      cedula: '1082490391',
      area: '',
      dia: '',
      hora: '',
      preguntarPor: '',
      direccionEmpresa: 'VEREDA MOYANO',
      gestionHumana: '',
      consecutivo: '180005',
    });

    const paginas = await aImagenes(page, blob, 'remision-apoyo');
    expect(paginas).toBe(1);

    // 215.9 x 139.7 mm = una carta cortada por la mitad.
    const texto = fs.readFileSync(path.join(SALIDA, 'remision-apoyo.pdf'), 'latin1');
    const media = texto.match(/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/);
    expect(media, 'no se encontró el MediaBox').toBeTruthy();
    expect(Number(media![1])).toBeCloseTo(215.9 * MM, 0);
    expect(Number(media![2])).toBeCloseTo(139.7 * MM, 0);
  });

  test('remisión de Tu Alianza', async ({ page }) => {
    await prepararVisor(page);
    const blob = buildRemisionPdf({
      temporal: 'alianza',
      fecha: '04/08/2026',
      empresaUsuaria: 'JARDINES DE LOS ANDES',
      cargo: 'POSCOSECHA',
      experienciaSector: 'SI',
      tiempoExperiencia: '2 año(s)',
      nombreCandidato: 'PEDRO PÉREZ GONZÁLEZ',
      cedula: '1005851505',
      area: 'POSCOSECHA',
      dia: '05/08/2026',
      hora: '07:00',
      preguntarPor: 'ANA',
      direccionEmpresa: 'KM 3 VÍA FUNZA',
      gestionHumana: 'LAURA',
      consecutivo: '180010',
    });
    expect(await aImagenes(page, blob, 'remision-alianza')).toBe(1);
  });

  test('carnet de Apoyo — CR80, frente y reverso', async ({ page }) => {
    await prepararVisor(page);
    const blob = buildCarnetApoyoPdf(CANDIDATO as any, 1);
    const paginas = await aImagenes(page, blob, 'carnet-apoyo-individual');
    expect(paginas, 'una cara por página').toBe(2);
  });

  test('carnet de Tu Alianza — grilla 3x3 con QR', async ({ page }) => {
    await prepararVisor(page);
    const blob = buildCarnetsMasivoPdf([FILA_ALIANZA as any], {
      logoDataUrl: null,
      telefonoCoordinador: TELEFONO_COORDINADOR_ALIANZA,
      arl: ARL_ALIANZA,
      posicion: 1,
    });
    expect(await aImagenes(page, blob, 'carnet-alianza-individual')).toBe(2);
  });

  test('lote de Apoyo con 9 carnets', async ({ page }) => {
    await prepararVisor(page);
    const gente = Array.from({ length: 9 }, (_, i) => ({
      ...CANDIDATO,
      cedula: `10000000${i}`,
      consecutivo: `18000${i}`,
      nombreCompleto: `APELLIDO${i} NOMBRE${i}`,
    }));
    const blob = buildCarnetApoyoLotePdf(gente as any);
    expect(await aImagenes(page, blob, 'carnet-apoyo-lote9')).toBe(2);
  });

  test('lote de Tu Alianza con 12 — debe abrir SEGUNDA hoja', async ({ page }) => {
    await prepararVisor(page);
    const filas = Array.from({ length: 12 }, (_, i) => ({
      ...FILA_ALIANZA,
      CEDULA: `10000000${i}`,
      CODIGO: `18000${i}`,
    }));
    const blob = buildCarnetsMasivoPdf(filas as any, {
      logoDataUrl: null,
      telefonoCoordinador: TELEFONO_COORDINADOR_ALIANZA,
      arl: ARL_ALIANZA,
    });
    // 9 por hoja => 2 hojas => 4 páginas (frente + reverso de cada una).
    expect(await aImagenes(page, blob, 'carnet-alianza-lote12')).toBe(4);
  });

  test('nombres largos no rompen el carnet', async ({ page }) => {
    await prepararVisor(page);
    const blob = buildCarnetsMasivoPdf([{
      ...FILA_ALIANZA,
      APELLIDOS: 'MONTOYA DE LA ESPRIELLA VILLARREAL',
      NOMBRES: 'MARÍA DE LOS ÁNGELES CONCEPCIÓN',
      CENTRO_COSTO: 'CENTRO DE COSTO CON UN NOMBRE EXAGERADAMENTE LARGO',
    } as any], {
      logoDataUrl: null,
      telefonoCoordinador: TELEFONO_COORDINADOR_ALIANZA,
      arl: ARL_ALIANZA,
      posicion: 5,
    });
    expect(await aImagenes(page, blob, 'carnet-alianza-nombres-largos')).toBe(2);
  });

  test('campos vacíos no rompen la remisión', async ({ page }) => {
    await prepararVisor(page);
    const blob = buildRemisionPdf({
      temporal: 'apoyo', fecha: '', empresaUsuaria: '', cargo: '',
      experienciaSector: '', tiempoExperiencia: '', nombreCandidato: '',
      cedula: '', area: '', dia: '', hora: '', preguntarPor: '',
      direccionEmpresa: '', gestionHumana: '', consecutivo: '',
    });
    expect(await aImagenes(page, blob, 'remision-vacia')).toBe(1);
  });
});
