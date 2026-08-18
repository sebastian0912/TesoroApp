import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable, finalize } from 'rxjs';
import Swal from 'sweetalert2';

import { FieldRendererComponent } from '@/app/shared/components/forms/field-renderer/field-renderer.component';
import {
  ApiProblem,
  DocumentRef,
  DynamicField,
  FieldValue,
  FormSection,
  FormStructure,
  SubmissionCreateRequest,
  SubmissionPayload,
  validateFieldValue,
} from '../../models/dynamic-forms.models';
import { DynamicFormService } from '../../services/dynamic-form.service';
import { SubmissionService } from '../../services/submission.service';
import { MediaOffloadService } from '../../services/media-offload.service';

/** Estado de carga de la estructura del formulario. */
type EstadoCarga = 'cargando' | 'listo' | 'error';

/**
 * RUNTIME DE LLENADO — ruta `llenar/:formId`.
 *
 * Carga la estructura PUBLICADA del formulario y la pinta por secciones en una
 * grilla de 2 columnas (1 en móvil) usando SIEMPRE app-field-renderer en modo
 * 'preview' (los componentes de campo concretos son detalle del motor de render).
 *
 * Los hijos de una SECTION escriben PLANO en la misma sección (vía childChange),
 * exactamente como los espera el payload del backend. La media queda subida a
 * ms-documents ANTES del submit (uploadFn inyectada): el payload solo lleva
 * referencias; si hay subidas en vuelo el envío se bloquea con mensaje claro.
 */
@Component({
  selector: 'app-form-runtime',
  standalone: true,
  imports: [FieldRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-runtime.component.html',
  styleUrls: ['./form-runtime.component.css'],
})
export class FormRuntimeComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  private forms = inject(DynamicFormService);
  private submissions = inject(SubmissionService);
  private media = inject(MediaOffloadService);
  private snack = inject(MatSnackBar);

  readonly structure = signal<FormStructure | null>(null);
  readonly estado = signal<EstadoCarga>('cargando');
  readonly errorCarga = signal<string>('');

  /** { [codigoSeccion]: { [nombreCampo]: valor } } — plano por sección, inmutable. */
  readonly values = signal<Record<string, Record<string, FieldValue>>>({});
  readonly showErrors = signal(false);

  readonly enviando = signal(false);
  readonly guardandoBorrador = signal(false);
  readonly enviado = signal(false);
  /** Id del borrador ya persistido; los siguientes guardados/envíos lo reutilizan. */
  readonly draftId = signal<number | null>(null);
  /** Subidas de media EN VUELO (bloquean envío y borrador para no perder referencias). */
  readonly subiendo = signal(0);

  private formId = 0;

  /** Sube a ms-documents y lleva la cuenta de subidas en vuelo (fail-closed en submit). */
  readonly uploadFn = (file: File): Observable<DocumentRef> => {
    this.subiendo.update(n => n + 1);
    return this.media
      .upload(file, this.formId)
      .pipe(finalize(() => this.subiendo.update(n => Math.max(0, n - 1))));
  };

  readonly downloadUrlFn = (ref: DocumentRef): string => this.media.downloadUrl(ref);

  constructor() {
    // El componente se reusa si se navega entre `llenar/:formId` distintos.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe(pm => {
      const id = Number(pm.get('formId'));
      this.formId = Number.isFinite(id) && id > 0 ? id : 0;
      this.reiniciar();
      this.structure.set(null);
      this.cargar();
    });
  }

  // ── Carga de estructura ─────────────────────────────────────────────

  recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    if (!this.formId) {
      this.errorCarga.set('El identificador del formulario no es válido.');
      this.estado.set('error');
      return;
    }
    this.estado.set('cargando');
    this.forms
      .structure(this.formId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: st => {
          this.structure.set(st);
          this.estado.set('listo');
        },
        error: (err: HttpErrorResponse) => {
          const p = this.comoProblema(err);
          this.errorCarga.set(
            p.detail ?? 'No se pudo cargar el formulario. Verifica que esté publicado e intenta de nuevo.',
          );
          this.estado.set('error');
        },
      });
  }

  // ── Claves y helpers de render ──────────────────────────────────────

  /** Clave de la sección en el payload (el backend siempre publica `code`). */
  sectionKey(sec: FormSection, index: number): string {
    return sec.code ?? `seccion_${index + 1}`;
  }

  /** Clave del campo en el payload — misma regla que el id `df-<name>` de los inputs. */
  fieldKey(f: DynamicField): string {
    return f.name ?? f.label;
  }

  /** Misma regla de ancho completo que aplica el renderer dentro de las SECTION. */
  esAnchoCompleto(f: DynamicField): boolean {
    return (
      f.type === 'TEXT_LONG' ||
      f.type === 'SECTION' ||
      f.schema?.ui?.full_width === true ||
      (f.type === 'MULTIPLE_CHOICE' && (f.schema?.options?.length ?? 0) > 6)
    );
  }

  valorDe(secKey: string, f: DynamicField): FieldValue {
    const seccion = this.values()[secKey];
    return seccion ? seccion[this.fieldKey(f)] ?? null : null;
  }

  /** Valores planos de la sección (los hijos de SECTION viven ahí mismo). */
  seccionValores(secKey: string): Record<string, FieldValue> | null {
    return this.values()[secKey] ?? null;
  }

  /** Escritura inmutable de un valor (campo directo o hijo de SECTION, da igual). */
  setValue(secKey: string, nombre: string, v: FieldValue): void {
    this.values.update(prev => ({
      ...prev,
      [secKey]: { ...(prev[secKey] ?? {}), [nombre]: v },
    }));
  }

  // ── Guardar borrador ────────────────────────────────────────────────

  guardarBorrador(): void {
    const st = this.structure();
    if (!st || this.enviando() || this.guardandoBorrador()) return;
    if (this.subiendo() > 0) {
      this.snack.open('Hay archivos subiéndose todavía; espera a que terminen para guardar.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }
    const req: SubmissionCreateRequest = { status: 'DRAFT', payload: this.construirPayload(st) };
    this.guardandoBorrador.set(true);
    const id = this.draftId();
    const peticion = id != null
      ? this.submissions.updateDraft(id, req)
      : this.submissions.create(st.version.id, req);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: s => {
        this.guardandoBorrador.set(false);
        this.draftId.set(s.id);
        this.snack.open('Borrador guardado', 'Cerrar', { duration: 3000 });
      },
      error: (err: HttpErrorResponse) => {
        this.guardandoBorrador.set(false);
        this.mostrarErrorApi('No se pudo guardar el borrador', err, () => this.guardarBorrador());
      },
    });
  }

  // ── Enviar ──────────────────────────────────────────────────────────

  onSubmit(ev: Event): void {
    ev.preventDefault();
    this.enviar();
  }

  enviar(): void {
    const st = this.structure();
    if (!st || this.enviando() || this.guardandoBorrador()) return;
    if (this.subiendo() > 0) {
      this.snack.open('Hay archivos subiéndose todavía; espera a que terminen para enviar.', 'Cerrar', {
        duration: 4000,
      });
      return;
    }

    // Validación cliente de TODOS los campos (hijos de SECTION aplanados incluidos).
    const invalidos = this.camposInvalidos(st);
    if (invalidos.length > 0) {
      this.showErrors.set(true);
      this.snack.open('Revisa los campos marcados', 'Cerrar', { duration: 4000 });
      this.irAlPrimerInvalido(invalidos);
      return;
    }

    const req: SubmissionCreateRequest = { status: 'SUBMITTED', payload: this.construirPayload(st) };
    this.enviando.set(true);
    const id = this.draftId();
    // Un borrador existente se COMPLETA (updateDraft con SUBMITTED), no se duplica.
    const peticion = id != null
      ? this.submissions.updateDraft(id, req)
      : this.submissions.create(st.version.id, req);
    peticion.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.enviando.set(false);
        this.draftId.set(null);
        this.enviado.set(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        this.mostrarErrorApi('No se pudo enviar la respuesta', err, () => this.enviar());
      },
    });
  }

  /** Pantalla de gracias → limpiar todo y permitir otra respuesta del mismo formulario. */
  enviarOtra(): void {
    this.reiniciar();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  volver(): void {
    void this.router.navigate(['../..'], { relativeTo: this.route });
  }

  // ── Internos ────────────────────────────────────────────────────────

  private reiniciar(): void {
    this.values.set({});
    this.showErrors.set(false);
    this.enviado.set(false);
    this.enviando.set(false);
    this.guardandoBorrador.set(false);
    this.draftId.set(null);
    this.subiendo.set(0);
  }

  /**
   * Nombres (en orden de pantalla) de los campos cuyo valor no pasa
   * validateFieldValue. COMMENT/SECTION no llevan valor y se saltan;
   * los hijos de SECTION se validan aplanados contra la misma sección.
   */
  private camposInvalidos(st: FormStructure): string[] {
    const nombres: string[] = [];
    st.sections.forEach((sec, i) => {
      const actuales = this.values()[this.sectionKey(sec, i)] ?? {};
      const revisar = (f: DynamicField): void => {
        if (f.type === 'COMMENT' || f.type === 'SECTION') return;
        const nombre = this.fieldKey(f);
        if (validateFieldValue(f, actuales[nombre] ?? null) !== null) nombres.push(nombre);
      };
      for (const f of sec.fields) {
        if (f.type === 'SECTION') (f.children ?? []).forEach(revisar);
        else revisar(f);
      }
    });
    return nombres;
  }

  /**
   * Payload = SOLO valores no-null, agrupados por sección; los hijos de SECTION
   * van PLANOS dentro de su sección y los COMMENT no aparecen jamás.
   */
  private construirPayload(st: FormStructure): SubmissionPayload {
    const payload: SubmissionPayload = {};
    st.sections.forEach((sec, i) => {
      const secKey = this.sectionKey(sec, i);
      const actuales = this.values()[secKey] ?? {};
      const grupo: Record<string, FieldValue> = {};
      const agregar = (f: DynamicField): void => {
        if (f.type === 'COMMENT' || f.type === 'SECTION') return;
        const nombre = this.fieldKey(f);
        const v = actuales[nombre] ?? null;
        if (v !== null) grupo[nombre] = v;
      };
      for (const f of sec.fields) {
        if (f.type === 'SECTION') (f.children ?? []).forEach(agregar);
        else agregar(f);
      }
      if (Object.keys(grupo).length > 0) payload[secKey] = grupo;
    });
    return payload;
  }

  /**
   * NUNCA bloquear en silencio: scroll suave y foco al primer campo inválido.
   * Se ancla a la CELDA (id df-anchor-<name>, presente para TODOS los tipos) y no al
   * input, porque dropdown/choice/signature no exponen id=df-<name>. Como respaldo,
   * intenta también el input df-<name> para enfocar el control cuando existe.
   */
  private irAlPrimerInvalido(nombres: string[]): void {
    for (const nombre of nombres) {
      const el = document.getElementById(`df-anchor-${nombre}`) ?? document.getElementById(`df-${nombre}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = document.getElementById(`df-${nombre}`) ?? el;
        try {
          (focusable as HTMLElement).focus({ preventScroll: true });
        } catch {
          /* elemento no enfocable: el scroll ya lo señala */
        }
        return;
      }
    }
  }

  private comoProblema(err: HttpErrorResponse): ApiProblem {
    return err.error && typeof err.error === 'object' ? (err.error as ApiProblem) : {};
  }

  /** Swal con el detail del ProblemDetail + errores por campo (con su etiqueta) y Reintentar. */
  private mostrarErrorApi(titulo: string, err: HttpErrorResponse, reintentar: () => void): void {
    const problema = this.comoProblema(err);
    const detalle = problema.detail ?? 'Ocurrió un error inesperado. Intenta de nuevo.';
    let html = `<p>${this.escapeHtml(detalle)}</p>`;
    const st = this.structure();
    if (problema.errors?.length && st) {
      // El servidor marcó campos: mostramos también los errores en línea.
      this.showErrors.set(true);
      const items = problema.errors
        .map(
          e =>
            `<li><strong>${this.escapeHtml(this.etiquetaDe(st, e.section, e.field))}</strong>: ` +
            `${this.escapeHtml(e.message)}</li>`,
        )
        .join('');
      html += `<ul style="text-align:left;margin:10px 0 0;padding-left:18px">${items}</ul>`;
    }
    void Swal.fire({
      icon: 'error',
      title: titulo,
      html,
      confirmButtonText: 'Reintentar',
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
    }).then(r => {
      if (r.isConfirmed) reintentar();
    });
  }

  /** Etiqueta visible de un campo a partir de (sección, nombre) del error del API. */
  private etiquetaDe(st: FormStructure, seccion: string, campo: string): string {
    for (let i = 0; i < st.sections.length; i++) {
      const sec = st.sections[i];
      if (this.sectionKey(sec, i) !== seccion) continue;
      for (const f of sec.fields) {
        if (this.fieldKey(f) === campo) return f.label;
        if (f.type === 'SECTION') {
          const hijo = (f.children ?? []).find(c => this.fieldKey(c) === campo);
          if (hijo) return hijo.label;
        }
      }
    }
    return campo;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
