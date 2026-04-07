import {  Component, OnInit, input, effect, inject, DestroyRef , ChangeDetectionStrategy } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, forkJoin, of, throwError, Observable } from 'rxjs';
import { catchError, startWith, map } from 'rxjs/operators';
import { SharedModule } from '@/app/shared/shared.module';
import { MatTabsModule } from '@angular/material/tabs';
import Swal from 'sweetalert2';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import type jsPDF from 'jspdf';
import type { RowInput } from 'jspdf-autotable';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import {
  ProcesoUpdateByDocumentRequest,
  RegistroProcesoContratacion,
} from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TarjetasService } from '../../service/tarjetas.service';

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
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-hiring-questions',
  standalone: true,
  imports: [SharedModule, MatTabsModule],
  templateUrl: './hiring-questions.component.html',
  styleUrls: ['./hiring-questions.component.css'],
} )
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

  // Lista de tarjetas disponibles (objetos completos)
  tarjetasDisponibles: any[] = [];
  filteredTarjetas!: Observable<any[]>;

  // PDFs por empresa
  private readonly DOCS: Record<string, string> = {
    'APOYO LABORAL TS SAS': 'APOYOLABORALCARTAAUTORIZACIONTRASLADO2024.pdf',
    'TU ALIANZA SAS': 'TUALIANZACARTAAUTORIZACIONTRASLADO_2024.pdf',
  };

  // ── Documentos con Huella (dialog preview) ──
  showDocumentsDialog = false;
  huellaDocsList: { title: string; safeUrl: SafeResourceUrl }[] = [];
  currentDocIndex = 0;

  // ── Consentimiento Biométrico — Huella (Ley 1581 de 2012) ──
  private static readonly EMPRESAS_HUELLA: Record<string, { nombre: string }> = {
    'apoyo-laboral': { nombre: 'APOYO LABORAL T.S. S.A.S.' },
    'tu-alianza': { nombre: 'TU ALIANZA SAS' },
  };
  private readonly VERSION_CONSENTIMIENTO_HUELLA = 'v1.0-2026';

  private buildTextoConsentimientoHuella(empresa: string): string {
    return (
      'En cumplimiento de la Ley Estatutaria 1581 de 2012 "Por la cual se dictan disposiciones generales ' +
      'para la protección de datos personales" y su Decreto Reglamentario 1377 de 2013, autorizo de manera ' +
      `libre, expresa, previa e informada a ${empresa} para que realice la recolección, ` +
      'almacenamiento, uso, circulación, supresión y en general, el tratamiento de mis datos biométricos ' +
      '(huella dactilar) que voluntariamente suministro en este proceso, con la finalidad de validar mi ' +
      'identidad, formalizar mi vinculación laboral y generar soporte probatorio contractual. ' +
      'Declaro que he sido informado(a) de mis derechos como titular de datos personales, incluyendo el ' +
      'derecho a conocer, actualizar, rectificar y solicitar la supresión de mis datos, así como a revocar ' +
      'la autorización otorgada, mediante comunicación dirigida al responsable del tratamiento.'
    );
  }

  // Huellas (per-company UI state)
  messageApoyo = '';
  messageTuAlianza = '';
  fingerprintImageApoyo: string | null = null;
  fingerprintImageTuAlianza: string | null = null;
  // Legacy (kept for PD if needed)
  messageID = '';
  messagePD = '';
  fingerprintImageID: string | null = null;
  fingerprintImagePD: string | null = null;

  // ───────── Inyección compacta ─────────
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly docSvc = inject(GestionDocumentalService);
  private readonly vacantesService = inject(VacantesService);
  private readonly procesosService = inject(RegistroProcesoContratacion);
  private readonly tarjetasService = inject(TarjetasService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);

  constructor() {
    // Reacciona a cambios del candidato seleccionado
    effect(() => {
      if (this.candidatoSeleccionado()) {
        this.loadData().catch(console.error);
      }
    });
  }

  // ───────── Ciclo de vida ─────────
  ngOnInit(): void {
    this.initForms();
    this.setupFormaPagoValidation(); // ← aplica validación dinámica CO
    this.loadTarjetas();
    // Consentimiento: autocompletar UserAgent
    this.huellaForm.patchValue({ userAgent: navigator.userAgent });

    this.filteredTarjetas = this.pagoTransporteForm.get('numeroIdentificacion')!.valueChanges.pipe(
      startWith(''),
      map(value => this._filterTarjetas(value || '')),
    );
  }

  private loadTarjetas() {
    this.tarjetasService.list().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: any) => {
        const items = Array.isArray(res) ? res : (res.results || []);
        this.tarjetasDisponibles = items;
      },
      error: (err) => console.error('Error cargando tarjetas', err)
    });
  }

  private _filterTarjetas(value: string | any): any[] {
    const raw = typeof value === 'string' ? value : (value?.identification_number || '');
    const filterValue = raw.toLowerCase();
    
    // Optimización V8: Limitar a 50 resultados para evitar colapso del DOM (mat-option rendering)
    // El FOR loop clásico con Break destruye el bottleneck cuando hay miles de tarjetas
    const matchCount = 50;
    const result = [];
    
    for (const t of this.tarjetasDisponibles) {
      if ((t.identification_number || '').toLowerCase().includes(filterValue) ||
          (t.card_number || '').includes(filterValue)) {
        result.push(t);
        if (result.length >= matchCount) break;
      }
    }
    
    return result;
  }

  private initForms(): void {
    this.pagoTransporteForm = this.fb.group(
      {
        formaPago: ['', Validators.required],
        otraFormaPago: [''],
        numeroPagos: ['', []],
        numeroIdentificacion: ['', []], // Restored field
        contraseniaAsignada: ['', []],
        seguroFunerario: [false, Validators.required],
        Ccostos: ['', Validators.required],
        salario: [{ value: null, disabled: true }, Validators.required],
        auxilioTransporte: [{ value: null, disabled: true }, Validators.required],
        porcentajeARL: [null, Validators.required],
        cesantias: [null, Validators.required],
        subCentroCostos: [null, Validators.required],
        grupo: [null, Validators.required],
        categoria: [null, Validators.required],
        operacion: [null, Validators.required],
        horasExtras: [false, Validators.required],
        fechaIngreso: [null, Validators.required],
      },
      // { validators: this.numbersMatch('numeroPagos', 'validacionNumeroCuenta') },
    );

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
      consentimientoHuella: [false],
      versionConsentimiento: [this.VERSION_CONSENTIMIENTO_HUELLA],
      timestampConsentimiento: [''],
      consentimientoHash: [''],
      imageHash: [''],
      userAgent: [''],
    });
  }

  // === Validador de coincidencia ===
  // === Validador de coincidencia (YA NO SE USA, PERO SE DEJA O SE BORRA) ===
  // numbersMatch(...) { ... }

  // === Reglas dinámicas según forma de pago (CO) ===
  // === Reglas dinámicas según forma de pago (CO) ===
  private setupFormaPagoValidation() {
    const formaCtrl = this.pagoTransporteForm.get('formaPago')!;
    const numCtrl = this.pagoTransporteForm.get('numeroPagos')!;
    const idCtrl = this.pagoTransporteForm.get('numeroIdentificacion');
    const passCtrl = this.pagoTransporteForm.get('contraseniaAsignada');

    // Daviplata: solo obligatorio
    const phoneCO = /^3\d{9}$/;
    // Otros: Tarjeta -> 16 o 18 dígitos
    const cardPattern = /^\d{16,18}$/;

    const apply = () => {
      const forma = formaCtrl.value;
      numCtrl.clearValidators();
      if (idCtrl) idCtrl.clearValidators();
      if (passCtrl) passCtrl.clearValidators();

      if (forma === 'Daviplata') {
        // Daviplata => "Número de cuenta"
        numCtrl.setValidators([Validators.required]); // O pattern phoneCO
      } else if (forma) {
        // Otros => Tarjeta
        numCtrl.setValidators([Validators.required, Validators.pattern(cardPattern)]);
        // ID de la tarjeta (si aplica)
        if (idCtrl) idCtrl.setValidators([Validators.required]);
        // Contraseña
        if (passCtrl) passCtrl.setValidators([Validators.required]);
      }

      numCtrl.updateValueAndValidity({ emitEvent: false });
      if (idCtrl) idCtrl.updateValueAndValidity({ emitEvent: false });
      if (passCtrl) passCtrl.updateValueAndValidity({ emitEvent: false });
    };

    apply();
    formaCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(apply);

    // Validación extra: verificar si la tarjeta existe
    // Escuchar cambios en numeroPagos + numeroIdentificacion
    if (idCtrl) {
      numCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => this.verificarTarjeta(),
        error: (err) => console.error('💥 numCtrl.valueChanges subscription crashed:', err),
      });
      idCtrl.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => this.verificarTarjeta(),
        error: (err) => console.error('💥 idCtrl.valueChanges subscription crashed:', err),
      });
    }
  }

  // Verificar existencia de tarjeta (local, sin API call)
  verificarTarjeta() {
    try {
      const forma = this.pagoTransporteForm.get('formaPago')?.value;
      console.log('[verificarTarjeta] forma:', forma);
      if (forma === 'Daviplata' || !forma) return;

      const numCtrl = this.pagoTransporteForm.get('numeroPagos')!;
      const numRaw = numCtrl.value;
      const num = (typeof numRaw === 'string' ? numRaw : '').trim();

      const idRaw = this.pagoTransporteForm.get('numeroIdentificacion')?.value;
      const id = (typeof idRaw === 'string' ? idRaw : (idRaw?.identification_number || '')).trim();

      console.log('[verificarTarjeta] num:', num, '| id:', id, '| tarjetasDisponibles:', this.tarjetasDisponibles.length);
      console.log('[verificarTarjeta] errores ANTES:', JSON.stringify(numCtrl.errors));

      // Si faltan datos o no cumplen longitud mínima, limpiamos los errores custom y salimos
      if (!num || num.length < 16 || !id) {
        this._clearCustomError(numCtrl, 'tarjetaInexistente');
        this._clearCustomError(numCtrl, 'noCoincide');
        console.log('[verificarTarjeta] datos incompletos, errores DESPUÉS:', JSON.stringify(numCtrl.errors));
        return;
      }

      // Buscar tarjetas que coincidan con la identificación
      const tarjetasDelId = this.tarjetasDisponibles.filter(
        t => (t.identification_number || '').trim() === id
      );

      console.log('[verificarTarjeta] tarjetasDelId:', tarjetasDelId.length);

      if (tarjetasDelId.length === 0) {
        this._setCustomError(numCtrl, 'tarjetaInexistente');
        this._clearCustomError(numCtrl, 'noCoincide');
        console.log('[verificarTarjeta] tarjetaInexistente SET, errores:', JSON.stringify(numCtrl.errors));
        return;
      }

      const coincide = tarjetasDelId.some(
        t => (t.card_number || '').trim() === num
      );

      if (!coincide) {
        this._clearCustomError(numCtrl, 'tarjetaInexistente');
        this._setCustomError(numCtrl, 'noCoincide');
        console.log('[verificarTarjeta] noCoincide SET, errores:', JSON.stringify(numCtrl.errors));
      } else {
        this._clearCustomError(numCtrl, 'tarjetaInexistente');
        this._clearCustomError(numCtrl, 'noCoincide');
        console.log('[verificarTarjeta] TODO OK, errores:', JSON.stringify(numCtrl.errors));
      }
    } catch (err) {
      console.error('💥 verificarTarjeta crashed:', err);
    }
  }

  /** Cuando el usuario selecciona una tarjeta del autocomplete, verifica que numeroPagos coincida */
  onTarjetaSelected(tarjeta: any): void {
    // Guardamos solo el identification_number como valor del control
    if (tarjeta?.identification_number) {
      this.pagoTransporteForm.get('numeroIdentificacion')?.setValue(tarjeta.identification_number, { emitEvent: false });
    }
    // Disparamos la verificación cruzada con lo que el usuario ya escribió en numeroPagos
    this.verificarTarjeta();
  }

  /** displayWith del autocomplete: muestra el identification_number en el input */
  displayTarjeta(value: any): string {
    if (!value) return '';
    return typeof value === 'string' ? value : (value.identification_number || '');
  }

  // Helpers para manejar errores custom sin borrar los validators nativos (required, pattern)
  private _setCustomError(ctrl: AbstractControl, errorKey: string): void {
    const existing = ctrl.errors || {};
    ctrl.setErrors({ ...existing, [errorKey]: true });
  }

  private _clearCustomError(ctrl: AbstractControl, errorKey: string): void {
    if (!ctrl.errors || !ctrl.errors[errorKey]) return;
    const { [errorKey]: _, ...rest } = ctrl.errors;
    ctrl.setErrors(Object.keys(rest).length ? rest : null);
  }

  // (Opcional) Limpia caracteres no numéricos al teclear/pegar
  digitsOnly(controlName: string, e: Event) {
    const ctrl = this.pagoTransporteForm.get(controlName);
    const el = e.target as HTMLInputElement | null;
    if (!ctrl || !el) return;
    const cleaned = el.value.replace(/\D+/g, '');
    if (el.value !== cleaned) {
      ctrl.setValue(cleaned, { emitEvent: true });
    }
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

    const v = this.pagoTransporteForm.getRawValue(); // getRawValue incluye disabled fields (salario, auxilioTransporte)
    const toNum = (x: any) => (x === '' || x == null ? null : Number(x));

    const payload: ProcesoUpdateByDocumentRequest & {
      contratado?: boolean;
      contrato_detalle: {
        forma_de_pago?: string | null;
        numero_para_pagos?: string | null;
        identification_number_tarjeta?: string | null;
        contrasenia_asignada?: string | null;
        seguro_funerario?: boolean | null;
        Ccentro_de_costos?: string | null;
        porcentaje_arl?: number | null;
        cesantias?: string | null;
        subcentro_de_costos?: string | null;
        grupo?: string | null;
        categoria?: string | null;
        operacion?: string | null;
        horas_extras?: boolean | null;
        fecha_ingreso?: string | null;
      };
    } = {
      numero_documento: String(cand.numero_documento),
      contratado: true,
      contrato_detalle: {
        forma_de_pago: v.formaPago ?? null,
        numero_para_pagos: v.numeroPagos ?? null,
        identification_number_tarjeta: v.numeroIdentificacion ?? null,
        contrasenia_asignada: v.contraseniaAsignada ?? null,
        seguro_funerario: !!v.seguroFunerario,
        Ccentro_de_costos: v.Ccostos ?? null,
        porcentaje_arl: toNum(v.porcentajeARL),
        cesantias: v.cesantias ?? null,
        subcentro_de_costos: v.subCentroCostos ?? null,
        grupo: v.grupo ?? null,
        categoria: v.categoria ?? null,
        operacion: v.operacion ?? null,
        horas_extras: !!v.horasExtras,
        fecha_ingreso: v.fechaIngreso ? new Date(v.fechaIngreso).toISOString().split('T')[0] : null,
      },
    };

    try {
      const resp = await firstValueFrom(
        this.procesosService.updateProcesoByDocumento(payload, 'PATCH'),
      );
      this.alert(
        'success',
        'Guardado',
        `Contrato ${codigoContrato ? `(${codigoContrato}) ` : ''}actualizado y proceso marcado como contratado.`,
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
        false,
      );

      Swal.close();

      const parts: string[] = [];
      if (uploaded.length) parts.push(`Subidos: ${uploaded.join(', ')}`);
      if (skipped.length) parts.push(`Omitidos (sin cambios): ${skipped.join(', ')}`);

      const html = parts.length ? parts.join('<br>') : 'Operación completada.';

      Swal.fire({
        icon: 'success',
        title: 'Listo',
        html,
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
        this.procesosService.updateProcesoByDocumento(payload, 'PATCH'),
      );

      Swal.close();
      this.alert('success', '¡Éxito!', 'Solicitud de traslado guardada.');
    } catch (e: any) {
      Swal.close();
      this.alert('error', 'Error', e?.error?.detail || 'No se pudo guardar la solicitud de traslado.');
    }
  }

  // ───────── Huellas (Electron) ─────────
  async captureFingerprintApoyo(): Promise<void> { await this.captureFingerprint('ID', 'apoyo-laboral'); }
  async captureFingerprintTuAlianza(): Promise<void> { await this.captureFingerprint('ID', 'tu-alianza'); }
  async captureFingerprintPD(): Promise<void> { await this.captureFingerprint('PD'); }

  // ── SHA-256 genérico ──
  private async generateHash(data: string): Promise<string> {
    const encoded = new TextEncoder().encode(data);
    const buffer = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async generateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // ── Dialog de consentimiento biométrico (huella) ──
  private async mostrarConsentimientoHuella(empresaSlug: string): Promise<boolean> {
    const cfg = HiringQuestionsComponent.EMPRESAS_HUELLA[empresaSlug]
      ?? HiringQuestionsComponent.EMPRESAS_HUELLA['apoyo-laboral'];
    const texto = this.buildTextoConsentimientoHuella(cfg.nombre);

    const { isConfirmed } = await Swal.fire({
      title: '',
      html: `
        <div class="consent-dialog-content">
          <div class="consent-dialog-header">
            <div class="consent-dialog-icon">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#2e7d32" stroke-width="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </div>
            <h2 class="consent-dialog-title">Autorización de Tratamiento de Datos Biométricos — Huella Dactilar</h2>
            <span class="consent-dialog-badge">Ley 1581 de 2012</span>
            <span class="consent-dialog-badge" style="background:#e8f5e9;color:#2e7d32">${cfg.nombre}</span>
          </div>
          <div class="consent-dialog-body-inner">
            <div class="consent-dialog-text">${texto}</div>
            <label class="consent-dialog-check" id="consent-label">
              <input type="checkbox" id="swal-consent-cb" />
              <span>He leído y <strong>autorizo</strong> la captura, almacenamiento y tratamiento de mi huella dactilar conforme a lo anterior.</span>
            </label>
            <p class="consent-dialog-version">Versión: ${this.VERSION_CONSENTIMIENTO_HUELLA}</p>
          </div>
        </div>
      `,
      width: '540px',
      showCancelButton: true,
      confirmButtonText: '🔒 Autorizar y Capturar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#2e7d32',
      customClass: { popup: 'consent-popup' },
      didOpen: () => {
        const btn = Swal.getConfirmButton();
        if (btn) btn.disabled = true;
        const cb = document.getElementById('swal-consent-cb') as HTMLInputElement;
        cb?.addEventListener('change', () => {
          if (btn) btn.disabled = !cb.checked;
        });
      },
      preConfirm: () => {
        const cb = document.getElementById('swal-consent-cb') as HTMLInputElement;
        if (!cb?.checked) {
          Swal.showValidationMessage('Debes marcar la casilla para continuar.');
          return false;
        }
        return true;
      },
    });
    return isConfirmed;
  }

  private async captureFingerprint(kind: 'ID' | 'PD', empresaSlug?: string): Promise<void> {
    // Per-company UI state helpers
    const setMsg = (t: string) => {
      if (empresaSlug === 'apoyo-laboral') this.messageApoyo = t;
      else if (empresaSlug === 'tu-alianza') this.messageTuAlianza = t;
      if (kind === 'ID') this.messageID = t; else this.messagePD = t;
    };
    const setImg = (d: string | null) => {
      if (empresaSlug === 'apoyo-laboral') this.fingerprintImageApoyo = d;
      else if (empresaSlug === 'tu-alianza') this.fingerprintImageTuAlianza = d;
      if (kind === 'ID') this.fingerprintImageID = d; else this.fingerprintImagePD = d;
    };

    // ── Consentimiento obligatorio para Índice Derecho ──
    if (kind === 'ID' && empresaSlug) {
      const aceptado = await this.mostrarConsentimientoHuella(empresaSlug);
      if (!aceptado) return;
      this.huellaForm.patchValue({ consentimientoHuella: true });
    }

    type FingerprintGetResult = { success: boolean; data?: string; error?: string };
    const electron = (window as any)?.electron as { fingerprint?: { get: () => Promise<FingerprintGetResult> } };

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

      // base64 crudo -> Data URL para preview
      const dataUrl = `data:image/png;base64,${res.data}`;
      setImg(dataUrl);
      setMsg('Huella capturada exitosamente.');

      // Subir automáticamente solo la Índice Derecho
      if (kind === 'ID' && empresaSlug) {
        const cedula = this.candidatoSeleccionado()?.numero_documento;
        if (!cedula) {
          this.alert('warning', 'Cédula requerida', 'No hay cédula para asociar la huella.');
          return;
        }

        const cfg = HiringQuestionsComponent.EMPRESAS_HUELLA[empresaSlug]
          ?? HiringQuestionsComponent.EMPRESAS_HUELLA['apoyo-laboral'];
        const textoConsentimiento = this.buildTextoConsentimientoHuella(cfg.nombre);

        // DataURL → File
        const filename = this.buildHuellaFilename('ID');
        const file = this.dataUrlToFile(dataUrl, filename);

        // ── Generar hashes ──
        const timestampISO = new Date().toISOString();
        const consentimientoHash = await this.generateHash(
          String(cedula) + textoConsentimiento + timestampISO
        );
        const imageHash = await this.generateFileHash(file);

        this.huellaForm.patchValue({
          consentimientoHash,
          timestampConsentimiento: timestampISO,
          imageHash,
        });

        Swal.fire({
          icon: 'info',
          title: 'Subiendo huella…',
          text: `Guardando Índice Derecho (${cfg.nombre}) en el servidor.`,
          allowOutsideClick: false,
          didOpen: () => Swal.showLoading(),
        });

        try {
          await firstValueFrom(
            this.procesosService.uploadHuella(cedula, file, {
              consentimiento_hash: consentimientoHash,
              consentimiento_version: this.VERSION_CONSENTIMIENTO_HUELLA,
              consentimiento_timestamp: timestampISO,
              user_agent: this.huellaForm.value.userAgent,
              image_hash: imageHash,
            })
          );
          Swal.close();
          setMsg('Huella capturada y guardada.');
          this.alert('success', '¡Listo!', `La huella (Índice Derecho — ${cfg.nombre}) se guardó correctamente.`);
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

  // Helper: DataURL → File
  private dataUrlToFile(dataUrl: string, filename: string): File {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) throw new Error('DataURL inválido');
    const mime = m[1] || 'application/octet-stream';
    const base64 = m[2];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], filename, { type: mime });
  }

  private buildHuellaFilename(kind: 'ID' | 'PD'): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `huella_${kind}_${stamp}.png`;
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

  private toSiNo(v: any): 'Sí' | 'No' {
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (typeof v === 'number') return v > 0 ? 'Sí' : 'No';
    if (typeof v === 'string') {
      const s = v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
      return ['si', 'sí', 'true', '1', 'x', 's'].includes(s) ? 'Sí' : 'No';
    }
    return 'No';
  }

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
      'forma_de_pago', 'numero_para_pagos', 'Ccentro_de_costos', 'porcentaje_arl', 'cesantias',
      'subcentro_de_costos', 'grupo', 'categoria', 'operacion', 'horas_extras', 'seguro_funerario',
      'desea_trasladarse', 'seleccion_eps', 'contrasenia_asignada', 'identification_number_tarjeta'
    ];
    const contratoVacio = !contr || CONTR_KEYS.every(k => isEmptyValue((contr as any)?.[k]));
    const toNum = (v: any) => (v === '' || v == null ? null : Number(v));

    // 1) Parche inicial (contrato/proceso)
    this.pagoTransporteForm.patchValue({
      formaPago: contr?.forma_de_pago ?? '',
      numeroPagos: contr?.numero_para_pagos ?? null,
      numeroIdentificacion: (contr as any)?.identification_number_tarjeta ?? null,
      contraseniaAsignada: contr?.contrasenia_asignada ?? null,
      // validacionNumeroCuenta: contr?.numero_para_pagos ?? null, // eliminado
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
      auxilioTransporte: 'No',
      fechaIngreso: contr?.fecha_ingreso ?? null,
    });

    // 2) Traer SIEMPRE la vacante (si hay publicacion) para setear auxilioTransporte
    if (proc?.publicacion) {
      try {
        const vac: any = await firstValueFrom(this.vacantesService.obtenerVacante(proc.publicacion));

        const salarioFromProc = proc?.vacante_salario != null ? toNum(proc.vacante_salario) : null;
        const salarioFromVac = vac?.salario != null ? toNum(vac.salario) : null;

        const auxFromVac = this.toSiNo(vac?.auxilioTransporte);

        this.pagoTransporteForm.patchValue({
          salario: salarioFromProc ?? salarioFromVac,
          auxilioTransporte: auxFromVac,
        });

        if (contratoVacio) {
          // Completar otros defaults desde la vacante si aplica
        }
      } catch (e) {
        console.error('No se pudo cargar la vacante:', e);
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
        }),
      );
  }

  private _docsCtx = 0;
  async llenarDocumentos(): Promise<void> {
    const ctx = ++this._docsCtx;
    Swal.fire({
      icon: 'info',
      title: 'Cargando…',
      text: 'Cargando documentos del candidato…',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading(),
    });

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
          if (baseKey === 'personal' || baseKey === 'familiar' || baseKey === 'laboral') {
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

  // ═══════════════════════════════════════════════════════════════
  //  DOCUMENT PREVIEW DIALOG (Huella)
  // ═══════════════════════════════════════════════════════════════

  openDocumentsDialog(): void {
    this.currentDocIndex = 0;
    this.showDocumentsDialog = true;
  }

  closeDocumentsDialog(): void {
    this.showDocumentsDialog = false;
  }

  nextDocument(): void {
    if (this.currentDocIndex < this.huellaDocsList.length - 1) this.currentDocIndex++;
  }

  prevDocument(): void {
    if (this.currentDocIndex > 0) this.currentDocIndex--;
  }

  private pushHuellaDoc(title: string, buffer: ArrayBuffer): void {
    const blob = new Blob([buffer], { type: 'application/pdf' });
    this.huellaDocsList.push({
      title,
      safeUrl: this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(blob))
    });
  }

  /** Genera previews de los documentos que usan la huella */
  async generarPreviewsHuella(empresaSlug: string): Promise<void> {
    this.huellaDocsList = [];
    this.currentDocIndex = 0;

    const huellaImage = empresaSlug === 'tu-alianza'
      ? this.fingerprintImageTuAlianza
      : this.fingerprintImageApoyo;

    if (!huellaImage) {
      Swal.fire('Atención', 'Primero debes capturar la huella.', 'info');
      return;
    }

    Swal.fire({
      icon: 'info', title: 'Generando documentos…',
      text: 'Creando las vistas previas con la huella capturada.',
      allowOutsideClick: false, didOpen: () => Swal.showLoading(),
    });

    const cand = this.candidatoSeleccionado();
    const cedula = cand?.numero_documento ?? '';

    try {
      // 1. Entrega de Documentos (jsPDF – usa huella)
      try {
        const buf = await this.generarEntregaDocsHuella(cedula, cand, huellaImage);
        if (buf) this.pushHuellaDoc('Entrega de documentos', buf);
      } catch (e) { console.warn('No se pudo generar Entrega de Documentos:', e); }

      this.currentDocIndex = 0;
      Swal.close();

      if (this.huellaDocsList.length > 0) {
        this.openDocumentsDialog();
      } else {
        Swal.fire('Info', 'No se generaron documentos con la huella.', 'info');
      }
    } catch (error) {
      Swal.close();
      console.error('Error generando previews de huella:', error);
      Swal.fire('Error', 'No se pudieron generar los documentos.', 'error');
    }
  }

  // ═════ ENTREGA DE DOCUMENTOS con Huella (jsPDF) ═════
  private async generarEntregaDocsHuella(
    cedula: string, cand: any, huellaDataUrl: string
  ): Promise<ArrayBuffer | null> {
    const H_CENTER = 'center' as const;
    const BOLD = 'bold' as const;
    const ITALIC = 'italic' as const;

    const toDataURL = async (url?: string): Promise<string | null> => {
      if (!url) return null;
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error('fetch fail');
        const b = await r.blob();
        return await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(new Error('reader fail'));
          fr.readAsDataURL(b);
        });
      } catch { return null; }
    };

    const renderJustifiedLine = (
      doc: jsPDF, linea: string, x: number, y: number,
      anchoDisponible: number, ultimaLinea: boolean
    ) => {
      const palabras = linea.split(' ').filter(Boolean);
      if (palabras.length <= 1 || ultimaLinea) { doc.text(linea, x, y); return; }
      const widths = palabras.map(p => doc.getTextWidth(p));
      const totalPalabras = widths.reduce((a, b) => a + b, 0);
      const espacios = palabras.length - 1;
      const extra = (anchoDisponible - totalPalabras) / espacios;
      let cursorX = x;
      palabras.forEach((p, i) => {
        doc.text(p, cursorX, y);
        if (i < espacios) cursorX += widths[i] + extra;
      });
    };

    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const empresaNombre = 'APOYO LABORAL T.S. S.A.S.';
    doc.setProperties({ title: 'Entrega_Documentos.pdf', author: empresaNombre, creator: empresaNombre });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const leftMargin = 10, rightMargin = 10;
    const contentWidth = pageWidth - leftMargin - rightMargin;
    let y = 10;
    const marginLeft = leftMargin;

    // ── Encabezado ──
    const startX = leftMargin, startY = y, headerHeight = 13;
    const logoBoxWidth = 50, tableWidth = contentWidth;
    doc.setLineWidth(0.1);
    doc.rect(startX, startY, logoBoxWidth, headerHeight);
    const logoData = await toDataURL('logos/Logo_AL.png');
    if (logoData) doc.addImage(logoData, 'PNG', startX + 2, startY + 1.5, 27, 10);
    doc.setFontSize(7);
    const tableStartX = startX + logoBoxWidth;
    const rightHeaderWidth = tableWidth - logoBoxWidth;
    doc.rect(tableStartX, startY, rightHeaderWidth, headerHeight);
    doc.setFont('helvetica', 'bold');
    doc.text('PROCESO DE CONTRATACIÓN', tableStartX + 54, startY + 3);
    doc.text('ENTREGA DE DOCUMENTOS Y AUTORIZACIONES', tableStartX + 44, startY + 7);
    const h1Y = startY + 4, h2Y = startY + 8;
    doc.line(tableStartX, h1Y, tableStartX + rightHeaderWidth, h1Y);
    doc.line(tableStartX, h2Y, tableStartX + rightHeaderWidth, h2Y);
    const col1 = tableStartX + 30, col2 = tableStartX + 50, col3 = tableStartX + 110;
    doc.line(col1, h2Y, col1, startY + headerHeight);
    doc.line(col2, h2Y, col2, startY + headerHeight);
    doc.line(col3, h2Y, col3, startY + headerHeight);
    doc.setFontSize(7).setFont('helvetica', 'bold');
    doc.text('Código: AL CO-RE-6', tableStartX + 2, startY + 11.5);
    doc.text('Versión: 23', col1 + 2, startY + 11.5);
    doc.text('Fecha Emisión: Julio 9-25', col2 + 5, startY + 11.5);
    doc.text('Página: 1 de 1', col3 + 6, startY + 11.5);
    y = startY + headerHeight + 7;

    // ── Intro ──
    doc.setFontSize(8).setFont('helvetica', 'normal');
    doc.text('Reciba un cordial saludo, por medio del presente documento afirmo haber recibido, leído y comprendido los documentos relacionados a continuación:', marginLeft, y, { maxWidth: contentWidth });
    doc.setFontSize(7);
    y += 4;

    ['Copia del Contrato individual de Trabajo',
      'Inducción General de nuestra Compañía e Información General de la Empresa Usuaria el cual incluye información sobre:'
    ].forEach((item, idx) => {
      const n = `${idx + 1}) `;
      doc.setFont('helvetica', 'bold'); doc.text(n, marginLeft, y);
      doc.setFont('helvetica', 'normal'); doc.text(item, marginLeft + doc.getTextWidth(n), y);
      y += 5;
    });

    // ── Tabla (autoTable) ──
    doc.setFontSize(8).setFont('helvetica', 'bold');
    doc.text('Fechas de Pago de Nómina y Valor del almuerzo que es descontado por Nómina o Liquidación final:', marginLeft + 20, y);
    const startYForTable = y + 3;

    const head: RowInput[] = [[
      { content: 'EMPRESA USUARIA', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } },
      { content: 'FECHA DE PAGO', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } },
      { content: 'SERVICIO DE CASINO', styles: { halign: H_CENTER, fontStyle: BOLD, fillColor: [255, 128, 0], textColor: 255 } }
    ]];
    const body: RowInput[] = [
      [{ content: 'The Elite Flower S.A.S C.I *\nFundación Fernando Borrero Caicedo', styles: { fontStyle: ITALIC, fontSize: 6.5, halign: H_CENTER } }, { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } }, { content: 'Valor de Almuerzo $ 1,945\nDescuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }],
      [{ content: 'Luisiana Farms S.A.S.', styles: { fontStyle: ITALIC, fontSize: 6.5, halign: H_CENTER } }, { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } }, { content: 'Valor de Almuerzo $ 3,700\nDescuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }],
      [{ content: 'Petalia S.A.S', styles: { fontStyle: ITALIC, fontSize: 6.5, halign: H_CENTER } }, { content: '01 y 16 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } }, { content: 'No cuenta con servicio de casino, se debe llevar el almuerzo', styles: { fontSize: 6.5, halign: H_CENTER } }],
      [{ content: 'Fantasy Flower S.A.S. \nMercedes S.A.S. \nWayuu Flowers S.A.S', styles: { fontStyle: ITALIC, fontSize: 6.5, halign: H_CENTER } }, { content: '06 y 21 de cada mes', styles: { fontSize: 6.5, halign: H_CENTER } }, { content: 'Valor de Almuerzo $ 1,945 \n Descuento quincenal por nómina y/o Liquidación Final', styles: { fontSize: 6.5, halign: H_CENTER } }]
    ];
    autoTable(doc, { head, body, startY: startYForTable, theme: 'grid', margin: { left: leftMargin, right: rightMargin }, styles: { font: 'helvetica', fontSize: 6.5, cellPadding: { top: 1.2, bottom: 1.2, left: 2, right: 2 } }, headStyles: { lineWidth: 0.2, lineColor: [120, 120, 120] }, bodyStyles: { lineWidth: 0.2, lineColor: [180, 180, 180], valign: 'middle' }, columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: 45 }, 2: { cellWidth: 'auto' as const } } });
    const finalY = (doc as any).lastAutoTable?.finalY ?? (startYForTable + 30);
    doc.setDrawColor(0).setLineWidth(0.2);
    doc.line(leftMargin, finalY, pageWidth - rightMargin, finalY);
    y = finalY + 4;

    // ── Notas ──
    doc.setFontSize(7).setFont('helvetica', 'normal');
    const nota1 = 'Nota: * Para los centros de costo de la empresa usuaria The Elite Flower S.A.S. C.I.: Carnations, Florex, Jardines de Colombia Normandía, Tinzuque, Tikya, Chuzacá; su fecha de pago son 06 y 21 de cada mes.';
    const nota2 = '** Para los centros de costo de la empresa usuaria Wayuu Flowers S.A.S.: Pozo Azul, Postcosecha Excellence, Belchite; su fecha de pago son 01 y 16 de cada mes.';
    const l1 = doc.splitTextToSize(nota1, contentWidth) as string[]; doc.text(l1, marginLeft, y); y += l1.length * 4;
    const l2 = doc.splitTextToSize(nota2, contentWidth) as string[]; doc.text(l2, marginLeft, y); y += l2.length * 4;

    // ── Autorización casino ──
    doc.setFontSize(8).setFont('helvetica', 'bold');
    doc.text('Teniendo en cuenta la anterior información, autorizo descuento de casino:', marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text('SI (  X  )', 130, y); doc.text('NO (     )', 155, y); doc.text('No aplica (     )', 175, y);

    // ── Forma de pago ──
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(7);
    doc.text('3) FORMA DE PAGO:', marginLeft, y); y += 5;
    const contrato = cand?.entrevistas?.[0]?.proceso?.contrato || {};
    const formaPago: string = contrato?.forma_de_pago ?? '';
    const numPagos: string = contrato?.numero_para_pagos ?? '';
    const opciones = [
      { nombre: 'Daviplata', x: marginLeft, y }, { nombre: 'Davivienda cta ahorros', x: marginLeft + 20, y },
      { nombre: 'Davivienda Tarjeta Master', x: marginLeft + 60, y }, { nombre: 'Otra', x: marginLeft + 105, y },
    ];
    opciones.forEach(op => {
      doc.rect(op.x, op.y - 3, 4, 4);
      doc.setFont('helvetica', 'normal').text(op.nombre, op.x + 6, op.y);
      if (formaPago === op.nombre) doc.setFont('helvetica', 'bold').text('X', op.x + 1, op.y);
    });
    doc.text('¿Cuál?', 130, y); doc.line(140, y, 200, y);
    y += 5;
    doc.setFontSize(8).setFont('helvetica', 'bold').text('Número TJT ó Celular:', marginLeft, y);
    doc.text('Código de Tarjeta:', 110, y);
    doc.setFont('helvetica', 'normal');
    if (formaPago === 'Daviplata') doc.text(String(numPagos), 60, y);
    else doc.text(String(numPagos), 150, y);

    // ── IMPORTANTE (justificado) ──
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(7);
    const importante = 'IMPORTANTE: Recuerde que si usted cuenta con su forma de pago Daviplata, cualquier cambio realizado en la misma debe ser notificado a la Emp. Temporal. También tenga presente que la entrega de la tarjeta Master por parte de la Emp. Temporal es provisional, y se reemplaza por la forma de pago DAVIPLATA; tan pronto Davivienda nos informa que usted activó su DAVIPLATA, se le genera automáticamente el cambio de forma de pago. CUIDADO! El manejo de estas cuentas es responsabilidad de usted como trabajador, por eso son personales e intransferibles.';
    doc.setFont('helvetica', 'normal');
    const lineas = doc.splitTextToSize(importante.trim().replace(/\s+/g, ' '), contentWidth) as string[];
    lineas.forEach((ln, i) => { renderJustifiedLine(doc, ln, marginLeft, y, contentWidth, i === lineas.length - 1); y += 3; });

    // ── Acepto cambio ──
    y += 5;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('ACEPTO CAMBIO SIN PREVIO AVISO YA QUE HE SIDO INFORMADO (A):', marginLeft, y - 4);
    doc.setFont('helvetica', 'normal'); doc.text('SI (  x  )', 170, y - 4); doc.text('NO (     )', 190, y - 4);
    doc.setFontSize(6.5);

    // ── Contenido final ──
    const contenidoFinal = [
      { numero: '4)', texto: 'Entrega y Manejo del Carné de la Empresa de Servicios Temporales APOYO LABORAL TS S.A.S.' },
      { numero: '5)', texto: 'Capacitación de Ley 1010 DEL 2006 (Acosos laboral) y mecanismo para interponer una queja general o frente al acoso.' },
      { numero: '6)', texto: 'Socialización de las políticas vigentes y aplicables de la Empresa Temporal.' },
      { numero: '7)', texto: 'Curso de Seguridad y Salud en el Trabajo "SST" de la Empresa Temporal.' },
      { numero: '8)', texto: 'Se hace entrega de la documentación requerida para la vinculación de beneficiarios a la Caja de Compensación Familiar y se establece compromiso de 15 días para la entrega sobre la documentación para afiliación de beneficiarios a la Caja de Compensación y EPS si aplica.\nDe lo contrario se entenderá que usted no desea recibir este beneficio, recuerde que es su responsabilidad el registro de los mismos.' },
      { numero: '9)', texto: 'Plan funeral Coorserpark: AUTORIZO la afiliación y descuento VOLUNTARIO al plan, por un valor de $4.095 descontados quincenalmente por Nómina. La afiliación se hace efectiva a partir del primer descuento.' }
    ];
    const bottomSafe = 12;
    const ensureSpace = (need: number) => { if (y + need > pageHeight - bottomSafe) { doc.addPage(); y = 15; } };
    doc.setFontSize(7);
    contenidoFinal.forEach(item => {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold').text(item.numero, marginLeft, y);
      doc.setFont('helvetica', 'normal');
      const tl = doc.splitTextToSize(item.texto, contentWidth) as string[];
      doc.text(tl, marginLeft + 10, y); y += tl.length * 4 + 1;
    });

    // Seguro funerario
    const seguro = !!contrato?.seguro_funerario;
    if (seguro) { doc.text('SI (  x  )', 170, y - 4); doc.text('NO (     )', 190, y - 4); }
    else { doc.text('SI (     )', 170, y - 4); doc.text('NO (  x  )', 190, y - 4); }

    doc.setFont('helvetica', 'bold').text('Nota:', marginLeft, y + 1);
    doc.setFont('helvetica', 'normal').setFontSize(7).text(
      'Si usted autorizó este descuento debe presentar una carta en la oficina de la Temporal solicitando el retiro, para la desafiliación de este plan.',
      marginLeft + 10, y + 1, { maxWidth: contentWidth - 10 }
    );

    // ── Banner Recuerde que ──
    y += 5; ensureSpace(10);
    doc.setFillColor(230, 230, 230); doc.rect(marginLeft, y - 2, contentWidth, 5, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(7.5).setTextColor(0, 0, 0);
    doc.text('Recuerde que:', marginLeft + 2, y + 1);
    doc.setFont('helvetica', 'normal').setTextColor(0, 0, 0);
    doc.text('Puede encontrar esta información disponible en:', marginLeft + 25, y + 1);
    doc.setTextColor(0, 0, 255);
    doc.textWithLink('http://www.apoyolaboralts.com/', marginLeft + 95, y + 1, { url: 'http://www.apoyolaboralts.com/' });
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold').text('Ingresando la clave:', marginLeft + 145, y + 1);
    doc.setFont('helvetica', 'bold').setFontSize(8).text('9876', marginLeft + 180, y + 1);

    // ── DEL COLABORADOR ──
    y += 8; ensureSpace(20);
    const contenidoColaborador = [
      { numero: 'a)', texto: 'Por medio de la presente manifiesto que recibí lo anteriormente mencionado y que acepto el mismo.' },
      { numero: 'b)', texto: 'Leí y comprendí  el curso de inducción General y de Seguridad y Salud en el Trabajo, así como  el contrato laboral   y todas las cláusulas y condiciones establecidas.' },
      { numero: 'c)', texto: 'Información Condiciones de Salud: Manifiesto que conozco los resultados de mis exámenes médicos de ingreso y las recomendaciones dadas por el médico ocupacional.' },
    ];
    doc.setFont('helvetica', 'bold').setFontSize(8).text('DEL COLABORADOR:', marginLeft, y); y += 5;
    doc.setFontSize(7.5);
    const lh = 4, gapAfterItem = 1;
    doc.setFont('helvetica', 'bold');
    const bulletBoxWidth = Math.max(doc.getTextWidth('a) '), doc.getTextWidth('b) '), doc.getTextWidth('c) ')) + 1.5;
    const xBullet = marginLeft, xText = xBullet + bulletBoxWidth;
    const availWidth = pageWidth - rightMargin - xText;

    contenidoColaborador.forEach(({ numero, texto }) => {
      ensureSpace(10);
      doc.setFont('helvetica', 'bold').text(numero, xBullet, y);
      doc.setFont('helvetica', 'normal');
      const partes = String(texto).split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      (partes.length ? partes : ['']).forEach((p, pi) => {
        const lines = doc.splitTextToSize(p, availWidth) as string[];
        lines.forEach(ln => { ensureSpace(lh); doc.text(ln, xText, y); y += lh; });
        if (pi < partes.length - 1) y += 1.5;
      });
      y += gapAfterItem;
    });

    // ── Firma + Huella ──
    y += 10; ensureSpace(30);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.line(marginLeft, y, marginLeft + 60, y);
    doc.text('Firma de Aceptación', marginLeft, y + 4);

    // Firma del candidato (si existe en biometría)
    const firmaUrl = cand?.biometria?.firma?.file_url;
    if (firmaUrl) {
      const firmaData = await toDataURL(firmaUrl);
      if (firmaData) doc.addImage(firmaData, 'PNG', marginLeft, y - 18, 50, 20);
    }

    y += 8;
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text(`No de Identificación: ${cedula ?? ''}`, marginLeft, y);
    doc.text(`Fecha de Recibido: ${new Date().toISOString().split('T')[0]}`, marginLeft, y + 4);

    // Tabla de huella
    const huellaTableWidth = 82, huellaTableHeight = 30, huellaHeaderHeight = 8;
    const huellaStartX = pageWidth - rightMargin - huellaTableWidth;
    const huellaStartY = y - 10;
    doc.setFillColor(230, 230, 230);
    doc.rect(huellaStartX, huellaStartY, huellaTableWidth / 2, huellaHeaderHeight, 'F');
    doc.setDrawColor(0);
    doc.rect(huellaStartX, huellaStartY, huellaTableWidth / 2, huellaHeaderHeight);
    doc.setFont('helvetica', 'bold').setFontSize(8);
    doc.text('Huella Indice Derecho', huellaStartX + 5, huellaStartY + 5);
    doc.rect(huellaStartX, huellaStartY + huellaHeaderHeight, huellaTableWidth / 2, huellaTableHeight);

    // Insertar la huella capturada directamente desde el dataURL en memoria
    if (huellaDataUrl) {
      const imageWidth = huellaTableWidth / 2 - 10;
      const imageHeight = huellaTableHeight - 3;
      doc.addImage(huellaDataUrl, 'PNG', huellaStartX + 5, huellaStartY + huellaHeaderHeight + 2, imageWidth, imageHeight);
    }

    // Sello
    const selloData = await toDataURL('firma/FirmaEntregaDocApoyo.png');
    if (selloData) { y += 5; doc.addImage(selloData, 'PNG', marginLeft, y, 95, 10); }

    return doc.output('arraybuffer');
  }
}
