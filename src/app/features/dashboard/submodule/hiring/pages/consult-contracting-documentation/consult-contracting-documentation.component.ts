
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTableDataSource } from '@angular/material/table';
import Swal from 'sweetalert2';
import { finalize, firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title, Meta } from '@angular/platform-browser';

import { SharedModule } from '@/app/shared/shared.module';
import { MatButtonModule } from '@angular/material/button';

import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { OrdenUnionDialogComponent } from '../../components/orden-union-dialog/orden-union-dialog.component';

import { saveAs } from 'file-saver';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { DateRangeDialogComponent } from '@/app/shared/components/date-rang-dialog/date-rang-dialog.component';

// ✅ StandardFilterTable (tu tabla nueva)
import { StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

/** Doc serializado (lo que devuelve el backend por cada tipo) */
type DocCell = {
  exists: boolean;
  url?: string;
  uploaded_at?: string; // ISO
  vigente15d?: boolean; // ✅ para iconos (✓ / ⚠ / ✗)
};

/** ✅ Cell UI para la tabla (abre PDF desde ✓ y ?) */
type DocUiCell = {
  state: 'OK' | 'INFO' | 'WARN' | 'MISSING' | 'OLD';
  url?: string | null;
  uploaded_at?: string | null;
  /** ¿este tipo documental está sujeto a la regla de 15 días? */
  controlled?: boolean;
  /** Referencia para el tooltip */
  referenceType?: 'contract' | 'today' | 'none';
  /** Días calculados. Si referenceType='contract' -> (fecha_contratacion - uploaded_at). Si 'today' -> (hoy - uploaded_at). */
  daysDiff?: number | null;
  /** Metadata útil para el flujo de subida */
  typeId?: number;
  typeName?: string;
  cedula?: string;
  contract_number?: string | null;
};

/** Fila base (para ZIP/Excel y tu lógica actual) */
type Row = {
  cedula: string;
  tipo_documento?: string | null;
  nombre?: string | null;
  finca?: string | null;
  fecha_ingreso?: string | Date | null;
  codigo_contrato?: string | null;
  fecha_contratacion?: string | Date | null;
  /** Oficina (sede) registrada en la última entrevista del candidato. */
  oficina_entrevista?: string | null;
  /** Mapa type_id -> DocCell */
  docs: Record<number, DocCell>;
};

type TipoHeader = { id: number; name: string };

type ChecklistDocDto = {
  type_id: number;
  doc: null | { file_url?: string; uploaded_at?: string };
};

type ChecklistItemDto = {
  cedula: string;
  tipo_documento?: string | null;
  nombre_completo?: string | null;
  finca?: string | null;
  fecha_ingreso?: string | null;
  codigo_contrato?: string | null;
  fecha_contratacion?: string | null;
  /** Oficina/sede de la última entrevista (gestion_contratacion). */
  oficina_entrevista?: string | null;
  docs?: ChecklistDocDto[];
};

type ChecklistResponseDto = {
  tipos?: TipoHeader[];
  items?: ChecklistItemDto[];
  invalidCedulas?: string[];
  duplicatesRemoved?: number;
  totalReceived?: number;
};

@Component({
  selector: 'app-consult-contracting-documentation',
  standalone: true,
  imports: [SharedModule, MatButtonModule, MatDialogModule, StandardFilterTable],
  templateUrl: './consult-contracting-documentation.component.html',
  styleUrls: ['./consult-contracting-documentation.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConsultContractingDocumentationComponent implements OnInit {
  // inyección moderna
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly gestionDocumentalService = inject(GestionDocumentalService);
  private readonly dialog = inject(MatDialog);
  private readonly utilityService = inject(UtilityServiceService);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  // --------- Ajustes para masivo ----------
  private readonly MAX_POST_BATCH = 1500;

  /** Fecha específica que siempre se considera "documento viejo" */
  private readonly OLD_BATCH_DATE = '2026-02-10';

  /** token para ignorar respuestas viejas (cuando el usuario pega otra lista) */
  private requestToken = 0;

  // --------- UI / estado ----------
  cedulaControl = new FormControl<string>('', { nonNullable: true });
  user: any;

  /** Últimas cédulas consultadas (para reconsultar sin re-pegar) */
  lastQueriedCedulas: string[] = [];

  // --------- Consulta automática por sede + rango de fechas ----------
  /**
   * Sedes registradas en gestion_admin (catálogo). Sus nombres deben coincidir con
   * `Entrevista.oficina` para que la consulta automática funcione.
   */
  sedesDisponibles: string[] = [];
  selectedSedes: string[] = [];

  /** Rango de fechas elegido en el dialog (YYYY-MM-DD); ambos opcionales pero la UI exige uno. */
  rangoFechas: { start: string | null; end: string | null } | null = null;

  isLoadingSedes = false;
  isLoadingAuto = false;

  // --------- columnas dinámicas ----------
  /** Tipos que devuelve el backend, en orden */
  tipoHeaders: TipoHeader[] = [];
  /** Claves de columnas para Material Table */
  tipoColumnKeys: string[] = [];

  // --------- tabla actual (tu lógica existente: ZIP/Excel/etc.) ----------
  dataSource = new MatTableDataSource<Row>([]);
  displayedColumns: string[] = [];

  private readonly baseColumns: string[] = [
    'cedula',
    'tipo_documento',
    'nombre',
    'finca',
    'fecha_ingreso',
    'codigo_contrato',
    'fecha_contratacion',
  ];

  // =========================
  // ✅ tabla con StandardFilterTable
  // =========================
  isLoadingChecklist = false;
  checklistColumns: ColumnDefinition[] = [];
  checklistRows: any[] = [];

  /**
   * Cédulas cuya última entrevista es en ADMINISTRATIVOS y que han sido excluidas
   * de la tabla (sólo GERENCIA puede ver sus documentos). Se muestran como un banner
   * informativo para que el usuario sepa cuáles son.
   */
  restrictedAdminItems: Array<{ cedula: string; nombre: string }> = [];

  // =========================
  // ✅ Tipos documentales sujetos a la regla de 15 días respecto a la fecha de contrato.
  // El matching se hace por palabras clave sobre el nombre que devuelve el backend,
  // para no depender de los IDs concretos. Cualquier tipo no listado acá se muestra OK
  // si existe (sin validar vigencia).
  // =========================
  private readonly CONTROLLED_DOC_KEYWORDS: readonly string[][] = [
    ['PROCURADURIA', 'PROCURADURÍA', 'PROCURAD'],
    ['CONTRALORIA', 'CONTRALORÍA', 'CONTRAL'],
    ['OFAC'],
    ['POLICIVO', 'POLICIVOS', 'POLICIA', 'ANTECEDENTE', 'ANTECEDENTES'],
    ['ADRES', 'ADRESS', 'ADDRESS', 'DIRECCION', 'DIRECCIÓN', 'DOMICILIO', 'RESIDENCIA'],
    ['SISBEN', 'SISBÉN'],
    ['AFP', 'FONDO', 'FONDO DE PENSION', 'PENSION', 'PENSIONES'],
  ];

  /** Cache por id para no recalcular en cada render */
  private controlledByTypeId = new Map<number, boolean>();

  /** Input oculto para subir documentos directamente desde una celda */
  @ViewChild('uploadInput') uploadInput?: ElementRef<HTMLInputElement>;

  /** Contexto de la subida pendiente (setear antes de click()) */
  private pendingUpload: {
    cedula: string;
    typeId: number;
    typeName: string;
    contract_number?: string | null;
    rowRef: any;
  } | null = null;

  // =========================
  // ✅ abreviador de headers Excel
  // =========================
  private readonly DOC_ABBR: Record<string, string> = {
    Procuraduria: 'Proc',
    Procuraduría: 'Proc',
    Contraloria: 'Contra',
    Contraloría: 'Contra',
    Policivo: 'Pol',
    SISBEN: 'Sis',
    Sisben: 'Sis',
    OFAC: 'OFAC',
    Fondo: 'Fondo',
    Adress: 'Dir',
    Address: 'Dir',
    Direccion: 'Dir',
    Dirección: 'Dir',
  };

  constructor() {
    // al destruir el componente, invalida cualquier request en curso
    this.destroyRef.onDestroy(() => {
      this.requestToken++;
    });
  }

  ngOnInit(): void {
    // SEO
    this.titleService.setTitle('Consultar documentación de contratación | Contratación');
    this.metaService.updateTag({ name: 'description', content: 'Consulta el estado y la disponibilidad de documentos asociados al proceso de contratación.' });

    this.user = this.utilityService.getUser();

    this.resetTabla();

    // ✅ filtro eficiente (para tu MatTable actual; si ya no la usas, no molesta)
    this.dataSource.filterPredicate = (row, filter) => {
      const f = (filter ?? '').trim().toLowerCase();
      if (!f) return true;

      return (
        (row.cedula ?? '').toLowerCase().includes(f) ||
        (row.tipo_documento ?? '').toLowerCase().includes(f) ||
        (row.nombre ?? '').toLowerCase().includes(f) ||
        (row.finca ?? '').toLowerCase().includes(f) ||
        (row.codigo_contrato ?? '').toLowerCase().includes(f)
      );
    };

    this.cdr.markForCheck();

    // Cargar las sedes (gestion_admin) para el selector de consulta automática.
    this.cargarSedes();
  }

  // ✅ Fix para *ngFor trackBy
  trackByTipo = (_: number, t: TipoHeader) => t.id;

  /**
   * Carga el catálogo de sedes desde gestion_admin.
   * `Sede.nombre` es el valor que se compara contra `Entrevista.oficina`.
   */
  private cargarSedes(): void {
    this.isLoadingSedes = true;
    this.utilityService
      .traerSucursales()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resp: any) => {
          const list: any[] = Array.isArray(resp)
            ? resp
            : Array.isArray(resp?.results)
              ? resp.results
              : [];
          const set = new Set<string>();
          for (const s of list) {
            const nombre = String(s?.nombre ?? '').trim();
            if (nombre) set.add(nombre);
          }
          this.sedesDisponibles = Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
          this.isLoadingSedes = false;
          this.cdr.markForCheck();
        },
        error: (err: any) => {
          console.error('[consult-docs] No se pudieron cargar sedes:', err);
          this.sedesDisponibles = [];
          this.isLoadingSedes = false;
          this.cdr.markForCheck();
        },
      });
  }

  /** Recarga manual de sedes (botón en el panel de consulta automática). */
  refrescarSedes(): void {
    this.cargarSedes();
  }

  /** Texto humano para mostrar el rango seleccionado. */
  get rangoFechasLabel(): string {
    if (!this.rangoFechas?.start && !this.rangoFechas?.end) return 'Sin rango seleccionado';
    const s = this.rangoFechas?.start ?? '—';
    const e = this.rangoFechas?.end ?? '—';
    return `${s}  →  ${e}`;
  }

  /** Abre el dialog compartido para escoger el rango de fechas. */
  abrirDialogoRangoFechas(): void {
    this.dialog
      .open(DateRangeDialogComponent, {
        width: '420px',
        autoFocus: false,
        restoreFocus: false,
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res: { start: string | null; end: string | null } | undefined) => {
        if (!res) return;
        if (!res.start && !res.end) {
          this.rangoFechas = null;
        } else {
          this.rangoFechas = { start: res.start, end: res.end };
        }
        this.cdr.markForCheck();
      });
  }

  /**
   * Trae las cédulas de candidatos cuya entrevista esté en alguna de las sedes
   * seleccionadas y dentro del rango. Reutiliza el flujo masivo existente.
   */
  async traerCedulasAutomaticas(): Promise<void> {
    if (!this.selectedSedes.length) {
      Swal.fire({
        icon: 'info',
        title: 'Sede requerida',
        text: 'Selecciona al menos una sede para continuar.',
      });
      return;
    }
    if (!this.rangoFechas?.start || !this.rangoFechas?.end) {
      Swal.fire({
        icon: 'info',
        title: 'Rango de fechas requerido',
        text: 'Selecciona un rango de fechas (inicio y fin) antes de consultar.',
      });
      return;
    }

    this.isLoadingAuto = true;
    this.cdr.markForCheck();

    Swal.fire({
      title: 'Buscando candidatos...',
      text: `Sedes: ${this.selectedSedes.length} · ${this.rangoFechas.start} → ${this.rangoFechas.end}`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const resp = await firstValueFrom(
        this.gestionDocumentalService.getCedulasPorOficina(
          this.selectedSedes,
          this.rangoFechas.start,
          this.rangoFechas.end,
        ),
      );

      const unique = new Set<string>();
      for (const c of resp?.docs ?? []) {
        const digits = String(c ?? '').replace(/\D+/g, '');
        if (digits) unique.add(digits);
      }

      if (!unique.size) {
        if (Swal.isVisible()) Swal.close();
        Swal.fire({
          icon: 'info',
          title: 'Sin resultados',
          text: 'No se encontraron candidatos con esos filtros.',
        });
        return;
      }

      const cedulas = Array.from(unique);
      // Alimentamos el textarea para visibilidad y reutilizamos el flujo existente.
      this.cedulaControl.setValue(cedulas.join('\n'));
      this.procesarCedulasPegadas(cedulas.join('\n'));
    } catch (err: any) {
      console.error('[consult-docs] Error en consulta automática:', err);
      if (Swal.isVisible()) Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.error?.detail || err?.message || 'No se pudieron obtener las cédulas.',
      });
    } finally {
      this.isLoadingAuto = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * ¿el usuario actual puede ver candidatos cuya última entrevista es ADMINISTRATIVOS?
   * Regla del negocio: SOLO el rol GERENCIA. El resto no debe verlos en la tabla
   * ni en exportes ni en consultas automáticas.
   */
  canViewAdministrativos(): boolean {
    const rol = String(this.user?.rol?.nombre ?? '').trim().toUpperCase();
    return rol === 'GERENCIA';
  }

  /** Match laxo de "ADMINISTRATIVOS" tolerante a espacios y acentos. */
  private isAdministrativos(oficina: string | null | undefined): boolean {
    if (!oficina) return false;
    return this.normName(oficina) === 'ADMINISTRATIVOS';
  }

  /** ✅ Abrir PDF cuando el estado sea OK o WARN */
  openDoc(cell: DocUiCell | null | undefined, ev?: MouseEvent): void {
    ev?.stopPropagation();
    const url = cell?.url ?? null;
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /** Normaliza un string para comparar nombres de tipos documentales */
  private normName(s: any): string {
    return String(s ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9 ]+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
  }

  /** ¿este tipo documental requiere validar 15 días vs fecha de contrato? */
  private isControlledType(typeName: string | null | undefined): boolean {
    const n = this.normName(typeName);
    if (!n) return false;
    for (const group of this.CONTROLLED_DOC_KEYWORDS) {
      for (const kw of group) {
        const k = this.normName(kw);
        if (!k) continue;
        if (n === k || n.startsWith(k) || n.includes(k)) return true;
      }
    }
    return false;
  }

  /** Texto de tooltip para una celda de documento (ver fechas y estado). */
  cellTooltip(cell: DocUiCell | null | undefined): string {
    if (!cell) return '';
    if (cell.state === 'MISSING') return 'No existe · toca para subir';

    const days = cell.daysDiff;
    const ref = cell.referenceType;

    if (cell.state === 'OK') {
      if (cell.controlled && ref === 'contract' && days !== null && days !== undefined) {
        if (days === 0) return 'Vigente · entregado el mismo día del contrato';
        if (days > 0) return `Vigente · entregado ${days} día(s) antes de la fecha de contrato`;
        return `Vigente · entregado ${Math.abs(days)} día(s) después de la fecha de contrato`;
      }
      if (ref === 'today' && days !== null && days !== undefined) {
        return `Entregado hace ${days} día(s)`;
      }
      return 'Entregado';
    }

    if (cell.state === 'INFO') {
      // Controlado pero sin fecha de contrato: solo mostramos los días desde la subida
      if (days !== null && days !== undefined) {
        return `Entregado hace ${days} día(s) · sin fecha de contrato para validar`;
      }
      return 'Entregado · sin fecha de contrato para validar';
    }

    if (cell.state === 'OLD') {
      if (cell.controlled && ref === 'contract' && days !== null && days !== undefined) {
        return `No vigente · entregado ${days} día(s) antes de la fecha de contrato (> 15 días)`;
      }
      if (ref === 'today' && days !== null && days !== undefined) {
        return `Entregado hace ${days} día(s) (más de 15 días)`;
      }
      return 'Entregado (más de 15 días)';
    }

    return '';
  }

  /** Abre el selector de archivo para esta celda (cédula + tipo documental). */
  uploadDoc(cell: DocUiCell | null | undefined, row: any, ev?: MouseEvent): void {
    ev?.stopPropagation();
    if (!cell || !cell.typeId || !cell.cedula) {
      Swal.fire({ icon: 'warning', title: 'Sin contexto', text: 'No se pudo identificar el documento a subir.' });
      return;
    }
    this.pendingUpload = {
      cedula: cell.cedula,
      typeId: cell.typeId,
      typeName: cell.typeName ?? '',
      contract_number: cell.contract_number ?? row?.codigo_contrato ?? null,
      rowRef: row,
    };
    const input = this.uploadInput?.nativeElement;
    if (!input) return;
    input.value = '';
    input.click();
  }

  /** Handler del <input type="file"> oculto. */
  async onFileSelected(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input?.files?.[0];
    if (!file) return;
    const ctx = this.pendingUpload;
    if (!ctx) return;

    const MAX_BYTES = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_BYTES) {
      Swal.fire({ icon: 'warning', title: 'Archivo muy grande', text: 'El archivo supera los 20 MB.' });
      this.pendingUpload = null;
      return;
    }

    Swal.fire({
      title: 'Subiendo documento...',
      text: `${ctx.typeName || 'Documento'} · CC ${ctx.cedula}`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const title = `${ctx.typeName || 'Documento'} - ${ctx.cedula}`;
      await firstValueFrom(
        this.gestionDocumentalService.guardarDocumento(
          title,
          ctx.cedula,
          ctx.typeId,
          file,
          ctx.contract_number ? String(ctx.contract_number) : undefined,
        ),
      );

      await this.refreshCedula(ctx.cedula);

      Swal.fire({
        icon: 'success',
        title: 'Documento actualizado',
        text: 'El archivo se subió correctamente.',
        timer: 1600,
        showConfirmButton: false,
      });
    } catch (err: any) {
      console.error('[upload-doc]', err);
      const detail = err?.error?.detail || err?.error?.error || err?.message || 'No se pudo subir el documento.';
      Swal.fire({ icon: 'error', title: 'Error al subir', text: detail });
    } finally {
      this.pendingUpload = null;
      if (input) input.value = '';
    }
  }

  /** Re-consulta una única cédula y refresca su fila en ambas tablas. */
  private async refreshCedula(cedula: string): Promise<void> {
    const resp = await firstValueFrom(
      this.gestionDocumentalService.getDocumentosChecklist([cedula]),
    );
    const item: ChecklistItemDto | undefined = resp?.items?.[0];
    if (!item) return;

    const { row, uiRow } = this.mapItemToRows(item);

    const idx = this.checklistRows.findIndex(r => String(r?.cedula) === String(cedula));
    if (idx >= 0) {
      const newList = this.checklistRows.slice();
      newList[idx] = uiRow;
      this.checklistRows = newList;
    }

    const rawIdx = this.dataSource.data.findIndex(r => String(r?.cedula) === String(cedula));
    if (rawIdx >= 0) {
      const newData = this.dataSource.data.slice();
      newData[rawIdx] = row;
      this.dataSource.data = newData;
    }

    this.cdr.markForCheck();
  }

  /** ✅ Visualizar todos los documentos válidos de esta columna (Max 40 para browser merge) */
  async viewColumnDocs(col: ColumnDefinition): Promise<void> {
    const validUrls = this.checklistRows
      .map(r => (r[col.name] as DocUiCell)?.url)
      .filter((url): url is string => !!url);

    if (!validUrls.length) {
      Swal.fire({ icon: 'info', title: 'Vacío', text: `No hay documentos de tipo "${col.header}" en los resultados actuales.` });
      return;
    }

    // El usuario pidió unir "x cantidad que pueda", así que siempre intentaremos unirlos
    // Puedes comentar la opción de ZIP, pero opcionalmente le preguntamos si son muchos (mayor a 50)
    // para darle la opción del ZIP, pero la primera será siempre unir.
    if (validUrls.length > 50) {
      const resp = await Swal.fire({
        title: `Se unirán ${validUrls.length} documentos`,
        text: 'Son bastantes documentos. ¿Deseas generar y abrir un único archivo PDF uniendo todos, o prefieres descargarlos en un ZIP?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Sí, Unir en un solo PDF',
        denyButtonText: 'Descargar en ZIP (Separados)',
        cancelButtonText: 'Cancelar'
      });

      if (resp.isDenied) {
        // Opción de descargar ZIP (archivos separados, no unidos)
        const idStr = col.name.replace('type_', '');
        const id = parseInt(idStr, 10);
        if (!isNaN(id)) {
          this.descargarZipConUnion([id]);
        }
        return;
      } else if (!resp.isConfirmed) {
        return; // Canceló
      }
    }

    Swal.fire({
      title: 'Uniendo Documentos',
      text: 'Descargando y combinando archivos a máxima velocidad...',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const { PDFDocument } = await import('pdf-lib');
      const mergedPdf = await PDFDocument.create();
      let mergedCount = 0;

      // Set metadata to prevent weird title in viewers
      mergedPdf.setTitle(`Consolidado - ${col.header}`);
      mergedPdf.setCreator('TesoroApp');

      // Descarga paralela en bloques (chunks) para no ahogar las conexiones del navegador
      const CHUNK_SIZE = 15;
      
      for (let i = 0; i < validUrls.length; i += CHUNK_SIZE) {
        const chunkUrls = validUrls.slice(i, i + CHUNK_SIZE);
        
        Swal.update({ 
          text: `Procesando bloque ${Math.ceil(i/CHUNK_SIZE) + 1} de ${Math.ceil(validUrls.length/CHUNK_SIZE)} (Docs ${i+1}-${Math.min(i+CHUNK_SIZE, validUrls.length)} / ${validUrls.length})` 
        });

        // Ejecutar fetches concurrentes
        const fetchPromises = chunkUrls.map(async (url) => {
          const res = await fetch(url);
          if (!res.ok) throw new Error('Network error');
          const contentType = res.headers.get('content-type') || '';
          const buffer = await res.arrayBuffer();
          return { url, contentType, buffer };
        });

        const results = await Promise.allSettled(fetchPromises);

        // Procesar buffers secuencialmente para no desordenar el PDF
        for (const result of results) {
          if (result.status === 'fulfilled') {
            const { url, contentType, buffer } = result.value;
            try {
              if (contentType.includes('image/') || url.toLowerCase().match(/\.(jpeg|jpg|png|gif)$/)) {
                 let img = (contentType.includes('png') || url.toLowerCase().endsWith('.png'))
                   ? await mergedPdf.embedPng(buffer)
                   : await mergedPdf.embedJpg(buffer);
                 const page = mergedPdf.addPage([img.width, img.height]);
                 page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
                 mergedCount++;
              } else {
                 const doc = await PDFDocument.load(buffer);
                 
                 // Aplanar el formulario para incrustar de forma permanente cualquier 
                 // campo interactivo, firma o texto autocompletado antes de copiar.
                 try {
                   const form = doc.getForm();
                   form.flatten();
                 } catch (e) {
                   console.warn('El PDF no tenía formulario o no se pudo aplanar', e);
                 }

                 const copiedPages = await mergedPdf.copyPages(doc, doc.getPageIndices());
                 copiedPages.forEach((p) => mergedPdf.addPage(p));
                 mergedCount++;
              }
            } catch (e) {
              console.warn('No se pudo anexar archivo', url, e);
            }
          }
        }
      }

      if (mergedCount === 0) {
        Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron procesar los documentos (Formato inválido o inaccesibles).' });
        return;
      }

      Swal.update({ text: 'Compilando el archivo PDF unificado...' });
      
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const finalUrl = URL.createObjectURL(blob);

      Swal.close();
      
      // Usamos un tag <a> en vez de window.open para asignar un nombre explícito e impedir 
      // que el navegador descargue un archivo con nombre UUID "blob:XXXX.pdf"
      const a = document.createElement('a');
      a.href = finalUrl;
      const safeName = String(col.header).replace(/[^a-zA-Z0-9]/g, '_');
      a.download = `Consolidado_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Liberar memoria luego de un rato
      setTimeout(() => URL.revokeObjectURL(finalUrl), 10000);
    } catch(err: any) {
      console.error('[consult-docs] Error generando PDF combinado:', err);
      Swal.fire({
        icon: 'error',
        title: 'Error al combinar PDFs',
        text: err?.message || 'No se pudo generar el PDF combinado. Algunos archivos podrían estar corruptos o inaccesibles.',
      });
    }
  }

  /** ---------- BÚSQUEDA INDIVIDUAL ---------- */
  buscarPorCedula(): void {
    const cedula = (this.cedulaControl.value ?? '').trim();
    if (!cedula) {
      Swal.fire({ icon: 'warning', title: 'Cédula vacía', text: 'Ingrese una cédula.' });
      return;
    }
    this.procesarCedulasPegadas(cedula);
  }

  /** Reconsultar las mismas cédulas sin tener que volver a pegarlas */
  reconsultar(): void {
    if (!this.lastQueriedCedulas.length) {
      Swal.fire({ icon: 'info', title: 'Sin consulta previa', text: 'No hay cédulas previas para reconsultar.' });
      return;
    }
    this.procesarCedulasPegadas(this.lastQueriedCedulas.join('\n'));
  }

  /** ---------- PEGAR LISTA DIRECTO EN TABLA ---------- */
  onTablePaste(evt: ClipboardEvent): void {
    const txt = evt.clipboardData?.getData('text') ?? '';
    if (!txt) return;

    evt.preventDefault();

    if (/[\s,\t\r\n;]/.test(txt)) {
      this.procesarCedulasPegadas(txt);
    } else {
      this.cedulaControl.setValue(txt.trim());
      this.buscarPorCedula();
    }
  }

  /** ---------- PROCESAMIENTO MASIVO (5.000+) ---------- */
  procesarCedulasPegadas(texto: string): void {
    void this.procesarCedulasPegadasAsync(texto);
  }

  private async procesarCedulasPegadasAsync(texto: string): Promise<void> {
    const token = ++this.requestToken;

    this.resetTabla();
    this.cdr.markForCheck();

    const parsed = this.parseCedulasBulk(texto);

    if (!parsed.cedulas.length) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'No se detectaron cédulas válidas.' });
      return;
    }

    // Guardar para reconsultar
    this.lastQueriedCedulas = parsed.cedulas;

    Swal.fire({
      icon: 'info',
      title: 'Consultando información...',
      text: `Cédulas únicas: ${parsed.cedulas.length}`,
      allowOutsideClick: false,
      allowEscapeKey: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    this.isLoadingChecklist = true;

    try {
      const resp = await this.fetchChecklistPostBatched(parsed.cedulas, token);

      if (token !== this.requestToken) return;

      // ✅ UX: Avisar que estamos procesando (mapping)
      Swal.update({
        title: 'Procesando datos...',
        text: 'Organizando la información para visualizar.',
      });
      // Breve respiro
      await new Promise(resolve => setTimeout(resolve, 50));

      // headers dinámicos
      this.tipoHeaders = Array.isArray(resp?.tipos) ? resp.tipos : [];
      this.tipoColumnKeys = this.tipoHeaders.map(t => `type_${t.id}`);
      this.displayedColumns = [...this.baseColumns, ...this.tipoColumnKeys];

      // Cache "controlled" por cada tipo (una sola vez por consulta)
      this.controlledByTypeId.clear();
      for (const t of this.tipoHeaders) {
        this.controlledByTypeId.set(Number(t.id), this.isControlledType(t.name));
      }

      // MAPPING (Heavy Sync Operation) - Optimizado O(N)
      const rawItems: ChecklistItemDto[] = Array.isArray(resp?.items) ? resp.items : [];

      // Restricción: los documentos de candidatos cuya última entrevista es en
      // ADMINISTRATIVOS sólo se muestran al rol GERENCIA. Para el resto:
      //  - los excluimos de la tabla principal (y por ende del Excel/ZIP),
      //  - pero los listamos en un banner aparte para que el usuario sepa
      //    QUÉ cédulas quedaron restringidas (la consulta de 15 cédulas no
      //    desaparece silenciosamente).
      let itemsList: ChecklistItemDto[];
      if (this.canViewAdministrativos()) {
        itemsList = rawItems;
        this.restrictedAdminItems = [];
      } else {
        itemsList = [];
        const restricted: Array<{ cedula: string; nombre: string }> = [];
        for (const it of rawItems) {
          if (this.isAdministrativos(it?.oficina_entrevista)) {
            restricted.push({
              cedula: String(it?.cedula ?? ''),
              nombre: String(it?.nombre_completo ?? ''),
            });
          } else {
            itemsList.push(it);
          }
        }
        this.restrictedAdminItems = restricted;
      }

      const len = itemsList.length;
      const rows: Row[] = new Array(len);
      const mappedRows: any[] = new Array(len);

      for (let i = 0; i < len; i++) {
        const { row, uiRow } = this.mapItemToRows(itemsList[i]);
        rows[i] = row;
        mappedRows[i] = uiRow;
      }

      this.dataSource.data = rows;

      const baseCols: ColumnDefinition[] = [
        { name: 'cedula', header: 'Cédula', type: 'text', stickyStart: true, width: '120px' },
        { name: 'tipo_documento', header: 'Tipo Doc', type: 'text', width: '110px' },
        { name: 'nombre', header: 'Nombre', type: 'text', width: '260px' },
        { name: 'finca', header: 'Finca', type: 'text', width: '160px' },
        { name: 'fecha_ingreso', header: 'Fecha ingreso', type: 'date', width: '150px' },
        { name: 'codigo_contrato', header: 'Código contrato', type: 'text', width: '150px' },
        { name: 'fecha_contratacion', header: 'Fecha contratación', type: 'date', width: '170px' },
      ];

      const dynCols: ColumnDefinition[] = this.tipoHeaders.map(t => ({
        name: `type_${t.id}`,
        header: t.name,
        type: 'status',
        width: '110px',
        align: 'center',
        filterable: false,
        sortable: false,
      }));

      this.checklistColumns = [...baseCols, ...dynCols];

      // ✅ UX: Avisar renderizado (esto suele congelar el UI)
      Swal.update({
        title: 'Generando tabla...',
        text: 'Esto puede tomar unos segundos.',
      });
      // Delay para asegurar que el browser pinte el Swal antes del freeze de asignación
      await new Promise(resolve => setTimeout(resolve, 100));

      this.checklistRows = mappedRows;
      this.isLoadingChecklist = false; // Stop internal table spinner
      this.cdr.markForCheck();

      // ✅ UX: Delay mayor para cubrir el freeze del renderizado de filas
      // 4000 filas pueden tomar 1-2s en computarse en el DOM aunque estén paginadas (calculos iniciales)
      setTimeout(() => {
        if (this.requestToken === token) {
          if (Swal.isVisible()) Swal.close();
        }
      }, 1500);

    } catch (e: any) {
      this.isLoadingChecklist = false;
      this.cdr.markForCheck();
      if (token !== this.requestToken) return;
      console.error('[consult-docs] Error consultando checklist:', e);
      if (Swal.isVisible()) Swal.close();

      let msg = 'Ocurrió un problema consultando datos.';
      if (e?.name === 'AbortError') {
        return; // Cancelado por el usuario (nueva consulta), no mostrar error
      } else if (e?.status === 0 || e?.status === 504) {
        msg = 'No se pudo conectar con el servidor. Verifique su conexión a internet.';
      } else if (e?.status === 413) {
        msg = 'Se enviaron demasiadas cédulas. Intente con un lote más pequeño.';
      } else if (e?.status >= 500) {
        msg = `Error interno del servidor (${e.status}). Intente de nuevo o contacte a soporte.`;
      } else if (e?.error?.detail) {
        msg = e.error.detail;
      }
      Swal.fire({ icon: 'error', title: 'Error', text: msg });
    }
  }

  /**
   * ✅ Usa POST siempre. Si son demasiadas, parte en lotes.
   */
  private async fetchChecklistPostBatched(
    cedulas: string[],
    token: number,
  ): Promise<ChecklistResponseDto> {
    if (cedulas.length <= this.MAX_POST_BATCH) {
      return await firstValueFrom(this.gestionDocumentalService.getDocumentosChecklist(cedulas));
    }

    const chunks = this.chunkArray(cedulas, this.MAX_POST_BATCH);

    const merged: ChecklistResponseDto = {
      tipos: [],
      items: [],
      totalReceived: cedulas.length,
      duplicatesRemoved: 0,
      invalidCedulas: [],
    };

    for (let i = 0; i < chunks.length; i++) {
      if (token !== this.requestToken) {
        throw new DOMException('Aborted', 'AbortError');
      }

      Swal.update({
        text: `Consultando lote ${i + 1} de ${chunks.length} (${chunks[i].length} cédulas)`,
      });

      const part = await firstValueFrom(
        this.gestionDocumentalService.getDocumentosChecklist(chunks[i]),
      );

      if (!merged.tipos?.length && Array.isArray(part?.tipos)) merged.tipos = part.tipos;
      if (Array.isArray(part?.items)) (merged.items as ChecklistItemDto[]).push(...part.items);

      if (Array.isArray(part?.invalidCedulas) && part.invalidCedulas.length) {
        merged.invalidCedulas = [...(merged.invalidCedulas ?? []), ...part.invalidCedulas];
      }

      merged.duplicatesRemoved =
        Number(merged.duplicatesRemoved ?? 0) + Number(part?.duplicatesRemoved ?? 0);
      merged.totalReceived = Number(merged.totalReceived ?? cedulas.length);
    }

    return merged;
  }

  /** Parseo masivo: dedupe estable + normaliza + detecta inválidas */
  private parseCedulasBulk(texto: string) {
    const tokens = String(texto ?? '').split(/[\s,;\t\r\n]+/g);

    const seen = new Set<string>();
    const cedulas: string[] = [];
    const invalid: string[] = [];

    let totalReceived = 0;
    let duplicatesRemoved = 0;

    for (const raw of tokens) {
      const s = (raw ?? '').trim();
      if (!s) continue;

      totalReceived++;

      // normaliza (solo dígitos)
      const digits = s.replace(/\D+/g, '');

      // regla simple
      if (digits.length < 6 || digits.length > 15) {
        invalid.push(s);
        continue;
      }

      if (seen.has(digits)) {
        duplicatesRemoved++;
        continue;
      }

      seen.add(digits);
      cedulas.push(digits);
    }

    return { cedulas, invalid, duplicatesRemoved, totalReceived };
  }

  private chunkArray<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }

  private resetTabla(): void {
    this.dataSource.data = [];
    this.tipoHeaders = [];
    this.tipoColumnKeys = [];
    this.displayedColumns = [...this.baseColumns];

    // ✅ StandardFilterTable
    this.checklistRows = [];
    this.checklistColumns = [];
    this.isLoadingChecklist = false;

    // Banner de restringidos (ADMINISTRATIVOS)
    this.restrictedAdminItems = [];
  }

  /** ---------- FILTRO DE TABLA (si aún usas MatTable) ---------- */
  applyFilters(ev: Event): void {
    this.dataSource.filter = (ev.target as HTMLInputElement).value.trim().toLowerCase();
    this.cdr.markForCheck();
  }

  limpiarTabla(): void {
    this.requestToken++;
    this.resetTabla();
    this.cedulaControl.setValue('');
    this.cdr.markForCheck();
  }

  /** ---------- ZIP DE ARCHIVOS ---------- */
  descargarZip(): void {
    if (!this.dataSource.data?.length) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'Primero realiza una consulta.' });
      return;
    }
    if (!this.tipoHeaders?.length) {
      Swal.fire({
        icon: 'info',
        title: 'Tipos no cargados',
        text: 'No se detectaron tipos documentales.',
      });
      return;
    }

    Swal.fire({
      title: '¿Deseas descargar los archivos PDF?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, por favor',
      cancelButtonText: 'No',
    }).then(r => r.isConfirmed && this.abrirDialogOrden());
  }

  abrirDialogOrden(): void {
    const antecedentes = this.tipoHeaders.map(t => ({
      id: t.id,
      name: t.name?.toUpperCase?.() || String(t.name),
    }));

    if (!antecedentes.length) {
      Swal.fire({ icon: 'info', title: 'Sin tipos disponibles', text: 'No hay tipos para ordenar.' });
      return;
    }

    this.dialog
      .open(OrdenUnionDialogComponent, {
        panelClass: 'orden-union-dialog-panel',
        minWidth: '500pt',
        height: '90vh',
        maxHeight: '90vh',
        autoFocus: false,
        restoreFocus: false,
        data: { antecedentes },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((orden: number[] | null) => orden && this.descargarZipConUnion(orden));
  }

  descargarZipConUnion(ordenSeleccionado: Array<number | string>): void {
    const cedulasStr = this.dataSource.data.filter(r => r.cedula).map(r => r.cedula);

    const cedulasNum = cedulasStr.map(c => Number(c)).filter(n => Number.isFinite(n));

    const noNumericas = cedulasStr.length - cedulasNum.length;
    if (noNumericas > 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Cédulas no numéricas',
        text: `Se omitieron ${noNumericas} cédula(s) con formato no numérico.`,
      });
    }

    const ordenNums = (ordenSeleccionado ?? [])
      .map(v => (typeof v === 'string' ? Number(v) : v))
      .filter(n => Number.isFinite(n));

    if (!cedulasNum.length || !ordenNums.length) {
      Swal.fire({ icon: 'info', title: 'Sin datos', text: 'Verifica cédulas y orden seleccionado.' });
      return;
    }

    Swal.fire({
      title: 'Preparando descarga...',
      text: 'Esto puede tardar unos segundos',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.gestionDocumentalService
      .descargarZipPorCedulasYOrden(cedulasNum, ordenNums)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => Swal.close()))
      .subscribe({
        next: (blob: Blob) => {
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
          a.download = `documentos_union_${ts}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        },
        error: (err: any) => {
          console.error('[consult-docs] Error descargando ZIP:', err);
          const detail = err?.error?.detail || err?.message || '';
          Swal.fire({
            icon: 'error',
            title: 'Error al descargar',
            text: detail
              ? `No se pudo generar el archivo: ${detail}`
              : 'No se pudo descargar el archivo. Verifique su conexión e intente de nuevo.',
          });
        },
      });
  }

  /**
   * Construye la fila base (para ZIP/Excel) y la fila UI (para StandardFilterTable)
   * desde un item del backend. Aplica la regla:
   *  - Si el tipo documental NO está en la lista controlada -> OK (si existe)
   *  - Si está controlado y hay fecha_contratacion:
   *      OK si uploaded_at >= fecha_contratacion - 15d ; OLD si no.
   *  - Si está controlado y NO hay fecha_contratacion:
   *      OK si existe (no se valida), con tooltip relativo a HOY.
   */
  private mapItemToRows(it: ChecklistItemDto): { row: Row; uiRow: any } {
    const oldBatchIso = this.OLD_BATCH_DATE;
    const DAY_MS = 86400000;

    const fechaContratacion = this.parseFecha(it?.fecha_contratacion as any);
    const rowCutoffTime = fechaContratacion
      ? (() => {
          const d = new Date(fechaContratacion.getTime());
          d.setHours(0, 0, 0, 0);
          return d.getTime() - 15 * DAY_MS;
        })()
      : null;

    // Referencia "hoy 00:00" para el fallback (sin fecha de contrato)
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const todayTime = todayMid.getTime();

    const docsMap: Record<number, DocCell> = {};
    const docsArr: ChecklistDocDto[] = Array.isArray(it?.docs) ? it.docs : [];

    for (let j = 0; j < docsArr.length; j++) {
      const d = docsArr[j];
      const tid = Number(d?.type_id);
      if (!Number.isFinite(tid)) continue;

      const dd = d?.doc;
      const uploadedAt = dd ? this.parseFecha(dd.uploaded_at as any) : null;

      // Si ya había un doc para este tipo, quedarnos con el más reciente
      if (docsMap[tid] && docsMap[tid].exists && dd) {
        const existingDateStr = docsMap[tid].uploaded_at;
        const existingDate = existingDateStr ? this.parseFecha(existingDateStr as any) : null;
        if (!uploadedAt || (existingDate && existingDate.getTime() >= uploadedAt.getTime())) {
          continue;
        }
      }

      if (!docsMap[tid] || dd) {
        docsMap[tid] = {
          exists: !!dd,
          url: dd?.file_url,
          uploaded_at: dd?.uploaded_at,
        };
      }
    }

    const baseRow = {
      cedula: String(it?.cedula ?? ''),
      tipo_documento: it?.tipo_documento ?? '',
      nombre: it?.nombre_completo ?? '',
      finca: it?.finca ?? '',
      fecha_ingreso: it?.fecha_ingreso ?? '',
      codigo_contrato: it?.codigo_contrato ?? '',
      fecha_contratacion: it?.fecha_contratacion ?? '',
      oficina_entrevista: it?.oficina_entrevista ?? '',
    };

    const row: Row = { ...baseRow, docs: docsMap };
    const uiRow: any = { ...baseRow };

    const headers = this.tipoHeaders;
    for (let t = 0; t < headers.length; t++) {
      const th = headers[t];
      const tid = th.id;
      const cell = docsMap[tid];
      const controlled = this.controlledByTypeId.get(tid) ?? this.isControlledType(th.name);
      const exists = !!cell?.exists;

      const uploadedAt = cell?.uploaded_at ? this.parseFecha(cell.uploaded_at as any) : null;
      const isOldBatch = !!uploadedAt && uploadedAt.toISOString().slice(0, 10) === oldBatchIso;

      let state: DocUiCell['state'];
      let daysDiff: number | null = null;
      let referenceType: 'contract' | 'today' | 'none' = 'none';

      if (!exists) {
        state = 'MISSING';
      } else if (!controlled) {
        // Tipos no controlados: si existe, queda OK (solo mostramos info en tooltip)
        state = 'OK';
        if (uploadedAt) {
          daysDiff = Math.floor((todayTime - uploadedAt.getTime()) / DAY_MS);
          referenceType = 'today';
        }
      } else if (fechaContratacion && rowCutoffTime !== null) {
        // Tipos controlados CON fecha de contrato: validar ventana 15d previa al contrato.
        if (uploadedAt) {
          const vigente = uploadedAt.getTime() >= rowCutoffTime && !isOldBatch;
          state = vigente ? 'OK' : 'OLD';
          daysDiff = Math.round((fechaContratacion.getTime() - uploadedAt.getTime()) / DAY_MS);
          referenceType = 'contract';
        } else {
          // Existe el registro pero sin fecha -> tratamos como OLD para no engañar
          state = 'OLD';
        }
      } else {
        // Tipos controlados SIN fecha de contrato: no se puede validar vigencia.
        // Mostramos "chulo amarillo" para indicar que está entregado pero sin verificar.
        state = 'INFO';
        if (uploadedAt) {
          daysDiff = Math.floor((todayTime - uploadedAt.getTime()) / DAY_MS);
          referenceType = 'today';
        }
      }

      uiRow[`type_${tid}`] = {
        state,
        url: cell?.url ?? null,
        uploaded_at: cell?.uploaded_at ?? null,
        controlled,
        referenceType,
        daysDiff,
        typeId: tid,
        typeName: th.name,
        cedula: baseRow.cedula,
        contract_number: baseRow.codigo_contrato ?? null,
      } satisfies DocUiCell;
    }

    return { row, uiRow };
  }

  // ---------- Util ----------
  private parseFecha(fecha: string | Date | null | undefined): Date | null {
    if (!fecha) return null;
    if (fecha instanceof Date) return isNaN(fecha.getTime()) ? null : fecha;

    const s0 = String(fecha).trim();

    // dd/mm/yyyy
    const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const m = ddmmyyyy.exec(s0);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);

    // ✅ Normaliza ISO con microsegundos: .824286 -> .824
    const s = s0.replace(/(\.\d{3})\d+(?=[Z+-])/, '$1');

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  private abbrDoc(name: string, max = 8): string {
    const mapped = this.DOC_ABBR[name];
    if (mapped) return mapped;
    const s = String(name ?? '').trim();
    return s.length <= max ? s : s.slice(0, max - 1) + '…';
  }

  focusPasteZone(ev: MouseEvent): void {
    const el = ev.currentTarget as HTMLElement | null;
    el?.focus();
  }

  // ---------- EXCEL (faltantes) ----------
  async exportarExcelFaltantes(): Promise<void> {
    const data = this.dataSource.data ?? [];
    if (!data.length) {
      Swal.fire('Sin datos', 'No hay registros para exportar.', 'info');
      return;
    }

    if (!this.tipoHeaders?.length) {
      Swal.fire('Sin tipos', 'Primero consulta para cargar los tipos documentales.', 'info');
      return;
    }

    const excelMod: any = await import('exceljs');
    const WorkbookCtor = excelMod?.Workbook ?? excelMod?.default?.Workbook ?? excelMod?.default;

    if (!WorkbookCtor) {
      Swal.fire('Error', 'No se pudo cargar ExcelJS (Workbook). Revisa la instalación/import.', 'error');
      return;
    }

    // =========================
    // Helpers inline (sin sacar métodos)
    // =========================
    const norm = (s: any) =>
      String(s ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Z0-9 ]+/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toUpperCase();

    const tokens = (s: any) => norm(s).split(' ').filter(Boolean);

    const scoreByKeywords = (nameNorm: string, keywords: readonly string[]) => {
      let score = 0;
      const nTok = new Set(tokens(nameNorm));

      for (const kw of keywords) {
        const k = norm(kw);
        if (!k) continue;

        if (nameNorm === k) score += 200;
        if (nameNorm.startsWith(k)) score += 80;
        if (nameNorm.includes(k)) score += 50;

        const kTok = tokens(k);
        let hit = 0;
        for (const t of kTok) if (nTok.has(t)) hit++;
        score += hit * 8;
      }
      return score;
    };

    const jaccard = (a: string, b: string) => {
      const A = new Set(tokens(a));
      const B = new Set(tokens(b));
      if (!A.size || !B.size) return 0;
      let inter = 0;
      for (const x of A) if (B.has(x)) inter++;
      const union = A.size + B.size - inter;
      return union ? inter / union : 0;
    };

    const pickTipoId = (keywords: readonly string[]) => {
      const kwJoined = norm((keywords ?? []).join(' '));

      let bestId: number | null = null;
      let bestScore = -1;

      for (const t of this.tipoHeaders) {
        const nameNorm = norm(t?.name);
        if (!nameNorm) continue;

        const s = scoreByKeywords(nameNorm, keywords);
        if (s > bestScore) {
          bestScore = s;
          bestId = Number(t.id);
        }
      }

      if (bestId == null || bestScore <= 0) {
        let bestJ = -1;
        let bestJId: number | null = null;

        for (const t of this.tipoHeaders) {
          const name = String(t?.name ?? '');
          const j = jaccard(name, kwJoined);
          if (j > bestJ) {
            bestJ = j;
            bestJId = Number(t.id);
          }
        }

        if (bestJId != null) return bestJId;
      }

      return bestId;
    };

    const safeSheetName = (name: string) =>
      (String(name ?? '').replace(/[\\/?*\[\]:]/g, ' ').slice(0, 31).trim() || 'HOJA');

    const paintHeader = (ws: any) => {
      const header = ws.getRow(1);
      header.height = 22;
      header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      header.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      header.eachCell((cell: any) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
        cell.border = { bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } } };
      });
      ws.views = [{ state: 'frozen', ySplit: 1 }];
    };

    const splitFullName = (full: string) => {
      const parts = String(full ?? '').trim().split(/\s+/g).filter(Boolean);

      let pn = '';
      let sn = '';
      let pa = '';
      let sa = '';

      if (parts.length === 1) {
        pn = parts[0];
      } else if (parts.length === 2) {
        pn = parts[0];
        pa = parts[1];
      } else if (parts.length === 3) {
        pn = parts[0];
        sn = parts[1];
        pa = parts[2];
      } else if (parts.length >= 4) {
        pn = parts[0];
        pa = parts[parts.length - 2];
        sa = parts[parts.length - 1];
        sn = parts.slice(1, -2).join(' ');
      }

      return { pn, sn, pa, sa };
    };

    // ✅ Fallback: "hoy - 15 días" cuando no exista fecha_contratacion en la fila.
    const todayCutoff = new Date();
    todayCutoff.setHours(0, 0, 0, 0);
    todayCutoff.setDate(todayCutoff.getDate() - 15);
    const DAY_MS = 86400000;

    /** Devuelve la fecha de corte para una fila (fecha_contratacion - 15d) o null si no aplica. */
    const rowCutoffFor = (r: Row): number | null => {
      const fc = this.parseFecha(r?.fecha_contratacion as any);
      if (!fc) return null;
      const d = new Date(fc.getTime());
      d.setHours(0, 0, 0, 0);
      return d.getTime() - 15 * DAY_MS;
    };

    /** Evalúa si el doc está vigente según la regla nueva (para hojas de faltantes). */
    const isVigenteForRow = (r: Row, doc: DocCell | undefined): boolean => {
      if (!doc?.exists) return false;
      const uploadedAt = this.parseFecha(doc?.uploaded_at as any);
      if (!uploadedAt) return false;
      const isOldBatch = uploadedAt.toISOString().slice(0, 10) === this.OLD_BATCH_DATE;
      if (isOldBatch) return false;
      const rc = rowCutoffFor(r);
      if (rc !== null) return uploadedAt.getTime() >= rc;
      // Sin fecha_contratacion: no se puede validar; no lo marcamos como faltante.
      return true;
    };

    const wb = new WorkbookCtor();
    wb.creator = 'TuAlianza';
    wb.created = new Date();

    const requestedSheets = [
      { sheet: 'PROCURADURIA', keywords: ['PROCURADURIA', 'PROCURADURÍA', 'PROCURAD'] },
      { sheet: 'CONTRALORIA', keywords: ['CONTRALORIA', 'CONTRALORÍA', 'CONTRAL'] },
      { sheet: 'OFAC', keywords: ['OFAC'] },
      { sheet: 'POLICIVOS', keywords: ['POLICIVO', 'POLICIVOS', 'POLICIA', 'ANTECEDENTE', 'ANTECEDENTES'] },
      { sheet: 'ADRESS', keywords: ['ADRESS', 'ADDRESS', 'DIRECCION', 'DIRECCIÓN', 'DOMICILIO', 'RESIDENCIA'] },
      { sheet: 'SISBEN', keywords: ['SISBEN', 'SISBÉN'] },
      { sheet: 'AFP', keywords: ['AFP', 'FONDO', 'FONDO DE PENSION', 'PENSION', 'PENSIONES'] },
    ];

    const resolvedDocs = requestedSheets.map(r => ({
      ...r,
      tipoId: pickTipoId(r.keywords),
    }));

    // =========================================================
    // 1) HOJA GENERAL
    // =========================================================
    const wsGeneral = wb.addWorksheet('GENERAL', { views: [{ state: 'frozen', ySplit: 1 }] });

    const baseColsGeneral = [
      { header: 'Céd.', key: 'cedula', width: 12 },
      { header: 'T.Doc', key: 'tipo_documento', width: 10 },
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Finca', key: 'finca', width: 14 },
      { header: 'F.Ing', key: 'fecha_ingreso', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
      { header: 'Cod.Cto', key: 'codigo_contrato', width: 12 },
    ];

    const tipoColsGeneral = this.tipoHeaders.flatMap(t => {
      const n = this.abbrDoc(t.name);
      return [
        { header: n, key: `t_${t.id}_estado`, width: 4 },
        { header: `F.${n}`, key: `t_${t.id}_fecha`, width: 16, style: { numFmt: 'yyyy-mm-dd hh:mm' } },
        { header: `L.${n}`, key: `t_${t.id}_link`, width: 6 },
      ];
    });

    wsGeneral.columns = [...baseColsGeneral, ...tipoColsGeneral];
    paintHeader(wsGeneral);

    const green = { argb: 'FF2E7D32' };
    const red = { argb: 'FFC62828' };
    const amber = { argb: 'FFF59E0B' };
    const linkBlue = { argb: 'FF2563EB' };

    for (const item of data) {
      const fechaIngreso = this.parseFecha(item.fecha_ingreso as any);

      const rowData: any = {
        cedula: item.cedula ?? '',
        tipo_documento: item.tipo_documento ?? '',
        nombre: item.nombre ?? '',
        finca: item.finca ?? '',
        fecha_ingreso: fechaIngreso ?? '',
        codigo_contrato: item.codigo_contrato ?? '',
      };

      this.tipoHeaders.forEach(t => {
        const doc = item.docs?.[t.id];
        const exists = !!doc?.exists;
        const controlled = this.isControlledType(t.name);

        const uploadedAt = this.parseFecha(doc?.uploaded_at as any);
        // Sólo validamos vigencia en tipos controlados; los demás se consideran OK si existen.
        const vigente15d = exists && (!controlled || isVigenteForRow(item, doc));

        rowData[`t_${t.id}_estado`] = !exists ? '✗' : vigente15d ? '✓' : '⚠';
        rowData[`t_${t.id}_fecha`] = uploadedAt ?? (doc?.uploaded_at ?? '');
        rowData[`t_${t.id}_link`] =
          exists && doc?.url ? { text: 'Abrir', hyperlink: String(doc.url) } : '';
      });

      const row = wsGeneral.addRow(rowData);

      if (row.number % 2 === 0) {
        row.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }

      this.tipoHeaders.forEach(t => {
        const estadoCell = row.getCell(`t_${t.id}_estado`);
        const fechaCell = row.getCell(`t_${t.id}_fecha`);
        const linkCell = row.getCell(`t_${t.id}_link`);

        const v = String(estadoCell.value ?? '');
        estadoCell.alignment = { vertical: 'middle', horizontal: 'center' };
        estadoCell.font = {
          name: 'Segoe UI Symbol',
          bold: true,
          color: v === '✓' ? green : v === '⚠' ? amber : red,
        };

        fechaCell.alignment = { vertical: 'middle', horizontal: 'center' };

        linkCell.alignment = { vertical: 'middle', horizontal: 'center' };
        if (linkCell.value && typeof linkCell.value === 'object') {
          linkCell.font = { color: linkBlue, underline: true };
        }
      });
    }

    wsGeneral.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: wsGeneral.columnCount },
    };

    // =========================================================
    // 2) HOJAS POR FALTANTES (una hoja por documento)
    // =========================================================
    const sheetColumns = [
      { header: 'Céd.', key: 'cedula', width: 12 },
      { header: 'T.Doc', key: 'tipo_documento', width: 10 },
      { header: 'Nombre', key: 'nombre', width: 22 },
      { header: 'Finca', key: 'finca', width: 14 },
      { header: 'F.Ing', key: 'fecha_ingreso', width: 12, style: { numFmt: 'yyyy-mm-dd' } },
      { header: 'Cod.Cto', key: 'codigo_contrato', width: 12 },
    ];

    for (const req of resolvedDocs) {
      const tipoId = req.tipoId;

      const ws = wb.addWorksheet(safeSheetName(req.sheet), {
        views: [{ state: 'frozen', ySplit: 1 }],
      });
      ws.columns = sheetColumns;
      paintHeader(ws);

      const missingRows = data
        .filter(r => {
          if (!tipoId) return false;
          const doc = r.docs?.[Number(tipoId)];
          if (!doc?.exists) return true; // missing
          // Incluir si NO está vigente según la nueva regla (fecha_contratacion - 15d)
          return !isVigenteForRow(r, doc);
        })
        .sort((a, b) => {
          const fa = String(a.finca ?? '').localeCompare(String(b.finca ?? ''), 'es', { sensitivity: 'base' });
          if (fa !== 0) return fa;
          return String(a.cedula ?? '').localeCompare(String(b.cedula ?? ''), 'es', { sensitivity: 'base' });
        });

      for (const r of missingRows) {
        const row = ws.addRow({
          cedula: r.cedula ?? '',
          tipo_documento: r.tipo_documento ?? '',
          nombre: r.nombre ?? '',
          finca: r.finca ?? '',
          fecha_ingreso: this.parseFecha(r.fecha_ingreso as any) ?? '',
          codigo_contrato: r.codigo_contrato ?? '',
        });

        if (row.number % 2 === 0) {
          row.eachCell((cell: any) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
          });
        }

        row.eachCell((cell: any) => {
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });
        row.getCell('nombre').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        row.getCell('finca').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      }

      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: ws.columnCount },
      };
    }

    // =========================================================
    // 3) HOJA: FALTANTES POR PERSONA
    // =========================================================
    const wsPersonas = wb.addWorksheet('FALTANTES_PERSONA', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    wsPersonas.columns = [
      { header: 'Identificación', key: 'identificacion', width: 16 },
      { header: 'Tipo documento', key: 'tipo_documento', width: 14 },
      { header: 'Nombre Y Apellidos', key: 'nombre_completo', width: 30 },
      { header: 'Primer Nombre', key: 'primer_nombre', width: 16 },
      { header: 'Segundo Nombre', key: 'segundo_nombre', width: 18 },
      { header: 'Primer Apellido', key: 'primer_apellido', width: 18 },
      { header: 'Segundo Apellido', key: 'segundo_apellido', width: 18 },
      { header: 'Documentación faltante', key: 'faltantes', width: 38 },
    ];
    paintHeader(wsPersonas);

    const personasConFaltantes = data
      .map(r => {
        const faltantes = resolvedDocs
          .filter(d => {
            if (!d.tipoId) return true;
            const doc = r.docs?.[Number(d.tipoId)];
            if (!doc?.exists) return true; // missing
            return !isVigenteForRow(r, doc);
          })
          .map(d => (d.tipoId ? d.sheet : `${d.sheet} (NO_MAPEADO)`));

        return { r, faltantes };
      })
      .filter(x => x.faltantes.length > 0)
      .sort((a, b) => {
        const fa = String(a.r.nombre ?? '').localeCompare(String(b.r.nombre ?? ''), 'es', { sensitivity: 'base' });
        if (fa !== 0) return fa;
        return String(a.r.cedula ?? '').localeCompare(String(b.r.cedula ?? ''), 'es', { sensitivity: 'base' });
      });

    for (const { r, faltantes } of personasConFaltantes) {
      const nombreCompleto = String(r.nombre ?? '').trim();
      const { pn, sn, pa, sa } = splitFullName(nombreCompleto);

      const row = wsPersonas.addRow({
        identificacion: r.cedula ?? '',
        tipo_documento: r.tipo_documento ?? '',
        nombre_completo: nombreCompleto,
        primer_nombre: pn,
        segundo_nombre: sn,
        primer_apellido: pa,
        segundo_apellido: sa,
        faltantes: faltantes.join(', '),
      });

      if (row.number % 2 === 0) {
        row.eachCell((cell: any) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
        });
      }

      row.eachCell((cell: any) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      row.getCell('nombre_completo').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
      row.getCell('faltantes').alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    }

    wsPersonas.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: wsPersonas.columnCount },
    };

    const blob = new Blob([await wb.xlsx.writeBuffer()], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const today = new Date().toISOString().slice(0, 10);
    saveAs(blob, `documentacion_general_y_faltantes_${today}.xlsx`);
  }
}
