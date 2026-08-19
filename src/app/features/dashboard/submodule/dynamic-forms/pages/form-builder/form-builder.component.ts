import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList, CdkDropListGroup,
  moveItemInArray, transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import Swal from 'sweetalert2';

import { environment } from '@/environments/environment';
import { DynamicFormService } from '../../services/dynamic-form.service';
import { FieldTypeService } from '../../services/field-type.service';
import { RolesService, RolResumen } from '../../services/roles.service';
import { PlacementService } from '../../services/placement.service';
import {
  ApiProblem, BuilderRequest, DynamicField, FieldTypeInfo, FormDetail, FormSection,
  FormTheme, FormUi,
} from '../../models/dynamic-forms.models';
import { PRESETS_TEMA, PresetTema, temaEfectivo } from '../../models/form-theme';
import { FormDesignService, SugerenciaDiseno } from '../../services/form-design.service';
import { ModuleNode, Placement, PlacementRequest } from '../../models/placement.models';
import { FieldPaletteComponent } from '../../components/field-palette/field-palette.component';
import {
  FieldConfigCardComponent, clonarCampoParaDuplicar, crearCampoDesdeTipo,
} from '../../components/field-config-card/field-config-card.component';
import { FormPreviewPhoneComponent } from '../../components/form-preview-phone/form-preview-phone.component';
import { ModuleTreePickerComponent } from '../../components/module-tree-picker/module-tree-picker.component';
import { leerUsuarioCrudo } from '@/app/core/utils/usuario-actual';
import { setLocalStorageItem } from '@/app/core/utils/safe-storage';

/**
 * Deriva el slug en cliente (solo para la vista previa; la ruta canónica la
 * calcula el backend): minúsculas, NFD sin diacríticos, no-alfanumérico→'-',
 * sin guiones en los extremos.
 */
function derivarSlug(texto: string): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Paneles plegables de la columna central del constructor. */
type PanelKey = 'datos' | 'diseno' | 'permisos' | 'ubicacion';

/**
 * Constructor de Formularios Dinámicos — 3 columnas:
 *   paleta de tipos | metadatos + secciones con tarjetas de campo | preview teléfono.
 *
 * Estado 100% con signals e INMUTABLE: toda mutación de secciones/campos crea
 * arrays y objetos nuevos para que OnPush repinte (el preview se deriva de aquí).
 *
 * Dos modos por ruta:
 *  - /builder            → creación (permisos de llenado + createBuilder)
 *  - /:formId/editar     → edición  (precarga get+structure; editBuilder publica v n+1)
 *
 * Los `name` de los campos NO se editan en UI: los genera el backend desde el label.
 */
@Component({
  selector: 'app-form-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, FormsModule,
    CdkDropListGroup, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder,
    FieldPaletteComponent, FieldConfigCardComponent, FormPreviewPhoneComponent,
    ModuleTreePickerComponent,
  ],
  templateUrl: './form-builder.component.html',
  styleUrl: './form-builder.component.css',
})
export class FormBuilderComponent {
  private formsSvc = inject(DynamicFormService);
  private tiposSvc = inject(FieldTypeService);
  private rolesSvc = inject(RolesService);
  private placementSvc = inject(PlacementService);
  private designSvc = inject(FormDesignService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private destroyRef = inject(DestroyRef);

  private static readonly RUTA_LISTADO = '/dashboard/gestion-del-programa/formularios-dinamicos';

  // ── Metadatos ─────────────────────────────────────────────────────
  nombre = signal('');
  descripcion = signal('');
  categoria = signal('');
  esPublico = signal(false);

  // ── Estructura ────────────────────────────────────────────────────
  sections = signal<FormSection[]>([{ order_no: 1, title: 'Sección 1', fields: [] }]);
  seccionActiva = signal(0);

  // ── Diseño (tema + recorrido) ─────────────────────────────────────
  /**
   * Tema en edición. Arranca en el preset institucional para que un formulario nuevo
   * no nazca sin identidad; el usuario cambia preset o toquetea colores sueltos.
   */
  readonly presets: PresetTema[] = PRESETS_TEMA;
  tema = signal<FormTheme>({ ...PRESETS_TEMA[0].theme });
  /** Recorrido: paso a paso (default con 2+ secciones) o todo de corrido. */
  pasoAPaso = signal(true);
  mostrarProgreso = signal(true);

  /** Portada: objectURL para verla aquí; en el tema solo viaja la referencia. */
  portadaUrl = signal<string | null>(null);
  private portadaObjectUrl: string | null = null;

  sugiriendo = signal(false);
  generandoPortada = signal(false);
  sugerencia = signal<SugerenciaDiseno | null>(null);

  /** Bloque `ui` que se envía al backend. */
  readonly uiActual = computed<FormUi>(() => ({
    theme: this.tema(),
    navigation: { mode: this.pasoAPaso() ? 'wizard' : 'single', progress: this.mostrarProgreso() },
  }));

  /** Tema con los defaults rellenos: lo que leen los selectores de color. */
  readonly temaVista = computed(() => temaEfectivo(this.tema()));

  /** Etiquetas de los campos: es lo que la IA usa para entender de qué habla el formulario. */
  private etiquetasDeCampos(): string[] {
    const out: string[] = [];
    for (const sec of this.sections()) {
      if (sec.title?.trim()) out.push(sec.title.trim());
      for (const f of sec.fields) {
        if (f.label?.trim()) out.push(f.label.trim());
        for (const c of f.children ?? []) if (c.label?.trim()) out.push(c.label.trim());
      }
    }
    return out.slice(0, 40);
  }

  aplicarPreset(preset: PresetTema): void {
    // El preset reemplaza los colores pero RESPETA la portada ya elegida.
    const actual = this.tema();
    this.tema.set({
      ...preset.theme,
      ...(actual.cover_url ? { cover_url: actual.cover_url } : {}),
      ...(actual.cover_document_id ? { cover_document_id: actual.cover_document_id } : {}),
      ...(actual.cover_alt ? { cover_alt: actual.cover_alt } : {}),
    });
  }

  cambiarTema<K extends keyof FormTheme>(clave: K, valor: FormTheme[K]): void {
    this.tema.update(t => ({ ...t, [clave]: valor, preset: 'personalizado' }));
  }

  /** Pide a la IA una identidad visual acorde al tema del formulario. */
  sugerirDiseno(): void {
    const nombre = this.nombre().trim();
    if (!nombre) {
      this.abrirPanel('datos');
      this.snack.open('Ponle nombre al formulario para que la IA sepa de qué se trata.', 'Entendido', { duration: 5000 });
      return;
    }
    this.sugiriendo.set(true);
    this.designSvc.sugerir({
      nombre,
      descripcion: this.descripcion().trim(),
      campos: this.etiquetasDeCampos(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: sug => {
          this.sugiriendo.set(false);
          this.sugerencia.set(sug);
          this.tema.update(t => ({ ...t, ...sug.theme, preset: 'ia' }));
          this.snack.open('Diseño sugerido aplicado. Puedes ajustarlo a mano.', 'OK', { duration: 4000 });
        },
        error: (err: unknown) => {
          this.sugiriendo.set(false);
          this.snack.open(this.mensajeIa(err, 'No se pudo obtener la sugerencia de diseño.'), 'Cerrar', { duration: 6000 });
        },
      });
  }

  /** Genera la portada con IA y la deja subida en ms-documents. */
  generarPortada(): void {
    const prompt = (this.sugerencia()?.cover_prompt || '').trim()
      || `Cover for an internal business form about: ${this.nombre().trim()}`;
    this.generandoPortada.set(true);
    this.designSvc.generarPortada(prompt, this.formId() ?? 0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ref => {
          this.generandoPortada.set(false);
          this.fijarPortada(ref.document_id);
          this.snack.open('Portada generada y guardada.', 'OK', { duration: 4000 });
        },
        error: (err: unknown) => {
          this.generandoPortada.set(false);
          this.snack.open(this.mensajeIa(err, 'No se pudo generar la imagen.'), 'Cerrar', { duration: 6000 });
        },
      });
  }

  /** Portada subida a mano (por si prefieren su propia imagen a la generada). */
  subirPortada(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.snack.open('La portada debe ser una imagen.', 'Cerrar', { duration: 4000 });
      return;
    }
    this.generandoPortada.set(true);
    this.designSvc.subirPortada(file, this.formId() ?? 0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ref => {
          this.generandoPortada.set(false);
          this.fijarPortada(ref.document_id);
        },
        error: () => {
          this.generandoPortada.set(false);
          this.snack.open('No se pudo subir la portada.', 'Cerrar', { duration: 5000 });
        },
      });
  }

  quitarPortada(): void {
    this.revocarPortada();
    this.portadaUrl.set(null);
    this.tema.update(t => {
      const { cover_document_id, cover_url, cover_alt, ...resto } = t;
      return resto;
    });
  }

  /**
   * Aplica SOLO el diseño al formulario ya publicado. Es un cambio cosmético: el
   * backend lo guarda en el formulario, no en la versión, así que no publica v n+1.
   */
  aplicarDisenoAhora(): void {
    const id = this.formId();
    if (id == null) return;
    this.guardando.set(true);
    this.formsSvc.updateUi(id, this.uiActual())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.guardando.set(false);
          this.snack.open('Diseño aplicado (sin publicar versión nueva).', 'OK', { duration: 4000 });
        },
        error: (err: unknown) => { this.guardando.set(false); this.mostrarErrorApi(err); },
      });
  }

  private fijarPortada(documentId: number): void {
    this.tema.update(t => ({ ...t, cover_document_id: documentId, header_style: 'image' }));
    this.cargarPortada(documentId);
  }

  private cargarPortada(documentId: number): void {
    this.designSvc.portadaBlobUrl(documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: url => { this.revocarPortada(); this.portadaObjectUrl = url; this.portadaUrl.set(url); },
        error: () => this.portadaUrl.set(null),
      });
  }

  private revocarPortada(): void {
    if (this.portadaObjectUrl) {
      URL.revokeObjectURL(this.portadaObjectUrl);
      this.portadaObjectUrl = null;
    }
  }

  private mensajeIa(err: unknown, porDefecto: string): string {
    if (err instanceof HttpErrorResponse) {
      const detalle = (err.error as { error?: string } | null)?.error;
      if (detalle) return detalle;
      if (err.status === 429) return 'Demasiadas peticiones a la IA; espera unos segundos.';
    }
    return porDefecto;
  }

  // ── Catálogos y permisos ──────────────────────────────────────────
  tipos = signal<FieldTypeInfo[]>([]);
  roles = signal<RolResumen[]>([]);
  rolesSel = signal<string[]>([]);
  cargandoRoles = signal(false);

  // ── Ubicación en el menú (solo en creación) ───────────────────────
  // El BuilderRequest NO lleva menu_parent_module_id: el formulario nace PENDING
  // y, si el usuario eligió ubicación y no marcó "no publicar", se publica con
  // placementService.place() justo después de crearlo.
  ubicPadre = signal<string | null>(null);
  ubicPadreNodo = signal<ModuleNode | null>(null);
  ubicLabel = signal<string>('');
  ubicIcono = signal<string>('dynamic_form');
  ubicOrden = signal<number | null>(null);
  ubicRespuestas = signal<boolean>(true);
  noPublicar = signal<boolean>(false);

  /** Ruta final estimada: /dashboard/{route_path del padre}/{slug de la etiqueta}. */
  readonly rutaUbicPreview = computed(() => {
    const n = this.ubicPadreNodo();
    if (!n) return '';
    const rp = (n.route_path ?? '').replace(/^\/+|\/+$/g, '');
    const etiqueta = this.ubicLabel().trim() || this.nombre().trim();
    const slug = derivarSlug(etiqueta) || '…';
    return `/dashboard/${rp ? rp + '/' : ''}${slug}`;
  });

  // ── Paneles plegables de la columna central ───────────────────────
  /**
   * Los paneles de configuración (datos, permisos, ubicación) ocupaban toda la primera
   * pantalla y empujaban los campos —lo que de verdad se está armando— fuera de la vista.
   * Ahora se pliegan: solo "Datos" arranca abierto (trae el nombre, que es obligatorio) y
   * cada cabecera lleva un RESUMEN de lo configurado para que plegado no signifique
   * olvidado.
   */
  readonly paneles = signal<Record<PanelKey, boolean>>({
    datos: true,
    diseno: false,
    permisos: false,
    ubicacion: false,
  });

  panelAbierto(key: PanelKey): boolean {
    return this.paneles()[key];
  }

  alternarPanel(key: PanelKey): void {
    this.paneles.update(p => ({ ...p, [key]: !p[key] }));
  }

  abrirPanel(key: PanelKey): void {
    this.paneles.update(p => (p[key] ? p : { ...p, [key]: true }));
  }

  /** Resúmenes de cabecera: lo esencial de cada panel cuando está plegado. */
  readonly resumenDatos = computed(() => {
    const n = this.nombre().trim();
    const cat = this.categoria().trim();
    if (!n) return 'Sin nombre';
    return cat ? `${n} · ${cat}` : n;
  });

  readonly resumenDiseno = computed(() => {
    const t = this.tema();
    const preset = this.presets.find(p => p.id === t.preset)?.nombre
      ?? (t.preset === 'ia' ? 'Sugerido por IA' : 'Personalizado');
    const recorrido = this.pasoAPaso() ? 'paso a paso' : 'de corrido';
    return `${preset} · ${recorrido}${t.cover_document_id || t.cover_url ? ' · con portada' : ''}`;
  });

  readonly resumenPermisos = computed(() => {
    const n = this.rolesSel().length;
    if (n === 0) return 'Sin roles (se asignan después)';
    return n === 1 ? '1 rol' : `${n} roles`;
  });

  readonly resumenUbicacion = computed(() => {
    if (this.noPublicar()) return 'Sin publicar por ahora';
    const nodo = this.ubicPadreNodo();
    if (!nodo) return 'Falta elegir el módulo padre';
    const etiqueta = this.ubicLabel().trim() || this.nombre().trim() || 'Formulario';
    return `${nodo.label} › ${etiqueta}`;
  });

  // ── Modo / progreso ───────────────────────────────────────────────
  formId = signal<number | null>(null);
  versionActual = signal(0);
  cargando = signal(false);
  guardando = signal(false);

  esEdicion = computed(() => this.formId() != null);

  /** Total de campos contando los hijos de SECTION (para el contador del header). */
  totalCampos = computed(() =>
    this.sections().reduce(
      (acc, s) => acc + s.fields.reduce((a, f) => a + 1 + (f.children?.length ?? 0), 0),
      0,
    ));

  constructor() {
    this.tiposSvc.fieldTypes()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ts => this.tipos.set(ts),
        error: () => this.snack.open('No se pudo cargar el catálogo de tipos de campo.', 'OK', { duration: 5000 }),
      });

    const idParam = this.route.snapshot.paramMap.get('formId');
    if (idParam) {
      this.formId.set(Number(idParam));
      this.cargarEdicion(Number(idParam));
    } else {
      this.cargarRoles();
    }
  }

  // ── Carga inicial ─────────────────────────────────────────────────

  private cargarRoles(): void {
    this.cargandoRoles.set(true);
    this.rolesSvc.list()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: rs => { this.roles.set(rs); this.cargandoRoles.set(false); },
        error: () => {
          this.cargandoRoles.set(false);
          this.snack.open('No se pudieron cargar los roles; el formulario se creará sin permisos de llenado.', 'OK', { duration: 6000 });
        },
      });
  }

  private cargarEdicion(id: number): void {
    this.cargando.set(true);
    forkJoin({ detalle: this.formsSvc.get(id), estructura: this.formsSvc.structure(id) })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ detalle, estructura }) => {
          this.nombre.set(detalle.name);
          this.descripcion.set(detalle.description ?? '');
          this.categoria.set(detalle.category ?? '');
          this.esPublico.set(detalle.is_public);
          this.aplicarUiCargada(detalle.ui ?? estructura.ui ?? null);
          this.versionActual.set(estructura.version.version);
          // Clon profundo: el estado del builder es nuestro, no el objeto del HTTP cache.
          this.sections.set(structuredClone(estructura.sections));
          this.seccionActiva.set(0);
          this.cargando.set(false);
        },
        error: (err: unknown) => {
          this.cargando.set(false);
          const problema = this.comoProblema(err);
          void Swal.fire({
            icon: 'error',
            title: 'No se pudo cargar el formulario',
            text: problema?.detail || 'Error inesperado del servidor.',
          }).then(() => this.irAlListado());
        },
      });
  }

  /** Vuelca en el editor el tema guardado; sin tema, se queda el preset por defecto. */
  private aplicarUiCargada(ui: FormUi | null): void {
    if (ui?.theme) this.tema.set({ ...ui.theme });
    // Sin `mode` guardado se asume paso a paso: es el default del runtime.
    this.pasoAPaso.set(ui?.navigation?.mode !== 'single');
    this.mostrarProgreso.set(ui?.navigation?.progress !== false);
    const docId = ui?.theme?.cover_document_id;
    if (docId) this.cargarPortada(docId);
    else if (ui?.theme?.cover_url) this.portadaUrl.set(ui.theme.cover_url);
  }

  // ── Secciones ─────────────────────────────────────────────────────

  agregarSeccion(): void {
    const secs = [...this.sections()];
    secs.push({ order_no: secs.length + 1, title: `Sección ${secs.length + 1}`, fields: [] });
    this.sections.set(secs);
    this.seccionActiva.set(secs.length - 1);
  }

  renombrarSeccion(i: number, titulo: string): void {
    const secs = [...this.sections()];
    secs[i] = { ...secs[i], title: titulo };
    this.sections.set(secs);
  }

  quitarSeccion(i: number): void {
    if (this.sections()[i].fields.length > 0) return; // solo si está vacía
    const secs = this.sections().filter((_, k) => k !== i);
    this.sections.set(secs);
    this.seccionActiva.set(Math.max(0, Math.min(this.seccionActiva(), secs.length - 1)));
  }

  // ── Campos ────────────────────────────────────────────────────────

  /** Clic en la paleta: agrega al FINAL de la sección activa. */
  agregarTipo(t: FieldTypeInfo): void {
    const secs = this.clonarSecciones();
    if (secs.length === 0) {
      secs.push({ order_no: 1, title: 'Sección 1', fields: [] });
      this.seccionActiva.set(0);
    }
    const idx = Math.min(this.seccionActiva(), secs.length - 1);
    secs[idx].fields.push(crearCampoDesdeTipo(t));
    this.sections.set(secs);
  }

  /**
   * Drop CDK sobre la lista de una sección: puede venir de la paleta (COPIAR:
   * id 'palette' + FieldTypeInfo en item.data), de la misma lista (reordenar)
   * o de otra sección (transferir). Todo sobre copias — nunca se mutan las
   * arrays que ya están en el signal.
   */
  soltarCampo(ev: CdkDragDrop<number>, destino: number): void {
    const secs = this.clonarSecciones();
    if (ev.previousContainer.id === 'palette') {
      const tipo = ev.item.data as FieldTypeInfo;
      secs[destino].fields.splice(ev.currentIndex, 0, crearCampoDesdeTipo(tipo));
    } else if (ev.previousContainer === ev.container) {
      moveItemInArray(secs[destino].fields, ev.previousIndex, ev.currentIndex);
    } else {
      const origen = ev.previousContainer.data;
      transferArrayItem(secs[origen].fields, secs[destino].fields, ev.previousIndex, ev.currentIndex);
    }
    this.sections.set(secs);
    this.seccionActiva.set(destino);
  }

  /**
   * Campos de la misma sección que pueden hacer de PADRE en una cascada de opciones:
   * los de selección simple que ya tienen `name` (el nombre lo genera el backend al
   * guardar, así que un campo recién arrastrado todavía no sirve de padre).
   */
  camposEncadenables(si: number, fi: number): Array<{ name: string; label: string }> {
    const secs = this.sections();
    const sec = secs[si];
    if (!sec) return [];
    return sec.fields
      .filter((f, i) => i !== fi && !!f.name
        && (f.type === 'SINGLE_CHOICE' || f.type === 'DROPDOWN'))
      .map(f => ({ name: f.name as string, label: f.label || (f.name as string) }));
  }

  actualizarCampo(si: number, fi: number, actualizado: DynamicField): void {
    const secs = this.clonarSecciones();
    secs[si].fields[fi] = actualizado;
    this.sections.set(secs);
  }

  duplicarCampo(si: number, fi: number): void {
    const secs = this.clonarSecciones();
    secs[si].fields.splice(fi + 1, 0, clonarCampoParaDuplicar(secs[si].fields[fi]));
    this.sections.set(secs);
  }

  quitarCampo(si: number, fi: number): void {
    const secs = this.clonarSecciones();
    secs[si].fields.splice(fi, 1);
    this.sections.set(secs);
  }

  /**
   * Un hijo pidió salir de su SECTION: se quita de children (por identidad de
   * objeto, estable dentro del estado actual) y se inserta justo después de la
   * sección en la misma FormSection.
   */
  sacarDeSeccion(si: number, fi: number, hijo: DynamicField): void {
    const secs = this.clonarSecciones();
    const campo = secs[si].fields[fi];
    secs[si].fields[fi] = { ...campo, children: (campo.children ?? []).filter(c => c !== hijo) };
    secs[si].fields.splice(fi + 1, 0, hijo);
    this.sections.set(secs);
  }

  // ── Permisos ──────────────────────────────────────────────────────

  toggleRol(id: string): void {
    const sel = this.rolesSel();
    this.rolesSel.set(sel.includes(id) ? sel.filter(r => r !== id) : [...sel, id]);
  }

  // ── Guardar ───────────────────────────────────────────────────────

  async guardar(): Promise<void> {
    const problema = this.validar();
    if (problema) {
      // El campo que falta suele vivir en "Datos": si estaba plegado, se abre para que el
      // mensaje no señale a un panel invisible.
      this.abrirPanel('datos');
      this.snack.open(problema, 'Entendido', { duration: 5000 });
      return;
    }
    const req = this.construirRequest();
    const id = this.formId();

    if (id != null) {
      // EDICIÓN: publicar crea versión nueva — confirmar SIEMPRE antes.
      const v = this.versionActual();
      const conf = await Swal.fire({
        icon: 'question',
        title: `Publicar v${v + 1}`,
        text: `Esto crea la versión v${v} → v${v + 1}; las respuestas ya enviadas conservan su esquema. ¿Continuar?`,
        showCancelButton: true,
        confirmButtonText: `Publicar v${v + 1}`,
        cancelButtonText: 'Cancelar',
      });
      if (!conf.isConfirmed) return;

      this.guardando.set(true);
      this.formsSvc.editBuilder(id, req)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.guardando.set(false);
            void Swal.fire({
              icon: 'success',
              title: `Versión v${v + 1} publicada`,
              timer: 1800,
              showConfirmButton: false,
            }).then(() => this.irAlListado());
          },
          error: (err: unknown) => { this.guardando.set(false); this.mostrarErrorApi(err); },
        });
      return;
    }

    // CREACIÓN: los roles seleccionados van como fill_role_ids.
    if (this.rolesSel().length > 0) req.fill_role_ids = this.rolesSel();
    this.guardando.set(true);
    this.formsSvc.createBuilder(req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detalle => { this.guardando.set(false); this.despuesDeCrear(detalle); },
        error: (err: unknown) => { this.guardando.set(false); this.mostrarErrorApi(err); },
      });
  }

  /**
   * Post-creación. El formulario nace PENDING (el BuilderRequest no lleva
   * ubicación). Si el usuario eligió un padre y no marcó "no publicar", se
   * publica ahora con placementService.place(); si no, se crea sin publicar.
   */
  private despuesDeCrear(detalle: FormDetail): void {
    const padre = this.ubicPadre();
    if (this.noPublicar() || !padre) {
      void Swal.fire({
        icon: 'success',
        title: 'Formulario creado',
        text: 'Formulario creado sin publicar; ubícalo cuando quieras desde el listado.',
        confirmButtonText: 'Ir al listado',
      }).then(() => this.irAlListado());
      return;
    }

    const req: PlacementRequest = {
      parent_module_id: padre,
      menu_label: this.ubicLabel().trim() || detalle.name || this.nombre().trim(),
      icon: this.ubicIcono().trim() || 'dynamic_form',
      responses_menu_enabled: this.ubicRespuestas(),
    };
    const orden = this.ubicOrden();
    if (orden != null && Number.isFinite(Number(orden))) req.order_no = Number(orden);
    // Los roles de llenado elegidos también gobiernan quién ve la entrada de menú.
    if (this.rolesSel().length > 0) req.fill_role_ids = this.rolesSel();

    this.guardando.set(true);
    this.placementSvc.place(detalle.id, req)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: p => { this.guardando.set(false); this.trasPublicarUbicacion(detalle.id, p); },
        error: (err: unknown) => {
          this.guardando.set(false);
          const problema = this.comoProblema(err);
          void Swal.fire({
            icon: 'warning',
            title: 'Formulario creado, pero no se pudo ubicar',
            text: problema?.detail || 'La publicación en el menú falló. Puedes ubicarlo desde el listado.',
            showCancelButton: true,
            confirmButtonText: 'Reintentar ubicación',
            cancelButtonText: 'Ir al listado',
          }).then(r => r.isConfirmed ? this.reintentarUbicacionTrasCrear(detalle.id) : this.irAlListado());
        },
      });
  }

  /** Resultado del place() tras crear: LINKED = éxito; FAILED/warnings = ofrecer reintento. */
  private trasPublicarUbicacion(formId: number, p: Placement): void {
    const conAvisos = (p.warnings?.length ?? 0) > 0;
    if (p.placement_status === 'FAILED' || conAvisos) {
      const items = (p.warnings ?? []).map(w => `<li>${this.esc(w)}</li>`).join('');
      const detalleErr = p.placement_error ? `<p>${this.esc(p.placement_error)}</p>` : '';
      void Swal.fire({
        icon: p.placement_status === 'FAILED' ? 'error' : 'warning',
        title: p.placement_status === 'FAILED' ? 'La ubicación quedó en error' : 'Ubicación con advertencias',
        html: `${detalleErr}${items ? `<ul style="text-align:left;margin:8px 0 0;padding-left:18px">${items}</ul>` : ''}`
          || 'Revisa la ubicación desde el listado.',
        showCancelButton: true,
        confirmButtonText: 'Reintentar ubicación',
        cancelButtonText: 'Ir al listado',
      }).then(r => r.isConfirmed ? this.reintentarUbicacionTrasCrear(formId) : this.irAlListado());
      return;
    }
    // LINKED: éxito. Refrescar el menú en caliente y navegar al listado.
    void Swal.fire({ icon: 'success', title: 'Formulario creado y publicado', timer: 1600, showConfirmButton: false })
      .then(() => this.irAlListadoRefrescandoMenu());
  }

  private reintentarUbicacionTrasCrear(formId: number): void {
    this.placementSvc.retry(formId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: p => {
          if (p.placement_status === 'FAILED' || (p.warnings?.length ?? 0) > 0) {
            this.snack.open('La ubicación sigue incompleta; gestiónala desde el listado.', 'OK', { duration: 6000 });
            this.irAlListado();
          } else {
            this.irAlListadoRefrescandoMenu();
          }
        },
        error: () => {
          this.snack.open('No se pudo reintentar la ubicación; gestiónala desde el listado.', 'OK', { duration: 6000 });
          this.irAlListado();
        },
      });
  }

  /**
   * Navega al listado refrescando el menú lateral EN CALIENTE. El sidebar
   * (navbar.component.ts) sólo relee `localStorage["user"].permisos_tree` en su
   * ngOnInit/refreshPermisos(); no hay canal para empujarle un refresco sin tocar
   * ese componente. Replicamos su mismo GET (/gestion_admin/usuarios/{id}/),
   * reescribimos 'user' con el árbol nuevo y hacemos una navegación COMPLETA al
   * listado (window.location) para que el navbar se reinstancie y pinte el módulo
   * recién publicado. Si el GET falla, navegamos igual: el refreshPermisos() del
   * navbar hará el fetch al reiniciar.
   */
  private irAlListadoRefrescandoMenu(): void {
    const ir = () => {
      if (typeof window !== 'undefined') window.location.href = FormBuilderComponent.RUTA_LISTADO;
      else this.irAlListado();
    };
    const user = leerUsuarioCrudo();
    const idCrudo = user?.['id'];
    const userId = idCrudo != null ? String(idCrudo) : '';
    if (!userId) { ir(); return; }
    const apiUrl = environment.apiUrl.replace(/\/+$/, '');
    this.http.get<unknown>(`${apiUrl}/gestion_admin/usuarios/${userId}/`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: resp => { setLocalStorageItem('user', JSON.stringify(resp)); ir(); },
        error: () => ir(),
      });
  }

  // ── Validación local mínima (la del servidor es la que manda) ─────

  private validar(): string | null {
    if (!this.nombre().trim()) return 'El nombre del formulario es obligatorio.';
    if (this.totalCampos() === 0) return 'Agrega al menos un campo al formulario.';
    for (const sec of this.sections()) {
      for (const campo of sec.fields) {
        const p = this.validarCampo(campo);
        if (p) return p;
        for (const hijo of campo.children ?? []) {
          const ph = this.validarCampo(hijo);
          if (ph) return ph;
        }
      }
    }
    return null;
  }

  private validarCampo(f: DynamicField): string | null {
    if (!f.label.trim()) return 'Hay un campo sin etiqueta: complétala antes de guardar.';
    const esChoice = f.type === 'SINGLE_CHOICE' || f.type === 'DROPDOWN' || f.type === 'MULTIPLE_CHOICE';
    if (esChoice && !(f.schema.options?.length)) return `«${f.label}» necesita al menos una opción.`;
    if (f.type === 'COMMENT' && !f.schema.text?.trim()) return `El comentario «${f.label}» necesita texto.`;
    return null;
  }

  // ── Armado del request ────────────────────────────────────────────

  private construirRequest(): BuilderRequest {
    return {
      name: this.nombre().trim(),
      description: this.descripcion().trim() || null,
      category: this.categoria().trim() || null,
      is_public: this.esPublico(),
      ui: this.uiActual(),
      sections: this.sections().map((s, si) => ({
        ...(s.code ? { code: s.code } : {}),
        title: s.title?.trim() || null,
        order_no: si + 1,
        fields: s.fields.map((f, fi) => ({
          ...f,
          order_no: fi + 1,
          ...(f.children ? { children: f.children.map((c, ci) => ({ ...c, order_no: ci + 1 })) } : {}),
        })),
      })),
    };
  }

  // ── Errores del API (ProblemDetail RFC 7807) ──────────────────────

  private comoProblema(err: unknown): ApiProblem | null {
    return err instanceof HttpErrorResponse ? (err.error as ApiProblem | null) : null;
  }

  private mostrarErrorApi(err: unknown): void {
    const problema = this.comoProblema(err);
    if (problema?.code === 'df_structure_invalid' && problema.errors?.length) {
      const items = problema.errors
        .map(e => `<li><b>${this.esc(e.section)} / ${this.esc(e.field)}</b>: ${this.esc(e.message)}</li>`)
        .join('');
      void Swal.fire({
        icon: 'error',
        title: 'Estructura inválida',
        html: `<ul style="text-align:left;margin:0;padding-left:18px">${items}</ul>`,
      });
    } else {
      void Swal.fire({
        icon: 'error',
        title: 'No se pudo guardar',
        text: problema?.detail || 'Error inesperado del servidor. Intenta de nuevo.',
      });
    }
  }

  // ── Utilitarios ───────────────────────────────────────────────────

  irAlListado(): void {
    void this.router.navigateByUrl(FormBuilderComponent.RUTA_LISTADO);
  }

  /** Copia superficial de secciones + arrays de campos (los campos se reemplazan, no se mutan). */
  private clonarSecciones(): FormSection[] {
    return this.sections().map(s => ({ ...s, fields: [...s.fields] }));
  }

  /** Escapa texto que va dentro del html de un Swal. */
  private esc(s: string): string {
    const mapa: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return s.replace(/[&<>"']/g, c => mapa[c] ?? c);
  }
}
