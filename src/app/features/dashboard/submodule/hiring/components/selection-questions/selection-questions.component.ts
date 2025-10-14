import { Component, effect, input, OnInit } from '@angular/core';
import { SharedModule } from '@/app/shared/shared.module';
import { FormBuilder, FormGroup } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import Swal from 'sweetalert2';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { firstValueFrom } from 'rxjs';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

type UploadedFileInfo = {
  file?: File | string;
  fileName?: string;
  updatedAt?: number | string;
  updatedAtLabel?: string;
  changed?: boolean;
  loading?: boolean; // visual mientras carga del backend
};

// Llaves tipadas para evitar typos
type DocKey =
  | 'eps' | 'afp' | 'policivos' | 'procuraduria' | 'contraloria'
  | 'ramaJudicial' | 'medidasCorrectivas' | 'sisben' | 'ofac'
  | 'figuraHumana' | 'pensionSemanas';

// Datos que esperamos del backend para pre-llenar el form
type Maybe<T> = T | null | undefined;

export interface AntecedentesData {
  eps?: string;
  afp?: string;
  policivos?: string;
  procuraduria?: string;
  contraloria?: string;
  ramaJudicial?: string;                // camelCase
  rama_judicial?: string;               // snake_case
  sisben?: string;
  ofac?: string;
  medidasCorrectivas?: string | number; // camelCase
  medidas_correctivas?: string | number;// snake_case
  semanasCotizadas?: number | string;   // camelCase
  semanas_cotizadas?: number | string;  // snake_case
  area_aplica?: string;
  [k: string]: any;                     // otros campos que vengan del backend
}

interface SeleccionPorIdResponse {
  procesoSeleccion?: Maybe<AntecedentesData>;
}

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

@Component({
  selector: 'app-selection-questions',
  imports: [SharedModule, MatTabsModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './selection-questions.component.html',
  styleUrl: './selection-questions.component.css'
})
export class SelectionQuestionsComponent implements OnInit {
  // Inputs como signals
  cedula = input<string>('');
  vacanteSeleccionada = input<any>(null);
  idProcesoSeleccion = input<number | null>(null);
  idInfoEntrevistaAndrea = input<number | null>(null);

  private _ready = false;
  private _prev = {
    cedula: undefined as string | undefined,
    vacante: undefined as any,
    idProceso: undefined as number | null | undefined,
    idInfoEntrevistaAndrea: undefined as number | null | undefined
  };

  // Catálogos (readonly para no mutar accidentalmente)
  readonly antecedentesEstados = ['Cumple', 'No Cumple', 'Sin Buscar'] as const;
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

  // formulario (sin requeridos)
  antecedentes: FormGroup;

  // Mapea cada doc a su tipo en backend
  readonly typeMap: Record<DocKey, number> = {
    eps: 7,
    policivos: 6,
    procuraduria: 3,
    contraloria: 4,
    medidasCorrectivas: 10,
    afp: 11,
    ramaJudicial: 12,
    sisben: 8,
    ofac: 5,
    figuraHumana: 31,
    pensionSemanas: 33
  };

  // Estado de archivos por clave
  uploadedFiles: Record<DocKey, UploadedFileInfo> = { ...DEFAULT_UPLOADED_FILES };

  // token anti-carrera
  private _ctx = 0;

  constructor(
    private fb: FormBuilder,
    private gestionDocumentalService: GestionDocumentalService,
    private seleccionService: SeleccionService,
    private utilityService: UtilityServiceService
  ) {
    // NOTA: Nada requerido; semanasCotizadas es nullable
    this.antecedentes = this.fb.group({
      eps: [''],
      afp: [''],
      policivos: [''],
      procuraduria: [''],
      contraloria: [''],
      ramaJudicial: [''],
      sisben: [''],
      ofac: [''],
      medidasCorrectivas: [''], // opcional
      semanasCotizadas: [null], // opcional y nullable
      // area_aplica: [''],
    });

    // Un único efecto que registra cambios por input
    effect(() => {
      const c = this.cedula();
      const v = this.vacanteSeleccionada();
      const id = this.idProcesoSeleccion();
      const idInfo = this.idInfoEntrevistaAndrea();

      this.onInputsChanged(c, v, id, idInfo);
      this._prev = { cedula: c, vacante: v, idProceso: id, idInfoEntrevistaAndrea: idInfo };
    });
  }

  ngOnInit(): void {
    this._ready = true;
  }

  /** Utilidad: a número o null si no aplica */
  private toIntOrNull(v: any): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = parseInt(String(v).trim(), 10);
    return Number.isFinite(n) ? n : null;
  }

  /** Utilidad local: medidasCorrectivas -> "CUMPLE" | número | '' */
  private coerceMedidas(v: any): string | number | '' {
    if (v == null || v === '') return '';
    const s = String(v).trim().toUpperCase();
    if (s === 'CUMPLE') return 'CUMPLE';
    const n = this.toIntOrNull(v);
    return n ?? '';
  }

  /** Carga la info de selección en el form `antecedentes` */
  private loadDataSeleccion(seleccion: AntecedentesData): void {
    if (!seleccion) return;

    const patch: any = {
      eps: seleccion.eps ?? '',
      afp: seleccion.afp ?? '',
      policivos: seleccion.policivos ?? '',
      procuraduria: seleccion.procuraduria ?? '',
      contraloria: seleccion.contraloria ?? '',
      ramaJudicial: (seleccion.ramaJudicial ?? seleccion.rama_judicial ?? ''),
      medidasCorrectivas: this.coerceMedidas(seleccion.medidasCorrectivas ?? seleccion.medidas_correctivas),
      sisben: seleccion.sisben ?? '',
      ofac: seleccion.ofac ?? '',
      semanasCotizadas: this.toIntOrNull(seleccion.semanasCotizadas ?? seleccion.semanas_cotizadas),
    };

    if (this.antecedentes.get('area_aplica')) {
      patch.area_aplica = seleccion.area_aplica ?? '';
    }

    this.antecedentes.patchValue(patch as any, { emitEvent: false });
  }

  // ======= Helpers Loading =======
  private showLoading(text = 'Cargando información…') {
    Swal.fire({
      icon: 'info',
      title: 'Cargando…',
      text,
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });
  }
  private closeLoadingIf(ctx: number) {
    if (ctx === this._ctx && Swal.isVisible()) Swal.close();
  }
  // ===============================

  /** deja todos los docs como “nuevos” y en loading=true */
  private resetUploadedFilesAsNew(): void {
    const keys = Object.keys(this.typeMap) as DocKey[];
    for (const k of keys) {
      const defaultName = k === 'pensionSemanas' ? 'Sin consultar' : 'Adjuntar documento';
      this.uploadedFiles[k] = {
        file: undefined,
        fileName: defaultName,
        changed: false,
        updatedAt: undefined,
        updatedAtLabel: undefined,
        loading: true,
      };
    }
  }

  /** Se ejecuta cada vez que cambian los inputs con signal() */
  private async onInputsChanged(
    cedula: string,
    _vacante: any,
    idProceso: number | null,
    _idInfoEntrevistaAndrea: number | null
  ) {
    const ctx = ++this._ctx; // descartar respuestas viejas

    // 1) Si no hay contexto suficiente, limpia y sal
    if (!cedula || !idProceso) {
      const resetValue: any = {
        eps: '', afp: '', policivos: '', procuraduria: '', contraloria: '',
        ramaJudicial: '', sisben: '', ofac: '', medidasCorrectivas: '',
        semanasCotizadas: null
      };
      if (this.antecedentes.get('area_aplica')) resetValue.area_aplica = '';

      this.antecedentes.reset(resetValue as any, { emitEvent: false });

      (Object.keys(this.typeMap) as DocKey[]).forEach(k => {
        const dflt = k === 'pensionSemanas' ? 'Sin consultar' : 'Adjuntar documento';
        this.uploadedFiles[k] = { fileName: dflt, loading: false, changed: false };
      });

      this.closeLoadingIf(ctx);
      return;
    }

    // 2) Si cambió cédula o proceso, reinicia UI derivada y marca loading
    const changedCedula = this._prev.cedula !== cedula;
    const changedProceso = this._prev.idProceso !== idProceso;
    if (changedCedula || changedProceso) {
      const resetValue: any = {
        eps: '', afp: '', policivos: '', procuraduria: '', contraloria: '',
        ramaJudicial: '', sisben: '', ofac: '', medidasCorrectivas: '',
        semanasCotizadas: null
      };
      if (this.antecedentes.get('area_aplica')) resetValue.area_aplica = '';
      this.antecedentes.reset(resetValue as any, { emitEvent: false });

      this.resetUploadedFilesAsNew();
    }

    // 3) Mostrar loading y ejecutar cargas
    this.showLoading('Obteniendo documentos y datos de selección…');

    try {
      // 3.1) Precarga documentos del candidato (con ctx)
      const tocados = await this.loadDataDocumentos(ctx);
      if (ctx !== this._ctx) { this.closeLoadingIf(ctx); return; }

      // apaga loading en los no tocados
      const all = new Set(Object.keys(this.typeMap) as DocKey[]);
      tocados.forEach(k => all.delete(k));
      for (const k of all) {
        if (this.uploadedFiles[k]) this.uploadedFiles[k].loading = false;
      }

      // 3.2) Traer selección por id (si el servicio existe)
      const svc: any = this.seleccionService as any;
      if (typeof svc.getSeleccionPorId === 'function') {
        const res = await firstValueFrom(svc.getSeleccionPorId(idProceso!)) as SeleccionPorIdResponse;
        if (ctx !== this._ctx) { this.closeLoadingIf(ctx); return; }

        const seleccion = res?.procesoSeleccion;
        if (seleccion) {
          this.loadDataSeleccion(seleccion);
        }
      }
    } catch (e) {
      Swal.fire('Error', 'No se pudo cargar la información.', 'error');
    } finally {
      this.closeLoadingIf(ctx);
    }
  }

  private toTimestampMs(v: unknown): number | undefined {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const p = Date.parse(v);
      return isNaN(p) ? undefined : p;
    }
    return undefined;
  }

  isOlderThan(key: DocKey, days: number): boolean {
    const entry = this.uploadedFiles[key];
    if (!entry) return false;

    let ts: number | undefined = this.toTimestampMs(entry.updatedAt);
    if (ts == null && entry.file instanceof File) ts = entry.file.lastModified;
    if (ts == null) return false;

    const diffMs = Date.now() - ts;
    return diffMs > days * 24 * 60 * 60 * 1000;
  }

  verArchivo(campo: DocKey) {
    const archivo = this.uploadedFiles[campo];
    if (archivo?.file) {
      if (typeof archivo.file === 'string') {
        const url = encodeURI(archivo.file);
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        const url = URL.createObjectURL(archivo.file);
        window.open(url, '_blank', 'noopener,noreferrer');
        setTimeout(() => URL.revokeObjectURL(url), 100);
      }
    } else {
      Swal.fire('Error', 'No se pudo encontrar el archivo para este campo', 'error');
    }
  }

  subirArchivo(event: any | Blob, campo: DocKey, fileName?: string): void {
    let file: File | null = null;

    if (event instanceof Blob && !(event as any).target) {
      file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
    } else if (event?.target?.files?.length) {
      file = event.target.files[0] as File;
    }
    if (!file) return;

    const nameOk = file.name && file.name.length <= 100;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!nameOk) return void Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');
    if (!isPdf) return void Swal.fire('Error', 'Solo se permiten archivos PDF', 'error');

    this.uploadedFiles[campo] = {
      file,
      fileName: file.name,
      changed: true,
      loading: false, // ya hay archivo local
      updatedAt: undefined,
      updatedAtLabel: undefined
    };
  }

  onlyInteger(e: KeyboardEvent) {
    const allowed = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Home', 'End'];
    if (allowed.includes(e.key)) return;
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }

  /** Elimina del payload lo que venga vacío/nullable */
  private sanitizarPayload(formValue: any): any {
    const out: any = { ...formValue };

    // semanasCotizadas: enviar número si existe; si no, omitir
    const sc = this.toIntOrNull(out.semanasCotizadas);
    if (sc === null) delete out.semanasCotizadas;
    else out.semanasCotizadas = sc;

    // medidasCorrectivas: si '', omitir
    if (out.medidasCorrectivas === '' || out.medidasCorrectivas === undefined || out.medidasCorrectivas === null) {
      delete out.medidasCorrectivas;
    }

    return out;
  }

  async imprimirVerificacionesAplicacion(): Promise<void> {
    // Con estos cambios, el form debería estar válido salvo otros campos

    Swal.fire({
      title: 'Cargando...',
      text: 'Estamos guardando los datos y subiendo los archivos.',
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      const base = this.sanitizarPayload(this.antecedentes.value);
      const payload: any = { ...base, numerodeceduladepersona: this.cedula() };

      const user = this.utilityService.getUser();
      payload.nombre_evaluador = `${user.datos_basicos.nombres} ${user.datos_basicos.apellidos}`;

      const resp: any = await firstValueFrom(
        this.seleccionService.crearSeleccionParteUnoCandidato(payload, this.cedula(), this.idProcesoSeleccion())
      );

      const message = (resp?.message || '').toLowerCase();
      const ok = ['success', 'created', 'updated'].includes(message);
      if (!ok) throw new Error(resp?.message || 'Respuesta inesperada del servidor.');

      // Decide qué claves considerar: las del mapa
      const keys: DocKey[] = Object.keys(this.typeMap) as DocKey[];

      try {
        const { todosOk, exitosos, fallidos } = await this.subirTodosLosArchivos(keys);

        Swal.close();
        if (todosOk) {
          await Swal.fire({
            title: '¡Éxito!',
            text: (message === 'updated' ? 'Datos actualizados' : 'Datos guardados') + ' y archivos subidos exitosamente.',
            icon: 'success', confirmButtonText: 'Ok'
          });
        } else {
          const lbl: Record<DocKey, string> = {
            eps: 'EPS', afp: 'AFP', policivos: 'Policivos', procuraduria: 'Procuraduría',
            contraloria: 'Contraloría', ramaJudicial: 'Rama Judicial', medidasCorrectivas: 'Medidas Correctivas',
            sisben: 'Sisbén', ofac: 'OFAC', figuraHumana: 'Figura Humana', pensionSemanas: 'Semanas cotizadas'
          };
          const htmlFallidos = fallidos.length
            ? `<ul>${fallidos.map(f => `<li>${lbl[f.key]}: ${f.error}</li>`).join('')}</ul>` : '<p>—</p>';
          const htmlExitosos = exitosos.length
            ? `<ul>${exitosos.map(k => `<li>${lbl[k]}</li>`).join('')}</ul>` : '<p>—</p>';

          await Swal.fire({
            icon: 'warning',
            title: 'Subida parcial',
            html: `
              <p>Los datos se guardaron, pero algunos archivos no se pudieron subir.</p>
              <p><b>Fallidos:</b></p>${htmlFallidos}
              <p><b>Exitosos:</b></p>${htmlExitosos}
            `,
            confirmButtonText: 'Ok'
          });
        }
      } catch (upErr: any) {
        Swal.close();
        await Swal.fire({
          title: 'Error',
          text: `Los datos se guardaron, pero hubo un error al subir los archivos: ${upErr?.message || upErr}`,
          icon: 'error', confirmButtonText: 'Ok'
        });
      }
    } catch (err: any) {
      Swal.close();
      await Swal.fire({
        title: 'Error',
        text: err?.error?.detail || err?.message || 'Hubo un error al guardar los datos del formulario.',
        icon: 'error', confirmButtonText: 'Ok'
      });
    }
  }

  async subirTodosLosArchivos(
    keysEspecificos: DocKey[]
  ): Promise<{ todosOk: boolean; exitosos: DocKey[]; fallidos: { key: DocKey; error: string }[] }> {

    const archivosAEnviar = keysEspecificos
      .filter((key) => {
        const fd = this.uploadedFiles[key];
        return !!fd?.changed && fd.file instanceof File;
      })
      .map((key) => {
        const fd = this.uploadedFiles[key];
        return { key, file: fd.file as File, fileName: fd.fileName ?? 'documento.pdf', typeId: this.typeMap[key] };
      });

    if (!archivosAEnviar.length) return { todosOk: true, exitosos: [], fallidos: [] };

    const promesas = archivosAEnviar.map(({ key, file, fileName, typeId }) =>
      new Promise<void>((resolve, reject) => {
        this.gestionDocumentalService
          .guardarDocumento(fileName, this.cedula(), typeId, file)
          .subscribe({
            next: () => {
              this.uploadedFiles[key].changed = false;
              this.uploadedFiles[key].updatedAt = new Date().toISOString();
              this.uploadedFiles[key].updatedAtLabel = this.formatFechaActualizacion(this.uploadedFiles[key].updatedAt as string);
              resolve();
            },
            error: (err) => reject(new Error(err?.error?.detail || err?.message || 'Error desconocido'))
          });
      })
    );

    const resultados = await Promise.allSettled(promesas);

    const exitosos: DocKey[] = [];
    const fallidos: { key: DocKey; error: string }[] = [];
    resultados.forEach((r, idx) => {
      const key = archivosAEnviar[idx].key;
      if (r.status === 'fulfilled') exitosos.push(key);
      else fallidos.push({ key, error: r.reason?.message || String(r.reason) });
    });

    return { todosOk: fallidos.length === 0, exitosos, fallidos };
  }

  private formatFechaActualizacion(iso: string | null | undefined): string | undefined {
    if (!iso) return undefined;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return undefined;
    try {
      return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
    } catch {
      return d.toLocaleString();
    }
  }

  /** Carga documentos previos; devuelve las claves tocadas y respeta el contexto para evitar carreras */
  async loadDataDocumentos(ctx: number): Promise<Set<DocKey>> {
    const tocados = new Set<DocKey>();
    try {
      const docs: any[] = await firstValueFrom(
        this.gestionDocumentalService.obtenerDocumentosPorTipo(this.cedula(), 2)
      );
      if (ctx !== this._ctx || !Array.isArray(docs) || !docs.length) return tocados;

      for (const documento of docs) {
        if (ctx !== this._ctx) return tocados;

        const typeKey = (Object.keys(this.typeMap) as DocKey[]).find(k => this.typeMap[k] === documento.type);
        if (!typeKey) continue;

        const nombre = documento.title || 'Documento sin título';
        const file = await this.urlToFile(documento.file_url, nombre);
        if (ctx !== this._ctx) return tocados;

        const iso: string | undefined = documento.uploaded_at || undefined;
        const label = this.formatFechaActualizacion(iso);

        this.uploadedFiles[typeKey] = {
          fileName: nombre,
          file,
          updatedAt: iso ?? undefined,
          updatedAtLabel: label ?? undefined,
          changed: false,
          loading: false,
        };
        tocados.add(typeKey);
      }
    } catch (err: any) {
      if (err?.error?.error !== 'No se encontraron documentos') {
        Swal.fire({
          title: '¡Error!',
          text: 'No se pudieron obtener los documentos de antecedentes',
          icon: 'error',
          confirmButtonText: 'Ok'
        });
      }
    }
    return tocados;
  }

  async urlToFile(url: string, fileName: string): Promise<File> {
    const busted = url + (url.includes('?') ? '&' : '?') + '_=' + Date.now();

    const res = await fetch(busted, {
      cache: 'no-store',
      mode: 'cors',
      referrerPolicy: 'strict-origin-when-cross-origin'
    });

    if (!res.ok) {
      throw new Error(`No se pudo descargar el archivo: ${res.status} ${res.statusText}`);
    }

    const blob = await res.blob();
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const fallback = ext === 'pdf' ? 'application/pdf' : 'application/octet-stream';
    const type = blob.type || fallback;

    return new File([blob], fileName, { type });
  }
}
