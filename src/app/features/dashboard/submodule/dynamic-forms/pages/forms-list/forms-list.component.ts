import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
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

import { DynamicFormService } from '../../services/dynamic-form.service';
import { ApiProblem, FormDetail, FormSummary, ProvisioningResult } from '../../models/dynamic-forms.models';
import { PublicLinksDialogComponent, PublicLinksDialogData } from '../../components/public-links-dialog/public-links-dialog.component';
import { leerUsuarioCrudo } from '@/app/core/utils/usuario-actual';

/** Filtro de estado del listado. `todos` no manda el parámetro `active`. */
type FiltroEstado = 'todos' | 'activos' | 'inactivos';

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
 * Aprovisionamiento de módulos de menú: el listado (FormSummary) NO trae el campo
 * `provisioning` (solo lo devuelven crear/duplicar/reintentar), pero un formulario
 * bien aprovisionado siempre tiene `module_id` Y `responses_module_id`; si falta
 * alguno quedó partial/failed/skipped y se ofrece "Reintentar módulo".
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
  /** Id de la fila con una acción en curso (deshabilita sus botones). */
  readonly busyId = signal<number | null>(null);
  /** Texto de búsqueda YA aplicado (el input escribe en `buscar$`, no aquí). */
  private readonly q = signal('');

  /**
   * Resultado FRESCO de aprovisionar (crear/duplicar/reintentar): pisa la heurística
   * por `module_id` hasta el siguiente refresh del listado.
   */
  private readonly provisioningFresco = signal<ReadonlyMap<number, ProvisioningResult['status']>>(new Map());

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
        // El refresh trae `module_id` actualizado: la heurística vuelve a mandar.
        this.provisioningFresco.set(new Map());
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

  // ── Aprovisionamiento de módulos ────────────────────────────────────

  /**
   * True si el formulario quedó con el aprovisionamiento a medias (partial/failed/
   * skipped). Ver nota de la clase: el summary no trae `provisioning`, se deduce de
   * los ids de módulo; un resultado fresco de reintentar tiene prioridad.
   */
  provisioningIncompleto(f: FormSummary): boolean {
    const fresco = this.provisioningFresco().get(f.id);
    if (fresco) return fresco !== 'ok';
    return !f.module_id || !f.responses_module_id;
  }

  reintentarModulo(f: FormSummary): void {
    if (this.busyId() !== null) return;
    this.busyId.set(f.id);
    this.svc.provisionRetry(f.id).subscribe({
      next: r => {
        this.busyId.set(null);
        const mapa = new Map(this.provisioningFresco());
        mapa.set(f.id, r.status);
        this.provisioningFresco.set(mapa);
        if (r.status === 'ok') {
          this.snack.open('Módulo de menú aprovisionado correctamente', 'Cerrar', { duration: 4000 });
          this.cargar();
        } else {
          const avisos = (r.warnings ?? []).join('\n');
          Swal.fire({
            icon: 'warning',
            title: 'El módulo sigue incompleto',
            text: avisos || `El aprovisionamiento terminó en estado "${r.status}". Intenta de nuevo más tarde.`,
            confirmButtonText: 'Entendido',
          });
        }
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.snack.open(this.mensajeError(err, 'No se pudo reintentar el aprovisionamiento'), 'Cerrar', { duration: 5000 });
      },
    });
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
          this.snack.open(`Formulario duplicado como "${copia.name}"`, 'Cerrar', { duration: 4000 });
          if (copia.provisioning === 'partial' || copia.provisioning === 'failed') {
            Swal.fire({
              icon: 'warning',
              title: 'Copia creada con módulo incompleto',
              text: 'El formulario se duplicó, pero su módulo de menú no quedó completo. Usa "Reintentar módulo" en la fila nueva.',
              confirmButtonText: 'Entendido',
            });
          }
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
