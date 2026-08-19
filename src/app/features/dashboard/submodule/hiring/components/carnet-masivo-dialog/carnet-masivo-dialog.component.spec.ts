/**
 * Generación masiva de carnets — pruebas de componente.
 *
 * Es donde más lógica se cambió y nada de eso se había verificado:
 *   - Apoyo y Tu Alianza usan FORMATOS distintos y no pueden compartir hoja.
 *   - El conteo de hojas se hace por temporal (5 + 5 son 2 hojas, no 1).
 *   - Sin temporal en la vacante la fila se bloquea, en vez de asumir Apoyo.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { CarnetMasivoDialogComponent } from './carnet-masivo-dialog.component';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { VacantesService } from '../../../vacancies/service/vacantes/vacantes.service';

/** Fila lista para generar (sin datos faltantes). */
function fila(temporal: 'apoyo' | 'alianza', cedula = '1000000001') {
  return {
    cedula, nombre: 'BAZA GARCIA LEIVIS', tipoDoc: 'CC',
    yaGenerado: false, faltantes: [], error: null, procesoId: 1,
    temporal, apellidos: 'BAZA GARCIA', nombres: 'LEIVIS ESTHER',
    datos: {
      nombreCompleto: 'BAZA GARCIA LEIVIS ESTHER', cedula,
      centroCostos: 'FANTASY', cargo: 'CULTIVO', consecutivo: '180005',
      fechaIngreso: '04/08/2026', eps: 'SURA', afp: 'PORVENIR',
      emergenciaNombre: 'MARIA', emergenciaTelefono: '3001234567',
      logoDataUrl: null, fotoDataUrl: null,
    },
  } as any;
}

describe('CarnetMasivoDialogComponent', () => {
  let fixture: ComponentFixture<CarnetMasivoDialogComponent>;
  let comp: CarnetMasivoDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CarnetMasivoDialogComponent, NoopAnimationsModule],
      providers: [
        // backdropClick/keydownEvents: el constructor real se suscribe a ambos
        // para que ESC/click-afuera cierren por cerrar() y devuelvan `cambios`.
        {
          provide: MatDialogRef,
          useValue: {
            close: jasmine.createSpy('close'),
            backdropClick: () => of(),
            keydownEvents: () => of(),
          },
        },
        { provide: MAT_DIALOG_DATA, useValue: { cedulas: [] } },
        {
          provide: RegistroProcesoContratacion,
          useValue: {
            getCandidatoPorDocumento: () => of(null),
            updateProcesoByDocumento: () => of({}),
          },
        },
        {
          provide: GestionDocumentalService,
          useValue: { guardarDocumento: () => of({ id: 1 }) },
        },
        { provide: VacantesService, useValue: { obtenerVacante: () => of(null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CarnetMasivoDialogComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Carga filas y las marca todas. */
  function cargar(filas: any[]) {
    comp.filas.set(filas);
    comp.marcarTodas(true);
    fixture.detectChanges();
  }

  // ─────────────────────────────────────────────────────────────
  describe('separación por temporal', () => {

    it('cuenta por separado las de cada temporal', () => {
      cargar([fila('apoyo', '1'), fila('apoyo', '2'), fila('alianza', '3')]);
      expect(comp.porTemporal().apoyo).toBe(2);
      expect(comp.porTemporal().alianza).toBe(1);
    });

    it('5 de Apoyo + 5 de Alianza son DOS hojas, no una', () => {
      // Caben 9 por hoja, pero no comparten hoja: cada formato usa la suya.
      const filas = [
        ...Array.from({ length: 5 }, (_, i) => fila('apoyo', `a${i}`)),
        ...Array.from({ length: 5 }, (_, i) => fila('alianza', `b${i}`)),
      ];
      cargar(filas);
      expect(comp.seleccionadas().length).toBe(10);
      expect(comp.hojas()).toBe(2);
    });

    it('9 de una sola temporal caben en una hoja', () => {
      cargar(Array.from({ length: 9 }, (_, i) => fila('apoyo', `a${i}`)));
      expect(comp.hojas()).toBe(1);
    });

    it('10 de una sola temporal necesitan dos hojas', () => {
      cargar(Array.from({ length: 10 }, (_, i) => fila('alianza', `b${i}`)));
      expect(comp.hojas()).toBe(2);
    });

    it('sin nada marcado no hay hojas', () => {
      comp.filas.set([fila('apoyo')]);
      comp.marcarTodas(false);
      expect(comp.hojas()).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('filas bloqueadas', () => {

    it('una fila con datos faltantes no se puede generar', () => {
      const f = { ...fila('apoyo'), faltantes: ['foto'] };
      expect(comp.puedeGenerar(f)).toBeFalse();
    });

    it('una fila con error no se puede generar', () => {
      const f = { ...fila('apoyo'), error: 'No se encontró el candidato.' };
      expect(comp.puedeGenerar(f)).toBeFalse();
    });

    it('una fila sin datos no se puede generar', () => {
      const f = { ...fila('apoyo'), datos: null };
      expect(comp.puedeGenerar(f)).toBeFalse();
    });

    it('una fila completa sí se puede generar', () => {
      expect(comp.puedeGenerar(fila('apoyo'))).toBeTrue();
    });

    it('las bloqueadas no entran en el conteo de seleccionadas', () => {
      cargar([fila('apoyo', '1'), { ...fila('apoyo', '2'), faltantes: ['foto'] }]);
      expect(comp.seleccionadas().length).toBe(1);
      expect(comp.bloqueadas()).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('marcado de filas', () => {

    it('"solo pendientes" no marca los que ya tienen carnet', () => {
      comp.filas.set([
        fila('apoyo', '1'),
        { ...fila('apoyo', '2'), yaGenerado: true },
      ]);
      comp.soloPendientes();
      fixture.detectChanges();

      expect(comp.seleccionadas().length).toBe(1);
      expect(comp.seleccionadas()[0].cedula).toBe('1');
    });

    it('se puede marcar a mano uno ya generado para regenerarlo', () => {
      const yaTiene = { ...fila('apoyo', '2'), yaGenerado: true };
      comp.filas.set([yaTiene]);
      comp.marcar(yaTiene, true);
      fixture.detectChanges();

      expect(comp.seleccionadas().length).toBe(1);
      expect(comp.regenerando()).toBe(1);
    });

    it('desmarcar deja la selección vacía', () => {
      cargar([fila('apoyo')]);
      comp.marcarTodas(false);
      expect(comp.seleccionadas().length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  describe('cierre del diálogo', () => {

    it('sin cambios devuelve false', () => {
      const ref = TestBed.inject(MatDialogRef) as any;
      comp.cerrar();
      expect(ref.close).toHaveBeenCalledWith(false);
    });

    it('con cambios devuelve true para que el pipeline recargue', () => {
      const ref = TestBed.inject(MatDialogRef) as any;
      comp.cambios = true;
      comp.cerrar();
      expect(ref.close).toHaveBeenCalledWith(true);
    });
  });
});
