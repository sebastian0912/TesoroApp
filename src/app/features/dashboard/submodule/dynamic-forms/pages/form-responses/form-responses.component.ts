import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule, formatCurrency, formatNumber } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import Swal from 'sweetalert2';
import { saveAs } from 'file-saver';

import { DynamicFormService } from '../../services/dynamic-form.service';
import { SubmissionService } from '../../services/submission.service';
import {
  ApiProblem,
  FieldType,
  FormDetail,
  FormStructure,
  Submission,
  SubmissionStatus,
  VersionInfo,
  isDocumentRef,
} from '../../models/dynamic-forms.models';

/** Columna derivada de la estructura: un campo escalar pintable en la tabla. */
interface ColumnaEscalar {
  seccion: string;
  nombre: string;
  etiqueta: string;
  tipo: FieldType;
}

/** Tipos de campo que caben en una celda de tabla sin renderer. */
const TIPOS_ESCALARES: ReadonlySet<FieldType> = new Set<FieldType>([
  'TEXT_SHORT', 'NUMBER', 'CURRENCY', 'DATE', 'SINGLE_CHOICE', 'DROPDOWN',
]);

/**
 * Formularios Dinámicos — Listado de respuestas de UN formulario.
 * Ruta: :formId/respuestas
 *
 * Filtra por versión (todas o una concreta) y estado, con paginación
 * server-side. Además de las columnas fijas (id, versión, estado, enviado,
 * usuario) pinta las primeras 3 columnas ESCALARES derivadas de la estructura
 * de la versión filtrada (o la publicada) — nunca hardcodeadas.
 */
@Component({
  selector: 'app-form-responses',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatPaginatorModule,
    MatProgressBarModule, MatSelectModule, MatSnackBarModule, MatTooltipModule,
  ],
  templateUrl: './form-responses.component.html',
  styleUrls: ['./form-responses.component.css'],
})
export class FormResponsesComponent implements OnInit {
  /**
   * Id inyectado por el DISPATCHER (form-view-host). Cuando llega, la vista se
   * inicializa con ese id sin mirar la ruta; el setter también reacciona si el host
   * reutiliza el componente y cambia de formulario. Sin input, se lee `formId` de la
   * ruta clásica :formId/respuestas.
   */
  @Input() set formIdInput(id: number | undefined) {
    if (id != null && Number.isFinite(id) && id > 0) {
      this.idPorInput = id;
      this.inicializar(id);
    }
  }
  private idPorInput?: number;

  private route = inject(ActivatedRoute);
  private destroyRef = inject(DestroyRef);
  private formsSvc = inject(DynamicFormService);
  private submissionsSvc = inject(SubmissionService);
  private snack = inject(MatSnackBar);

  // ── Estado de la página ─────────────────────────────────────────────
  formId = signal<number>(0);
  form = signal<FormDetail | null>(null);
  versiones = signal<VersionInfo[]>([]);
  estructura = signal<FormStructure | null>(null);

  /** null = todas las versiones (listByForm sin `version`). */
  versionFiltro = signal<number | null>(null);
  /** '' = todos los estados. */
  estadoFiltro = signal<SubmissionStatus | ''>('');

  filas = signal<Submission[]>([]);
  total = signal(0);
  pagina = signal(0);
  tamano = signal(25);

  cargando = signal(false);
  exportando = signal(false);
  /** id de la respuesta cuyo cambio de estado está en vuelo (deshabilita sus botones). */
  procesandoId = signal<number | null>(null);

  /** Opciones del filtro de estado (etiquetas en español). */
  readonly ESTADOS: ReadonlyArray<{ valor: SubmissionStatus | ''; etiqueta: string }> = [
    { valor: '', etiqueta: 'Todos los estados' },
    { valor: 'SUBMITTED', etiqueta: 'Enviada' },
    { valor: 'APPROVED', etiqueta: 'Aprobada' },
    { valor: 'REJECTED', etiqueta: 'Rechazada' },
    { valor: 'DRAFT', etiqueta: 'Borrador' },
  ];

  /**
   * Primeras 3 columnas escalares de la estructura filtrada, en orden de
   * sección/campo. Solo campos de primer nivel: el valor vive en
   * payload[seccion][nombre] (los hijos de SECTION no cuelgan ahí).
   */
  columnas = computed<ColumnaEscalar[]>(() => {
    const est = this.estructura();
    if (!est) return [];
    const cols: ColumnaEscalar[] = [];
    const secciones = [...est.sections].sort((a, b) => a.order_no - b.order_no);
    for (const sec of secciones) {
      const codigo = sec.code ?? '';
      if (!codigo) continue;
      const campos = [...sec.fields].sort((a, b) => a.order_no - b.order_no);
      for (const campo of campos) {
        if (!campo.name || !TIPOS_ESCALARES.has(campo.type)) continue;
        cols.push({ seccion: codigo, nombre: campo.name, etiqueta: campo.label, tipo: campo.type });
        if (cols.length === 3) return cols;
      }
    }
    return cols;
  });

  ngOnInit(): void {
    // Con id inyectado por el host, el setter ya inicializó: no se lee la ruta.
    if (this.idPorInput != null) return;
    // El formId llega por la ruta; si cambia (navegación entre formularios) se reinicia todo.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(pm => {
      const id = Number(pm.get('formId'));
      if (!Number.isFinite(id) || id <= 0) return;
      this.inicializar(id);
    });
  }

  /** Reinicia filtros/paginación y carga base, estructura y respuestas del formulario `id`. */
  private inicializar(id: number): void {
    this.formId.set(id);
    this.versionFiltro.set(null);
    this.estadoFiltro.set('');
    this.pagina.set(0);
    this.cargarBase(id);
    this.cargarEstructura();
    this.cargarRespuestas();
  }

  // ── Filtros / paginación ────────────────────────────────────────────

  onVersionChange(valor: number | null): void {
    this.versionFiltro.set(valor);
    this.pagina.set(0);
    this.cargarEstructura(); // las columnas escalares dependen de la versión filtrada
    this.cargarRespuestas();
  }

  onEstadoChange(valor: SubmissionStatus | ''): void {
    this.estadoFiltro.set(valor);
    this.pagina.set(0);
    this.cargarRespuestas();
  }

  onPage(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
    this.tamano.set(evento.pageSize);
    this.cargarRespuestas();
  }

  // ── Carga de datos ──────────────────────────────────────────────────

  private cargarBase(id: number): void {
    this.formsSvc.get(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: f => this.form.set(f),
        error: () => this.snack.open('No se pudo cargar el formulario.', 'Cerrar', { duration: 4000 }),
      });
    this.formsSvc.versions(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: vs => this.versiones.set([...vs].sort((a, b) => b.version - a.version)),
        error: () => this.versiones.set([]),
      });
  }

  /** Estructura de la versión filtrada; sin filtro, la publicada vigente. */
  private cargarEstructura(): void {
    const id = this.formId();
    if (!id) return;
    this.formsSvc.structure(id, this.versionFiltro() ?? undefined)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: est => this.estructura.set(est),
        // Sin versión publicada la tabla simplemente no pinta columnas de campos.
        error: () => this.estructura.set(null),
      });
  }

  private cargarRespuestas(): void {
    const id = this.formId();
    if (!id) return;
    this.cargando.set(true);
    this.submissionsSvc.listByForm(id, {
      version: this.versionFiltro() ?? undefined,
      status: this.estadoFiltro() || undefined,
      page: this.pagina(),
      size: this.tamano(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: pag => {
          this.filas.set(pag.content);
          this.total.set(pag.total);
          this.cargando.set(false);
        },
        error: async err => {
          this.cargando.set(false);
          this.filas.set([]);
          this.total.set(0);
          this.snack.open(
            await this.mensajeProblema(err, 'No se pudieron cargar las respuestas.'),
            'Cerrar', { duration: 5000 },
          );
        },
      });
  }

  // ── Celdas ──────────────────────────────────────────────────────────

  estadoEtiqueta(estado: SubmissionStatus): string {
    const opcion = this.ESTADOS.find(e => e.valor === estado);
    return opcion?.etiqueta ?? estado;
  }

  /** badge--submitted | badge--approved | badge--rejected | badge--draft (ver CSS). */
  estadoClase(estado: SubmissionStatus): string {
    return `badge badge--${estado.toLowerCase()}`;
  }

  usuarioDe(fila: Submission): string {
    if (fila.created_by) return fila.created_by;
    return fila.public_link_id != null ? 'anónimo (link)' : '—';
  }

  /** Valor de una columna escalar: payload[seccion][nombre], formateado por TIPO. */
  valorCelda(fila: Submission, col: ColumnaEscalar): string {
    const valor = fila.payload?.[col.seccion]?.[col.nombre] ?? null;
    if (valor == null || (typeof valor === 'string' && valor.trim() === '')) return '—';
    if (Array.isArray(valor)) {
      const partes = (valor as unknown[]).map(v =>
        isDocumentRef(v) ? v.filename : this.formatoEscalar(String(v), col.tipo));
      return partes.length ? partes.join('; ') : '—';
    }
    if (isDocumentRef(valor)) return valor.filename;
    if (typeof valor === 'object') return '—'; // p. ej. LOCATION: no es escalar, no debería llegar
    return this.formatoEscalar(valor, col.tipo);
  }

  /** Formato es-CO por tipo: fecha dd/MM/yyyy, moneda COP, número con miles. */
  private formatoEscalar(valor: string | number, tipo: FieldType): string {
    switch (tipo) {
      case 'DATE': {
        const m = String(valor).match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return m ? `${m[3]}/${m[2]}/${m[1]}` : String(valor);
      }
      case 'CURRENCY': {
        const n = typeof valor === 'number' ? valor : Number(valor);
        return Number.isFinite(n) ? formatCurrency(n, 'es-CO', '$', 'COP', '1.0-0') : String(valor);
      }
      case 'NUMBER': {
        const n = typeof valor === 'number' ? valor : Number(valor);
        return Number.isFinite(n) ? formatNumber(n, 'es-CO') : String(valor);
      }
      default:
        return String(valor);
    }
  }

  // ── Acciones ────────────────────────────────────────────────────────

  /** SUBMITTED → APPROVED | REJECTED, con confirmación y refresco de la página actual. */
  async cambiarEstado(fila: Submission, destino: 'APPROVED' | 'REJECTED'): Promise<void> {
    const aprobar = destino === 'APPROVED';
    const res = await Swal.fire({
      title: aprobar ? '¿Aprobar respuesta?' : '¿Rechazar respuesta?',
      text: `La respuesta #${fila.id} quedará en estado ${aprobar ? 'Aprobada' : 'Rechazada'}.`,
      icon: aprobar ? 'question' : 'warning',
      showCancelButton: true,
      confirmButtonText: aprobar ? 'Sí, aprobar' : 'Sí, rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: aprobar ? '#0f766e' : '#b42318',
    });
    if (!res.isConfirmed) return;

    this.procesandoId.set(fila.id);
    this.submissionsSvc.changeStatus(fila.id, destino)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.procesandoId.set(null);
          this.snack.open(aprobar ? 'Respuesta aprobada.' : 'Respuesta rechazada.', 'Cerrar', { duration: 3500 });
          this.cargarRespuestas();
        },
        error: async err => {
          this.procesandoId.set(null);
          Swal.fire('Error', await this.mensajeProblema(err, 'No se pudo cambiar el estado de la respuesta.'), 'error');
        },
      });
  }

  /** Excel del backend con los filtros vigentes; nombre desde Content-Disposition. */
  exportarExcel(): void {
    const id = this.formId();
    if (!id || this.exportando()) return;
    this.exportando.set(true);
    this.formsSvc.exportXlsx(id, {
      version: this.versionFiltro() ?? undefined,
      status: this.estadoFiltro() || undefined,
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: resp => {
          this.exportando.set(false);
          const blob = resp.body;
          if (!blob) {
            Swal.fire('Error', 'El servidor no devolvió el archivo.', 'error');
            return;
          }
          const cd = resp.headers.get('Content-Disposition') || '';
          const m = cd.match(/filename\*=UTF-8''([^;]+)/i) || cd.match(/filename="?([^";]+)"?/i);
          const nombre = m
            ? decodeURIComponent(m[1])
            : `Respuestas_${this.form()?.code ?? id}.xlsx`;
          saveAs(blob, nombre);
          this.snack.open('Excel descargado.', 'Cerrar', { duration: 3000 });
        },
        error: async err => {
          this.exportando.set(false);
          Swal.fire('Error', await this.mensajeProblema(err, 'No se pudo exportar el Excel.'), 'error');
        },
      });
  }

  // ── Errores del API ─────────────────────────────────────────────────

  /**
   * Extrae el `detail` del ProblemDetail (RFC 7807). En descargas blob el
   * cuerpo del error también llega como Blob y hay que parsearlo.
   */
  private async mensajeProblema(err: unknown, porDefecto: string): Promise<string> {
    const e = err as HttpErrorResponse;
    let cuerpo: unknown = e?.error;
    if (cuerpo instanceof Blob) {
      try { cuerpo = JSON.parse(await cuerpo.text()); } catch { cuerpo = null; }
    }
    const problema = cuerpo as ApiProblem | null;
    return problema?.detail || porDefecto;
  }
}
