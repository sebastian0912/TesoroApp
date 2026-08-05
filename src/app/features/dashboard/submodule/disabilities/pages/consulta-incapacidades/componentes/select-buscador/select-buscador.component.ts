import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  forwardRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelect, MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

/** Una opcion del desplegable. */
export interface OpcionSelect {
  valor: string;
  etiqueta: string;
  /** Linea secundaria opcional (por ejemplo el codigo del enum). */
  detalle?: string;
  /** Marca de "lo pone el sistema" (estados documentales automaticos). */
  automatico?: boolean;
}

/**
 * Desplegable con buscador incorporado.
 *
 * La funcional pidio expresamente que "cada lista desplegable se vea bonita,
 * completa, que tenga su buscador que va filtrando automaticamente". Material no
 * trae buscador en `mat-select` y no se pueden anadir dependencias, asi que este
 * componente lo resuelve: un campo de texto fijo en la cabecera del panel que
 * filtra las opciones a medida que se escribe.
 *
 * Detalles importantes:
 *  - ZONELESS: todo el estado interno son signals; no hay `markForCheck`.
 *  - Es un `ControlValueAccessor`, asi que se usa con `formControlName` igual
 *    que cualquier control de Material.
 *  - `permitirLibre` habilita el valor tecleado que no esta en la lista. Hace
 *    falta porque las opciones de empresa / centro de costo / EPS / AFP se
 *    derivan de lo que el backend ya devolvio: si el usuario busca una empresa
 *    que todavia no ha aparecido en ninguna pagina, tiene que poder filtrarla.
 */
@Component({
  selector: 'app-select-buscador',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatInputModule,
    MatTooltipModule,
  ],
  templateUrl: './select-buscador.component.html',
  styleUrl: './select-buscador.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectBuscadorComponent),
      multi: true,
    },
  ],
})
export class SelectBuscadorComponent implements ControlValueAccessor {
  // ── Entradas ──────────────────────────────────────────────────────────

  readonly etiqueta = input<string>('');
  readonly icono = input<string>('');
  readonly opciones = input<readonly OpcionSelect[]>([]);
  /** Texto de la opcion "sin filtro". Si es vacio, no se pinta. */
  readonly textoTodas = input<string>('Todas');
  readonly placeholderBusqueda = input<string>('Escribe para filtrar…');
  readonly ayuda = input<string>('');
  /** Permite aplicar un valor escrito a mano que no este en la lista. */
  readonly permitirLibre = input<boolean>(false);
  readonly deshabilitadoEntrada = input<boolean>(false, { alias: 'deshabilitado' });

  /** Se emite cada vez que cambia la seleccion (ademas del CVA). */
  readonly cambio = output<string>();

  // ── Estado interno ────────────────────────────────────────────────────

  private readonly campoBusqueda = viewChild<ElementRef<HTMLInputElement>>('campoBusqueda');
  private readonly select = viewChild(MatSelect);

  readonly valor = signal<string>('');
  readonly termino = signal<string>('');
  private readonly deshabilitadoCva = signal(false);

  readonly estaDeshabilitado = computed(
    () => this.deshabilitadoEntrada() || this.deshabilitadoCva(),
  );

  /** Opciones que pasan el filtro del buscador. */
  readonly opcionesFiltradas = computed<readonly OpcionSelect[]>(() => {
    const aguja = normalizar(this.termino());
    const todas = this.opciones() ?? [];
    if (!aguja) return todas;
    return todas.filter(
      (o) =>
        normalizar(o.etiqueta).includes(aguja) ||
        normalizar(o.valor).includes(aguja) ||
        normalizar(o.detalle ?? '').includes(aguja),
    );
  });

  /** `true` cuando el buscador no encontro nada. */
  readonly sinCoincidencias = computed(
    () => this.termino().trim().length > 0 && this.opcionesFiltradas().length === 0,
  );

  /**
   * Valor libre ofrecible: hay texto, se permite, y no coincide exactamente con
   * ninguna opcion ya listada.
   */
  readonly valorLibre = computed<string>(() => {
    if (!this.permitirLibre()) return '';
    const texto = this.termino().trim();
    if (!texto) return '';
    const yaExiste = (this.opciones() ?? []).some(
      (o) => normalizar(o.etiqueta) === normalizar(texto) || normalizar(o.valor) === normalizar(texto),
    );
    return yaExiste ? '' : texto;
  });

  /**
   * El valor seleccionado puede no estar en `opciones` (por ejemplo un valor
   * libre, o uno restaurado de la URL). Se anade como opcion fantasma para que
   * `mat-select` sepa pintarlo.
   */
  readonly valorFueraDeLista = computed<string>(() => {
    const actual = this.valor();
    if (!actual) return '';
    const existe = (this.opciones() ?? []).some((o) => o.valor === actual);
    return existe ? '' : actual;
  });

  // ── ControlValueAccessor ──────────────────────────────────────────────

  private alCambiar: (valor: string) => void = () => undefined;
  private alTocar: () => void = () => undefined;

  writeValue(valor: string | null | undefined): void {
    this.valor.set(valor === null || valor === undefined ? '' : String(valor));
  }

  registerOnChange(fn: (valor: string) => void): void {
    this.alCambiar = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.alTocar = fn;
  }

  setDisabledState(deshabilitado: boolean): void {
    this.deshabilitadoCva.set(deshabilitado);
  }

  // ── Interaccion ───────────────────────────────────────────────────────

  seleccionar(valor: string): void {
    const limpio = (valor ?? '').toString();
    this.valor.set(limpio);
    this.alCambiar(limpio);
    this.alTocar();
    this.cambio.emit(limpio);
  }

  /** Aplica el texto escrito como valor (opcion "Usar …"). */
  usarValorLibre(): void {
    const libre = this.valorLibre();
    if (!libre) return;
    this.seleccionar(libre);
  }

  alAbrir(): void {
    this.termino.set('');
    // El panel se monta en el overlay: hay que esperar un tick para enfocar.
    queueMicrotask(() => this.campoBusqueda()?.nativeElement.focus());
  }

  alCerrar(): void {
    this.termino.set('');
    this.alTocar();
  }

  alEscribir(evento: Event): void {
    const destino = evento.target as HTMLInputElement | null;
    this.termino.set(destino?.value ?? '');
  }

  /**
   * Evita que `mat-select` interprete las teclas como su typeahead (que moveria
   * la opcion activa y robaria el foco del buscador). Se dejan pasar las teclas
   * de navegacion y cierre.
   */
  alTeclear(evento: KeyboardEvent): void {
    if (evento.key === 'Enter') {
      // Se corta la propagacion para que `mat-select` no seleccione ademas su
      // opcion activa (que casi nunca es la que el usuario esta viendo).
      evento.preventDefault();
      evento.stopPropagation();
      const primera = this.opcionesFiltradas()[0];
      if (primera) this.seleccionar(primera.valor);
      else if (this.valorLibre()) this.usarValorLibre();
      this.select()?.close();
      return;
    }

    if (['ArrowDown', 'ArrowUp', 'Escape', 'Tab'].includes(evento.key)) return;
    evento.stopPropagation();
  }

  limpiar(evento: Event): void {
    evento.stopPropagation();
    this.seleccionar('');
  }
}

/** Minusculas y sin tildes, para que "medellin" encuentre "Medellín". */
function normalizar(texto: string): string {
  return (texto ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
