import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs/operators';

import { PlacementService } from '../../services/placement.service';
import { FormView } from '../../models/placement.models';

import { FormRuntimeComponent } from '../form-runtime/form-runtime.component';
import { FormResponsesComponent } from '../form-responses/form-responses.component';
import { FormAnalyticsComponent } from '../form-analytics/form-analytics.component';
import { FormSupportsComponent } from '../form-supports/form-supports.component';

/** Estado de resolución de la ruta a una vista de formulario. */
type EstadoHost = 'cargando' | 'listo' | 'error';

/**
 * DISPATCHER de vistas de formulario dinámico.
 *
 * Lo carga el catch-all `**` del dashboard (tras el guard que confirma que la URL es un
 * formulario). Resuelve la ruta actual contra el backend (GET /forms/resolve), que
 * devuelve el `form_id`, la `view` ('fill'|'responses'|'supports'|'analytics'), la
 * etiqueta del menú y la ruta canónica. Según la vista monta el componente hijo y le
 * pasa el `form_id` por @Input (así los hijos NO vuelven a resolver la ruta). Un alias
 * antiguo se redirige a la canónica.
 *
 * Se re-resuelve en cada NavigationEnd: cuando el usuario salta entre las 4 vistas del
 * MISMO formulario (o entre formularios distintos) el host se reutiliza sin recrearse,
 * y solo cambian `vista()` y `fid()`.
 */
@Component({
  selector: 'app-form-view-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Solo la vista de LLENADO gobierna su propio alto (cabecera y botones fijos, scroll
  // únicamente en los campos). Respuestas/Soportes/Analítica siguen scrolleando con el
  // wrapper del dashboard, que es como están hechas.
  host: { '[class.fvh-lleno]': 'esLlenado()' },
  imports: [
    FormRuntimeComponent, FormResponsesComponent, FormAnalyticsComponent, FormSupportsComponent,
  ],
  template: `
    @switch (estado()) {
      @case ('cargando') {
        <div class="fvh-estado" role="status" aria-live="polite">
          <span class="fvh-spinner" aria-hidden="true"></span>
          <p>Cargando vista…</p>
        </div>
      }
      @case ('error') {
        <div class="fvh-estado fvh-estado--error" role="alert">
          <span class="material-symbols-outlined" aria-hidden="true">block</span>
          <p>{{ errorMsg() }}</p>
        </div>
      }
      @default {
        @switch (vista()) {
          @case ('responses') { <app-form-responses [formIdInput]="fid()" /> }
          @case ('supports')  { <app-form-supports  [formIdInput]="fid()" /> }
          @case ('analytics') { <app-form-analytics [formIdInput]="fid()" /> }
          @default            { <app-form-runtime   [formIdInput]="fid()" /> }
        }
      }
    }
  `,
  styles: [`
    :host { display: block; }

    /* La vista de llenado llena EXACTAMENTE el wrapper: así el wrapper no scrollea y
       la única barra de la pantalla es la de los campos (antes convivían las dos). */
    :host(.fvh-lleno) {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

    .fvh-estado {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      min-height: 40vh;
      padding: 32px 16px;
      color: var(--muted, #64748b);
      text-align: center;
    }
    .fvh-estado p { margin: 0; font-weight: 600; color: var(--slate-700, #334155); }
    .fvh-estado--error .material-symbols-outlined { font-size: 44px; color: var(--danger, #b42318); }
    .fvh-estado--error p { color: var(--danger, #b42318); }
    .fvh-spinner {
      width: 34px;
      height: 34px;
      border: 3px solid var(--slate-200, #e8edf3);
      border-top-color: var(--navy, #21263c);
      border-radius: 50%;
      animation: fvh-giro 0.8s linear infinite;
    }
    @keyframes fvh-giro { to { transform: rotate(360deg); } }
  `],
})
export class FormViewHostComponent {
  private router = inject(Router);
  private placement = inject(PlacementService);
  private titleService = inject(Title);
  private destroyRef = inject(DestroyRef);

  readonly estado = signal<EstadoHost>('cargando');
  readonly errorMsg = signal<string>('');
  readonly vista = signal<FormView | null>(null);
  readonly fid = signal<number>(0);

  /** true cuando lo montado es el runtime de llenado (vista por defecto del switch). */
  readonly esLlenado = computed(() => {
    if (this.estado() !== 'listo') return false;
    const v = this.vista();
    return v === null || v === 'fill';
  });

  /** Última ruta ya resuelta: evita re-resolver el mismo NavigationEnd. */
  private rutaResuelta = '';

  constructor() {
    this.resolver();
    // Re-resolver al navegar entre vistas del mismo formulario (host reutilizado).
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.resolver());
  }

  private resolver(): void {
    const ruta = this.rutaActual();
    if (!ruta) {
      this.rutaResuelta = ruta;
      this.mostrarError('Esta vista no está disponible.');
      return;
    }
    if (ruta === this.rutaResuelta) return; // ya resuelta esta URL
    this.rutaResuelta = ruta;
    this.estado.set('cargando');

    this.placement.resolveRoute(ruta).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        if (!res || !res.form_id) {
          this.mostrarError('Esta vista no corresponde a ningún formulario disponible.');
          return;
        }
        // Alias antiguo → redirigir a la ruta canónica vigente.
        if (res.canonical_route_path && res.canonical_route_path !== ruta) {
          this.router.navigateByUrl('/dashboard/' + res.canonical_route_path, { replaceUrl: true });
          return;
        }
        this.fid.set(res.form_id);
        this.vista.set(res.view ?? 'fill');
        if (res.menu_label) this.titleService.setTitle(res.menu_label);
        this.estado.set('listo');
      },
      error: () => this.mostrarError('No se pudo cargar la vista. Intenta de nuevo.'),
    });
  }

  private mostrarError(mensaje: string): void {
    this.errorMsg.set(mensaje);
    this.estado.set('error');
  }

  /** URL actual relativa a /dashboard (sin query ni fragment), como espera el backend. */
  private rutaActual(): string {
    let url = this.router.url.split('?')[0].split('#')[0];
    if (url.startsWith('/dashboard/')) url = url.substring('/dashboard/'.length);
    else if (url.startsWith('/')) url = url.substring(1);
    return url.replace(/\/+$/, '');
  }
}
