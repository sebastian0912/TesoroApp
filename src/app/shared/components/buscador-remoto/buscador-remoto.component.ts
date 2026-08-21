import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, Subscription, of, timer } from 'rxjs';
import { catchError, debounce, distinctUntilChanged, filter, map, switchMap, tap } from 'rxjs/operators';

import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

/** Trozo de texto de una opcion, marcado o no como coincidencia. */
export interface SegmentoTexto {
  texto: string;
  resaltado: boolean;
}

/** Opcion ya preparada para pintar (evita llamar funciones desde la plantilla). */
export interface OpcionVista<T> {
  item: T;
  principal: string;
  secundario: string;
  segmentos: SegmentoTexto[];
}

/**
 * Buscador remoto reutilizable (autocomplete server-side).
 *
 * Se usa en cuatro sitios del modulo de incapacidades: empleado, CIE-10,
 * IPS y EPS. La aplicacion no tenia ningun autocomplete con debounce y
 * cancelacion, asi que este componente es la pieza generica.
 *
 * ZONELESS-safe: todo el estado vive en signals; no hay `markForCheck`
 * manual ni mutacion dentro de `subscribe` sobre campos planos.
 *
 * @example
 * ```html
 * <app-buscador-remoto
 *   [buscar]="buscarEmpleado"
 *   [mostrar]="mostrarEmpleado"
 *   [secundario]="detalleEmpleado"
 *   etiqueta="Trabajador"
 *   placeholder="Cedula o nombre"
 *   [minCaracteres]="3"
 *   (seleccionado)="onEmpleado($event)"
 *   (limpiado)="onLimpiar()">
 * </app-buscador-remoto>
 * ```
 * ```ts
 * // En el componente padre (funciones estables, NO creadas en la plantilla):
 * readonly buscarEmpleado = (q: string) => this.srv.buscarEmpleados(q, 15);
 * readonly mostrarEmpleado = (e: EmpleadoBusqueda) => `${e.cedula} — ${e.nombreCompleto}`;
 * readonly detalleEmpleado = (e: EmpleadoBusqueda) => `${e.empresa} · ${e.centroCosto}`;
 * ```
 */
@Component({
  selector: 'app-buscador-remoto',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './buscador-remoto.component.html',
  styleUrl: './buscador-remoto.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuscadorRemotoComponent<T> implements OnDestroy {
  private readonly destroyRef = inject(DestroyRef);

  // ── Entradas ──────────────────────────────────────────────────────────

  /** Funcion de busqueda. Debe ser una referencia ESTABLE del padre. */
  readonly buscar = input.required<(q: string) => Observable<T[]>>();

  /** Texto principal de cada opcion (y del input una vez seleccionada). */
  readonly mostrar = input.required<(item: T) => string>();

  /** Linea secundaria opcional de cada opcion. */
  readonly secundario = input<((item: T) => string) | null>(null);

  /** Etiqueta del `mat-form-field`. */
  readonly etiqueta = input<string>('Buscar');

  /** Placeholder del input. */
  readonly placeholder = input<string>('');

  /** Caracteres minimos antes de disparar la busqueda. */
  readonly minCaracteres = input<number>(3);

  /** Milisegundos de espera tras la ultima tecla. */
  readonly debounceMs = input<number>(300);

  /** Texto inicial del input (por ejemplo al editar un registro). */
  readonly valorInicial = input<string>('');

  /** Deshabilita el control. */
  readonly deshabilitado = input<boolean>(false);

  /** Marca el campo como obligatorio (asterisco + `aria-required`). */
  readonly requerido = input<boolean>(false);

  /** Icono de Material mostrado como prefijo. */
  readonly icono = input<string>('search');

  /** Texto de ayuda bajo el campo (`mat-hint`). */
  readonly ayuda = input<string>('');

  // ── Salidas ───────────────────────────────────────────────────────────

  /** Emite el item elegido por el usuario. */
  readonly seleccionado = output<T>();

  /** Emite cuando se limpia el campo (boton X o borrado total). */
  readonly limpiado = output<void>();

  // ── Estado interno (signals: la app es ZONELESS) ──────────────────────

  private readonly _opciones = signal<T[]>([]);
  private readonly _cargando = signal(false);
  private readonly _error = signal<string>('');
  private readonly _termino = signal<string>('');
  private readonly _hayTexto = signal(false);

  /** `true` mientras la peticion esta en vuelo. */
  readonly cargando = this._cargando.asReadonly();
  /** Mensaje de error de la ultima busqueda ('' si no hubo). */
  readonly error = this._error.asReadonly();
  /** Ultimo termino efectivamente buscado. */
  readonly termino = this._termino.asReadonly();
  /** `true` si el input tiene contenido (controla el boton de limpiar). */
  readonly hayTexto = this._hayTexto.asReadonly();

  /** Opciones ya preparadas para pintar, con los segmentos resaltados. */
  readonly opcionesVista = computed<OpcionVista<T>[]>(() => {
    const items = this._opciones();
    const mostrarFn = this.mostrar();
    const secundarioFn = this.secundario();
    const consulta = this._termino();

    return items.map((item) => {
      const principal = this.aTexto(() => mostrarFn(item));
      return {
        item,
        principal,
        secundario: secundarioFn ? this.aTexto(() => secundarioFn(item)) : '',
        segmentos: this.calcularSegmentos(principal, consulta),
      };
    });
  });

  /** `true` cuando se busco y el backend no devolvio nada. */
  readonly sinResultados = computed(
    () =>
      !this._cargando() &&
      !this._error() &&
      this._termino().length >= this.minCaracteres() &&
      this._opciones().length === 0,
  );

  /** Texto del hint cuando faltan caracteres para buscar. */
  readonly ayudaEfectiva = computed(() => {
    if (this.ayuda()) return this.ayuda();
    return `Escribe al menos ${this.minCaracteres()} caracteres`;
  });

  /** Contador de instancias para generar ids unicos. */
  private static contador = 0;

  /** Id estable para enlazar el hint por `aria-describedby`. */
  readonly idAyuda = `buscador-remoto-ayuda-${++BuscadorRemotoComponent.contador}`;

  /** El control guarda texto mientras se escribe y el item tras seleccionar. */
  readonly control = new FormControl<string | T | null>('');

  private readonly suscripciones = new Subscription();

  constructor() {
    // Sincroniza `valorInicial` -> input sin disparar busquedas.
    effect(() => {
      const inicial = this.valorInicial() ?? '';
      if (this.mostrarValor(this.control.value) !== inicial) {
        this.control.setValue(inicial, { emitEvent: false });
        this._hayTexto.set(inicial.length > 0);
      }
    });

    // Sincroniza `deshabilitado` -> estado del control.
    effect(() => {
      if (this.deshabilitado()) {
        this.control.disable({ emitEvent: false });
      } else {
        this.control.enable({ emitEvent: false });
      }
    });

    this.suscripciones.add(
      this.control.valueChanges
        .pipe(
          // Cuando el usuario elige una opcion el valor pasa a ser el objeto:
          // ese caso NO debe disparar una nueva busqueda.
          filter((valor): valor is string => typeof valor === 'string'),
          map((texto) => texto.trim()),
          tap((texto) => this._hayTexto.set(texto.length > 0)),
          // `debounce` con `timer` (no `debounceTime`) para poder leer el
          // signal `debounceMs` en cada emision.
          debounce(() => timer(Math.max(0, this.debounceMs()))),
          // Repetir el mismo termino no vuelve a pegarle al backend, salvo
          // que ya no queden opciones en pantalla (por ejemplo tras limpiar).
          distinctUntilChanged(
            (anterior, actual) => anterior === actual && this._opciones().length > 0,
          ),
          tap((texto) => {
            if (texto.length < this.minCaracteres()) {
              this._opciones.set([]);
              this._termino.set('');
              this._error.set('');
              this._cargando.set(false);
            }
          }),
          filter((texto) => texto.length >= this.minCaracteres()),
          tap((texto) => {
            this._termino.set(texto);
            this._error.set('');
            this._cargando.set(true);
          }),
          // `switchMap` CANCELA la peticion anterior: nunca llega una
          // respuesta vieja despues de una nueva.
          switchMap((texto) =>
            this.buscar()(texto).pipe(
              catchError((err: unknown) => {
                this._error.set(this.mensajeError(err));
                return of([] as T[]);
              }),
            ),
          ),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe((resultados) => {
          // Estado en signals => repinta solo en zoneless.
          this._opciones.set(Array.isArray(resultados) ? resultados : []);
          this._cargando.set(false);
        }),
    );
  }

  /**
   * Limpieza explicita de suscripciones (regla de la casa: los componentes
   * viejos de este modulo tienen fugas; aqui no se replican).
   */
  ngOnDestroy(): void {
    this.suscripciones.unsubscribe();
  }

  // ── API de plantilla ──────────────────────────────────────────────────

  /** `displayWith` del autocomplete: texto que queda escrito en el input. */
  readonly mostrarValor = (valor: string | T | null): string => {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'string') return valor;
    return this.aTexto(() => this.mostrar()(valor));
  };

  /** Handler de `optionSelected`. */
  alSeleccionar(evento: MatAutocompleteSelectedEvent): void {
    const item = evento.option.value as T;
    this._opciones.set([]);
    this._error.set('');
    this._hayTexto.set(true);
    this.seleccionado.emit(item);
  }

  /** Vacia el campo y avisa al padre. */
  limpiar(): void {
    this.control.setValue('', { emitEvent: false });
    this._opciones.set([]);
    this._termino.set('');
    this._error.set('');
    this._cargando.set(false);
    this._hayTexto.set(false);
    this.limpiado.emit();
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Parte el texto en segmentos resaltando la subcadena coincidente.
   * La comparacion ignora mayusculas y tildes; el texto devuelto conserva
   * el original (no se pinta el texto normalizado).
   */
  private calcularSegmentos(texto: string, consulta: string): SegmentoTexto[] {
    if (!texto) return [];
    const aguja = (consulta ?? '').trim();
    if (!aguja) return [{ texto, resaltado: false }];

    const pajarNorm = this.normalizar(texto);
    const agujaNorm = this.normalizar(aguja);
    if (!agujaNorm) return [{ texto, resaltado: false }];

    // Si la normalizacion cambio la longitud (texto ya descompuesto en NFD),
    // los indices dejarian de coincidir: mejor no resaltar que resaltar mal.
    if (pajarNorm.length !== texto.length) return [{ texto, resaltado: false }];

    const segmentos: SegmentoTexto[] = [];
    let cursor = 0;

    // `normalizar` conserva la longitud (solo quita diacriticos y baja a
    // minusculas), asi que los indices valen para el texto original.
    while (cursor < texto.length) {
      const encontrado = pajarNorm.indexOf(agujaNorm, cursor);
      if (encontrado < 0) {
        segmentos.push({ texto: texto.slice(cursor), resaltado: false });
        break;
      }
      if (encontrado > cursor) {
        segmentos.push({ texto: texto.slice(cursor, encontrado), resaltado: false });
      }
      segmentos.push({
        texto: texto.slice(encontrado, encontrado + agujaNorm.length),
        resaltado: true,
      });
      cursor = encontrado + agujaNorm.length;
    }

    return segmentos.filter((s) => s.texto.length > 0);
  }

  /** Minusculas sin diacriticos, conservando la longitud del texto. */
  private normalizar(valor: string): string {
    return valor
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  /** Ejecuta una funcion del padre sin dejar que reviente la vista. */
  private aTexto(fn: () => string | null | undefined): string {
    try {
      return (fn() ?? '').toString();
    } catch {
      return '';
    }
  }

  /** Mensaje legible para el usuario a partir de un error HTTP. */
  private mensajeError(err: unknown): string {
    const estado = (err as { status?: number } | null)?.status;
    if (estado === 0) return 'Sin conexion con el servidor.';
    if (estado === 401 || estado === 403) return 'No tienes permiso para consultar.';
    if (typeof estado === 'number' && estado >= 500) return 'El servidor no respondio bien.';
    return 'No se pudo completar la busqueda.';
  }
}
