import {  Component, effect, input , ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from '@/app/shared/shared.module';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import type { AntecedentesPayload } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';

/* ===================== Tipos ===================== */
type UploadedFileInfo = {
  file?: File | string;
  fileName?: string;
  updatedAt?: number | string;
  updatedAtLabel?: string;
  changed?: boolean;
  loading?: boolean;
  error?: string | null;
};

type DocKey =
  | 'eps' | 'afp' | 'policivos' | 'procuraduria' | 'contraloria'
  | 'ramaJudicial' | 'medidasCorrectivas' | 'sisben' | 'ofac'
  | 'figuraHumana' | 'pensionSemanas';

type ListSource = 'epsList' | 'afpList' | 'categoriasSisben' | 'medidasCorrectivas';
type FieldType = 'estado' | 'list' | 'number';

interface FieldDef {
  key: DocKey;
  label: string;
  type: FieldType;
  optionSource?: ListSource;
  placeholder?: string;
  control?: string;
}

/* ===== Cola de antecedentes (viene del backend) ===== */
type ColaKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo_pension'
  | 'medidas_correctivas';

interface ColaItem {
  estado: 'FINALIZADO' | 'EN_PROGRESO' | 'SIN_CONSULTAR' | 'DESCARGADO ROBOT' | 'SIN_REGISTRO' | string;
  faltan_antes: number | null;
}

type ColaRaw = Partial<Record<ColaKey, ColaItem>>;

/* ============== Constantes (catálogos/UI) ============== */
const DEFAULT_UPLOADED_FILES: Record<DocKey, UploadedFileInfo> = {
  eps: { fileName: 'Adjuntar documento' },
  afp: { fileName: 'Adjuntar documento' },
  policivos: { fileName: 'Adjuntar documento' },
  procuraduria: { fileName: 'Adjuntar documento' },
  contraloria: { fileName: 'Adjuntar documento' },
  ramaJudicial: { fileName: 'Adjuntar documento' },
  medidasCorrectivas: { fileName: 'Adjuntar documento' },
  sisben: { fileName: 'Adjuntar documento' },
  ofac: { fileName: 'Adjuntar documento' },
  figuraHumana: { fileName: 'Adjuntar documento' },
  pensionSemanas: { fileName: 'Sin consultar' },
};

/* Keys que maneja el patch del formulario */
type FormPatchKeys =
  | 'eps' | 'afp' | 'policivos' | 'procuraduria' | 'contraloria'
  | 'ramaJudicial' | 'sisben' | 'ofac' | 'medidasCorrectivas' | 'semanasCotizadas';

type FormPatchBase = Record<FormPatchKeys, string | number | null>;

/* nombre (BD) -> key de form */
const MAP_NOMBRE_TO_KEY: Record<string, FormPatchKeys> = {
  EPS: 'eps',
  AFP: 'afp',
  POLICIVOS: 'policivos',
  PROCURADURIA: 'procuraduria',
  CONTRALORIA: 'contraloria',
  RAMA_JUDICIAL: 'ramaJudicial',
  SISBEN: 'sisben',
  OFAC: 'ofac',
  MEDIDAS_CORRECTIVAS: 'medidasCorrectivas',
  SEMANAS_COTIZADAS: 'semanasCotizadas',
};

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-selection-questions',
  standalone: true,
  imports: [SharedModule, MatTabsModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './selection-questions.component.html',
  styleUrls: ['./selection-questions.component.css'],
} )
export class SelectionQuestionsComponent {
  /* -------- Input (signal) -------- */
  candidatoSeleccionado = input<any | null>(null);

  /* -------- Form -------- */
  antecedentes: FormGroup;

  /** Patch-base del form para reinicios/control de tipos */
  readonly formPatchBase: FormPatchBase = {
    eps: '', afp: '', policivos: '', procuraduria: '', contraloria: '',
    ramaJudicial: '', sisben: '', ofac: '', medidasCorrectivas: '', semanasCotizadas: ''
  };

  /* -------- Catálogos -------- */
  readonly estados = ['CUMPLE', 'NO CUMPLE', 'SIN BUSCAR'] as const;
  readonly epsList = [
    'ALIANSALUD', 'ASMET SALUD', 'CAJACOPI', 'CAPITAL SALUD', 'CAPRESOCA', 'COMFAMILIARHUILA',
    'COMFAORIENTE', 'COMPENSAR', 'COOSALUD', 'DUSAKAWI', 'ECOOPSOS', 'FAMISANAR',
    'FAMILIAR DE COLOMBIA', 'MUTUAL SER', 'NUEVA EPS', 'PIJAOS SALUD', 'SALUD TOTAL',
    'SANITAS', 'SAVIA SALUD', 'SOS', 'SURA', 'No Tiene', 'Sin Buscar',
  ] as const;
  readonly afpList = ['PORVENIR', 'COLFONDOS', 'PROTECCION', 'COLPENSIONES'] as const;
  readonly categoriasSisben = [
    'A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18',
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21',
    'No Aplica', 'Sin Buscar'
  ] as const;
  readonly medidasCorrectivasOpts = [...Array.from({ length: 11 }, (_, i) => i), 'CUMPLE'] as const;

  /* -------- Definición de campos (data-driven) -------- */
  readonly fields: FieldDef[] = [
    { key: 'policivos', label: 'Policivos', type: 'estado' },
    { key: 'procuraduria', label: 'Procuraduría', type: 'estado' },
    { key: 'contraloria', label: 'Contraloría', type: 'estado' },
    { key: 'ofac', label: 'OFAC', type: 'estado' },
    { key: 'ramaJudicial', label: 'Rama Judicial', type: 'estado' },

    { key: 'eps', label: 'EPS', type: 'list', optionSource: 'epsList', placeholder: 'EPS' },
    { key: 'sisben', label: 'Sisbén', type: 'list', optionSource: 'categoriasSisben' },
    { key: 'afp', label: 'AFP', type: 'list', optionSource: 'afpList', placeholder: 'AFP' },
    { key: 'medidasCorrectivas', label: 'Medidas Correctivas', type: 'list', optionSource: 'medidasCorrectivas' },

    { key: 'pensionSemanas', label: 'Semanas cotizadas', type: 'number', control: 'semanasCotizadas' },
  ];

  /* -------- Documentos -------- */
  readonly typeMap: Record<DocKey, number> = {
    eps: 7, policivos: 6, procuraduria: 3, contraloria: 4, medidasCorrectivas: 10,
    afp: 11, ramaJudicial: 12, sisben: 8, ofac: 5, figuraHumana: 31, pensionSemanas: 33
  };
  uploadedFiles: Record<DocKey, UploadedFileInfo> = { ...DEFAULT_UPLOADED_FILES };

  /* -------- Estado/ctx -------- */
  private _ctx = 0;
  cedula: string | null = null;

  /* -------- Cola de antecedentes (para la UI) -------- */
  private colaRaw: ColaRaw | null = null;

  /** Mapa de campos del formulario -> clave en cola_antecedentes */
  /** Mapa de campos del formulario -> clave en cola_antecedentes */
  private readonly colaKeyMap: Record<DocKey, ColaKey | null> = {
    // con cola
    eps: 'adress',                      // ← EPS usa 'adress'
    policivos: 'policivo',
    ramaJudicial: 'policivo',           // ← Rama Judicial también usa 'policivo'
    procuraduria: 'procuraduria',
    contraloria: 'contraloria',
    ofac: 'ofac',
    sisben: 'sisben',
    medidasCorrectivas: 'medidas_correctivas',
    // opcional (muestra la cola de AFP):
    afp: 'fondo_pension',               // ← quítalo si no la quieres mostrar

    // sin cola
    figuraHumana: null,
    pensionSemanas: null,
  };


  constructor(
    private fb: FormBuilder,
    private docsSrv: GestionDocumentalService,
    private rpc: RegistroProcesoContratacion,
    private ui: UtilityServiceService
  ) {
    // Reactive Forms
    this.antecedentes = this.fb.group({
      eps: [''],
      afp: [''],
      policivos: [''],
      procuraduria: [''],
      contraloria: [''],
      ramaJudicial: [''],
      sisben: [''],
      ofac: [''],
      medidasCorrectivas: [''],
      semanasCotizadas: [null],
    });

    // Reacciona al candidato seleccionado
    effect(() => {
      const candidato = this.candidatoSeleccionado();
      // Fix: proceso (no "processo")
      const proc = candidato?.entrevistas?.[0]?.proceso;
      this.cedula = (candidato?.numero_documento ?? candidato?.numeroDocumento ?? null) as string | null;

      // Cola de antecedentes (camelCase o snake_case)
      this.colaRaw = (candidato?.cola_antecedentes ?? candidato?.colaAntecedentes ?? null) as ColaRaw | null;

      this.resetUploadedFilesAsNew();
      this.patchSeleccion(proc?.antecedentes ?? null);

      // opcional: precargar documentos ya existentes
      const ctx = ++this._ctx;
      if (this.cedula) this.loadDataDocumentos(ctx).catch((err) => console.error('[selection] Error cargando documentos:', err));
    });
  }

  /* ===================== Helpers de UI/Template ===================== */
  controlName(fld: FieldDef): string { return fld.control ?? fld.key; }
  docKey(fld: FieldDef): DocKey { return fld.key; }
  getOptions(fld: FieldDef): readonly (string | number)[] {
    switch (fld.optionSource) {
      case 'epsList': return this.epsList;
      case 'afpList': return this.afpList;
      case 'categoriasSisben': return this.categoriasSisben;
      case 'medidasCorrectivas': return this.medidasCorrectivasOpts;
      default: return [];
    }
  }
  estadoIcon(v: string | null | undefined): string {
    const s = (v ?? '').toUpperCase();
    if (s === 'CUMPLE') return 'check_circle';
    if (s === 'NO CUMPLE') return 'cancel';
    return 'help_outline';
  }
  estadoColor(v: string | null | undefined): string {
    const s = (v ?? '').toUpperCase();
    if (s === 'CUMPLE') return '#2E7D32';
    if (s === 'NO CUMPLE') return '#C62828';
    return '#6E7781';
  }
  trackByIndex(index: number): number { return index; }

  /* ===== Cola: helpers que usa el template para la píldora ===== */
  hasQueue(fld: FieldDef): boolean {
    const k = this.colaKeyMap[fld.key];
    return !!(k && this.colaRaw && this.colaRaw[k]);
  }

  colaEstado(fld: FieldDef): string | null {
    const k = this.colaKeyMap[fld.key];
    const it = k ? this.colaRaw?.[k] : undefined;
    if (!it) return null;
    // normaliza: FINALIZADO también se muestra como DESCARGADO ROBOT
    if ((it.estado || '').toUpperCase() === 'FINALIZADO') return 'DESCARGADO ROBOT';
    return it.estado || null;
  }

  queueDetailFor(fld: FieldDef): { finalizado: boolean, enProgreso: boolean, faltan: number | null } | null {
    const k = this.colaKeyMap[fld.key];
    const it = k ? this.colaRaw?.[k] : undefined;
    if (!it) return null;

    const est = (it.estado || '').toUpperCase();
    if (est === 'FINALIZADO' || est === 'DESCARGADO ROBOT') {
      return { finalizado: true, enProgreso: false, faltan: 0 };
    }
    if (est === 'EN_PROGRESO') {
      return { finalizado: false, enProgreso: true, faltan: null };
    }
    return { finalizado: false, enProgreso: false, faltan: typeof it.faltan_antes === 'number' ? it.faltan_antes : null };
  }

  queueLabelFor(fld: FieldDef): string {
    const k = this.colaKeyMap[fld.key];
    const it = k ? this.colaRaw?.[k] : undefined;
    if (!it) return '—';
    const estado = (it.estado || '').toUpperCase();
    if (estado === 'DESCARGADO ROBOT' || estado === 'FINALIZADO') return 'DESCARGADO ROBOT';
    if (typeof it.faltan_antes === 'number') return `${it.faltan_antes} antes`;
    return '—';
  }

  queueTooltipFor(fld: FieldDef): string {
    const k = this.colaKeyMap[fld.key];
    const it = k ? this.colaRaw?.[k] : undefined;
    if (!it) return 'Sin datos de cola';
    const estado = (it.estado || '').toUpperCase();
    if (estado === 'DESCARGADO ROBOT' || estado === 'FINALIZADO') {
      return 'Este antecedente ya fue DESCARGADO ROBOT.';
    }
    const n = typeof it.faltan_antes === 'number' ? it.faltan_antes : null;
    return n == null
      ? `Estado: ${estado}`
      : `Estado: ${estado} · Faltan ${n} antes en la cola`;
  }

  queuePillClass(fld: FieldDef): string {
    const est = (this.colaEstado(fld) || '').toUpperCase();
    if (est === 'DESCARGADO ROBOT') return 'q-pill q-ok';
    if (est === 'EN_PROGRESO') return 'q-pill q-progress';
    if (est === 'SIN_CONSULTAR') return 'q-pill q-wait';
    return 'q-pill q-none';
  }

  /* ===================== Carga antecedentes -> form ===================== */
  private patchSeleccion(raw: any): void {
    const patch = buildPatchFromAntecedentes(raw, this.formPatchBase);
    this.antecedentes.patchValue(patch, { emitEvent: false });
  }

  /* ===================== Documentos (estado/descarga/subida) ===================== */
  private resetUploadedFilesAsNew(): void {
    (Object.keys(this.typeMap) as DocKey[]).forEach(k => {
      this.uploadedFiles[k] = {
        file: undefined,
        fileName: k === 'pensionSemanas' ? 'Sin consultar' : 'Adjuntar documento',
        changed: false,
        updatedAt: undefined,
        updatedAtLabel: undefined,
        loading: true,
        error: null,
      };
    });
  }

  async loadDataDocumentos(ctx: number): Promise<Set<DocKey>> {
    const tocados = new Set<DocKey>();
    if (!this.cedula) return tocados;

    try {
      // Fetch ALL documents for this user (no type filter)
      const docs: any[] = await firstValueFrom(this.docsSrv.getDocuments(this.cedula));
      if (ctx !== this._ctx || !Array.isArray(docs)) return tocados;

      // Reset all uploadedFiles to default before populating
      // This ensures we start clean and fill only what exists
      this.resetUploadedFilesAsNew();

      for (const d of docs) {
        if (ctx !== this._ctx) break;
        // Find which key corresponds to this doc type
        const typeKey = (Object.keys(this.typeMap) as DocKey[]).find(k => this.typeMap[k] === d.type);
        if (!typeKey) continue;

        const nombre = d.original_filename || d.title || 'Documento sin título';
        const fileUrl = d.file_url; // Use URL directly
        const iso: string | undefined = d.uploaded_at || undefined;

        // Update the file entry
        this.uploadedFiles[typeKey] = {
          fileName: nombre,
          file: fileUrl, // Store string URL
          updatedAt: iso,
          updatedAtLabel: this.formatFecha(iso),
          changed: false,
          loading: false,
          error: null,
        };
        tocados.add(typeKey);
      }
    } catch (err: any) {
      // If 404/Not Found, just means no docs, which is fine.
      if (err?.error?.error !== 'No se encontraron documentos') {
        console.error('Error loading documents:', err);
      }
    }
    return tocados;
  }

  verArchivo(key: DocKey) {
    const entry = this.uploadedFiles[key];
    const f = entry?.file;
    if (!f) return void Swal.fire('Error', 'No se encontró archivo para este campo', 'error');

    if (typeof f === 'string') {
      window.open(encodeURI(f), '_blank', 'noopener,noreferrer');
    } else {
      const url = URL.createObjectURL(f);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 150);
    }
  }

  subirArchivo(event: any | Blob, key: DocKey, fileName?: string): void {
    let file: File | null = null;

    if (event instanceof Blob && !(event as any).target) {
      file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
    } else if (event?.target?.files?.length) {
      file = event.target.files[0] as File;
    }
    if (!file) return;

    const nameOk = file.name && file.name.length <= 100;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!nameOk) return void Swal.fire('Error', 'El nombre no debe exceder 100 caracteres', 'error');
    if (!isPdf) return void Swal.fire('Error', 'Solo se permiten archivos PDF', 'error');

    this.uploadedFiles[key] = {
      file,
      fileName: file.name,
      changed: true,
      loading: false,
      updatedAt: undefined,
      updatedAtLabel: undefined,
      error: null,
    };
  }

  isOlderThan(key: DocKey, days: number): boolean {
    const entry = this.uploadedFiles[key];
    if (!entry) return false;
    let ts: number | undefined;

    if (typeof entry.updatedAt === 'number') ts = entry.updatedAt;
    else if (typeof entry.updatedAt === 'string') {
      const p = Date.parse(entry.updatedAt);
      if (!Number.isNaN(p)) ts = p;
    } else if (entry.file instanceof File) {
      ts = entry.file.lastModified;
    }
    if (ts == null) return false;

    return (Date.now() - ts) > (days * 24 * 60 * 60 * 1000);
  }

  private formatFecha(iso?: string): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return undefined;
    try {
      return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
    } catch {
      return d.toLocaleString();
    }
  }



  onlyInteger(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  /* ===================== Guardar selección + subir PDFs ===================== */
  async imprimirVerificacionesAplicacion(): Promise<void> {
    if (this.antecedentes.invalid) {
      this.antecedentes.markAllAsTouched();
      await Swal.fire('Campos incompletos', 'Revisa los campos obligatorios.', 'warning');
      return;
    }
    const cand = this.candidatoSeleccionado?.();
    const numero = (cand?.numero_documento ?? cand?.numeroDocumento ?? '').toString().trim();
    if (!numero) {
      await Swal.fire('Error', 'No se encontró el número de documento del candidato.', 'error');
      return;
    }

    const v: Record<string, unknown> = this.antecedentes.value ?? {};

    // ------ Normalizadores fuertes ------
    const toUpperStrOrNull = (x: unknown): string | null => {
      const s = (x ?? '').toString().trim().toUpperCase();
      return s ? s : null;
    };
    const normalizeEstado = (x: unknown): 'CUMPLE' | 'NO CUMPLE' | null => {
      const s = (x ?? '').toString().trim().toUpperCase();
      return s === 'CUMPLE' || s === 'NO CUMPLE' ? s : null;
    };
    const toNumOrNull = (x: unknown): number | null => (x === '' || x == null ? null : Number(x));

    // Medidas correctivas: número o 'CUMPLE', otro -> null
    let medidas: number | 'CUMPLE' | null = null;
    const mc = v['medidasCorrectivas'];
    if (mc !== '' && mc != null) {
      const s = String(mc).trim().toUpperCase();
      medidas = /^\d+$/.test(s) ? Number(s) : (s === 'CUMPLE' ? 'CUMPLE' : null);
    }

    const payload: AntecedentesPayload = {
      eps: toUpperStrOrNull(v['eps']),
      afp: toUpperStrOrNull(v['afp']),
      policivos: normalizeEstado(v['policivos']),
      procuraduria: normalizeEstado(v['procuraduria']),
      contraloria: normalizeEstado(v['contraloria']),
      ramaJudicial: normalizeEstado(v['ramaJudicial']),
      sisben: toUpperStrOrNull(v['sisben']),
      ofac: normalizeEstado(v['ofac']),
      medidasCorrectivas: medidas,
      semanasCotizadas: toNumOrNull(v['semanasCotizadas']),
    };

    try {
      await firstValueFrom(this.rpc.upsertSeleccionByDocumento(numero, payload));
      await Swal.fire('¡Guardado!', 'Se actualizaron los antecedentes del proceso.', 'success');

      const res = await this.subirTodosLosArchivos(Object.keys(this.typeMap) as DocKey[]);

      if (res.todosOk) {
        Swal.fire('¡Listo!', 'Todos los documentos se subieron correctamente.', 'success');
      } else {
        // Build detailed error message
        const listaErrores = res.fallidos.map(f => `<li><b>${f.key}:</b> ${f.error}</li>`).join('');
        const htmlMsg = `
          <p>Algunos documentos no se pudieron subir:</p>
          <ul style="text-align: left; margin-bottom: 0;">${listaErrores}</ul>
        `;

        Swal.fire({
          title: 'Atención',
          html: htmlMsg,
          icon: 'warning',
          confirmButtonText: 'Entendido'
        });
      }
    } catch (err: any) {
      console.error('[selection] Error guardando antecedentes:', err);
      const body = err?.error;
      let msg = '';
      if (body?.detail) {
        msg = body.detail;
      } else if (body && typeof body === 'object') {
        const entries = Object.entries(body).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`);
        msg = entries.length ? entries.join(' | ') : 'No fue posible guardar los antecedentes.';
      } else {
        msg = err?.message || 'No fue posible guardar los antecedentes. Verifique su conexión.';
      }
      await Swal.fire('Error', msg, 'error');
    }
  }

  async subirTodosLosArchivos(
    keys: DocKey[]
  ): Promise<{ todosOk: boolean; exitosos: DocKey[]; fallidos: { key: DocKey; error: string }[] }> {
    const ced = this.cedula;
    if (!ced) return { todosOk: true, exitosos: [], fallidos: [] };

    const aEnviar = keys
      .filter(k => !!this.uploadedFiles[k]?.changed && this.uploadedFiles[k].file instanceof File)
      .map(k => ({
        key: k,
        file: this.uploadedFiles[k].file as File,
        fileName: this.uploadedFiles[k].fileName ?? 'documento.pdf',
        typeId: this.typeMap[k],
      }));

    if (!aEnviar.length) return { todosOk: true, exitosos: [], fallidos: [] };

    // Reset errors for sending files
    aEnviar.forEach(({ key }) => {
      if (this.uploadedFiles[key]) this.uploadedFiles[key].error = null;
    });

    const promesas = aEnviar.map(({ key, file, fileName, typeId }) =>
      new Promise<void>((resolve, reject) => {
        this.docsSrv.guardarDocumento(fileName, ced, typeId, file).subscribe({
          next: () => {
            const entry = this.uploadedFiles[key];
            if (entry) {
              entry.changed = false;
              entry.updatedAt = new Date().toISOString();
              entry.updatedAtLabel = this.formatFecha(entry.updatedAt as string);
              entry.error = null;
            }
            resolve();
          },
          error: (err) => {
            let msg = 'Error desconocido';
            if (err?.error?.error) {
              const e = err.error.error;
              msg = Array.isArray(e) ? e.join(', ') : String(e);
            } else if (err?.error?.detail) {
              msg = err.error.detail;
            } else if (err?.message) {
              msg = err.message;
            }

            // Guardar error en estado local también (opcional para mostrar en UI inline)
            if (this.uploadedFiles[key]) {
              this.uploadedFiles[key].error = msg;
            }
            reject(new Error(msg));
          },
        });
      })
    );

    const settled = await Promise.allSettled(promesas);
    const exitosos: DocKey[] = [];
    const fallidos: { key: DocKey; error: string }[] = [];
    settled.forEach((r, i) => {
      const key = aEnviar[i].key;
      if (r.status === 'fulfilled') {
        exitosos.push(key);
      } else {
        const reason = (r as PromiseRejectedResult).reason;
        const msg = reason?.message || String(reason);
        fallidos.push({ key, error: msg });
      }
    });

    return { todosOk: fallidos.length === 0, exitosos, fallidos };
  }
}

/* ===================== Helpers puros (fuera de la clase) ===================== */
function up(v: unknown): string { return v == null ? '' : String(v).toUpperCase().trim(); }
function isEmpty(v: unknown): boolean { return v === '' || v == null; }
function toNumOrEmpty(v: unknown): number | '' {
  if (v === '' || v == null) return '';
  const n = Number(v);
  return Number.isFinite(n) ? n : '';
}

/** Recibe la lista [{nombre, observacion}] o un diccionario normalizado y devuelve un patch para el form */
function buildPatchFromAntecedentes(raw: any, base: FormPatchBase): FormPatchBase {
  const initial: FormPatchBase = { ...base };

  // Diccionario normalizado
  if (raw && !Array.isArray(raw) && (raw.eps || raw.policivos || raw.ramaJudicial || raw.medidasCorrectivas)) {
    return {
      ...initial,
      eps: up(raw.eps),
      afp: up(raw.afp),
      policivos: up(raw.policivos),
      procuraduria: up(raw.procuraduria),
      contraloria: up(raw.contraloria),
      ramaJudicial: up(raw.ramaJudicial ?? raw.rama_judicial),
      sisben: up(raw.sisben),
      ofac: up(raw.ofac),
      medidasCorrectivas: up(raw.medidasCorrectivas),
      semanasCotizadas: toNumOrEmpty(raw.semanasCotizadas ?? raw.semanas_cotizadas),
    };
  }

  // Lista [{nombre, observacion}]
  const lista: Array<{ nombre?: string; observacion?: any; }> | undefined =
    Array.isArray(raw) ? raw :
      Array.isArray(raw?.proceso?.antecedentes) ? raw.proceso.antecedentes :
        Array.isArray(raw?.antecedentes) ? raw.antecedentes : undefined;

  if (!lista) return initial;

  const out: any = { ...initial };
  for (const it of lista) {
    const key = MAP_NOMBRE_TO_KEY[up(it?.nombre)];
    if (!key) continue;

    if (key === 'semanasCotizadas') {
      out['semanasCotizadas'] = toNumOrEmpty(it?.observacion);
    } else if (key === 'medidasCorrectivas') {
      const obs = it?.observacion;
      out['medidasCorrectivas'] = isEmpty(obs) ? '' : (/^\d+$/.test(String(obs)) ? Number(obs) : up(obs));
    } else {
      out[key] = up(it?.observacion);
    }
  }
  return out as FormPatchBase;
}
