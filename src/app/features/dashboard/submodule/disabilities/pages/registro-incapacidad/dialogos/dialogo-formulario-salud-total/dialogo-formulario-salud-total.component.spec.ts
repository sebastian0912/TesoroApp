/**
 * Pruebas del llenado del formato oficial de Salud Total (M-GINT-F103).
 *
 * La funcion `llenarFormatoSaludTotal` es pura respecto del DOM: recibe los bytes del PDF
 * y devuelve los bytes diligenciados. Aqui se llena el formato REAL empacado en assets y
 * se relee con pdf-lib para verificar que los nombres de campo del formato oficial siguen
 * siendo los esperados — si Salud Total publica una version con campos renombrados, esto
 * cae aqui y no en la oficina.
 */

import {
  PREGUNTAS_SALUD_TOTAL,
  RUTA_PDF_SALUD_TOTAL,
  llenarFormatoSaludTotal,
} from './dialogo-formulario-salud-total.component';

describe('llenarFormatoSaludTotal', () => {
  const DATOS = {
    nombres: 'JUAN CARLOS',
    apellidos: 'PEREZ GOMEZ',
    telefono: '3001234567',
    arl: 'ARL SURA',
    cargo: 'OPERARIO',
    responsable: 'ANA RUIZ',
    cedula: '1075263514',
  };

  it('define exactamente las 6 preguntas del formato, en su orden impreso', () => {
    expect(PREGUNTAS_SALUD_TOTAL.length).toBe(6);
    expect(PREGUNTAS_SALUD_TOTAL[0]).toContain('sitio de trabajo');
    expect(PREGUNTAS_SALUD_TOTAL[5]).toContain('transporte pagado');
  });

  it('llena los campos reales del formato oficial y marca las casillas SI/NO', async () => {
    const respuesta = await fetch(RUTA_PDF_SALUD_TOTAL);
    if (!respuesta.ok) {
      pending(`karma no sirve el asset del formato (${respuesta.status})`);
      return;
    }
    const base = await respuesta.arrayBuffer();

    const bytes = await llenarFormatoSaludTotal(
      base,
      DATOS,
      ['NO', 'NO', 'NO', 'SI', 'NO', 'NO'],
      { relato: 'Sin evento laboral.' },
    );
    expect(bytes.length).toBeGreaterThan(1000);

    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes as unknown as ArrayBuffer);
    const form = doc.getForm();

    expect(form.getTextField('NOMBRES').getText()).toBe('JUAN CARLOS');
    expect(form.getTextField('APELLIDOS').getText()).toBe('PEREZ GOMEZ');
    expect(form.getTextField('TELEFONO').getText()).toBe('3001234567');
    expect(form.getTextField('ARL').getText()).toBe('ARL SURA');
    expect(form.getTextField('CARGO').getText()).toBe('OPERARIO');
    expect(form.getTextField('FIRMA RESPONSABLE').getText()).toBe('ANA RUIZ');
    expect(form.getTextField('RELATO DEL ACCIDENTE').getText()).toBe('Sin evento laboral.');

    // Pregunta 4 respondida SI; el resto NO. Nunca ambas casillas de un par.
    expect(form.getCheckBox('4SI').isChecked()).toBeTrue();
    expect(form.getCheckBox('4NO').isChecked()).toBeFalse();
    expect(form.getCheckBox('1NO').isChecked()).toBeTrue();
    expect(form.getCheckBox('1SI').isChecked()).toBeFalse();
    expect(form.getCheckBox('6NO').isChecked()).toBeTrue();
  }, 15000);
});
