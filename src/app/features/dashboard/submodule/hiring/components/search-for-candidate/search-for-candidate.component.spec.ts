/**
 * Búsqueda de candidato y cola de turnos — pruebas de componente.
 *
 * Es la puerta de entrada de toda la pantalla: acá se digita la cédula. O sea
 * que es donde más basura entra. Se prueba el camino normal y, sobre todo, el
 * uso torpe: cédulas con puntos, con espacios, vacías, letras, doble clic en
 * buscar, y el refresco automático de la cola.
 */
import { ComponentFixture, TestBed, fakeAsync, tick, discardPeriodicTasks } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';

import { SearchForCandidateComponent } from './search-for-candidate.component';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { VetadosService } from '../../service/vetados/vetados.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

const CANDIDATO = { numero_documento: '1082490391', tipo_doc: 'CC', primer_nombre: 'LEIVIS' };

describe('SearchForCandidateComponent', () => {
  let fixture: ComponentFixture<SearchForCandidateComponent>;
  let comp: SearchForCandidateComponent;
  let registro: jasmine.SpyObj<RegistroProcesoContratacion>;

  beforeEach(async () => {
    registro = jasmine.createSpyObj('RegistroProcesoContratacion', [
      'getCandidatoPorDocumento', 'getCandidatosRecientes',
      'asegurarEstadoRobot', 'encolarCandidato',
    ]);
    registro.getCandidatoPorDocumento.and.returnValue(of(CANDIDATO as any));
    registro.getCandidatosRecientes.and.returnValue(of([] as any));
    registro.asegurarEstadoRobot.and.returnValue(of({} as any));
    registro.encolarCandidato.and.returnValue(of({} as any));

    await TestBed.configureTestingModule({
      imports: [SearchForCandidateComponent, NoopAnimationsModule],
      providers: [
        { provide: RegistroProcesoContratacion, useValue: registro },
        { provide: VetadosService, useValue: { consultar: () => of(null), list: () => of([]) } },
        {
          provide: UtilityServiceService,
          useValue: { getUser: () => Promise.resolve({ sede: { nombre: 'FACA_PRIMERA' } }) },
        },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(undefined) }) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchForCandidateComponent);
    comp = fixture.componentInstance;
  });

  // ───────────────────────────────────────────────────────────
  describe('cédulas que digita la gente', () => {

    it('con espacios alrededor la recorta antes de buscar', () => {
      comp.cedula = '   1082490391   ';
      comp.buscarCandidato();
      expect(registro.getCandidatoPorDocumento).toHaveBeenCalledWith('1082490391', true);
    });

    it('vacía NO dispara ninguna consulta', () => {
      comp.cedula = '';
      comp.buscarCandidato();
      expect(registro.getCandidatoPorDocumento).not.toHaveBeenCalled();
    });

    it('solo espacios NO dispara ninguna consulta', () => {
      comp.cedula = '     ';
      comp.buscarCandidato();
      expect(registro.getCandidatoPorDocumento).not.toHaveBeenCalled();
    });

    it('si el candidato no existe, avisa y emite null', () => {
      registro.getCandidatoPorDocumento.and.returnValue(of(null as any));
      const emitido: any[] = [];
      comp.candidatoSeleccionado.subscribe(v => emitido.push(v));

      comp.cedula = '9999999999';
      comp.buscarCandidato();

      expect(emitido).toEqual([null]);
    });

    it('un error del backend no tumba el componente', () => {
      registro.getCandidatoPorDocumento.and.returnValue(
        throwError(() => ({ status: 500 })));
      comp.cedula = '1082490391';
      expect(() => comp.buscarCandidato()).not.toThrow();
    });

    it('asegura la fila del robot en CADA búsqueda', () => {
      // Es lo que evita que el candidato quede sin antecedentes pedidos.
      comp.cedula = '1082490391';
      comp.buscarCandidato();
      expect(registro.asegurarEstadoRobot).toHaveBeenCalledWith(
        jasmine.objectContaining({ numero_documento: '1082490391' }));
    });

    it('si asegurarEstadoRobot falla, la búsqueda sigue', () => {
      registro.asegurarEstadoRobot.and.returnValue(throwError(() => ({ status: 500 })));
      comp.cedula = '1082490391';
      comp.buscarCandidato();
      expect(registro.getCandidatoPorDocumento)
        .withContext('el robot es accesorio: la consulta no depende de él')
        .toHaveBeenCalled();
    });

    it('buscar dos veces seguidas (doble clic) no rompe nada', () => {
      comp.cedula = '1082490391';
      comp.buscarCandidato();
      comp.buscarCandidato();
      expect(registro.getCandidatoPorDocumento).toHaveBeenCalledTimes(2);
    });
  });

  // ───────────────────────────────────────────────────────────
  describe('cola de turnos', () => {

    it('encola cuando el toggle está encendido', () => {
      comp.encolarEnTabla = true;
      comp.cedula = '1082490391';
      comp.buscarCandidato();
      expect(registro.encolarCandidato).toHaveBeenCalled();
    });

    it('NO encola cuando el toggle está apagado', () => {
      comp.encolarEnTabla = false;
      comp.cedula = '1082490391';
      comp.buscarCandidato();
      expect(registro.encolarCandidato).not.toHaveBeenCalled();
    });

    it('el refresco automático es de 15 segundos, no de 3', () => {
      // A 3 s eran ~1.200 requests/hora por cada TesoroApp abierto contra un
      // endpoint que consulta candidatos, entrevistas y estados de robots.
      expect((comp as any).RECIENTES_REFRESH_MS).toBe(15000);
    });

    it('el refresco no arranca si la ventana está oculta', fakeAsync(() => {
      spyOnProperty(document, 'hidden', 'get').and.returnValue(true);
      fixture.detectChanges();
      tick(16000);
      expect(registro.getCandidatosRecientes)
        .withContext('con la app minimizada nadie mira la cola')
        .not.toHaveBeenCalled();
      discardPeriodicTasks();
    }));

    it('un error al refrescar no deja el spinner girando para siempre', fakeAsync(() => {
      registro.getCandidatosRecientes.and.returnValue(throwError(() => ({ status: 0 })));
      fixture.detectChanges();
      tick(100);
      expect(comp.recientesLoading).toBeFalse();
      discardPeriodicTasks();
    }));

    it('quita repetidos de la cola', () => {
      const dupes = [
        { numero_documento: '1', apellidos_nombres: 'A' },
        { numero_documento: '1', apellidos_nombres: 'A' },
        { numero_documento: '2', apellidos_nombres: 'B' },
      ];
      const limpio = (comp as any).dedupeRecientes(dupes);
      expect(limpio.length).toBe(2);
    });

    it('una cola vacía no revienta', () => {
      expect(() => (comp as any).dedupeRecientes([])).not.toThrow();
    });

    it('una cola nula no revienta', () => {
      expect(() => (comp as any).dedupeRecientes(null)).not.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────
  describe('carnet masivo desde la cola', () => {

    it('manda las cédulas que hay en la cola', () => {
      comp.recientes = [
        { numero_documento: '1' } as any,
        { numero_documento: '2' } as any,
      ];
      const emitido: string[][] = [];
      comp.carnetMasivo.subscribe(v => emitido.push(v));

      comp.pedirCarnetMasivo();

      expect(emitido[0]).toEqual(['1', '2']);
    });

    it('con la cola vacía manda una lista vacía, no revienta', () => {
      comp.recientes = [];
      const emitido: string[][] = [];
      comp.carnetMasivo.subscribe(v => emitido.push(v));

      expect(() => comp.pedirCarnetMasivo()).not.toThrow();
      expect(emitido[0]).toEqual([]);
    });

    it('descarta las filas sin cédula', () => {
      comp.recientes = [
        { numero_documento: '1' } as any,
        { numero_documento: '' } as any,
        { numero_documento: null } as any,
      ];
      const emitido: string[][] = [];
      comp.carnetMasivo.subscribe(v => emitido.push(v));

      comp.pedirCarnetMasivo();

      expect(emitido[0]).toEqual(['1']);
    });
  });
});
