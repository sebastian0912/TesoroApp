/**
 * Deja los PDF generados con las imágenes "quemadas" en la página y el
 * formulario aplanado.
 *
 * POR QUÉ EXISTE
 * --------------
 * Las plantillas de contratación traen foto, huella, firma y logo como
 * *botones de formulario* (`*_af_image`). Rellenarlos con
 * `form.getButton(x).setImage(img)` deja la imagen como **apariencia del
 * widget**, no como contenido de la página. Mientras el PDF se abre entero se
 * ve bien, pero al copiar sus páginas a otro documento (Nitro, Acrobat, o el
 * propio `copyPages` de pdf-lib) el AcroForm se queda atrás, los widgets
 * quedan huérfanos y **la foto, la huella y la firma desaparecen**.
 *
 * Medido sobre `Ficha tecnica.pdf`: con `setImage` el documento pegado en otro
 * PDF queda con 0 imágenes y 0 campos; dibujando en la página quedan las 6
 * imágenes intactas antes y después de copiar.
 *
 * `form.flatten()` NO resuelve esto por sí solo: pdf-lib aplana los botones de
 * imagen con apariencia vacía y la imagen se pierde igual. Por eso el orden
 * correcto es:
 *   1. llenar los campos de texto,
 *   2. `dibujarImagenPlana(...)` por cada imagen (dibuja y quita el widget),
 *   3. `aplanarFormulario(form)` para el texto restante.
 */

import {
  PDFDocument, PDFForm, PDFImage,
  pushGraphicsState, popGraphicsState, moveTo, lineTo, closePath, clip, endPath, rgb,
} from 'pdf-lib';

/**
 * `contener`: la imagen entra completa dentro del recuadro (firmas, huellas,
 * logos). `cubrir`: la imagen llena el recuadro y se recorta el sobrante, sin
 * aire alrededor (fotos tipo carné).
 */
export type ModoImagen = 'contener' | 'cubrir';

/**
 * Dibuja `img` en el rectángulo del campo `campo` como contenido de la página
 * y quita el widget del formulario.
 *
 * Recorre TODOS los widgets del campo: en Ficha Social las dos cajas de firma
 * son dos widgets del mismo `firma_af_image`, y con solo el primero una de las
 * dos salía vacía.
 *
 * @returns true si dibujó al menos una vez.
 */
export function dibujarImagenPlana(
  pdfDoc: PDFDocument,
  form: PDFForm,
  campo: string,
  img: PDFImage,
  modo: ModoImagen = 'contener',
): boolean {
  let field: any;
  try {
    field = form.getField(campo);
  } catch {
    return false; // el campo no existe en esta plantilla
  }

  const widgets: any[] = field?.acroField?.getWidgets?.() ?? [];
  if (!widgets.length) return false;

  const ctx: any = (pdfDoc as any).context;
  const paginas = pdfDoc.getPages();
  let dibujadas = 0;

  for (const widget of widgets) {
    try {
      const rect = widget.getRectangle();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;

      // Página del widget: primero por su /P, si no buscando su referencia en
      // los /Annots. OJO: Annots guarda PDFRef, hay que resolver con lookup —
      // comparar contra el dict directamente nunca encuentra nada.
      const refPagina = widget.P?.();
      let pagina =
        paginas.find((pg: any) => refPagina && pg.ref === refPagina) ??
        paginas.find((pg: any) => {
          const arr: any[] = (pg as any).node?.Annots?.()?.asArray?.() ?? [];
          return arr.some((a: any) => a === widget.dict || ctx?.lookup?.(a) === widget.dict);
        }) ??
        paginas[0];

      const dims = img.scale(1);
      const escala = modo === 'cubrir'
        ? Math.max(rect.width / dims.width, rect.height / dims.height)
        : Math.min(rect.width / dims.width, rect.height / dims.height) * 0.95;
      const w = dims.width * escala;
      const h = dims.height * escala;
      const x = rect.x + (rect.width - w) / 2;
      const y = rect.y + (rect.height - h) / 2;

      if (modo === 'cubrir') {
        // Fondo blanco: tapa el texto impreso del recuadro antes de la foto.
        pagina.drawRectangle({
          x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: rgb(1, 1, 1),
        });
        pagina.pushOperators(
          pushGraphicsState(),
          moveTo(rect.x, rect.y),
          lineTo(rect.x + rect.width, rect.y),
          lineTo(rect.x + rect.width, rect.y + rect.height),
          lineTo(rect.x, rect.y + rect.height),
          closePath(),
          clip(),
          endPath(),
        );
        pagina.drawImage(img, { x, y, width: w, height: h });
        pagina.pushOperators(popGraphicsState());
      } else {
        pagina.drawImage(img, { x, y, width: w, height: h });
      }

      // Fuera el widget: su fondo (/MK /BG) taparía lo recién dibujado.
      try {
        const annots = (pagina as any).node?.Annots?.();
        const arr: any[] = annots?.asArray?.() ?? [];
        const i = arr.findIndex((a: any) => a === widget.dict || ctx?.lookup?.(a) === widget.dict);
        if (i >= 0) annots.remove(i);
      } catch { /* si no se puede quitar, al menos la imagen ya está */ }

      dibujadas++;
    } catch (e) {
      console.error(`[pdf-aplanado] no se pudo dibujar la imagen de "${campo}":`, e);
    }
  }

  // NO se llama a `form.removeField()`: en los formularios XFA (minerva.pdf)
  // revienta con "Unexpected N type: undefined" y deja el documento
  // inconsistente — el save posterior falla y el PDF sale corrupto. Basta con
  // haber quitado el widget: el campo queda sin apariencia y `flatten()` lo
  // ignora.
  return dibujadas > 0;
}

/**
 * Aplana el formulario para que el texto quede como contenido de la página.
 *
 * Si `flatten()` falla (plantilla con campos sin apariencia), cae a dejar los
 * campos en solo lectura: se pierde el aplanado, pero NO el documento — que es
 * el comportamiento que había antes de este cambio.
 */
export function aplanarFormulario(form: PDFForm): void {
  try {
    form.flatten();
  } catch (e) {
    console.warn('[pdf-aplanado] flatten() falló, se deja el formulario en solo lectura:', e);
    try {
      form.getFields().forEach((f: any) => { try { f.enableReadOnly(); } catch { /* noop */ } });
    } catch { /* noop */ }
  }
}
