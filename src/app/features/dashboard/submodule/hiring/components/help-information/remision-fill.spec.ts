import { temporalDeVacante } from './remision-fill';

/**
 * La temporal decide el membrete y el código de calidad del formato de
 * remisión impreso; `porDefecto` dispara el aviso "Temporal no definida en la
 * vacante" ANTES de imprimir.
 */
describe('temporalDeVacante', () => {

  it('Publicacion.temporal manda: TU ALIANZA SAS → alianza, sin aviso', () => {
    expect(temporalDeVacante({ temporal: 'TU ALIANZA SAS' }))
      .toEqual({ temporal: 'alianza', porDefecto: false });
  });

  it('Publicacion.temporal manda: APOYO LABORAL SAS → apoyo, sin aviso', () => {
    expect(temporalDeVacante({ temporal: 'APOYO LABORAL SAS' }))
      .toEqual({ temporal: 'apoyo', porDefecto: false });
  });

  it('no distingue mayúsculas/minúsculas', () => {
    expect(temporalDeVacante({ temporal: 'tu alianza sas' }).temporal).toBe('alianza');
  });

  it('sin temporal, la empresa usuaria decide: ALIANZA → alianza, sin aviso', () => {
    expect(temporalDeVacante({ empresaUsuariaSolicita: 'FLORES ALIANZA SAS' }))
      .toEqual({ temporal: 'alianza', porDefecto: false });
  });

  it('sin temporal, empresa con APOYO → apoyo, sin aviso', () => {
    expect(temporalDeVacante({ empresaUsuariaSolicita: 'APOYO LABORAL TS' }))
      .toEqual({ temporal: 'apoyo', porDefecto: false });
  });

  it('sin señal en ninguna de las dos → apoyo POR DESCARTE (porDefecto avisa)', () => {
    expect(temporalDeVacante({ empresaUsuariaSolicita: 'FINCA EL ROSAL' }))
      .toEqual({ temporal: 'apoyo', porDefecto: true });
  });

  it('vacante vacía o null → apoyo por descarte con aviso', () => {
    expect(temporalDeVacante({})).toEqual({ temporal: 'apoyo', porDefecto: true });
    expect(temporalDeVacante(null)).toEqual({ temporal: 'apoyo', porDefecto: true });
  });
});
