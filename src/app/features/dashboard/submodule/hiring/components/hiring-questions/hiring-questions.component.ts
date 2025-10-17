import { Component, OnInit, input, effect, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, forkJoin, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { SharedModule } from '@/app/shared/shared.module';
import { MatTabsModule } from '@angular/material/tabs';
import Swal from 'sweetalert2';
import { HiringService } from '../../service/hiring.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import {
  ProcesoUpdateByDocumentRequest,
  RegistroProcesoContratacion
} from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';

type LocalFile = { file: File | string; fileName: string };
type ServerDocInfo = {
  id: number;
  fileName: string;
  type: number;
  file_url: string;
  uploaded_at?: string;
  size?: number;
  etag?: string;
  lastModified?: string;
};

@Component({
  selector: 'app-hiring-questions',
  imports: [SharedModule, MatTabsModule],
  templateUrl: './hiring-questions.component.html',
  styleUrl: './hiring-questions.component.css',
})
export class HiringQuestionsComponent implements OnInit {
  // ───────── Input con signals ─────────
  candidatoSeleccionado = input<any>(null);

  // ───────── UI ─────────
  descripcionVacante = '';
  nombreEmpresa = '';

  // ───────── Formularios ─────────
  pagoTransporteForm!: FormGroup;
  referenciasForm!: FormGroup;
  trasladosForm!: FormGroup;
  huellaForm!: FormGroup;

  // ───────── Archivos / tipos ─────────
  uploadedFiles: Record<string, LocalFile> = {};
  serverDocs: Record<string, ServerDocInfo> = {};

  private readonly typeMap: Record<string, number> = {
    personal1: 16, personal2: 16,
    familiar1: 17, familiar2: 17,
    traslado: 18,
    laboral1: 86, laboral2: 86,
  };

  // PDFs por empresa
  private readonly DOCS: Record<string, string> = {
    'APOYO LABORAL TS SAS': 'APOYOLABORALCARTAAUTORIZACIONTRASLADO2024.pdf',
    'TU ALIANZA SAS': 'TUALIANZACARTAAUTORIZACIONTRASLADO_2024.pdf',
  };

  // Huellas (solo UI)
  messageID = '';
  messagePD = '';
  fingerprintImageID: string | null = null;
  fingerprintImagePD: string | null = null;

  // ───────── Inyección compacta ─────────
  private readonly fb = inject(FormBuilder);
  private readonly contratacionService = inject(HiringService);
  private readonly docSvc = inject(GestionDocumentalService);
  private readonly vacantesService = inject(VacantesService);
  private readonly procesosService = inject(RegistroProcesoContratacion);

  constructor() {
    // Reacciona a cambios del candidato seleccionado
    effect(() => {
      if (this.candidatoSeleccionado()) {
        this.loadData();
      }
    });
  }

  // ───────── Ciclo de vida ─────────
  ngOnInit(): void { this.initForms(); }

  private initForms(): void {
    this.pagoTransporteForm = this.fb.group({
      formaPago: ['', Validators.required],
      numeroPagos: [null, [Validators.required, Validators.pattern(/^\d{10}$/)]],
      validacionNumeroCuenta: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      seguroFunerario: ['', Validators.required],
      Ccostos: ['', Validators.required],
      salario: [{ value: null, disabled: true }, Validators.required],
      auxilioTransporte: [{ value: null, disabled: true }, Validators.required],
      porcentajeARL: [null, Validators.required],
      cesantias: [null, Validators.required],
      subCentroCostos: [null, Validators.required],
      grupo: [null, Validators.required],
      categoria: [null, Validators.required],
      operacion: [null, Validators.required],
      horasExtras: ['', Validators.required],
    }, { validators: this.match('numeroPagos', 'validacionNumeroCuenta') });

    this.referenciasForm = this.fb.group({
      familiar1: [''],
      familiar2: [''],
      personal1: [''],
      personal2: [''],
      laboral1: [''],
      laboral2: [''],
    });

    this.trasladosForm = this.fb.group({
      opcion_traslado_eps: ['NO', Validators.required],
      eps_a_trasladar: [''],
      traslado: [''],
    });
  }

  private match(a: string, b: string) {
    return (fg: FormGroup) => {
      const va = fg.get(a)?.value, vb = fg.get(b)?.value;
      return va && vb && va !== vb ? { numbersNotMatch: true } : null;
    };
  }

  // ───────── Acciones principales ─────────
  async cargarPagoTransporte(): Promise<void> {
    if (this.pagoTransporteForm.invalid) {
      this.pagoTransporteForm.markAllAsTouched();
      return this.alert('warning', 'Formulario incompleto', 'Revisa los campos obligatorios.');
    }

    const cand = this.candidatoSeleccionado();
    if (!cand?.numero_documento) {
      return this.alert('info', 'Sin cédula', 'No hay candidato seleccionado.');
    }

    const ent0 = Array.isArray(cand?.entrevistas) ? cand.entrevistas[0] : null;
    const proc = ent0?.proceso || null;
    if (!proc) {
      return this.alert('info', 'Sin proceso', 'La última entrevista no tiene proceso asociado.');
    }

    const contr = proc?.contrato || null;
    const codigoContrato: string | null =
      (proc?.contrato_codigo as string) || (contr?.codigo_contrato as string) || null;

    const v = this.pagoTransporteForm.value;
    const toNum = (x: any) => (x === '' || x == null ? null : Number(x));

    // No generamos código acá (ya fue generado antes)
    const payload: ProcesoUpdateByDocumentRequest & {
      contratado?: boolean;
      contrato_detalle: {
        forma_de_pago?: string | null;
        numero_para_pagos?: string | null;
        seguro_funerario?: boolean | null;
        Ccentro_de_costos?: string | null;
        porcentaje_arl?: number | null;
        cesantias?: string | null;
        subcentro_de_costos?: string | null;
        grupo?: string | null;
        categoria?: string | null;
        operacion?: string | null;
        horas_extras?: boolean | null;
      };
    } = {
      numero_documento: String(cand.numero_documento),
      contratado: true, // Etapa → contratado
      contrato_detalle: {
        forma_de_pago: v.formaPago ?? null,
        numero_para_pagos: v.numeroPagos ?? null,
        seguro_funerario: !!v.seguroFunerario,
        Ccentro_de_costos: v.Ccostos ?? null,
        porcentaje_arl: toNum(v.porcentajeARL),
        cesantias: v.cesantias ?? null,
        subcentro_de_costos: v.subCentroCostos ?? null,
        grupo: v.grupo ?? null,
        categoria: v.categoria ?? null,
        operacion: v.operacion ?? null,
        horas_extras: !!v.horasExtras,
      },
    };

    try {
      const resp = await firstValueFrom(
        this.procesosService.updateProcesoByDocumento(payload, 'PATCH')
      );
      this.alert(
        'success',
        'Guardado',
        `Contrato ${codigoContrato ? `(${codigoContrato}) ` : ''}actualizado y proceso marcado como contratado.`
      );
      console.log('update-by-document →', resp);
    } catch (e: any) {
      console.error(e);
      this.alert('error', 'Error', e?.error?.detail || 'No se pudo guardar la información.');
    }
  }

  // ───────── Archivos: subir / ver / descargar ─────────
  subirArchivo(evt: Event, campo: string): void {
    const input = evt.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (file.name.length > 100) {
      this.alert('error', 'Nombre muy largo', 'Máximo 100 caracteres.');
      input.value = ''; return;
    }
    this.uploadedFiles[campo] = { file, fileName: file.name };
    (this.referenciasForm.get(campo) || this.trasladosForm.get(campo))?.setValue(file.name);
    input.value = '';
  }

  verArchivo(campo: string): void {
    const reg = this.uploadedFiles[campo];
    if (!reg) return this.alert('error', 'Archivo no encontrado', 'No se encontró el archivo.');
    if (typeof reg.file === 'string') {
      window.open(encodeURI(reg.file), '_blank');
    } else {
      const url = URL.createObjectURL(reg.file);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 250);
    }
  }

  descargarArchivo(): void {
    const archivo = this.DOCS[this.nombreEmpresa];
    if (!archivo) return this.alert('error', 'Error', 'No hay documento para esta empresa.');
    const a = document.createElement('a');
    a.href = `Docs/${archivo}`;
    a.download = archivo;
    a.click();
  }

  // ───────── Subir SOLO los que cambiaron ─────────
  private isChanged(key: string): boolean {
    const local = this.uploadedFiles[key];
    const server = this.serverDocs[key];
    if (!local) return false;
    if (typeof local.file === 'string') return false; // ya es URL → sin cambios
    if (!server) return true;
    const f = local.file as File;
    const nameDiffers = !!(server.fileName && server.fileName !== f.name);
    const sizeKnownAndDiffers = typeof server.size === 'number' && server.size !== f.size;
    return nameDiffers || sizeKnownAndDiffers;
  }

  private async uploadChanged(keys: string[], withContract = false): Promise<{ uploaded: string[], skipped: string[] }> {
    const toUpload = keys.filter(k => this.isChanged(k));
    const skipped = keys.filter(k => !toUpload.includes(k));

    await Promise.all(toUpload.map(async (k) => {
      const { file, fileName } = this.uploadedFiles[k]!;
      if (typeof file === 'string') return;
      const type = this.typeMap[k] ?? 3;

      const ced = this.candidatoSeleccionado()?.numero_documento;
      const cod = this.candidatoSeleccionado()?.codigo_contrato;
      const obs = withContract
        ? this.docSvc.guardarDocumento(fileName, ced, type, file, cod)
        : this.docSvc.guardarDocumento(fileName, ced, type, file);

      const resp: any = await firstValueFrom(obs).catch(() => null);
      this.serverDocs[k] = {
        id: this.serverDocs[k]?.id ?? (resp?.id ?? 0),
        fileName,
        type,
        file_url: resp?.file_url ?? this.serverDocs[k]?.file_url ?? '',
        uploaded_at: resp?.uploaded_at ?? new Date().toISOString(),
        size: (file as File).size,
      };
      const newUrl = this.serverDocs[k].file_url;
      this.uploadedFiles[k] = { file: newUrl || this.uploadedFiles[k].file, fileName };
    }));

    return { uploaded: toUpload, skipped };
  }

  async cargarReferencias(): Promise<void> {
    this.loading('Validando cambios y subiendo referencias…');

    try {
      const { uploaded, skipped } = await this.uploadChanged(
        ['personal1', 'personal2', 'familiar1', 'familiar2', 'laboral1', 'laboral2'],
        false
      );

      Swal.close();

      const parts: string[] = [];
      if (uploaded.length) parts.push(`Subidos: ${uploaded.join(', ')}`);
      if (skipped.length) parts.push(`Omitidos (sin cambios): ${skipped.join(', ')}`);

      // ✅ Mostrar cada parte en su propia línea
      const html = parts.length ? parts.join('<br>') : 'Operación completada.';

      Swal.fire({
        icon: 'success',
        title: 'Listo',
        html,                 // ← usar html para respetar saltos
        confirmButtonText: 'Ok',
      });

    } catch {
      Swal.close();
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'No se pudieron subir los archivos.',
        confirmButtonText: 'Ok',
      });
    }
  }


  onTrasladoChange(event: any): void {
    const v = event?.value;
    if (v === 'NO') {
      this.trasladosForm.get('eps_a_trasladar')?.reset();
      this.trasladosForm.get('traslado')?.reset();
    }
  }

  async cargarTraslados(): Promise<void> {
    const cand = this.candidatoSeleccionado();
    if (!cand?.numero_documento) {
      return this.alert('info', 'Sin cédula', 'No hay candidato seleccionado.');
    }

    const desea = this.trasladosForm.value.opcion_traslado_eps === 'SI';
    const epsSel: string | null = this.trasladosForm.value.eps_a_trasladar ?? null;

    if (desea && !epsSel) {
      return this.alert('warning', 'Falta EPS', 'Selecciona la EPS a la que se trasladará.');
    }

    const payload = {
      numero_documento: String(cand.numero_documento),
      contrato_detalle: {
        desea_trasladarse: desea,
        seleccion_eps: desea ? epsSel : null,
      },
    };

    this.loading('Procesando la solicitud de traslado…');

    try {
      // Sube el PDF solo si el usuario eligió traslado = "SI"
      if (desea) {
        await this.uploadChanged(['traslado'], true);
      }

      await firstValueFrom(
        this.procesosService.updateProcesoByDocumento(payload, 'PATCH')
      );

      Swal.close();
      this.alert('success', '¡Éxito!', 'Solicitud de traslado guardada.');
    } catch (e: any) {
      Swal.close();
      this.alert('error', 'Error', e?.error?.detail || 'No se pudo guardar la solicitud de traslado.');
    }
  }

  // ───────── Huellas (Electron) ─────────
  async captureFingerprintID(): Promise<void> { await this.captureFingerprint('ID'); }
  async captureFingerprintPD(): Promise<void> { await this.captureFingerprint('PD'); }

  private async captureFingerprint(kind: 'ID' | 'PD'): Promise<void> {
    const setMsg = (t: string) => kind === 'ID' ? this.messageID = t : this.messagePD = t;
    const setImg = (d: string | null) => kind === 'ID' ? this.fingerprintImageID = d : this.fingerprintImagePD = d;

    const electron = (window as any)?.electron;
    if (!electron?.fingerprint?.get) { setMsg('Electron o fingerprint no están disponibles.'); return; }

    try {
      const res = await electron.fingerprint.get();
      if (!res?.success || !res.data) { setMsg(`Error al capturar huella: ${res?.error || 'Desconocido.'}`); return; }

      const dataUrl = `data:image/png;base64,${res.data}`;
      setImg(dataUrl); setMsg('Huella capturada exitosamente.');
      if (kind === 'ID' && !this.candidatoSeleccionado()?.numero_documento) {
        this.alert('warning', 'Cédula requerida', 'No hay cédula para asociar la huella.');
      }
    } catch {
      setMsg('Error de comunicación con Electron.');
    }
  }

  // ───────── Utilidades ─────────
  private alert(icon: 'success' | 'error' | 'warning' | 'info', title: string, text: string) {
    Swal.fire({ icon, title, text, confirmButtonText: 'Ok' });
  }
  private loading(text: string) {
    Swal.fire({ icon: 'info', title: 'Cargando…', text, allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  }
  private async headMeta(url: string): Promise<Partial<ServerDocInfo>> {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return {
        size: Number(res.headers.get('content-length') ?? undefined),
        etag: res.headers.get('etag') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
      };
    } catch { return {}; }
  }
  timeAgo(dateStr?: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr).getTime();
    if (!Number.isFinite(d)) return '';
    const diffMs = Date.now() - d;
    const sec = Math.round(diffMs / 1000);
    const min = Math.round(sec / 60);
    const hrs = Math.round(min / 60);
    const days = Math.round(hrs / 24);
    if (sec < 60) return `hace ${sec} s`;
    if (min < 60) return `hace ${min} min`;
    if (hrs < 24) return `hace ${hrs} h`;
    return `hace ${days} días`;
  }
  ageInDays(dateStr?: string): number {
    if (!dateStr) return NaN;
    const t = new Date(dateStr).getTime();
    return Number.isFinite(t) ? Math.floor((Date.now() - t) / 86400000) : NaN;
  }
  hasLocalChange(key: string): boolean { return this.isChanged(key); }

  urlToFile(url: string, fileName: string): Promise<File> {
    return fetch(url)
      .then(r => { if (!r.ok) throw new Error(`No se pudo descargar: ${r.statusText}`); return r.blob(); })
      .then(blob => new File([blob], fileName, { type: blob.type || 'application/octet-stream' }))
      .catch(err => { Swal.fire('Error', 'No se pudo descargar el archivo', 'error'); throw err; });
  }

  // Helper (colócalo en la clase)
private toSiNo(v: any): 'Sí' | 'No' {
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (typeof v === 'number') return v > 0 ? 'Sí' : 'No';
  if (typeof v === 'string') {
    // normaliza acentos: "sí" -> "si"
    const s = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    return /^(si|true|1|x|s)$/i.test(s) ? 'Sí' : 'No';
  }
  return 'No';
}


  // ───────── Carga integral reactiva ─────────
// ───────── Carga integral reactiva ─────────
async loadData(): Promise<void> {
  const cand = this.candidatoSeleccionado();
  if (!cand?.numero_documento) return;

  const ent0 = Array.isArray(cand?.entrevistas) ? cand.entrevistas[0] : null;
  const proc = ent0?.proceso;
  if (!proc) return;

  const contr = proc?.contrato;
  const isEmptyValue = (v: any) => v === null || v === '' || (typeof v === 'boolean' && v === false);
  const CONTR_KEYS: Array<keyof typeof contr> = [
    'forma_de_pago','numero_para_pagos','Ccentro_de_costos','porcentaje_arl','cesantias',
    'subcentro_de_costos','grupo','categoria','operacion','horas_extras','seguro_funerario',
    'desea_trasladarse','seleccion_eps',
  ];
  const contratoVacio = !contr || CONTR_KEYS.every(k => isEmptyValue((contr as any)?.[k]));
  const toNum = (v: any) => (v === '' || v == null ? null : Number(v));

  // 1) Parche inicial (contrato/proceso)
  this.pagoTransporteForm.patchValue({
    formaPago: contr?.forma_de_pago ?? '',
    numeroPagos: contr?.numero_para_pagos ?? null,
    validacionNumeroCuenta: contr?.numero_para_pagos ?? null,
    seguroFunerario: contr?.seguro_funerario ?? false,
    Ccostos: contr?.Ccentro_de_costos ?? '',
    porcentajeARL: contr?.porcentaje_arl != null ? toNum(contr.porcentaje_arl) : null,
    cesantias: contr?.cesantias ?? null,
    subCentroCostos: contr?.subcentro_de_costos ?? null,
    grupo: contr?.grupo ?? null,
    categoria: contr?.categoria ?? null,
    operacion: contr?.operacion ?? null,
    horasExtras: contr?.horas_extras ?? false,
    salario: proc?.vacante_salario != null ? toNum(proc.vacante_salario) : null,
    auxilioTransporte: 'No', // valor por defecto
  });

  // 2) Traer SIEMPRE la vacante (si hay publicacion) para setear auxilioTransporte
  if (proc?.publicacion) {
    try {
      const vac: any = await firstValueFrom(this.vacantesService.obtenerVacante(proc.publicacion));

      const salarioFromProc = proc?.vacante_salario != null ? toNum(proc.vacante_salario) : null;
      const salarioFromVac  = vac?.salario != null ? toNum(vac.salario) : null;

      // SIEMPRE setear auxilioTransporte desde la vacante, como 'Sí'/'No'
      const auxFromVac = this.toSiNo(vac?.auxilioTransporte);

      this.pagoTransporteForm.patchValue({
        salario: salarioFromProc ?? salarioFromVac,
        auxilioTransporte: auxFromVac,
      });

      // Si quieres seguir rellenando otros campos SOLO cuando el contrato está vacío, deja esta condición:
      if (contratoVacio) {
        // aquí podrías completar otros defaults desde la vacante si aplica
      }
    } catch (e) {
      console.error('No se pudo cargar la vacante:', e);
      // Mantiene 'No' por defecto si falla
    }
  }

  this.llenarDocumentos().catch(console.error);
}


  // ───────── Documentos del servidor ─────────
  private docs$(type: number) {
    const ced = this.candidatoSeleccionado()?.numero_documento;
    const cod = this.candidatoSeleccionado()?.codigo_contrato;
    return this.docSvc
      .obtenerDocumentosPorTipo(ced, type, cod)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) return of([] as any[]);
          return throwError(() => err);
        })
      );
  }

  private _docsCtx = 0;
  async llenarDocumentos(): Promise<void> {
    const ctx = ++this._docsCtx;
    Swal.fire({ icon: 'info', title: 'Cargando…', text: 'Cargando documentos del candidato…', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });

    try {
      const res = await firstValueFrom(forkJoin({
        tipo16: this.docs$(16),
        tipo17: this.docs$(17),
        tipo18: this.docs$(18),
        tipo86: this.docs$(86),
      }));

      if (ctx !== this._docsCtx) { if (Swal.isVisible()) Swal.close(); return; }

      const fillList = async (list: any[], baseKey: 'personal' | 'familiar' | 'laboral', max = 2) => {
        let i = 1;
        for (const doc of list ?? []) {
          if (i > max) break;
          const key = `${baseKey}${i}` as const;
          const head = await this.headMeta(doc.file_url);
          this.serverDocs[key] = {
            id: doc.id, fileName: doc.title || 'Documento', type: doc.type, file_url: doc.file_url,
            uploaded_at: doc.uploaded_at, size: head.size, etag: head.etag, lastModified: head.lastModified,
          };
          this.uploadedFiles[key] = { file: doc.file_url, fileName: doc.title || 'Documento' };
          if (baseKey === 'personal' || baseKey === 'familiar') {
            this.referenciasForm.patchValue({ [key]: doc.title || 'Documento' });
          }
          i++;
        }
      };

      await fillList(res.tipo16, 'personal', 2);
      await fillList(res.tipo17, 'familiar', 2);
      await fillList(res.tipo86, 'laboral', 2);

      // Traslado (único)
      for (const doc of res.tipo18 ?? []) {
        const head = await this.headMeta(doc.file_url);
        this.serverDocs['traslado'] = {
          id: doc.id, fileName: doc.title || 'Documento', type: doc.type, file_url: doc.file_url,
          uploaded_at: doc.uploaded_at, size: head.size, etag: head.etag, lastModified: head.lastModified,
        };
        this.uploadedFiles['traslado'] = { file: doc.file_url, fileName: doc.title || 'Documento' };
        this.trasladosForm.patchValue({ traslado: doc.title || 'Documento' });
        break;
      }
    } catch {
      if (Swal.isVisible()) Swal.close();
      Swal.fire('Error', 'No fue posible cargar los documentos.', 'error');
      return;
    } finally {
      if (ctx === this._docsCtx && Swal.isVisible()) Swal.close();
    }
  }
}
