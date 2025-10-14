import { Component, effect, input } from '@angular/core';
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

// ---------- Tipos / claves ----------
type UploadedFileInfo = {
  file?: File | string;
  fileName?: string;
  updatedAt?: number | string;
  updatedAtLabel?: string;
  changed?: boolean;
  loading?: boolean;
};

type DocKey =
  | 'eps' | 'afp' | 'policivos' | 'procuraduria' | 'contraloria'
  | 'ramaJudicial' | 'medidasCorrectivas' | 'sisben' | 'ofac'
  | 'figuraHumana' | 'pensionSemanas';

type AntecedenteNombre =
  | 'EPS' | 'AFP' | 'POLICIVOS' | 'PROCURADURIA' | 'CONTRALORIA'
  | 'RAMA_JUDICIAL' | 'SISBEN' | 'OFAC' | 'MEDIDAS_CORRECTIVAS' | 'SEMANAS_COTIZADAS';

type AntecedenteItem = { nombre: AntecedenteNombre; observacion: string | number | null };

// ---------- Constantes ----------
const DEFAULT_FILES: Record<DocKey, UploadedFileInfo> = {
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

type SeleccionPatch = {
  eps: string;
  afp: string;
  policivos: string;
  procuraduria: string;
  contraloria: string;
  ramaJudicial: string;
  sisben: string;
  ofac: string;
  medidasCorrectivas: string | number | ''; // '' para “sin valor”
  semanasCotizadas: number | '';            // '' para “sin valor”
};

const MAP_NOMBRE_TO_KEY: Record<string, keyof SeleccionPatch> = {
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

// Estados válidos en backend
const ESTADOS_VALIDOS = new Set(['CUMPLE', 'NO CUMPLE'] as const);

// ---------- Helpers puros ----------
const up = (v: unknown) => (v == null ? '' : String(v).toUpperCase().trim());
const isEmpty = (v: unknown) => v === '' || v === undefined || v === null;
const toNumOrEmpty = (v: unknown) => (isEmpty(v) ? '' : (Number.isFinite(Number(v)) ? Number(v) : ''));
const toNumOrNull = (v: unknown) => (isEmpty(v) ? null : Number(v));

/** Backend: solo 'CUMPLE' | 'NO CUMPLE'; todo lo demás => null */
function normalizeEstado(v: unknown): 'CUMPLE' | 'NO CUMPLE' | null {
  const s = up(v);
  return ESTADOS_VALIDOS.has(s as any) ? (s as 'CUMPLE' | 'NO CUMPLE') : null;
}
type ListSource = 'epsList' | 'afpList' | 'categoriasSisben' | 'medidasCorrectivas';
type FieldType = 'estado' | 'list' | 'number';

interface FieldDef {
  key: DocKey;               // usa tu DocKey existente
  label: string;
  type: FieldType;
  optionSource?: ListSource;
  placeholder?: string;
  control?: string;          // nombre alterno del formControl (ej. 'semanasCotizadas')
}

/** 'CUMPLE' | número | null */
function normalizeMedidasCorrectivas(v: unknown): number | 'CUMPLE' | null {
  if (isEmpty(v)) return null;
  const s = up(v);
  if (/^\d+$/.test(s)) return Number(s);
  return s === 'CUMPLE' ? 'CUMPLE' : null;
}

/** Mapea lista [{nombre, observacion}] o diccionario normalizado a patch del form */
/** Mapea lista [{nombre, observacion}] o diccionario normalizado a patch del form */
function buildPatchFromAntecedentes(raw: any): SeleccionPatch {
  const base: SeleccionPatch = {
    eps: '', afp: '', policivos: '', procuraduria: '', contraloria: '',
    ramaJudicial: '', sisben: '', ofac: '', medidasCorrectivas: '', semanasCotizadas: ''
  };

  // Diccionario normalizado (p. ej. { eps, policivos, ... })
  if (raw && !Array.isArray(raw) &&
    ('eps' in raw || 'policivos' in raw || 'ramaJudicial' in raw || 'medidasCorrectivas' in raw)) {
    return {
      ...base,
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

  // Lista [{ nombre, observacion }]
  const lista: any[] | undefined =
    Array.isArray(raw) ? raw :
      Array.isArray(raw?.proceso?.antecedentes) ? raw.proceso.antecedentes :
        Array.isArray(raw?.antecedentes) ? raw.antecedentes : undefined;

  if (!lista) return base;

  const out: SeleccionPatch = { ...base };
  for (const it of lista) {
    const key = MAP_NOMBRE_TO_KEY[up(it?.nombre)];
    if (!key) continue;

    if (key === 'semanasCotizadas') {
      out.semanasCotizadas = toNumOrEmpty(it?.observacion);
    } else if (key === 'medidasCorrectivas') {
      const obs = it?.observacion;
      out.medidasCorrectivas = isEmpty(obs)
        ? ''
        : (/^\d+$/.test(String(obs)) ? Number(obs) : up(obs));
    } else {
      out[key] = up(it?.observacion) as any;
    }
  }
  return out;
}

@Component({
  selector: 'app-selection-questions',
  standalone: true,
  imports: [SharedModule, MatTabsModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './selection-questions.component.html',
  styleUrls: ['./selection-questions.component.css']
})
export class SelectionQuestionsComponent {
  // Inputs (signals)
  candidatoSeleccionado = input<any | null>(null);

  // Cédula para servicios externos
  cedula: string | null = null;

  // Catálogos UI
  readonly antecedentesEstados = ['CUMPLE', 'NO CUMPLE', 'SIN BUSCAR'] as const;
  readonly epsList = [
    'ALIANSALUD', 'ASMET SALUD', 'CAJACOPI', 'CAPITAL SALUD', 'CAPRESOCA', 'COMFAMILIARHUILA',
    'COMFAORIENTE', 'COMPENSAR', 'COOSALUD', 'DUSAKAWI', 'ECOOPSOS', 'FAMISANAR',
    'FAMILIAR DE COLOMBIA', 'MUTUAL SER', 'NUEVA EPS', 'PIJAOS SALUD', 'SALUD TOTAL',
    'SANITAS', 'SAVIA SALUD', 'SOS', 'SURA', 'No Tiene', 'Sin Buscar',
  ] as const;
  readonly afpList = ['PORVENIR', 'COLFONDOS', 'PROTECCION', 'COLPENSIONES'] as const;
  readonly medidasCorrectivas = [...Array.from({ length: 11 }, (_, i) => i), 'CUMPLE'] as const;
  readonly categoriasSisben = [
    'A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7',
    'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13', 'C14', 'C15', 'C16', 'C17', 'C18',
    'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'D14', 'D15', 'D16', 'D17', 'D18', 'D19', 'D20', 'D21',
    'No Aplica', 'Sin Buscar'
  ] as const;

  // Map doc -> tipo backend
  readonly typeMap: Record<DocKey, number> = {
    eps: 7, policivos: 6, procuraduria: 3, contraloria: 4, medidasCorrectivas: 10,
    afp: 11, ramaJudicial: 12, sisben: 8, ofac: 5, figuraHumana: 31, pensionSemanas: 33
  };

  // Estado archivos
  uploadedFiles: Record<DocKey, UploadedFileInfo> = { ...DEFAULT_FILES };

  // Form
  antecedentes: FormGroup;

  // Token para invalidar cargas en carrera
  private _ctx = 0;

  constructor(
    private fb: FormBuilder,
    private gestionDocumental: GestionDocumentalService,
    private registroProceso: RegistroProcesoContratacion,
    private ui: UtilityServiceService
  ) {
    this.antecedentes = this.fb.group({
      eps: [''], afp: [''], policivos: [''], procuraduria: [''], contraloria: [''],
      ramaJudicial: [''], sisben: [''], ofac: [''], medidasCorrectivas: [''], semanasCotizadas: [null],
    });

    // Reacciona a cambios del candidato (objeto completo)
    effect(() => {
      const cand = this.candidatoSeleccionado();
      this.cedula = (cand?.numero_documento ?? cand?.numeroDocumento ?? null) as string | null;

      this.resetFiles();
      const proc = cand?.entrevistas?.[0]?.proceso;
      this.patchFormFromAntecedentes(proc?.antecedentes ?? null);

      const ctx = ++this._ctx;
      if (this.cedula) this.loadDataDocumentos(ctx);
    });
  }

  // Debe existir como propiedad pública
  public readonly fields: FieldDef[] = [
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

  // Necesario para *ngFor options
  public getOptions(fld: FieldDef): readonly (string | number)[] {
    switch (fld.optionSource) {
      case 'epsList': return this.epsList;
      case 'afpList': return this.afpList;
      case 'categoriasSisben': return this.categoriasSisben;
      case 'medidasCorrectivas': return this.medidasCorrectivas;
      default: return [];
    }
  }

  // Necesario para el warning de “> 15 días”
  public isOlderThan(key: DocKey, days: number): boolean {
    const entry = this.uploadedFiles[key];
    if (!entry) return false;
    let ts: number | undefined;
    if (typeof entry.updatedAt === 'number') ts = entry.updatedAt;
    else if (typeof entry.updatedAt === 'string') {
      const p = Date.parse(entry.updatedAt);
      ts = isNaN(p) ? undefined : p;
    }
    if (ts == null && entry.file instanceof File) ts = entry.file.lastModified;
    if (ts == null) return false;
    return (Date.now() - ts) > days * 24 * 60 * 60 * 1000;
  }

  // Helpers para evitar el error 7053 en el template al indexar con fld.key
  public fileBy(fld: FieldDef): UploadedFileInfo | undefined {
    return this.uploadedFiles[fld.key as DocKey];
  }
  public fileNameBy(fld: FieldDef): string | undefined {
    return this.uploadedFiles[fld.key as DocKey]?.fileName;
  }
  public updatedAtLabelBy(fld: FieldDef): string | undefined {
    return this.uploadedFiles[fld.key as DocKey]?.updatedAtLabel;
  }


  // ---------- UI helpers ----------
  estadoColor(val: string | null | undefined) {
    const v = up(val);
    if (v === 'CUMPLE') return '#2E7D32';
    if (v === 'NO CUMPLE') return '#C62828';
    return '#6E7781';
  }
  estadoIcon(val: string | null | undefined) {
    const v = up(val);
    if (v === 'CUMPLE') return 'check_circle';
    if (v === 'NO CUMPLE') return 'cancel';
    return 'help_outline';
  }

  // ---------- Carga al form ----------
  private patchFormFromAntecedentes(data: any) {
    this.antecedentes.patchValue(buildPatchFromAntecedentes(data), { emitEvent: false });
  }

  // ---------- Reset archivos ----------
  private resetFiles() {
    (Object.keys(this.typeMap) as DocKey[]).forEach(k => {
      this.uploadedFiles[k] = {
        file: undefined,
        fileName: k === 'pensionSemanas' ? 'Sin consultar' : 'Adjuntar documento',
        changed: false,
        updatedAt: undefined,
        updatedAtLabel: undefined,
        loading: true,
      };
    });
  }

  // ---------- Subir/ver archivos ----------
  verArchivo(key: DocKey) {
    const a = this.uploadedFiles[key];
    if (!a?.file) return void Swal.fire('Error', 'No se encontró archivo para este campo', 'error');

    if (typeof a.file === 'string') {
      window.open(encodeURI(a.file), '_blank', 'noopener,noreferrer');
    } else {
      const url = URL.createObjectURL(a.file);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 100);
    }
  }

  subirArchivo(event: any | Blob, key: DocKey, fileName?: string) {
    let file: File | null = null;

    if (event instanceof Blob && !(event as any).target) {
      file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
    } else if (event?.target?.files?.length) {
      file = event.target.files[0] as File;
    }
    if (!file) return;

    if (!file.name || file.name.length > 100)
      return void Swal.fire('Error', 'El nombre del archivo no debe exceder 100 caracteres', 'error');
    if (!(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')))
      return void Swal.fire('Error', 'Solo se permiten archivos PDF', 'error');

    this.uploadedFiles[key] = {
      file, fileName: file.name, changed: true, loading: false, updatedAt: undefined, updatedAtLabel: undefined
    };
  }

  onlyInteger(e: KeyboardEvent) {
    const ok = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (!ok.includes(e.key) && !/^\d$/.test(e.key)) e.preventDefault();
  }

  // ---------- Guardado ----------
  async imprimirVerificacionesAplicacion(): Promise<void> {
    // Con estos cambios, el form debería estar válido salvo otros campos

    const numero = (this.candidatoSeleccionado()?.numero_documento ?? this.candidatoSeleccionado()?.numeroDocumento ?? '').toString().trim();
    if (!numero) return void Swal.fire('Error', 'No se encontró el número de documento del candidato.', 'error');

    const v = this.antecedentes.value;
    const payload = {
      eps: isEmpty(v.eps) ? null : v.eps,
      afp: isEmpty(v.afp) ? null : v.afp,
      policivos: normalizeEstado(v.policivos),
      procuraduria: normalizeEstado(v.procuraduria),
      contraloria: normalizeEstado(v.contraloria),
      ramaJudicial: normalizeEstado(v.ramaJudicial), // evita 400 por "" inválido
      sisben: isEmpty(v.sisben) ? null : v.sisben,
      ofac: normalizeEstado(v.ofac),
      medidasCorrectivas: normalizeMedidasCorrectivas(v.medidasCorrectivas),
      semanasCotizadas: toNumOrNull(v.semanasCotizadas),
    };

    try {
      await firstValueFrom(this.registroProceso.upsertSeleccionByDocumento(numero, payload));
      await Swal.fire('¡Guardado!', 'Se actualizaron los antecedentes del proceso.', 'success');
      await this.subirTodosLosArchivos(Object.keys(this.typeMap) as DocKey[]);
    } catch (err: any) {
      const msg = err?.error?.detail || 'No fue posible guardar los antecedentes.';
      await Swal.fire('Error', msg, 'error');
    }
  }

  private async subirTodosLosArchivos(keys: DocKey[]) {
    if (!this.cedula) return;

    const tareas = keys
      .filter(k => this.uploadedFiles[k]?.changed && this.uploadedFiles[k].file instanceof File)
      .map(k => {
        const it = this.uploadedFiles[k];
        const typeId = this.typeMap[k];
        return new Promise<DocKey>((resolve, reject) => {
          this.gestionDocumental
            .guardarDocumento(it.fileName || 'documento.pdf', this.cedula!, typeId, it.file as File)
            .subscribe({
              next: () => {
                it.changed = false;
                it.updatedAt = new Date().toISOString();
                it.updatedAtLabel = this.formatFecha(it.updatedAt as string);
                resolve(k);
              },
              error: (e) => reject({ k, e }),
            });
        });
      });

    if (!tareas.length) return;

    const res = await Promise.allSettled(tareas);
    const ok = res.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<DocKey>).value);
    const ko = res.filter(r => r.status === 'rejected').map(r => (r as any).reason?.k as DocKey);

    if (ko.length === 0) {
      Swal.fire('¡Listo!', 'Todos los documentos se subieron correctamente.', 'success');
    } else {
      if (ok.length) Swal.fire('¡Listo!', `Se subieron: ${ok.map(k => k.toUpperCase()).join(', ')}`, 'success');
      Swal.fire('Error', `No se pudieron subir: ${ko.map(k => k.toUpperCase()).join(', ')}`, 'error');
    }
  }

  private formatFecha(iso?: string) {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return undefined;
    try {
      return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
    } catch {
      return d.toLocaleString();
    }
  }

  // ---------- Documentos previos ----------
  private async loadDataDocumentos(ctx: number) {
    try {
      const docs: any[] = await firstValueFrom(this.gestionDocumental.obtenerDocumentosPorTipo(this.cedula!, 2));
      if (ctx !== this._ctx || !Array.isArray(docs)) return;

      for (const d of docs) {
        if (ctx !== this._ctx) return;

        const key = (Object.keys(this.typeMap) as DocKey[]).find(k => this.typeMap[k] === d.type);
        if (!key) continue;

        const file = await this.urlToFile(d.file_url, d.title || 'Documento.pdf');
        if (ctx !== this._ctx) return;

        const iso: string | undefined = d.uploaded_at || undefined;
        this.uploadedFiles[key] = {
          fileName: d.title || 'Documento',
          file,
          updatedAt: iso,
          updatedAtLabel: this.formatFecha(iso),
          changed: false,
          loading: false,
        };
      }
    } catch (err: any) {
      if (err?.error?.error !== 'No se encontraron documentos') {
        Swal.fire('¡Error!', 'No se pudieron obtener los documentos de antecedentes', 'error');
      }
    }
  }

  private async urlToFile(url: string, fileName: string): Promise<File> {
    const res = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), {
      cache: 'no-store', mode: 'cors', referrerPolicy: 'strict-origin-when-cross-origin'
    });
    if (!res.ok) throw new Error(`No se pudo descargar: ${res.status} ${res.statusText}`);
    const blob = await res.blob();
    const type = blob.type || (fileName.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream');
    return new File([blob], fileName, { type });
  }
}
