import { Component, OnInit, input, Output, EventEmitter, effect } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import { SharedModule } from '@/app/shared/shared.module';
import { MatTabsModule } from '@angular/material/tabs';

import Swal from 'sweetalert2';
import { catchError, firstValueFrom, forkJoin, isObservable, of, throwError } from 'rxjs';

import { HiringService } from '../../service/hiring.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { SeleccionService } from '../../service/seleccion/seleccion.service';

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
  standalone: true,
  imports: [SharedModule, MatTabsModule],
  templateUrl: './hiring-questions.component.html',
  styleUrl: './hiring-questions.component.css',
})
export class HiringQuestionsComponent implements OnInit {
  // ───────── Inputs (signals) ─────────
  cedula = input<string>('');
  codigoContrato = input<string>('');
  idInfoEntrevistaAndrea = input<number | null>(null);
  idVacantes = input<number | null>(null);

  // Notificar idVacante (opcional)
  @Output() idVacante = new EventEmitter<number>();

  // Datos de UI/persistencia
  descripcionVacante = '';
  nombreEmpresa = '';

  // Getters cortos
  private get ced() { return (this.cedula() || '').trim(); }
  private get codContrato() { return (this.codigoContrato() || '').trim(); }
  private get idInfo() { return this.idInfoEntrevistaAndrea(); }
  private get idVac() { return this.idVacantes(); }

  // ───────── Formularios ─────────
  pagoTransporteForm!: FormGroup;
  referenciasForm!: FormGroup;
  trasladosForm!: FormGroup;
  huellaForm!: FormGroup;

  // ───────── Archivos / tipos ─────────
  uploadedFiles: Record<string, LocalFile> = {};
  serverDocs: Record<string, ServerDocInfo> = {};

  // Map de tipos según backend
  private readonly typeMap: Record<string, number> = {
    personal1: 16, personal2: 16,
    familiar1: 17, familiar2: 17,
    traslado: 18,
    laboral1: 86, laboral2: 86,
  };

  // Huellas (UI)
  messageID = '';
  messagePD = '';
  fingerprintImageID: string | null = null;
  fingerprintImagePD: string | null = null;

  // PDFs por empresa
  private readonly DOCS: Record<string, string> = {
    'APOYO LABORAL TS SAS': 'APOYOLABORALCARTAAUTORIZACIONTRASLADO2024.pdf',
    'TU ALIANZA SAS': 'TUALIANZACARTAAUTORIZACIONTRASLADO_2024.pdf',
  };

  // Snapshot para detectar cambios de inputs
  private _prev = { ced: '', cod: '', idInfo: null as number | null, idVac: null as number | null };

  constructor(
    private fb: FormBuilder,
    private contratacionService: HiringService,
    private docSvc: GestionDocumentalService,
    private vacantesService: VacantesService,
    private infoVacantesService: InfoVacantesService,
    private gestionDocumentalService: GestionDocumentalService,
    private seleccionService: SeleccionService,
  ) {
    // Efecto: recarga cada vez que cambian los input() del componente
    effect(() => {
      const ced = this.cedula();
      const cod = this.codigoContrato();
      const idI = this.idInfoEntrevistaAndrea();
      const idV = this.idVacantes();

      const changed = ced !== this._prev.ced || cod !== this._prev.cod || idI !== this._prev.idInfo || idV !== this._prev.idVac;
      if (changed) {
        this._prev = { ced, cod, idInfo: idI, idVac: idV };
        this.onInputsChanged(ced?.trim() || '', cod?.trim() || '', idI ?? null, idV ?? null);
      }
    });
  }

  // ───────── Ciclo de vida ─────────
  ngOnInit(): void { this.initForms(); }

  private initForms(): void {
    this.pagoTransporteForm = this.fb.group({
      semanasCotizadas: [null, Validators.required],
      formaPago: ['', Validators.required],
      numeroPagos: [null, [Validators.required, Validators.pattern(/^\d{10}$/)]],
      validacionNumeroCuenta: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      seguroFunerario: ['', Validators.required],
      Ccostos: ['', Validators.required],
      salario: [null, Validators.required],
      auxilioTransporte: [null, Validators.required],
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

    this.huellaForm = this.fb.group({
      cedula: [this.ced || '', Validators.required],
      centroCosto: [''],
    });
  }

  private match(a: string, b: string) {
    return (fg: FormGroup) => {
      const va = fg.get(a)?.value, vb = fg.get(b)?.value;
      return va && vb && va !== vb ? { numbersNotMatch: true } : null;
    };
  }

  // ───────── Reacción a cambios de inputs ─────────
  private async onInputsChanged(
    cedula: string,
    codigoContrato: string,
    _idInfo: number | null,
    _idVac: number | null,
  ): Promise<void> {
    if (cedula && codigoContrato) {
      await this.loadData();
    }
  }

  // ───────── Acciones principales ─────────
  async cargarPagoTransporte(): Promise<void> {
    if (this.pagoTransporteForm.invalid) {
      this.pagoTransporteForm.markAllAsTouched();
      return this.alert('warning', 'Formulario incompleto', 'Revisa los campos obligatorios.');
    }

    const data = {
      numero_de_cedula: this.ced,
      codigo_contrato: this.codContrato,
      semanas_cotizadas: this.pagoTransporteForm.value.semanasCotizadas,
      forma_pago: this.pagoTransporteForm.value.formaPago,
      numero_pagos: this.pagoTransporteForm.value.numeroPagos,
      validacion_numero_cuenta: this.pagoTransporteForm.value.validacionNumeroCuenta,
      seguro_funerario: this.pagoTransporteForm.value.seguroFunerario,
      centro_de_costos: this.pagoTransporteForm.value.Ccostos,
      salario_contratacion: this.pagoTransporteForm.value.salario,
      valor_transporte: this.pagoTransporteForm.value.auxilioTransporte,
      porcentaje_arl: this.pagoTransporteForm.value.porcentajeARL,
      cesantias: this.pagoTransporteForm.value.cesantias,
      sub_centro_de_costos: this.pagoTransporteForm.value.subCentroCostos,
      grupo: this.pagoTransporteForm.value.grupo,
      categoria: this.pagoTransporteForm.value.categoria,
      operacion: this.pagoTransporteForm.value.operacion,
      horas_extras: this.pagoTransporteForm.value.horasExtras,
    };

    try {
      const r = (this.contratacionService.guardarOActualizarContratacion as any)(data);
      if (isObservable(r)) await firstValueFrom(r); else await r;

      const results = await Promise.allSettled([
        this.idInfo ? firstValueFrom(this.infoVacantesService.setEstadoVacanteAplicante(this.idInfo, 'contratado', true)) : Promise.resolve(null),
        this.idVac ? firstValueFrom(this.vacantesService.setEstadoVacanteAplicante(this.idVac, 'contratado', this.ced)) : Promise.resolve(null),
      ]);

      results.some(x => x.status === 'rejected')
        ? this.alert('warning', 'Guardado con advertencias', 'Algunos estados no se actualizaron.')
        : this.alert('success', '¡Éxito!', 'Datos guardados y estados actualizados.');
    } catch (e) {
      this.alert('error', 'Error', 'No se pudo guardar/actualizar.');
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

    // Sin selección local => no hay cambio a subir
    if (!local) return false;

    // Si el "archivo" local es una URL existente, lo consideramos NO cambiado
    if (typeof local.file === 'string') return false;

    // Si no había documento o cambió nombre o (si se conoce) el tamaño → cambió
    const f = local.file as File;
    if (!server) return true;

    const nameDiffers = !!(server.fileName && server.fileName !== f.name);
    const sizeKnownAndDiffers = typeof server.size === 'number' && server.size !== f.size;

    return nameDiffers || sizeKnownAndDiffers;
  }

  private async uploadChanged(keys: string[], withContract = false): Promise<{ uploaded: string[], skipped: string[] }> {
    const toUpload = keys.filter(k => this.isChanged(k));
    const skipped = keys.filter(k => !toUpload.includes(k));

    const tasks = toUpload.map(async (k) => {
      const { file, fileName } = this.uploadedFiles[k]!;
      if (typeof file === 'string') return; // seguridad
      const type = this.typeMap[k] ?? 3;

      const obs = withContract
        ? this.docSvc.guardarDocumento(fileName, this.ced, type, file, this.codContrato)
        : this.docSvc.guardarDocumento(fileName, this.ced, type, file);

      const resp: any = await firstValueFrom(obs).catch(() => null);

      // Reflejar nuevo estado "servidor"
      this.serverDocs[k] = {
        id: this.serverDocs[k]?.id ?? (resp?.id ?? 0),
        fileName,
        type,
        file_url: resp?.file_url ?? this.serverDocs[k]?.file_url ?? '',
        uploaded_at: resp?.uploaded_at ?? new Date().toISOString(),
        size: (file as File).size,
      };

      // Convertimos uploadedFiles a URL-like (si tenemos), para marcar “sin cambios”
      const newUrl = this.serverDocs[k].file_url;
      this.uploadedFiles[k] = { file: newUrl || this.uploadedFiles[k].file, fileName };
    });

    await Promise.all(tasks);
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

      const msg = [
        uploaded.length ? `Subidos: ${uploaded.join(', ')}` : 'No hubo cambios para subir',
        skipped.length ? `Omitidos (sin cambios): ${skipped.join(', ')}` : ''
      ].filter(Boolean).join('\n');

      this.alert('success', 'Listo', msg || 'Operación completada.');
    } catch (e: any) {
      Swal.close();
      this.alert('error', 'Error', e?.message || 'No se pudieron subir los archivos.');
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
    const payload = {
      ...this.trasladosForm.value,
      numerodeceduladepersona: this.ced,
      codigo_contrato: this.codContrato,
    };

    this.loading('Procesando la solicitud de traslado…');

    try {
      await this.uploadChanged(['traslado'], true);

      const r = (this.contratacionService.actualizarProcesoContratacion as any)(payload);
      if (isObservable(r)) await firstValueFrom(r); else await r;

      Swal.close();
      this.alert('success', '¡Éxito!', 'Solicitud de traslado guardada.');
    } catch {
      Swal.close();
      this.alert('error', 'Error', 'No se pudo guardar la solicitud de traslado.');
    }
  }

  // ───────── Huellas (Electron) ─────────
async captureFingerprintID(): Promise<void> {
  await this.captureFingerprint('ID');
}

async captureFingerprintPD(): Promise<void> {
  await this.captureFingerprint('PD'); // aquí solo captura y muestra; no sube
}

private async captureFingerprint(kind: 'ID' | 'PD'): Promise<void> {
  const setMsg = (t: string) => kind === 'ID' ? this.messageID = t : this.messagePD = t;
  const setImg = (d: string | null) => kind === 'ID' ? this.fingerprintImageID = d : this.fingerprintImagePD = d;

  const electron = (window as any)?.electron;
  if (!electron?.fingerprint?.get) {
    setMsg('Electron o fingerprint no están disponibles.');
    return;
  }

  try {
    const res = await electron.fingerprint.get();
    if (!res?.success || !res.data) {
      setMsg(`Error al capturar huella: ${res?.error || 'Desconocido.'}`);
      return;
    }

    // base64 crudo -> Data URL (mostrable en <img>)
    const dataUrl = `data:image/png;base64,${res.data}`;
    setImg(dataUrl);
    setMsg('Huella capturada exitosamente.');

    // Solo subimos automáticamente la Índice Derecho (ID)
    if (kind === 'ID') {
      if (!this.ced) {
        this.alert('warning', 'Cédula requerida', 'No hay cédula para asociar la huella.');
        return;
      }
      // Subir al backend
      Swal.fire({
        icon: 'info',
        title: 'Subiendo huella…',
        text: 'Guardando Índice Derecho en el servidor.',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      try {
        await firstValueFrom(this.seleccionService.subirHuellaBase64(this.ced, dataUrl));
        Swal.close();
        setMsg('Huella capturada y guardada.');
        this.alert('success', '¡Listo!', 'La huella (Índice Derecho) se guardó correctamente.');
      } catch (e) {
        Swal.close();
        setMsg('Huella capturada, pero no se pudo guardar.');
        this.alert('error', 'Error al guardar la huella', 'Intenta nuevamente.');
      }
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

  // HEAD para meta remota (size/etag/last-modified)
  private async headMeta(url: string): Promise<Partial<ServerDocInfo>> {
    try {
      const res = await fetch(url, { method: 'HEAD' });
      return {
        size: Number(res.headers.get('content-length') ?? undefined),
        etag: res.headers.get('etag') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
      };
    } catch {
      return {};
    }
  }

  // Helper de edad para mostrar en UI
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

  // Descargar URL → File (si lo necesitas en algún flujo)
  urlToFile(url: string, fileName: string): Promise<File> {
    return fetch(url)
      .then(response => {
        if (!response.ok) throw new Error(`No se pudo descargar: ${response.statusText}`);
        return response.blob();
      })
      .then(blob => new File([blob], fileName, { type: blob.type || 'application/octet-stream' }))
      .catch(error => {
        Swal.fire('Error', 'No se pudo descargar el archivo', 'error');
        throw error;
      });
  }

  // ───────── Carga integral de datos (reactiva a inputs) ─────────
  async loadData(): Promise<void> {
    if (!this.ced || !this.codContrato) return;

    // 1) Proceso de selección más reciente
    const respSel: any = await firstValueFrom(this.contratacionService.traerDatosSeleccion(this.ced));
    const lista = Array.isArray(respSel?.procesoSeleccion) ? respSel.procesoSeleccion : [];
    if (!lista.length) return;

    const seleccion = lista.reduce((acc: any, cur: any) => (cur?.id ?? 0) > (acc?.id ?? 0) ? cur : acc, null);
    const idVacante = seleccion?.vacante;
    if (typeof idVacante === 'number') this.idVacante.emit(idVacante);

    // 2) Detalle de vacante
    const vacResp: any = await firstValueFrom(this.vacantesService.obtenerVacante(idVacante));
    this.nombreEmpresa = vacResp?.temporal || '';
    this.descripcionVacante = vacResp?.descripcion || '';
    this.pagoTransporteForm.patchValue({
      auxilioTransporte: vacResp?.auxilioTransporte,
      salario: vacResp?.salario,
      Ccostos: vacResp?.empresaUsuariaSolicita || '',
      

    });

    // 3) Documentos actuales
    await this.llenarDocumentos();

    // 4) Datos de contratación
    const datos: any = await firstValueFrom(this.contratacionService.traerDatosContratacion(this.ced, this.codContrato));
    if (datos) {
      console.log('Datos de contratación:', datos);
      this.pagoTransporteForm.patchValue({
        semanasCotizadas: datos.semanas_cotizadas,
        formaPago: datos.forma_pago,
        numeroPagos: datos.numero_pagos,
        validacionNumeroCuenta: datos.numero_cuenta ?? datos.validacion_numero_cuenta,
        seguroFunerario: datos.seguro_funerario,
        porcentajeARL: datos.porcentaje_arl,
        cesantias: datos.cesantias,
        subCentroCostos: datos.subCentroCostos,
        grupo: datos.grupo,
        categoria: datos.categoria,
        operacion: datos.operacion,
        horasExtras: datos.horas_extras,
      });
      this.trasladosForm.patchValue({
        opcion_traslado_eps: datos.opcion_traslado_eps || 'NO',
        eps_a_trasladar: datos.eps_a_trasladar,
        traslado: datos.traslado,
      });
    }
  }

  private docs$(type: number) {
    return this.gestionDocumentalService
      .obtenerDocumentosPorTipo(this.ced, type, this.codContrato)
      .pipe(
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) return of([] as any[]);   // 404 => tratar como vacío
          return throwError(() => err);                      // otros errores → propagar
        })
      );
  }

  // Llena serverDocs + uploadedFiles (como URL) + meta HEAD
  private _docsCtx = 0;
  async llenarDocumentos(): Promise<void> {
    const ctx = ++this._docsCtx;

    // Loader
    Swal.fire({
      icon: 'info',
      title: 'Cargando…',
      text: 'Cargando documentos del candidato…',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const res = await firstValueFrom(
        forkJoin({
          tipo16: this.docs$(16),
          tipo17: this.docs$(17),
          tipo18: this.docs$(18),
          tipo86: this.docs$(86),
        })
      );

      // Si se disparó otra carga después, aborta ésta
      if (ctx !== this._docsCtx) {
        if (Swal.isVisible()) Swal.close();
        return;
      }

      const t86 = res.tipo86 ?? [];
      const t16 = res.tipo16 ?? [];
      const t17 = res.tipo17 ?? [];
      const t18 = res.tipo18 ?? [];

      const fillList = async (list: any[], baseKey: 'personal' | 'familiar' | 'laboral', max = 2) => {
        let i = 1;
        for (const doc of list) {
          if (i > max) break;
          const key = `${baseKey}${i}` as const;
          const head = await this.headMeta(doc.file_url);
          this.serverDocs[key] = {
            id: doc.id,
            fileName: doc.title || 'Documento',
            type: doc.type,
            file_url: doc.file_url,
            uploaded_at: doc.uploaded_at,
            size: head.size, etag: head.etag, lastModified: head.lastModified,
          };
          // Cargar como URL (NO File) => se considera “sin cambios”
          this.uploadedFiles[key] = { file: doc.file_url, fileName: doc.title || 'Documento' };

          if (baseKey === 'personal' || baseKey === 'familiar') {
            this.referenciasForm.patchValue({ [key]: doc.title || 'Documento' });
          }
          i++;
        }
      };

      await fillList(t16, 'personal', 2);
      await fillList(t17, 'familiar', 2);
      await fillList(t86, 'laboral', 2);

      // Traslado (único)
      for (const doc of t18) {
        const head = await this.headMeta(doc.file_url);
        this.serverDocs['traslado'] = {
          id: doc.id,
          fileName: doc.title || 'Documento',
          type: doc.type,
          file_url: doc.file_url,
          uploaded_at: doc.uploaded_at,
          size: head.size, etag: head.etag, lastModified: head.lastModified,
        };
        this.uploadedFiles['traslado'] = { file: doc.file_url, fileName: doc.title || 'Documento' };
        this.trasladosForm.patchValue({ traslado: doc.title || 'Documento' });
        break;
      }

    } catch (err) {
      if (Swal.isVisible()) Swal.close();
      Swal.fire('Error', 'No fue posible cargar los documentos.', 'error');
      return;
    } finally {
      if (ctx === this._docsCtx && Swal.isVisible()) Swal.close();
    }
  }
}
