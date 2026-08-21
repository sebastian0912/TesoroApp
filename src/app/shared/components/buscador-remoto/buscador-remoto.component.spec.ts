import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { Observable, Subject, of, throwError, timer } from 'rxjs';
import { map } from 'rxjs/operators';

import { BuscadorRemotoComponent } from './buscador-remoto.component';

interface Empleado {
  cedula: string;
  nombre: string;
  empresa: string;
}

const EMPLEADOS: Empleado[] = [
  { cedula: '1001', nombre: 'JUAN PEREZ', empresa: 'APOYO LABORAL' },
  { cedula: '1002', nombre: 'JUANA GOMEZ', empresa: 'TU ALIANZA' },
];

describe('BuscadorRemotoComponent', () => {
  let fixture: ComponentFixture<BuscadorRemotoComponent<Empleado>>;
  let componente: BuscadorRemotoComponent<Empleado>;
  let llamadas: string[];
  let buscar: (q: string) => Observable<Empleado[]>;

  const mostrar = (e: Empleado) => `${e.cedula} - ${e.nombre}`;
  const secundario = (e: Empleado) => e.empresa;

  /** Devuelve el input real del componente. */
  function inputEl(): HTMLInputElement {
    return fixture.nativeElement.querySelector('input') as HTMLInputElement;
  }

  /** Escribe en el input tal cual lo haria el usuario. */
  function escribir(texto: string, elemento: HTMLInputElement = inputEl()): void {
    elemento.value = texto;
    elemento.dispatchEvent(new Event('input'));
  }

  beforeEach(async () => {
    llamadas = [];
    buscar = (q: string) => {
      llamadas.push(q);
      return of(EMPLEADOS);
    };

    await TestBed.configureTestingModule({
      imports: [BuscadorRemotoComponent],
      providers: [provideZonelessChangeDetection(), provideNoopAnimations()],
    }).compileComponents();

    fixture = TestBed.createComponent<BuscadorRemotoComponent<Empleado>>(
      BuscadorRemotoComponent,
    );
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('buscar', buscar);
    fixture.componentRef.setInput('mostrar', mostrar);
    fixture.componentRef.setInput('secundario', secundario);
    fixture.componentRef.setInput('etiqueta', 'Trabajador');
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('se crea', () => {
    expect(componente).toBeTruthy();
  });

  it('arranca sin opciones, sin cargar y sin error', () => {
    expect(componente.opcionesVista()).toEqual([]);
    expect(componente.cargando()).toBe(false);
    expect(componente.error()).toBe('');
    expect(componente.termino()).toBe('');
  });

  it('NO busca por debajo de minCaracteres', fakeAsync(() => {
    escribir('ju');
    tick(400);
    expect(llamadas).toEqual([]);
    expect(componente.opcionesVista().length).toBe(0);
    flush();
  }));

  it('busca cuando se alcanza minCaracteres', fakeAsync(() => {
    escribir('juan');
    tick(400);
    expect(llamadas).toEqual(['juan']);
    expect(componente.opcionesVista().length).toBe(2);
    expect(componente.cargando()).toBe(false);
    flush();
  }));

  it('aplica debounce: varias teclas seguidas producen UNA sola peticion', fakeAsync(() => {
    escribir('ju');
    tick(100);
    escribir('jua');
    tick(100);
    escribir('juan');
    tick(400);
    expect(llamadas).toEqual(['juan']);
    flush();
  }));

  it('respeta un debounceMs personalizado', fakeAsync(() => {
    fixture.componentRef.setInput('debounceMs', 800);
    escribir('juan');
    tick(400);
    expect(llamadas).toEqual([]);
    tick(500);
    expect(llamadas).toEqual(['juan']);
    flush();
  }));

  it('respeta un minCaracteres personalizado', fakeAsync(() => {
    fixture.componentRef.setInput('minCaracteres', 1);
    escribir('j');
    tick(400);
    expect(llamadas).toEqual(['j']);
    flush();
  }));

  it('cancela la peticion anterior con switchMap (solo llega la ultima)', fakeAsync(() => {
    const emitidos: string[] = [];
    const buscarLento = (q: string): Observable<Empleado[]> => {
      llamadas.push(q);
      const retraso = q === 'juan' ? 500 : 10;
      return timer(retraso).pipe(
        map(() => {
          emitidos.push(q);
          return [{ cedula: q, nombre: q.toUpperCase(), empresa: 'X' }];
        }),
      );
    };
    fixture.componentRef.setInput('buscar', buscarLento);
    fixture.componentRef.setInput('debounceMs', 0);

    escribir('juan');
    tick(1); // pasa el debounce, la peticion lenta arranca
    escribir('juana');
    tick(1000);

    // La primera respuesta nunca se materializa: switchMap la desuscribio.
    expect(llamadas).toEqual(['juan', 'juana']);
    expect(emitidos).toEqual(['juana']);
    expect(componente.opcionesVista()[0].principal).toBe('juana - JUANA');
    flush();
  }));

  it('no repite la busqueda si el termino no cambia (distinctUntilChanged)', fakeAsync(() => {
    escribir('juan');
    tick(400);
    escribir('juan');
    tick(400);
    expect(llamadas).toEqual(['juan']);
    flush();
  }));

  it('vacia las opciones al bajar de minCaracteres', fakeAsync(() => {
    escribir('juan');
    tick(400);
    expect(componente.opcionesVista().length).toBe(2);

    escribir('ju');
    tick(400);
    expect(componente.opcionesVista().length).toBe(0);
    expect(componente.termino()).toBe('');
    flush();
  }));

  it('marca cargando mientras la peticion esta en vuelo', fakeAsync(() => {
    const sujeto = new Subject<Empleado[]>();
    fixture.componentRef.setInput('buscar', () => sujeto.asObservable());

    escribir('juan');
    tick(400);
    expect(componente.cargando()).toBe(true);

    sujeto.next(EMPLEADOS);
    sujeto.complete();
    tick();
    expect(componente.cargando()).toBe(false);
    flush();
  }));

  it('marca sinResultados cuando el backend devuelve vacio', fakeAsync(() => {
    fixture.componentRef.setInput('buscar', () => of([] as Empleado[]));
    escribir('zzzz');
    tick(400);
    expect(componente.sinResultados()).toBe(true);
    flush();
  }));

  it('no propaga el error: lo guarda como mensaje y deja de cargar', fakeAsync(() => {
    fixture.componentRef.setInput('buscar', () =>
      throwError(() => ({ status: 500 })),
    );
    escribir('juan');
    tick(400);
    expect(componente.error()).toBe('El servidor no respondio bien.');
    expect(componente.cargando()).toBe(false);
    expect(componente.opcionesVista().length).toBe(0);
    flush();
  }));

  it('distingue el error de red sin conexion', fakeAsync(() => {
    fixture.componentRef.setInput('buscar', () => throwError(() => ({ status: 0 })));
    escribir('juan');
    tick(400);
    expect(componente.error()).toBe('Sin conexion con el servidor.');
    flush();
  }));

  describe('resaltado de coincidencias', () => {
    it('parte el texto en segmentos resaltando la subcadena', fakeAsync(() => {
      escribir('juan');
      tick(400);
      const segmentos = componente.opcionesVista()[0].segmentos;
      expect(segmentos.map((s) => s.texto).join('')).toBe('1001 - JUAN PEREZ');
      expect(segmentos.filter((s) => s.resaltado).map((s) => s.texto)).toEqual(['JUAN']);
      flush();
    }));

    it('ignora mayusculas y tildes al resaltar', fakeAsync(() => {
      fixture.componentRef.setInput('buscar', () =>
        of([{ cedula: '9', nombre: 'JOSÉ MARÍA', empresa: 'X' }]),
      );
      escribir('jose');
      tick(400);
      const segmentos = componente.opcionesVista()[0].segmentos;
      expect(segmentos.filter((s) => s.resaltado).map((s) => s.texto)).toEqual(['JOSÉ']);
      flush();
    }));

    it('deja un solo segmento sin resaltar si no hay coincidencia visible', fakeAsync(() => {
      fixture.componentRef.setInput('buscar', () =>
        of([{ cedula: '9', nombre: 'OTRO', empresa: 'X' }]),
      );
      escribir('juan');
      tick(400);
      const segmentos = componente.opcionesVista()[0].segmentos;
      expect(segmentos.length).toBe(1);
      expect(segmentos[0].resaltado).toBe(false);
      flush();
    }));
  });

  it('calcula la linea secundaria con la funcion recibida', fakeAsync(() => {
    escribir('juan');
    tick(400);
    expect(componente.opcionesVista()[0].secundario).toBe('APOYO LABORAL');
    flush();
  }));

  it('deja la linea secundaria vacia si no se pasa la funcion', fakeAsync(() => {
    fixture.componentRef.setInput('secundario', null);
    escribir('juan');
    tick(400);
    expect(componente.opcionesVista()[0].secundario).toBe('');
    flush();
  }));

  describe('seleccion', () => {
    it('emite el item elegido y cierra las opciones', () => {
      const emitidos: Empleado[] = [];
      componente.seleccionado.subscribe((e) => emitidos.push(e));

      componente.alSeleccionar({
        option: { value: EMPLEADOS[0] },
      } as unknown as MatAutocompleteSelectedEvent);

      expect(emitidos).toEqual([EMPLEADOS[0]]);
      expect(componente.opcionesVista()).toEqual([]);
    });

    it('mostrarValor devuelve el texto del item seleccionado', () => {
      expect(componente.mostrarValor(EMPLEADOS[0])).toBe('1001 - JUAN PEREZ');
    });

    it('mostrarValor devuelve el texto tal cual mientras se escribe', () => {
      expect(componente.mostrarValor('jua')).toBe('jua');
      expect(componente.mostrarValor(null)).toBe('');
    });
  });

  describe('limpiar', () => {
    it('vacia el control, el estado y emite limpiado', fakeAsync(() => {
      const limpiados: number[] = [];
      componente.limpiado.subscribe(() => limpiados.push(1));

      escribir('juan');
      tick(400);
      expect(componente.hayTexto()).toBe(true);

      componente.limpiar();

      expect(limpiados.length).toBe(1);
      expect(componente.control.value).toBe('');
      expect(componente.opcionesVista()).toEqual([]);
      expect(componente.termino()).toBe('');
      expect(componente.hayTexto()).toBe(false);
      flush();
    }));

    it('limpiar no dispara una nueva busqueda', fakeAsync(() => {
      escribir('juan');
      tick(400);
      const antes = llamadas.length;
      componente.limpiar();
      tick(400);
      expect(llamadas.length).toBe(antes);
      flush();
    }));
  });

  describe('entradas de configuracion', () => {
    it('valorInicial escribe en el control sin buscar', fakeAsync(() => {
      fixture.componentRef.setInput('valorInicial', '1001 - JUAN PEREZ');
      fixture.detectChanges();
      tick(400);
      expect(componente.control.value).toBe('1001 - JUAN PEREZ');
      expect(llamadas).toEqual([]);
      flush();
    }));

    it('deshabilitado bloquea el control', async () => {
      fixture.componentRef.setInput('deshabilitado', true);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(componente.control.disabled).toBe(true);

      fixture.componentRef.setInput('deshabilitado', false);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(componente.control.disabled).toBe(false);
    });

    it('ayudaEfectiva usa el texto por defecto o el recibido', () => {
      expect(componente.ayudaEfectiva()).toBe('Escribe al menos 3 caracteres');
      fixture.componentRef.setInput('ayuda', 'Busca por cedula');
      expect(componente.ayudaEfectiva()).toBe('Busca por cedula');
    });

    it('pinta la etiqueta recibida', () => {
      fixture.detectChanges();
      const label: HTMLElement = fixture.nativeElement.querySelector('mat-label');
      expect(label.textContent?.trim()).toBe('Trabajador');
    });
  });

  it('ngOnDestroy corta la suscripcion (no busca despues de destruir)', fakeAsync(() => {
    const elemento = inputEl();
    escribir('juan', elemento);
    tick(400);
    const antes = llamadas.length;

    fixture.destroy();

    escribir('pedro', elemento);
    tick(400);
    expect(llamadas.length).toBe(antes);
    flush();
  }));
});
