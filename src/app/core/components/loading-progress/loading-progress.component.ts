import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';

import { LoadingProgressService } from '../../services/loading-progress.service';

/**
 * Hilo de carga global: una línea fina en el borde superior con el avance real.
 *
 * Es el indicador de reserva, no el principal. El desglose 0→100 % vive en la esfera del
 * top bar ({@link ../loading-orb/loading-orb.component}); mientras esa esfera esté montada
 * esta barra no se pinta, porque son el mismo dato. Queda para las pantallas que no tienen
 * top bar —login, formularios públicos—, donde si no no habría ninguna señal de actividad.
 *
 * No bloquea nada: es una línea de 2 px sin eventos. Bloquear la interfaz en cada carga de
 * datos convertiría cada filtro del tablero en una pausa forzada.
 */

/** Espera antes de pintar: una consulta de 150 ms no debe hacer parpadear la línea. */
const RETARDO_APARICION = 220;
/** Tiempo que el 100 % queda visible antes de desaparecer, para que se vea el cierre. */
const RETARDO_CIERRE = 480;
/** Margen para limpiar el registro cuando la línea ni llegó a pintarse. */
const RETARDO_LIMPIEZA = 260;

@Component({
  selector: 'app-loading-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-progress.component.html',
  styleUrl: './loading-progress.component.css',
})
export class LoadingProgressComponent implements OnDestroy {
  private readonly progreso = inject(LoadingProgressService);

  /** Terminado = no queda nada en vuelo (ver la nota de la esfera: el cierre no se
   *  ata al porcentaje animado, que puede quedarse corto). */
  readonly completo = computed(() => !this.progreso.cargando() && this.progreso.totalPasos() > 0);

  readonly porcentaje = computed(() =>
    this.completo() ? 100 : Math.min(100, this.progreso.porcentaje()),
  );

  private readonly enPantalla = signal(false);
  readonly visible = this.enPantalla.asReadonly();

  private timerAparicion: ReturnType<typeof setTimeout> | null = null;
  private timerCierre: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      // Con una esfera montada esta barra no pinta NI limpia: un solo dueño del
      // reinicio evita que un temporizador le vacíe la lista al otro a media
      // animación de cierre.
      if (this.progreso.orbeAnclado()) {
        this.cancelar('aparicion');
        this.cancelar('cierre');
        this.enPantalla.set(false);
        return;
      }

      if (this.progreso.cargando()) {
        this.cancelar('cierre');
        if (!this.enPantalla() && this.timerAparicion === null) {
          this.timerAparicion = setTimeout(() => {
            this.timerAparicion = null;
            if (this.progreso.cargando()) this.enPantalla.set(true);
          }, RETARDO_APARICION);
        }
        return;
      }

      this.cancelar('aparicion');

      // Igual que en la esfera: se limpia aunque la línea no llegara a pintarse.
      if (this.progreso.totalPasos() > 0 && this.timerCierre === null) {
        const espera = this.enPantalla() ? RETARDO_CIERRE : RETARDO_LIMPIEZA;
        this.timerCierre = setTimeout(() => {
          this.timerCierre = null;
          this.enPantalla.set(false);
          this.progreso.reiniciar();
        }, espera);
      }
    });
  }

  ngOnDestroy(): void {
    this.cancelar('aparicion');
    this.cancelar('cierre');
  }

  private cancelar(cual: 'aparicion' | 'cierre'): void {
    if (cual === 'aparicion' && this.timerAparicion !== null) {
      clearTimeout(this.timerAparicion);
      this.timerAparicion = null;
    }
    if (cual === 'cierre' && this.timerCierre !== null) {
      clearTimeout(this.timerCierre);
      this.timerCierre = null;
    }
  }
}
