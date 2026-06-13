/**
 * Incremento 2.6 — pruebas del gating de guardado por snapshot (calculationId).
 * Ejercen la lógica pura del componente sin TestBed (el constructor solo asigna
 * dependencias; ngOnInit no se invoca). Ejecutar con `ng test` (Karma/Chrome) en CI.
 *
 * Cubre criterios: puedeCerrar=false bloquea Guardar (§5/§14.5), conciliación
 * incorrecta bloquea (§11/§14.6), snapshot vencido exige recalcular (§9/§14.11),
 * y la invalidación deja Guardar deshabilitado hasta nuevo cálculo (§3/§14.2-4).
 */
import { CalculoNominaComponent } from './calculo-nomina.component';

function nuevoComponente(): CalculoNominaComponent {
  // Stubs mínimos; no se ejecuta ngOnInit ni se tocan los servicios reales.
  const svc: any = {};
  const dialog: any = {};
  const cdr: any = { markForCheck: () => {} };
  const c = new CalculoNominaComponent(svc, dialog, cdr);
  (c as any)._empleadosCalculados = new Map<number, any>([[1, { id_contrato: 1 }]]);
  return c;
}

describe('CalculoNomina — gating snapshot (Inc 2.6)', () => {
  it('con snapshot válido (puedeCerrar, conciliación ok, vigente) habilita Guardar', () => {
    const c = nuevoComponente();
    c.calculationIdActivo = 'CID';
    c.puedeCerrarActivo = true;
    c.conciliacionActiva = { conciliacion_correcta: true } as any;
    c.snapshotExpiraAt = new Date(Date.now() + 3600_000).toISOString();
    expect(c.puedeGuardar).toBe(true);
  });

  it('puedeCerrar=false deshabilita Guardar', () => {
    const c = nuevoComponente();
    c.calculationIdActivo = 'CID';
    c.puedeCerrarActivo = false;
    expect(c.puedeGuardar).toBe(false);
  });

  it('conciliación incorrecta deshabilita Guardar aunque puedeCerrar=true', () => {
    const c = nuevoComponente();
    c.calculationIdActivo = 'CID';
    c.puedeCerrarActivo = true;
    c.conciliacionActiva = { conciliacion_correcta: false } as any;
    expect(c.puedeGuardar).toBe(false);
  });

  it('snapshot vencido deshabilita Guardar', () => {
    const c = nuevoComponente();
    c.calculationIdActivo = 'CID';
    c.puedeCerrarActivo = true;
    c.snapshotExpiraAt = new Date(Date.now() - 1000).toISOString();
    expect(c.puedeGuardar).toBe(false);
  });

  it('Inc 2.7: sin calculationId (cierre legacy eliminado) NO permite guardar', () => {
    const c = nuevoComponente();
    c.calculationIdActivo = null;
    c.puedeCerrarActivo = true;
    expect(c.puedeGuardar).toBe(false);
  });

  it('invalidar deja Guardar deshabilitado para el flujo de novedades', () => {
    const c = nuevoComponente();
    c.calculationIdActivo = 'CID';
    c.puedeCerrarActivo = true;
    (c as any).invalidarCalculo();
    expect(c.calculationIdActivo).toBeNull();
    expect(c.puedeCerrarActivo).toBe(false);
  });
});
