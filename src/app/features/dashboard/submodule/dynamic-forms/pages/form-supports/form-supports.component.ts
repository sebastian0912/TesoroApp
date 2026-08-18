import {
  ChangeDetectionStrategy, Component, DestroyRef, Input, OnDestroy, OnInit, computed, inject, signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { saveAs } from 'file-saver';

import { environment } from '@/environments/environment';
import { DynamicFormService } from '../../services/dynamic-form.service';
import { ApiProblem } from '../../models/dynamic-forms.models';
import { SupportFile } from '../../models/placement.models';

/** Categoría visual del archivo, derivada del mime_type. */
type CategoriaMime = 'imagen' | 'pdf' | 'excel' | 'word' | 'otro';
/** Valor del filtro de tipo (todos + categorías). */
type FiltroTipo = 'todos' | CategoriaMime;

/**
 * SOPORTES — archivos adjuntos de las respuestas de un formulario.
 * Ruta canónica: {ruta_base}/soportes (vía dispatcher) · compat: :formId/soportes.
 *
 * Lista los documentos subidos en los campos de tipo archivo (PHOTO/FILE/…) de todas
 * las respuestas, paginados en el servidor. La descarga es AUTENTICADA: el gateway
 * exige JWT en /api/v1/documents/**, así que NO se usa <a href> directo; se baja el
 * blob con HttpClient (el auth.interceptor añade el token) y se guarda con file-saver.
 * Las miniaturas de imagen se bajan igual como blob y se muestran con object URL,
 * revocado al destruir el componente.
 */
@Component({
  selector: 'app-form-supports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatCardModule, MatFormFieldModule, MatSelectModule,
    MatPaginatorModule, MatProgressBarModule, MatTooltipModule, MatSnackBarModule,
  ],
  templateUrl: './form-supports.component.html',
  styleUrls: ['./form-supports.component.css'],
})
export class FormSupportsComponent implements OnInit, OnDestroy {
  /**
   * Id inyectado por el DISPATCHER (form-view-host); reacciona también si el host
   * reutiliza el componente para otro formulario. Sin input, se lee de la ruta
   * clásica :formId/soportes.
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
  private http = inject(HttpClient);
  private formsSvc = inject(DynamicFormService);
  private snack = inject(MatSnackBar);

  /** Base absoluta del submódulo (para enlazar la respuesta origen a su detalle). */
  readonly baseListado = '/dashboard/gestion-del-programa/formularios-dinamicos';

  // ── Estado ──────────────────────────────────────────────────────────
  readonly formId = signal<number>(0);
  readonly cargando = signal(false);
  readonly error = signal<string | null>(null);
  readonly filas = signal<SupportFile[]>([]);
  readonly total = signal(0);
  readonly pagina = signal(0);
  readonly tamano = signal(24);
  readonly filtroTipo = signal<FiltroTipo>('todos');
  /** document_id cuya descarga está en vuelo (deshabilita su botón). */
  readonly descargandoId = signal<number | null>(null);
  /** Miniaturas de imagen ya resueltas: { [document_id]: objectUrl }. */
  readonly miniaturas = signal<Record<number, string>>({});

  /** Object URLs vivos, para revocarlos al destruir (evita fugas de memoria). */
  private objectUrls: string[] = [];

  /** Opciones del filtro de tipo (etiqueta ES + icono). */
  readonly TIPOS: ReadonlyArray<{ valor: FiltroTipo; etiqueta: string }> = [
    { valor: 'todos', etiqueta: 'Todos los tipos' },
    { valor: 'imagen', etiqueta: 'Imágenes' },
    { valor: 'pdf', etiqueta: 'PDF' },
    { valor: 'excel', etiqueta: 'Hojas de cálculo' },
    { valor: 'word', etiqueta: 'Documentos Word' },
    { valor: 'otro', etiqueta: 'Otros' },
  ];

  /**
   * Filas visibles tras el filtro de tipo. Nota: la paginación es del servidor, así
   * que el filtro se aplica sobre la página cargada (mismo patrón que el listado).
   */
  readonly filasVisibles = computed<SupportFile[]>(() => {
    const f = this.filtroTipo();
    if (f === 'todos') return this.filas();
    return this.filas().filter(sf => this.categoriaMime(sf.mime_type) === f);
  });

  ngOnInit(): void {
    // Con id del host, el setter ya inicializó: no se lee la ruta.
    if (this.idPorInput != null) return;
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(pm => {
      const id = Number(pm.get('formId'));
      if (!Number.isFinite(id) || id <= 0) return;
      this.inicializar(id);
    });
  }

  ngOnDestroy(): void {
    this.revocarMiniaturas();
  }

  /** Reinicia paginación/miniaturas y carga la primera página del formulario `id`. */
  private inicializar(id: number): void {
    this.formId.set(id);
    this.pagina.set(0);
    this.filtroTipo.set('todos');
    this.revocarMiniaturas();
    this.cargar();
  }

  // ── Carga ───────────────────────────────────────────────────────────

  recargar(): void {
    this.cargar();
  }

  private cargar(): void {
    const id = this.formId();
    if (!id) return;
    this.cargando.set(true);
    this.error.set(null);
    this.revocarMiniaturas();
    this.formsSvc.supports(id, this.pagina(), this.tamano())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: pag => {
          this.filas.set(pag.content ?? []);
          this.total.set(pag.total ?? 0);
          this.cargando.set(false);
          // Miniaturas solo para imágenes (los binarios grandes no se pre-descargan).
          for (const sf of this.filas()) {
            if (this.esImagen(sf.mime_type)) this.cargarMiniatura(sf);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.cargando.set(false);
          this.filas.set([]);
          this.total.set(0);
          this.error.set(this.mensajeProblema(err, 'No se pudieron cargar los soportes.'));
        },
      });
  }

  onPage(evento: PageEvent): void {
    this.pagina.set(evento.pageIndex);
    this.tamano.set(evento.pageSize);
    this.cargar();
  }

  onFiltroTipo(valor: FiltroTipo): void {
    this.filtroTipo.set(valor);
  }

  // ── Descarga autenticada ────────────────────────────────────────────

  /**
   * Descarga el archivo como blob (el auth.interceptor pone el JWT) y lo guarda con
   * file-saver. No se puede usar <a href> directo porque el gateway rechaza sin token.
   */
  descargar(sf: SupportFile): void {
    if (this.descargandoId() != null) return;
    this.descargandoId.set(sf.document_id);
    this.http.get(this.urlAbsoluta(sf.download_url), { responseType: 'blob' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          this.descargandoId.set(null);
          saveAs(blob, sf.filename || `soporte-${sf.document_id}`);
        },
        error: (err: HttpErrorResponse) => {
          this.descargandoId.set(null);
          this.snack.open(
            this.mensajeProblema(err, 'No se pudo descargar el archivo.'),
            'Cerrar', { duration: 5000 },
          );
        },
      });
  }

  /** Baja la imagen como blob y publica su object URL como miniatura. */
  private cargarMiniatura(sf: SupportFile): void {
    if (this.miniaturas()[sf.document_id]) return; // ya resuelta (documento repetido)
    this.http.get(this.urlAbsoluta(sf.download_url), { responseType: 'blob' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          this.objectUrls.push(url);
          this.miniaturas.update(prev => ({ ...prev, [sf.document_id]: url }));
        },
        // Sin miniatura: la tarjeta cae al icono por tipo. No molestamos al usuario.
        error: () => { /* noop */ },
      });
  }

  private revocarMiniaturas(): void {
    for (const url of this.objectUrls) {
      try { URL.revokeObjectURL(url); } catch { /* noop */ }
    }
    this.objectUrls = [];
    if (Object.keys(this.miniaturas()).length > 0) this.miniaturas.set({});
  }

  // ── Presentación ────────────────────────────────────────────────────

  esImagen(mime: string | null | undefined): boolean {
    return (mime || '').toLowerCase().startsWith('image/');
  }

  /** Categoría a partir del mime (para icono y filtro). */
  categoriaMime(mime: string | null | undefined): CategoriaMime {
    const m = (mime || '').toLowerCase();
    if (m.startsWith('image/')) return 'imagen';
    if (m.includes('pdf')) return 'pdf';
    if (m.includes('spreadsheet') || m.includes('excel') || m.includes('csv')) return 'excel';
    if (m.includes('word') || m.includes('wordprocessing') || m === 'application/msword') return 'word';
    return 'otro';
  }

  /** Material Symbol representativo del tipo de archivo. */
  iconoPorMime(mime: string | null | undefined): string {
    switch (this.categoriaMime(mime)) {
      case 'imagen': return 'image';
      case 'pdf': return 'picture_as_pdf';
      case 'excel': return 'table_view';
      case 'word': return 'description';
      default: return 'draft';
    }
  }

  /** Etiqueta corta del tipo (badge). */
  tipoLegible(mime: string | null | undefined): string {
    switch (this.categoriaMime(mime)) {
      case 'imagen': return 'Imagen';
      case 'pdf': return 'PDF';
      case 'excel': return 'Hoja de cálculo';
      case 'word': return 'Word';
      default: return 'Archivo';
    }
  }

  /** Tamaño legible: B / KB / MB. */
  tamanoLegible(bytes: number | null | undefined): string {
    if (bytes == null || bytes < 0) return '—';
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  }

  // ── Utilidades ──────────────────────────────────────────────────────

  /**
   * Resuelve download_url a absoluta contra la API. Debe llevar el host de la API
   * (no el del front): una URL relativa iría al origen del documento y el
   * interceptor no le pondría el JWT.
   */
  private urlAbsoluta(u: string): string {
    if (/^https?:\/\//i.test(u)) return u;
    const base = environment.apiUrl.replace(/\/+$/, '');
    return base + (u.startsWith('/') ? u : '/' + u);
  }

  private mensajeProblema(err: HttpErrorResponse, porDefecto: string): string {
    const problema = err?.error as ApiProblem | null;
    if (problema && typeof problema.detail === 'string' && problema.detail.trim()) {
      return problema.detail;
    }
    return porDefecto;
  }
}
