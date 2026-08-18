import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import Swal from 'sweetalert2';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule, MatButtonToggleChange } from '@angular/material/button-toggle';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { environment } from '@/environments/environment';
import { DynamicFormService } from '../../services/dynamic-form.service';
import { PlacementService } from '../../services/placement.service';
import { ApiProblem, FormDetail, FormSummary } from '../../models/dynamic-forms.models';
import { Placement, PlacementStatus } from '../../models/placement.models';
import { PublicLinksDialogComponent, PublicLinksDialogData } from '../../components/public-links-dialog/public-links-dialog.component';
import { PlacementDialogComponent, PlacementDialogData } from '../../components/placement-dialog/placement-dialog.component';
import { leerUsuarioCrudo } from '@/app/core/utils/usuario-actual';
import { setLocalStorageItem } from '@/app/core/utils/safe-storage';

/** Filtro de estado del listado. `todos` no manda el parámetro `active`. */
type FiltroEstado = 'todos' | 'activos' | 'inactivos';

/** Filtro solo-cliente por estado de ubicación en el menú. */
type FiltroUbic = 'todos' | PlacementStatus;

/**
 * True si el usuario logueado puede borrar DEFINITIVAMENTE un formulario.
 * El rol vive en `localStorage["user"].rol` con dos shapes conocidos:
 * string plano ("ADMIN") u objeto `{id, nombre}` (login / UsuarioDetailSerializer).
 */
function calcularEsAdmin(): boolean {
  const user = leerUsuarioCrudo();
  const rol: unknown = user?.['rol'];
  let nombre = '';
  if (typeof rol === 'string') nombre = rol;
  else if (rol && typeof rol === 'object') nombre = String((rol as Record<string, unknown>)['nombre'] ?? '');
  const limpio = nombre.trim().toUpperCase();
  return limpio === 'ADMIN' || limpio === 'GERENCIA';
}

/**
 * FORMULARIOS DINÁMICOS — listado y administración.
 *
 * Puerta de entrada del submódulo: buscar/filtrar formularios (paginación en el
 * servidor), entrar a llenarlos, ver respuestas y analítica, editar la estructura
 * (crea versión nueva), gestionar links públicos, duplicar, activar/desactivar y
 * —solo ADMIN/GERENCIA— borrar definitivo.
 *
 * Ubicación en el menú: la columna "Ubicación" muestra el `placement_status`
 * (LINKED/PENDING/UNLINKED/FAILED) y las acciones Publicar / Mover-Renombrar /
 * Desvincular / Reintentar según ese estado.
 */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-forms-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatCardModule, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule,
    MatFormFieldModule, MatInputModule, MatButtonToggleModule, MatPaginatorModule,
    MatProgressBarModule, MatSnackBarModule, MatDialogModule,
  ],
  templateUrl: './forms-list.component.html',
  styleUrl: './forms-list.component.css',
})
export class FormsListComponent {
  private svc = inject(DynamicFormService);
  private placementSvc = inject(PlacementService);
  private http = inject(HttpClient);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  /** Base ABSOLUTA de las rutas del submódulo (coincide con el módulo sembrado en db_admin). */
  readonly base = '/dashboard/gestion-del-programa/formularios-dinamicos';

  /** Solo ADMIN/GERENCIA ven el borrado definitivo. Se calcula una vez por sesión de la vista. */
  readonly esAdmin = calcularEsAdmin();

  // La app corre ZONELESS: todo estado que pinte la vista va en signals.
  readonly rows = signal<FormSummary[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly size = signal(25);
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly filtro = signal<FiltroEstado>('todos');
  /** Filtro solo-cliente por estado de ubicación (sobre la página ya cargada). */
  readonly filtroUbic = signal<FiltroUbic>('todos');
  /** Id de la fila con una acción en curso (deshabilita sus botones). */
  readonly busyId = signal<number | null>(null);

  /** Filas visibles tras aplicar el filtro de ubicación en cliente. */
  readonly filasVisibles = computed<FormSummary[]>(() => {
    const f = this.filtroUbic();
    if (f === 'todos') return this.rows();
    return this.rows().filter(r => this.estadoUbic(r) === f);
  });
  /** Texto de búsqueda YA aplicado (el input escribe en `buscar$`, no aquí). */
  private readonly q = signal('');

  /** Búsqueda con debounce: se dispara sola 350 ms después de dejar de teclear. */
  private readonly buscar$ = new Subject<string>();

  constructor() {
    this.buscar$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(texto => {
        this.q.set(texto);
        this.page.set(0);
        this.cargar();
      });
    this.cargar();
  }

  // ── Carga y filtros ─────────────────────────────────────────────────

  cargar(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.svc.list({
      q: this.q(),
      active: this.activeParam(),
      page: this.page(),
      size: this.size(),
    }).subscribe({
      next: r => {
        this.rows.set(r.content);
        this.total.set(r.total);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.loadError.set(true);
        this.snack.open(this.mensajeError(err, 'No se pudo cargar el listado de formularios'), 'Cerrar', { duration: 5000 });
      },
    });
  }

  onSearchInput(texto: string): void {
    this.buscar$.next(texto);
  }

  setFiltro(e: MatButtonToggleChange): void {
    const v = e.value as FiltroEstado;
    this.filtro.set(v);
    this.page.set(0);
    this.cargar();
  }

  onPage(e: PageEvent): void {
    this.page.set(e.pageIndex);
    this.size.set(e.pageSize);
    this.cargar();
  }

  private activeParam(): boolean | null {
    switch (this.filtro()) {
      case 'activos': return true;
      case 'inactivos': return false;
      default: return null;
    }
  }

  // ── Ubicación en el menú ────────────────────────────────────────────

  /** Estado de ubicación efectivo: un summary sin dato se trata como PENDING. */
  estadoUbic(f: FormSummary): PlacementStatus {
    return f.placement_status ?? 'PENDING';
  }

  /** Etiqueta legible del estado de ubicación (para el badge). */
  ubicEtiqueta(f: FormSummary): string {
    switch (this.estadoUbic(f)) {
      case 'LINKED': return 'Publicado';
      case 'UNLINKED': return 'Desvinculado';
      case 'FAILED': return 'Error';
      default: return 'Pendiente';
    }
  }

  setFiltroUbic(e: MatButtonToggleChange): void {
    this.filtroUbic.set(e.value as FiltroUbic);
  }

  /** Publicar en el menú (PENDING/UNLINKED) → diálogo de ubicación en modo publish. */
  publicar(f: FormSummary): void {
    if (this.estadoUbic(f) === 'LINKED') return;
    this.abrirDialogoUbicacion(f, 'publish');
  }

  /** Mover / renombrar / reordenar (LINKED) → diálogo en modo move. */
  moverRenombrar(f: FormSummary): void {
    if (this.estadoUbic(f) !== 'LINKED') return;
    this.abrirDialogoUbicacion(f, 'move');
  }

  /**
   * Carga la ubicación actual (para precargar el diálogo) y lo abre. Al cerrar
   * con éxito, refresca el menú lateral en caliente.
   */
  private abrirDialogoUbicacion(f: FormSummary, mode: 'publish' | 'move'): void {
    if (this.busyId() !== null) return;
    this.busyId.set(f.id);
    this.placementSvc.getPlacement(f.id).subscribe({
      next: current => { this.busyId.set(null); this.lanzarDialogoUbicacion(f, mode, current); },
      error: () => {
        this.busyId.set(null);
        if (mode === 'publish') {
          // Sin ubicación previa legible: se publica desde cero.
          this.lanzarDialogoUbicacion(f, mode, undefined);
        } else {
          this.snack.open('No se pudo cargar la ubicación actual del formulario.', 'Cerrar', { duration: 5000 });
        }
      },
    });
  }

  private lanzarDialogoUbicacion(f: FormSummary, mode: 'publish' | 'move', current?: Placement): void {
    const data: PlacementDialogData = { formId: f.id, formName: f.name, current, mode };
    const ref = this.dialog.open(PlacementDialogComponent, {
      data,
      width: '760px',
      maxWidth: '95vw',
      autoFocus: false,
      restoreFocus: true,
    });
    ref.afterClosed().subscribe((res?: Placement) => {
      if (!res) return; // cancelado
      const titulo = mode === 'publish' ? 'Formulario publicado en el menú' : 'Ubicación actualizada';
      void Swal.fire({ icon: 'success', title: titulo, timer: 1400, showConfirmButton: false })
        .then(() => this.refrescarMenuLateralYRecargar());
    });
  }

  /** Desvincular del menú (LINKED): conserva formulario y respuestas. */
  desvincular(f: FormSummary): void {
    if (this.estadoUbic(f) !== 'LINKED' || this.busyId() !== null) return;
    Swal.fire({
      icon: 'warning',
      title: '¿Desvincular del menú?',
      text: `La entrada de "${f.name}" se quitará del menú. El formulario y sus respuestas se conservan; podrás volver a publicarlo cuando quieras.`,
      showCancelButton: true,
      confirmButtonText: 'Desvincular',
      cancelButtonText: 'Cancelar',
    }).then(res => {
      if (!res.isConfirmed) return;
      this.busyId.set(f.id);
      this.placementSvc.unlink(f.id).subscribe({
        next: () => {
          this.busyId.set(null);
          void Swal.fire({ icon: 'success', title: 'Formulario desvinculado', timer: 1400, showConfirmButton: false })
            .then(() => this.refrescarMenuLateralYRecargar());
        },
        error: (err: unknown) => {
          this.busyId.set(null);
          this.snack.open(this.mensajeError(err, 'No se pudo desvincular el formulario'), 'Cerrar', { duration: 5000 });
        },
      });
    });
  }

  /** Reintentar (FAILED): reconcilia el estado real en ms-auth-admin. */
  reintentarUbicacion(f: FormSummary): void {
    if (this.estadoUbic(f) !== 'FAILED' || this.busyId() !== null) return;
    this.busyId.set(f.id);
    this.placementSvc.retry(f.id).subscribe({
      next: p => {
        this.busyId.set(null);
        const conAvisos = (p.warnings?.length ?? 0) > 0;
        if (p.placement_status === 'FAILED' || conAvisos) {
          const items = (p.warnings ?? []).map(w => `<li>${this.esc(w)}</li>`).join('');
          const detalle = p.placement_error ? `<p>${this.esc(p.placement_error)}</p>` : '';
          void Swal.fire({
            icon: 'error',
            title: 'La ubicación sigue en error',
            html: `${detalle}${items ? `<ul style="text-align:left;margin:8px 0 0;padding-left:18px">${items}</ul>` : ''}`
              || 'El reintento no completó. Intenta de nuevo más tarde.',
            confirmButtonText: 'Entendido',
          });
        } else {
          void Swal.fire({ icon: 'success', title: 'Ubicación reconciliada', timer: 1400, showConfirmButton: false })
            .then(() => this.refrescarMenuLateralYRecargar());
        }
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        void Swal.fire({
          icon: 'error',
          title: 'No se pudo reintentar',
          text: this.mensajeError(err, 'El servidor rechazó el reintento de ubicación.'),
          confirmButtonText: 'Cerrar',
        });
      },
    });
  }

  /**
   * Refresca el menú lateral EN CALIENTE (sin cerrar sesión) tras un cambio de
   * ubicación. El sidebar (navbar.component.ts) construye el menú desde
   * `localStorage["user"].permisos_tree`, que sólo relee en su ngOnInit /
   * refreshPermisos(); no hay canal para empujarle un refresco desde aquí sin
   * tocar ese componente (fuera del alcance de este cambio). Así que replicamos
   * su mismo GET (/gestion_admin/usuarios/{id}/), reescribimos 'user' con el
   * árbol nuevo y recargamos la página: el navbar se reinstancia y ya pinta el
   * módulo recién publicado/movido/desvinculado. Si el GET falla, recargamos
   * igual — el propio refreshPermisos() del navbar hará el fetch al reiniciar.
   */
  private refrescarMenuLateralYRecargar(): void {
    const recargar = () => { if (typeof window !== 'undefined') window.location.reload(); };
    const user = leerUsuarioCrudo();
    const idCrudo = user?.['id'];
    const userId = idCrudo != null ? String(idCrudo) : '';
    if (!userId) { recargar(); return; }
    const apiUrl = environment.apiUrl.replace(/\/+$/, '');
    this.http.get<unknown>(`${apiUrl}/gestion_admin/usuarios/${userId}/`).subscribe({
      next: resp => { setLocalStorageItem('user', JSON.stringify(resp)); recargar(); },
      error: () => recargar(),
    });
  }

  /** Escapa texto que va dentro del html de un Swal. */
  private esc(s: string): string {
    const mapa: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return s.replace(/[&<>"']/g, c => mapa[c] ?? c);
  }

  // ── Acciones por fila ───────────────────────────────────────────────

  abrirLinksPublicos(f: FormSummary): void {
    const data: PublicLinksDialogData = { formId: f.id, formName: f.name };
    this.dialog.open(PublicLinksDialogComponent, {
      data,
      width: '680px',
      maxWidth: '95vw',
      autoFocus: false,
      restoreFocus: true,
    });
  }

  duplicar(f: FormSummary): void {
    if (this.busyId() !== null) return;
    Swal.fire({
      icon: 'question',
      title: '¿Duplicar formulario?',
      text: `Se creará una copia de "${f.name}" con su estructura vigente (sin respuestas ni links públicos).`,
      showCancelButton: true,
      confirmButtonText: 'Duplicar',
      cancelButtonText: 'Cancelar',
    }).then(res => {
      if (!res.isConfirmed) return;
      this.busyId.set(f.id);
      this.svc.duplicate(f.id).subscribe({
        next: (copia: FormDetail) => {
          this.busyId.set(null);
          // La copia nace sin ubicar (PENDING): se publica luego desde su fila.
          this.snack.open(
            `Formulario duplicado como "${copia.name}". Publícalo en el menú desde su fila.`,
            'Cerrar', { duration: 5000 });
          this.cargar();
        },
        error: (err: unknown) => {
          this.busyId.set(null);
          this.snack.open(this.mensajeError(err, 'No se pudo duplicar el formulario'), 'Cerrar', { duration: 5000 });
        },
      });
    });
  }

  /** Desactivar = borrado lógico (con confirmación); activar = PATCH active. */
  toggleActivo(f: FormSummary): void {
    if (this.busyId() !== null) return;
    if (f.active) {
      Swal.fire({
        icon: 'warning',
        title: '¿Desactivar formulario?',
        text: `"${f.name}" dejará de estar disponible para llenado; las respuestas ya guardadas se conservan y podrás reactivarlo cuando quieras.`,
        showCancelButton: true,
        confirmButtonText: 'Desactivar',
        cancelButtonText: 'Cancelar',
      }).then(res => {
        if (!res.isConfirmed) return;
        this.busyId.set(f.id);
        this.svc.softDelete(f.id).subscribe({
          next: () => {
            this.busyId.set(null);
            this.snack.open('Formulario desactivado', 'Cerrar', { duration: 4000 });
            this.cargar();
          },
          error: (err: unknown) => {
            this.busyId.set(null);
            this.snack.open(this.mensajeError(err, 'No se pudo desactivar el formulario'), 'Cerrar', { duration: 5000 });
          },
        });
      });
    } else {
      this.busyId.set(f.id);
      this.svc.patch(f.id, { active: true }).subscribe({
        next: () => {
          this.busyId.set(null);
          this.snack.open('Formulario activado', 'Cerrar', { duration: 4000 });
          this.cargar();
        },
        error: (err: unknown) => {
          this.busyId.set(null);
          this.snack.open(this.mensajeError(err, 'No se pudo activar el formulario'), 'Cerrar', { duration: 5000 });
        },
      });
    }
  }

  /**
   * Borrado DEFINITIVO (solo ADMIN/GERENCIA): irreversible, se lleva estructura,
   * versiones y respuestas. Doble confirmación: aviso + escribir "ELIMINAR".
   */
  eliminarDefinitivo(f: FormSummary): void {
    if (!this.esAdmin || this.busyId() !== null) return;
    Swal.fire({
      icon: 'warning',
      title: 'Eliminar definitivamente',
      html: `Vas a borrar <b>"${f.name}"</b> con sus versiones y sus `
        + `<b>${f.submissions_count}</b> respuesta(s).<br>Esta acción <b>no se puede deshacer</b>.`,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#b42318',
    }).then(paso1 => {
      if (!paso1.isConfirmed) return;
      Swal.fire({
        icon: 'error',
        title: 'Confirmación final',
        text: 'Escribe ELIMINAR (en mayúsculas) para confirmar el borrado definitivo.',
        input: 'text',
        inputPlaceholder: 'ELIMINAR',
        inputAttributes: { autocomplete: 'off', 'aria-label': 'Escribe ELIMINAR para confirmar' },
        showCancelButton: true,
        confirmButtonText: 'Eliminar definitivo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#b42318',
        preConfirm: (valor: string) => {
          if (valor !== 'ELIMINAR') {
            Swal.showValidationMessage('Debes escribir exactamente ELIMINAR');
            return false;
          }
          return true;
        },
      }).then(paso2 => {
        if (!paso2.isConfirmed) return;
        this.busyId.set(f.id);
        this.svc.hardDelete(f.id).subscribe({
          next: () => {
            this.busyId.set(null);
            this.snack.open(`Formulario "${f.name}" eliminado definitivamente`, 'Cerrar', { duration: 5000 });
            this.cargar();
          },
          error: (err: unknown) => {
            this.busyId.set(null);
            Swal.fire({
              icon: 'error',
              title: 'No se pudo eliminar',
              text: this.mensajeError(err, 'El servidor rechazó el borrado definitivo.'),
              confirmButtonText: 'Cerrar',
            });
          },
        });
      });
    });
  }

  // ── Utilidades ──────────────────────────────────────────────────────

  /** Extrae el `detail` del ProblemDetail RFC 7807 del backend; si no, el texto por defecto. */
  private mensajeError(err: unknown, porDefecto: string): string {
    if (err instanceof HttpErrorResponse) {
      const p = err.error as ApiProblem | null;
      if (p && typeof p === 'object' && typeof p.detail === 'string' && p.detail) return p.detail;
    }
    return porDefecto;
  }
}
