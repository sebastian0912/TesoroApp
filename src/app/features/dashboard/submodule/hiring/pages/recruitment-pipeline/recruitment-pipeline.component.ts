import {
  Component, LOCALE_ID, inject, effect, signal, computed, DestroyRef, PLATFORM_ID,
  afterNextRender
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatDateFormats } from '@angular/material/core';
import { MomentDateAdapter, MatMomentDateModule } from '@angular/material-moment-adapter';

import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { FormsModule, FormArray, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '@/app/shared/shared.module';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { HiringQuestionsComponent } from '../../components/hiring-questions/hiring-questions.component';
import { HelpInformationComponent } from '../../components/help-information/help-information.component';
import { CameraDialogComponent } from '../../components/camera-dialog/camera-dialog.component';

import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

import { firstValueFrom, merge, startWith } from 'rxjs';
import Swal from 'sweetalert2';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { TableDialogComponent } from '@/app/shared/components/table-dialog/table-dialog.component';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import jsPDF from 'jspdf';
import JSZip from 'jszip';
import QRCode from 'qrcode';

import { PdfService } from '@/app/shared/services/pdf/pdf.service';
import { HomeService } from '../../../home/service/home.service';

import { ColumnDefinition } from '@/app/shared/models/advanced-table-interface';

export const MY_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

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

type ExamenResultadoForm = { aptoStatus?: string };
type BioKind = 'foto' | 'huella' | 'firma';

@Component({
  selector: 'app-recruitment-pipeline',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule,
    MatIconModule, MatTabsModule, MatDatepickerModule, MatMomentDateModule,
    MatTooltipModule, MatDialogModule, MatBadgeModule, MatSnackBarModule,
    SharedModule,
    SearchForCandidateComponent, SelectionQuestionsComponent, HiringQuestionsComponent, HelpInformationComponent,
    RouterLink
  ],
  templateUrl: './recruitment-pipeline.component.html',
  styleUrls: ['./recruitment-pipeline.component.css'],
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS },
  ],
})
export class RecruitmentPipelineComponent {
  // ───────── Signals de estado ─────────
  candidatoSeleccionado = signal<any | null>(null);
  nombreCandidato: string = '';
  numeroDocumento: string = '';

  // Previews locales
  fotoDataUrl = signal<string | null>(null);
  firmaDataUrl = signal<string | null>(null);
  huellaDataUrl = signal<string | null>(null);

  uploadedFiles: Record<string, LocalFile> = {};
  serverDocs: Record<string, ServerDocInfo> = {};

  // Biometría desde backend
  biometria = signal<{ firma?: any; huella?: any; foto?: any; created_at?: string; updated_at?: string } | null>(null);
  examenMedicoDoc = signal<ServerDocInfo | null>(null); // Signal para el documento ID 32
  arlDoc = signal<ServerDocInfo | null>(null); // Signal para el documento ID 30
  fotoDoc = signal<ServerDocInfo | null>(null); // Signal para el documento FOTO ID 89

  // Flags (solo backend)
  private tieneFirmaSrv = computed(() => !!this.getBioDoc('firma'));
  private tieneHuellaSrv = computed(() => !!this.getBioDoc('huella'));
  private tieneFotoSrv = computed(() => !!this.getBioDoc('foto'));

  // Flags UI
  tieneFirmaUI = computed(() => !!(this.firmaDataUrl() || this.tieneFirmaSrv()));
  tieneHuellaUI = computed(() => !!(this.huellaDataUrl() || this.tieneHuellaSrv()));
  tieneFotoUI = computed(() => !!(this.fotoDataUrl() || this.fotoDoc() || this.tieneFotoSrv()));
  tieneExamenMedicoUI = computed(() => !!this.examenMedicoDoc());
  tieneArlUI = computed(() => !!this.arlDoc());

  // Helpers para badges
  badge(kind: BioKind) { return this.tiene(kind) ? '✓' : '✗'; }
  badgeColor(kind: BioKind) { return this.tiene(kind) ? 'primary' : 'warn'; }
  tiene(kind: BioKind): boolean {
    return !!(this.bioLocal(kind) || this.getBioUrl(kind));
  }

  sede = signal<string>('');
  // Un archivo por examen seleccionado (mapeo por índice)
  examFiles = signal<File[]>([]);

  readonly typeMap: Record<string, number> = { examenesMedicos: 32, arl: 30 };

  readonly filteredExamOptions: string[] = [
    'Exámen Ingreso', 'Colinesterasa', 'Glicemia Basal', 'Perfil lípidico', 'Visiometria', 'Optometría', 'Audiometría',
    'Espirometría', 'Sicometrico', 'Frotis de uñas', 'Frotis de garganta', 'Cuadro hematico', 'Creatinina', 'TGO',
    'Coprológico', 'Osteomuscular', 'Quimico (Respiratorio - Dermatologico)', 'Tegumentaria', 'Cardiovascular',
    'Trabajo en alturas (Incluye test para detección de fobia a las alturas: El AQ (Acrophobia Questionnaire) de Cohen)',
    'Electrocardiograma (Sólo aplica para mayores de 45 años)', 'Examen Médico', 'HEPATITIS A Y B', 'TETANO VACUNA T-D',
    'Exámen médico integral definido para conductores',
  ];

  private readonly abreviaciones: Record<string, string> = {
    ADMINISTRATIVOS: 'ADM', ANDES: 'AND', BOSA: 'BOS', CARTAGENITA: 'CAR',
    FACA_PRIMERA: 'FPR', FACA_PRINCIPAL: 'FPC', FONTIBÓN: 'FON', FORANEOS: 'FOR',
    FUNZA: 'FUN', MADRID: 'MAD', MONTE_VERDE: 'MV', ROSAL: 'ROS', SOACHA: 'SOA',
    SUBA: 'SUB', TOCANCIPÁ: 'TOC', USME: 'USM', VIRTUAL: 'VIRTUAL'
  };

  // ───────── DI ─────────
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);
  private readonly docSvc = inject(GestionDocumentalService);

  private util = inject(UtilityServiceService);
  private pdfSvc = inject(PdfService);
  private registroProceso = inject(RegistroProcesoContratacion);
  private homeService = inject(HomeService);
  private platformId = inject(PLATFORM_ID);
  private isBrowser = signal(false);

  // ───────── Form Parte 3 ─────────
  formGroup3: FormGroup = this.fb.group({
    ips: ['', Validators.required],
    ipsLab: [''],
    selectedExams: [[], Validators.required],
    selectedExamsArray: this.fb.array([]),
  });

  private selectedExamsCtrl = this.formGroup3.get('selectedExams')!;
  private selectedExamsArray = this.formGroup3.get('selectedExamsArray') as FormArray;

  // Señal booleana: hay al menos un NO APTO
  private hayNoApto = signal<boolean>(false);
  private _warnedNoApto = signal<boolean>(false);

  // 🔔 control para no spamear toasts
  private _lastMissingKey = signal<string>('');

  // ───────── Overlay Toast persistente (no-Swal) ─────────
  private _toastNode: HTMLDivElement | null = null;

  private _ensureToastNode(): HTMLDivElement {
    if (this._toastNode && document.body.contains(this._toastNode)) return this._toastNode;

    const node = document.createElement('div');
    node.setAttribute('role', 'status');
    node.style.position = 'fixed';
    node.style.top = '12px';
    node.style.right = '12px';
    node.style.maxWidth = '420px';
    node.style.zIndex = '2147483647';
    node.style.pointerEvents = 'auto';

    node.innerHTML = `
      <div style="
        background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.18);
        border:1px solid rgba(0,0,0,.08);overflow:hidden;font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial;
      ">
        <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(0,0,0,.06);">
          <span style="display:inline-flex;width:22px;height:22px;align-items:center;justify-content:center;border-radius:50%;background:#e8f0fe;">ℹ️</span>
          <div style="font-weight:600;color:#222">Faltan requisitos para Contratación</div>
          <button type="button" aria-label="Cerrar" style="
            margin-left:auto;background:transparent;border:0;cursor:pointer;font-size:18px;line-height:1;color:#444;padding:2px 6px;border-radius:8px;
          ">&times;</button>
        </div>
        <div class="body" style="padding:10px 14px;color:#333;font-size:13px;line-height:1.35;max-height:45vh;overflow:auto;"></div>
      </div>
    `;

    const closeBtn = node.querySelector('button');
    closeBtn?.addEventListener('click', () => this._closeToast());

    document.body.appendChild(node);
    this._toastNode = node;
    return node;
  }

  private _renderToast(htmlList: string): void {
    const node = this._ensureToastNode();
    const body = node.querySelector('.body') as HTMLElement | null;
    if (body) body.innerHTML = htmlList;
  }

  private _closeToast(): void {
    if (this._toastNode) {
      this._toastNode.remove();
      this._toastNode = null;
    }
  }

  private isNoApto = (v: unknown) =>
    this.util.normalizeText(v) === 'NOAPTO';

  constructor() {
    const safeJson = <T>(raw: any, fallback: T): T => {
      try {
        if (typeof raw !== 'string') return fallback;
        const parsed = JSON.parse(raw);
        return (Array.isArray(parsed) || typeof parsed === 'object') ? (parsed as T) : fallback;
      } catch { return fallback; }
    };

    this.isBrowser.set(isPlatformBrowser(this.platformId));

    // 1) Mantener MISMA instancia de FormArray → clear() + push()
    this.selectedExamsCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((exams: string[]) => {
        const arr = this.selectedExamsArray;
        while (arr.length) arr.removeAt(0);
        (exams || []).forEach(() =>
          arr.push(this.fb.group({ aptoStatus: ['APTO', Validators.required] }))
        );
        // Sincronizar slots de archivos con la cantidad de exámenes seleccionados
        const files = [...(this.examFiles() ?? [])];
        files.length = (exams ?? []).length;
        this.examFiles.set(files);

        this.recalcHayNoApto();
      });

    // 1.1) Recalcular “hayNoApto”
    merge(this.selectedExamsArray.valueChanges, this.selectedExamsArray.statusChanges)
      .pipe(startWith(this.selectedExamsArray.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalcHayNoApto());

    // 2) Cédula + biometría (embebida y refresh opcional)
    effect(() => {
      if (!this.isBrowser()) return;
      this.getFullName();
      this.getNumeroDocumento();

      const cand = this.candidatoSeleccionado();
      const ced = cand?.numero_documento ? String(cand.numero_documento) : null;

      this.setBiometriaFromCandidate(cand);

      const bio = cand?.biometria ?? null;
      if (ced && (!bio || this.isBioStale(bio))) {
        this.refreshBiometriaForCandidate(ced).catch(() => this.biometria.set(null));
      }
      if (ced) {
        this.refreshExamenMedicoForCandidate(ced);
        this.refreshArlForCandidate(ced);
        this.refreshFotoForCandidate(ced);
      } else {
        this.examenMedicoDoc.set(null);
        this.arlDoc.set(null);
        this.fotoDoc.set(null);
      }

      this.mostrarTabla();
    });

    // 3) Autollenar Salud Ocupacional desde la PRIMERA entrevista
    effect(() => {
      if (!this.isBrowser()) return;
      const cand = this.candidatoSeleccionado();
      const formArray = this.selectedExamsArray;

      if (!cand || !cand.entrevistas?.length) {
        this.formGroup3.reset();
        while (formArray.length) formArray.removeAt(0);
        this.examFiles.set([]); // limpiar archivos si no hay entrevista
        this.recalcHayNoApto();
        return;
      }

      const ent = cand.entrevistas[0];
      const proc = ent?.proceso;
      const em = proc?.examen_medico;

      if (!em) {
        this.formGroup3.patchValue({ ips: '', ipsLab: '', selectedExams: [] }, { emitEvent: false });
        while (formArray.length) formArray.removeAt(0);
        this.examFiles.set([]);
        this.recalcHayNoApto();
        return;
      }

      const exams: string[] = safeJson<string[]>(em.examenes, []);
      const results: ExamenResultadoForm[] = safeJson<ExamenResultadoForm[]>(em.resultados, []);

      this.formGroup3.patchValue(
        { ips: em.ips ?? '', ipsLab: em.ips_lab ?? '', selectedExams: exams ?? [] },
        { emitEvent: true }
      );

      setTimeout(() => {
        const len = formArray.length;
        for (let i = 0; i < len; i++) {
          const fg = formArray.at(i) as FormGroup;
          fg.patchValue({ aptoStatus: results[i]?.aptoStatus || 'APTO' }, { emitEvent: false });
        }
        // crear slots de archivos acorde a los exámenes autollenados (vacíos por ahora)
        const files = new Array<File>(formArray.length);
        this.examFiles.set(files);
        this.recalcHayNoApto();
      });
    });

    // 4) Aviso/lock por “NO APTO”
    effect(() => {
      if (!this.isBrowser()) return;
      const hay = this.hayNoApto();
      if (hay && !this._warnedNoApto()) {
        this._warnedNoApto.set(true);
        Swal.fire({
          icon: 'warning',
          title: 'Examen no apto',
          text: 'Hay al menos un examen con resultado "NO APTO". Se deshabilitará la pestaña de Contratación.',
          confirmButtonText: 'Entendido',
          allowOutsideClick: false,
          allowEscapeKey: false,
        }).then(() => this.util.nextStep.emit());
      }
      if (!hay && this._warnedNoApto()) this._warnedNoApto.set(false);
    });

    // 5) 🔔 Toast AUTOMÁTICO (overlay propio) con detalle de lo que FALTA (top-end)
    effect(() => {
      if (!this.isBrowser()) return;
      const cand = this.candidatoSeleccionado();
      if (!cand) { this._closeToast(); return; }

      const missing = this._missingForContratacion();
      const key = missing.join('|');

      // solo mostrar si hay algo faltante y cambió el "hash" de motivos
      if (missing.length > 0) {
        if (key !== this._lastMissingKey()) {
          this._lastMissingKey.set(key);
          const htmlList = `<ul style="margin:0;padding-left:18px;text-align:left">
            ${missing.map(m => `<li>${m}</li>`).join('')}
          </ul>`;
          this._renderToast(htmlList);
        } else {
          // ya estaba abierto, no actualizar => nada
        }
      } else {
        // ya no falta nada ⇒ cerrar si está abierto
        this._lastMissingKey.set('');
        this._closeToast();
      }
    });
  }

  // ───────── API UI ────────
  onCandidatoSeleccionado(candidato: any | null): void {
    this.candidatoSeleccionado.set(candidato);
    console.log('Candidato seleccionado:', candidato);
  }

  getFullName(): void {
    const c = this.candidatoSeleccionado();
    this.nombreCandidato = c
      ? [c.primer_nombre, c.segundo_nombre, c.primer_apellido, c.segundo_apellido]
        .map(v => (v ?? '').toString().trim())
        .filter(v => v.length > 0)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim()
      : '';
  }

  getNumeroDocumento(): void {
    const c = this.candidatoSeleccionado();
    this.numeroDocumento = c?.numero_documento != null ? String(c.numero_documento).trim() : '';
  }

  generacionDocumentos(): void {
    this.router.navigate(['dashboard/hiring/generate-contracting-documents', this.numeroDocumento]);
  }

  // ───────── CONFIRMACIÓN CONTACTO ─────────
  async confirmarCorreoBienvenida(): Promise<void> {
    const cand = this.candidatoSeleccionado();
    if (!cand?.id) return;

    const emailStr = cand.contacto?.email || cand.correo_electronico || cand.correo || 'No registrado';
    const msgTemplate = `Hola ${cand.primer_nombre || ''},\n\nTe damos la bienvenida al equipo.\n\nPor favor confirma la recepción de este correo.\n\nSaludos.`;

    const { value: textToSend, isConfirmed } = await Swal.fire({
      title: 'Confirmar Correo de Bienvenida',
      html: `<p>Se enviará el siguiente mensaje a: <b>${emailStr}</b></p>`,
      input: 'textarea',
      inputValue: msgTemplate,
      inputAttributes: {
        'aria-label': 'Mensaje de bienvenida'
      },
      showCancelButton: true,
      confirmButtonText: 'Confirmar y Guardar',
      cancelButtonText: 'Cancelar',
      width: '600px'
    });

    if (!isConfirmed) return;

    try {
      Swal.fire({ title: 'Guardando confirmación...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const resp = await firstValueFrom(this.registroProceso.confirmarContacto(cand.id, { correo_confirmado: true }));
      cand.contacto = cand.contacto || {};
      cand.contacto.correo_confirmado = true;
      this.candidatoSeleccionado.set(cand);
      Swal.close();
      this.snack.open('Correo confirmado', 'OK', { duration: 3000 });

      // Here you could also trigger an email sending service with `textToSend` and `emailStr`
      // if there's a backend endpoint for it, but for now we just mark it as confirmed.
    } catch (err) {
      Swal.close();
      console.error(err);
      this.snack.open('Error al confirmar correo', 'Cerrar', { duration: 3000 });
    }
  }

  async confirmarWhatsAppBienvenida(): Promise<void> {
    const cand = this.candidatoSeleccionado();
    if (!cand?.id) return;

    const waStr = cand.contacto?.whatsapp || cand.numCelular || cand.telefono || cand.celular || 'No registrado';
    const msgTemplate = `Hola ${cand.primer_nombre || ''}, te damos la bienvenida al equipo. Por favor confirma este mensaje.`;

    const { value: textToSend, isConfirmed } = await Swal.fire({
      title: 'Confirmar WhatsApp de Bienvenida',
      html: `<p>Se enviará el siguiente mensaje a: <b>${waStr}</b></p>`,
      input: 'textarea',
      inputValue: msgTemplate,
      inputAttributes: {
        'aria-label': 'Mensaje de WhatsApp'
      },
      showCancelButton: true,
      confirmButtonText: 'Confirmar y Guardar',
      cancelButtonText: 'Cancelar',
      width: '600px'
    });

    if (!isConfirmed) return;

    try {
      Swal.fire({ title: 'Guardando confirmación...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const resp = await firstValueFrom(this.registroProceso.confirmarContacto(cand.id, { whatsapp_confirmado: true }));
      cand.contacto = cand.contacto || {};
      cand.contacto.whatsapp_confirmado = true;
      this.candidatoSeleccionado.set(cand);
      Swal.close();
      this.snack.open('WhatsApp confirmado', 'OK', { duration: 3000 });

      // Open WhatsApp web with the message
      if (waStr !== 'No registrado') {
        const waNumber = waStr.replace(/[^0-9]/g, '');
        const waUrl = `https://wa.me/57${waNumber}?text=${encodeURIComponent(textToSend)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      Swal.close();
      console.error(err);
      this.snack.open('Error al confirmar WhatsApp', 'Cerrar', { duration: 3000 });
    }
  }

  // ───────── VALIDACIÓN PARA HABILITAR/DESHABILITAR CONTRATACIÓN ─────────
  // ───────── VALIDACIÓN PARA HABILITAR/DESHABILITAR CONTRATACIÓN ─────────
  private _norm(s: any): string {
    return this.util.normalizeText(s);
  }

  private _firstProceso(cand: any): any | null {
    const ent0 = cand?.entrevistas?.[0];
    return ent0?.proceso ?? null;
  }

  private _antecedenteValor(proc: any, nombre: string): string | null {
    const want = this._norm(nombre);
    const lista = proc?.antecedentes ?? [];
    let val: string | null = null;
    for (const it of lista) {
      if (this._norm(it?.nombre) === want) {
        val = it?.observacion ?? null; // si hay duplicados, se queda con el último
      }
    }
    return val;
  }

  private _antecedentesCumplen(proc: any): boolean {
    // Regla estricta: EPS = "CUMPLE", PROCURADURIA = "CUMPLE", POLICIVOS = "CUMPLE"
    const eps = this._norm(this._antecedenteValor(proc, 'EPS'));
    const pro = this._norm(this._antecedenteValor(proc, 'PROCURADURIA'));
    const poli = this._norm(this._antecedenteValor(proc, 'POLICIVOS'));
    return eps === 'CUMPLE' && pro === 'CUMPLE' && poli === 'CUMPLE';
  }

  private _etapasOk(proc: any): boolean {
    const entrevistado = proc?.entrevistado === true;
    const remision = proc?.remision === true; // requerido explícitamente
    const pruebaOAprob = proc?.prueba_tecnica === true || proc?.autorizado === true;
    const examenes = proc?.examenes_medicos === true;
    return entrevistado && remision && pruebaOAprob && examenes;
  }

  /** Devuelve lista de mensajes con lo que falta para habilitar Contratación */
  private _missingForContratacion(): string[] {
    const cand = this.candidatoSeleccionado();
    if (!cand || !Array.isArray(cand.entrevistas) || cand.entrevistas.length === 0) {
      return ['Debe existir al menos una entrevista (entrevistas[0]).'];
    }

    const proc = this._firstProceso(cand);
    if (!proc) return ['La primera entrevista no tiene proceso asociado.'];

    const missing: string[] = [];

    // Antecedentes
    const vEPS = this._antecedenteValor(proc, 'EPS');
    const vPROC = this._antecedenteValor(proc, 'PROCURADURIA');
    const vPOLI = this._antecedenteValor(proc, 'POLICIVOS');

    // ✅ EPS: sólo que NO esté vacío
    if (!vEPS || this._norm(vEPS).length === 0) {
      missing.push(`Antecedente EPS no debe estar vacío (actual: ${vEPS ?? 'sin registro'})`);
    }

    // Se mantienen estos como "CUMPLE"
    if (this._norm(vPROC) !== 'CUMPLE') {
      missing.push(`Antecedente PROCURADURIA debe estar en "CUMPLE" (actual: ${vPROC ?? 'sin registro'})`);
    }
    if (this._norm(vPOLI) !== 'CUMPLE') {
      missing.push(`Antecedente POLICIVOS debe estar en "CUMPLE" (actual: ${vPOLI ?? 'sin registro'})`);
    }

    // Etapas del proceso
    if (proc?.entrevistado !== true) {
      missing.push('Marcar proceso.entrevistado en TRUE.');
    }

    // ❌ remision ya no es requisito
    // if (proc?.remision !== true) missing.push('Marcar proceso.remision en TRUE.');

    // ✅ Al menos uno: prueba_tecnica o autorizado
    const tienePruebaTecnica = proc?.prueba_tecnica === true;
    const tieneAutorizado = proc?.autorizado === true;
    if (!(tienePruebaTecnica || tieneAutorizado)) {
      missing.push('Debe estar TRUE al menos uno: "prueba_tecnica" o "autorizado".');
    }

    if (proc?.examenes_medicos !== true) {
      missing.push('Marcar proceso.examenes_medicos en TRUE.');
    }

    // NO APTO local (form)
    const arr = (this.selectedExamsArray.value ?? []) as ExamenResultadoForm[];
    const hayNoApto = Array.isArray(arr) && arr.some(x => this.isNoApto(x?.aptoStatus));
    if (hayNoApto) {
      missing.push('Hay al menos un examen con resultado "NO APTO".');
    }

    return missing;
  }


  // Usado por la plantilla: <mat-tab [disabled]="deshabilitarContratacion()">
  deshabilitarContratacion(): boolean {
    return this._missingForContratacion().length > 0;
  }

  // ───────── Salud ocupacional (PDF) ─────────
  // ───────── Salud ocupacional (PDF) ─────────
  private isPdf(file?: File | null): file is File {
    return this.pdfSvc.isPdf(file);
  }

  private normalizarSedeAbbr(raw: string | undefined | null): string {
    const s = (raw || '').toString().trim().toUpperCase();
    return this.abreviaciones[s] || s;
  }

  // ========= Utilidades nombres/fechas =========
  // ========= Utilidades nombres/fechas =========
  private slug(input: string): string {
    return this.util.normalizeText(input)
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  private yyyymmdd(d = new Date()): string {
    const iso = this.util.formatDateForBackend(d);
    return iso ? iso.replace(/-/g, '') : '';
  }

  private buildExamFilename(examName: string, cedula: string): string {
    const base = this.slug(examName || 'EXAMEN');
    return `${base}_${cedula}_${this.yyyymmdd()}.pdf`;
  }

  // ========= Helpers de UI para no congelar =========
  private nextFrame(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
  }
  private yieldUI(): Promise<void> {
    return new Promise<void>(resolve => setTimeout(resolve, 0));
  }

  // ========= Unir todos los PDFs de exámenes en uno solo =========
  // ========= Unir todos los PDFs de exámenes en uno solo =========
  private async mergeExamPdfs(
    pairs: { name: string; file: File }[],
    mergedName: string,
    onProgress?: (i: number, total: number) => void
  ): Promise<File> {
    return this.pdfSvc.mergePdfs(pairs.map(p => p.file), mergedName, onProgress);
  }

  // ========= Guardar + Unir + Subir =========
  async imprimirSaludOcupacional(): Promise<void> {
    const f = this.formGroup3.value;
    const numeroDocumento = this.candidatoSeleccionado()?.numero_documento;
    if (!numeroDocumento) {
      await Swal.fire({ title: 'Falta el número de documento del candidato', icon: 'info', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
      return;
    }

    // Helpers del loader
    const renderProgress = (pct: number, fase: string, sub: string = '') => `
      <div style="width:100%;margin-top:6px">
        <div style="height:10px;background:#eee;border-radius:6px;overflow:hidden">
          <div style="height:100%;width:${pct}%;transition:width .2s ease;background:#1976d2"></div>
        </div>
        <div style="margin-top:8px;font-size:12px;color:#555">${fase}${sub ? `<br><span style="font-size:11px;color:#777">${sub}</span>` : ''}</div>
      </div>
    `;
    const updateLoader = (pct: number, title: string, sub = '') =>
      Swal.update({ title, html: renderProgress(pct, title, sub) });

    // --- Datos para payload y NO APTO ---
    const cand = this.candidatoSeleccionado();
    const ent0 = cand?.entrevistas?.[0];
    const proc0 = ent0?.proceso;
    const contratoBE: any = proc0?.contrato || null;
    const formContrato: FormGroup | undefined = (this as any).formContrato;
    const llenoUI = formContrato?.valid === true;

    const camposClave = ['forma_de_pago', 'numero_para_pagos', 'Ccentro_de_costos', 'subcentro_de_costos', 'grupo', 'categoria', 'operacion'];
    const llenoBE = !!contratoBE && camposClave.every((k: string) => !!(contratoBE?.[k]));
    const codigoYaExiste = !!(contratoBE?.codigo_contrato);
    const sedeAbbr = this.normalizarSedeAbbr?.(ent0?.oficina) ?? ent0?.oficina ?? '';

    type ExamenResultado = { aptoStatus?: string | boolean | null;[k: string]: any };
    const resultadosArr: ExamenResultado[] = Array.isArray(this.selectedExamsArray?.value) ? this.selectedExamsArray.value : (f?.selectedExamsArray || []);
    const norm = (x: any) => String(x ?? '').trim().toUpperCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
    const hayNoApto = resultadosArr.some(r => typeof r?.aptoStatus === 'boolean' ? r.aptoStatus === false : norm(r?.aptoStatus) === 'NO APTO');

    const payload: any = {
      numero_documento: String(numeroDocumento),
      examen_medico: {
        ips: f?.ips ?? null,
        ips_lab: f?.ipsLab ?? null,
        examenes: JSON.stringify(f?.selectedExams ?? []),
        resultados: JSON.stringify(resultadosArr ?? []),
      },
    };

    if (hayNoApto) {
      payload.rechazado = true;
      payload.detalle = '901 examen';
    } else {
      const generarCodigo = !(llenoUI || llenoBE || codigoYaExiste);
      if (sedeAbbr) payload.contrato = { sede_abbr: sedeAbbr, generar_codigo: generarCodigo };
      if (llenoUI && formContrato) {
        const det = { ...(formContrato.value || {}) };
        Object.keys(det).forEach(k => { const v = det[k]; if (v === '' || v === undefined) delete det[k]; });
        if (Object.keys(det).length > 0) payload.contrato_detalle = det;
      }
    }

    // --- Preparar insumos de exámenes ---
    const selectedExams: string[] = (this.formGroup3.get('selectedExams')?.value || []) as string[];
    const files: File[] = this.examFiles() || [];
    const cedula = String(numeroDocumento);
    const TYPE_EXAM = 32;

    // Pares (nombre, archivo) válidos
    const pairs = selectedExams
      .map((name, i) => ({ name: name ?? `EXAMEN_${i + 1}`, file: files[i] }))
      .filter(p => !!p.file && this.isPdf(p.file));

    try {
      // Abrir loader
      Swal.fire({
        title: 'Preparando…',
        html: renderProgress(0, 'Preparando…'),
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });
      await this.nextFrame();

      // 1) Guardar proceso (10%)
      updateLoader(10, 'Guardando salud ocupacional…');
      const resp = await firstValueFrom(this.registroProceso.updateProcesoByDocumento(payload, 'PATCH'));

      const codigo = (resp as any)?.proceso?.contrato_codigo as string | undefined;
      const okMsg = hayNoApto
        ? 'Examen médico guardado · Proceso RECHAZADO por NO APTO'
        : (codigo ? `Examen médico guardado · Contrato: ${codigo}` : 'Examen médico guardado');

      let resumenHtml = '';

      if (pairs.length) {
        // 2) Unir PDFs (15% → 85%)
        const mergedName = `EXAMENES_MEDICOS_${cedula}_${this.yyyymmdd()}.pdf`;
        updateLoader(15, 'Uniendo PDFs de exámenes…', `${pairs.length} archivo(s)`);

        const mergedFile = await this.mergeExamPdfs(pairs, mergedName, (i, total) => {
          const pct = 15 + Math.round((i / total) * 70);
          updateLoader(pct, `Uniendo PDFs de exámenes… (${i}/${total})`);
        });

        // 3) Subir PDF consolidado (85% → 100%)
        updateLoader(88, 'Subiendo PDF consolidado…', mergedName);
        const obs = this.candidatoSeleccionado()?.codigo_contrato
          ? this.docSvc.guardarDocumento(mergedFile.name, cedula, TYPE_EXAM, mergedFile, this.candidatoSeleccionado()?.codigo_contrato)
          : this.docSvc.guardarDocumento(mergedFile.name, cedula, TYPE_EXAM, mergedFile);
        await firstValueFrom(obs);
        updateLoader(100, 'Finalizando…');

        resumenHtml = `PDF consolidado subido: <b>${mergedName}</b>`;
      } else {
        updateLoader(100, 'Finalizando…');
        resumenHtml = 'No hay archivos PDF de exámenes para unir.';
      }

      Swal.close();
      await Swal.fire({
        icon: 'success',
        title: okMsg,
        html: resumenHtml,
        confirmButtonText: 'Ok',
      });
    } catch (err: unknown) {
      Swal.close();
      const http = err as any;
      const msg = http?.error?.detail || http?.message || 'No se pudo completar la operación.';
      await Swal.fire({ title: 'Error', text: msg, icon: 'error', confirmButtonText: 'OK' });
      console.error(err);
    }
  }

  // ========= Otros helpers/subidas =========
  subirArchivo(event: any | Blob, campo: string, fileName?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let file: File | undefined;
      if (event instanceof Blob) file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
      else file = event?.target?.files?.[0];

      if (!file) return reject('No se recibió archivo');
      if (file.name.length > 100) {
        Swal.fire('Error', 'El nombre del archivo no debe exceder 100 caracteres', 'error');
        return reject('Nombre demasiado largo');
      }

      // uploadedFiles queda para otros documentos (no exámenes)
      this.uploadedFiles[campo] = { file, fileName: file.name };
      resolve();
    });
  }

  imprimirDocumentos(): void {
    Swal.fire({ title: 'Subiendo archivos...', icon: 'info', html: 'Por favor, espere…', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => Swal.showLoading() });
  }

  onFileSelected(evt: any, index: number): void {
    const f: File | undefined = evt?.target?.files?.[0];
    const files = [...(this.examFiles() ?? [])];
    if (f && this.isPdf(f)) {
      files[index] = f;
      this.examFiles.set(files);
    } else {
      Swal.fire('Archivo inválido', 'Seleccione un PDF válido.', 'warning');
    }
  }

  // ───────── Tabla ─────────
  mostrarTabla(): void {
    const ced = this.candidatoSeleccionado()?.numero_documento || this.numeroDocumento;
    if (!ced) return;

    Swal.fire({
      icon: 'info',
      title: 'Cargando registros…',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.registroProceso.listProcesosMiniByDocumento(String(ced)).subscribe({
      next: (rows: any) => {
        Swal.close();

        const data = Array.isArray(rows) ? rows : (rows ? [rows] : []);

        const columns: ColumnDefinition[] = [
          { name: 'oficina', header: 'Oficina', type: 'text', width: '140px' },
          { name: 'entrevista_created_at', header: 'Fecha entrevista', type: 'date', width: '200px' },
          { name: 'empresaUsuariaSolicita', header: 'Empresa usuaria', type: 'text', width: '180px' },
          { name: 'finca', header: 'Finca', type: 'text', width: '160px' },
          {
            name: 'aplica_o_no_aplica',
            header: 'Aplica/No aplica',
            type: 'select',
            width: '180px',
            options: ['APLICA', 'NO_APLICA', 'EN_ESPERA'],
          },
          { name: 'motivo_no_aplica', header: 'Motivo no aplica', type: 'text', width: '240px' },
          { name: 'motivo_espera', header: 'Motivo espera', type: 'text', width: '220px' },
          { name: 'detalle', header: 'Detalle', type: 'text', width: '260px' },
          { name: 'actions', header: 'Acciones', type: 'custom', width: '120px', stickyEnd: true },
        ];

        this.dialog.open(TableDialogComponent, {
          maxWidth: '95vw',
          height: '80vh',
          data: {
            title: `Procesos de ${this.nombreCandidato || ced}`,
            rows: data,
            columns,
            pageSize: 12,
            pageSizeOptions: [12, 24, 36],
            tableTitle: 'Procesos del candidato',
          },
          panelClass: 'table-dialog',
        });
      },
      error: (err) => {
        Swal.close();
        console.error(err);
        Swal.fire('Error', 'No fue posible cargar la tabla.', 'error');
      },
    });
  }

  // ───────── Cámara ─────────
  async openCamera(): Promise<void> {
    const initialPreview = this.fotoDataUrl() || this.fotoDoc()?.file_url || this.getBioUrl('foto') || null;

    const ref = this.dialog.open<
      CameraDialogComponent,
      { initialPreviewUrl?: string | null },
      { file: File; previewUrl: string } | undefined
    >(CameraDialogComponent, {
      width: '720px',
      maxWidth: '95vw',
      disableClose: true,
      data: { initialPreviewUrl: initialPreview },
    });

    const result = await firstValueFrom(ref.afterClosed());
    if (!result) return;

    const numero = this.candidatoSeleccionado()?.numero_documento || this.numeroDocumento;
    if (!numero) {
      await Swal.fire('Información', 'Selecciona un candidato antes de tomar la foto.', 'info');
      return;
    }

    this.fotoDataUrl.set(result.previewUrl);

    try {
      Swal.fire({ title: 'Subiendo foto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      await firstValueFrom(this.registroProceso.uploadFoto(String(numero), result.file));
      Swal.close();
      await Swal.fire('Éxito', 'Foto subida correctamente', 'success');
      await this.refreshBiometriaForCandidate(String(numero));
      await this.refreshFotoForCandidate(String(numero)); // Actualizar también el doc 89
    } catch (err) {
      console.error(err);
      Swal.close();
      await Swal.fire('Error', 'No se pudo subir la foto', 'error');
    }
  }

  // ───────── Ver archivos con una sola función ─────────
  ver(kind: BioKind): void {
    const label = kind === 'huella' ? 'Huella' : kind === 'firma' ? 'Firma' : 'Foto';
    const local = this.bioLocal(kind);
    if (local) { this.showBase64(label, local); return; }

    const url = this.getBioUrl(kind);
    if (!url) {
      this.snack.open(`No hay ${label.toLowerCase()} disponible.`, 'OK', { duration: 2500 });
      return;
    }
    this.openInNewTab(url);
  }

  verHuella(): void { this.ver('huella'); }
  verFirma(): void { this.ver('firma'); }
  verFoto(): void {
    if (this.fotoDoc()) {
      this.openInNewTab(this.fotoDoc()!.file_url);
      return;
    }
    this.ver('foto');
  }

  verExamenMedico(): void {
    const doc = this.examenMedicoDoc();
    if (!doc || !doc.file_url) {
      this.snack.open('No hay examen médico disponible.', 'OK', { duration: 2500 });
      return;
    }
    this.openInNewTab(doc.file_url);
  }

  verArl(): void {
    const doc = this.arlDoc();
    if (!doc || !doc.file_url) {
      this.snack.open('No hay ARL disponible.', 'OK', { duration: 2500 });
      return;
    }
    this.openInNewTab(doc.file_url);
  }

  // Helpers
  private bioLocal(kind: BioKind): string | null {
    switch (kind) {
      case 'foto': return this.fotoDataUrl();
      case 'huella': return this.huellaDataUrl();
      case 'firma': return this.firmaDataUrl();
    }
  }

  private openInNewTab(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  private normalizeDataUrl(raw: string | null | undefined, defaultMime = 'image/png'): string | null {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (s.startsWith('data:')) return s;

    if (/^JVBERi0/.test(s)) return `data:application/pdf;base64,${s}`;
    if (/^iVBOR/.test(s)) return `data:image/png;base64,${s}`;
    if (/^\/9j\//.test(s)) return `data:image/jpeg;base64,${s}`;

    return `data:${defaultMime};base64,${s}`;
  }

  private isPdfDataUrl(url: string): boolean {
    return url.startsWith('data:application/pdf');
  }

  private async showBase64(title: string, dataUrl: string, alt = title) {
    if (!dataUrl) {
      this.snack.open(`No hay ${title.toLowerCase()} disponible.`, 'OK', { duration: 2500 });
      return;
    }

    if (this.isPdfDataUrl(dataUrl)) {
      window.open(dataUrl, '_blank');
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title,
      html: `<img src="${dataUrl}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;" />`,
      width: '48rem',
      heightAuto: false,
      showCloseButton: true,
      showCancelButton: true,
      cancelButtonText: 'Cerrar'
    });

    if (isConfirmed) window.open(dataUrl, '_blank');
  }

  private fileToDataURL(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  private dataUrlToFile(dataUrl: string, filename: string): File {
    const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
    if (!m) throw new Error('DataURL inválido');
    const mime = m[1] || 'application/octet-stream';
    const base64 = m[2];
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return new File([bytes.buffer], filename, { type: mime });
  }

  private recalcHayNoApto(): void {
    const arr = (this.selectedExamsArray.value ?? []) as ExamenResultadoForm[];
    this.hayNoApto.set(Array.isArray(arr) && arr.some(x => this.isNoApto(x?.aptoStatus)));
  }

  private async refreshBiometriaForCandidate(cedula: string): Promise<void> {
    try {
      const data: any = await firstValueFrom(this.registroProceso.getBiometriaPorCedula(cedula));
      this.biometria.set({
        firma: Array.isArray(data?.firma) ? data.firma[0] : data?.firma ?? null,
        huella: Array.isArray(data?.huella) ? data.huella[0] : data?.huella ?? null,
        foto: Array.isArray(data?.foto) ? data.foto[0] : data?.foto ?? null,
        created_at: data?.created_at,
        updated_at: data?.updated_at,
      });
    } catch {
      this.biometria.set(null);
    }
  }

  private async refreshExamenMedicoForCandidate(cedula: string): Promise<void> {
    try {
      // 32 es el ID para EXAMENES_MEDICOS según typeMap
      const docs: ServerDocInfo[] = await firstValueFrom(this.docSvc.getDocuments(cedula, 32));
      // Asumimos que el backend retorna lista ordenada o filtramos el active.
      // Si retorna lista, tomamos el primero (o el más reciente).
      // Usualmente getDocuments filtra por is_active=True si no se especifica lo contrario.
      if (Array.isArray(docs) && docs.length > 0) {
        this.examenMedicoDoc.set(docs[0]);
      } else {
        this.examenMedicoDoc.set(null);
      }
    } catch {
      this.examenMedicoDoc.set(null);
    }
  }

  private async refreshArlForCandidate(cedula: string): Promise<void> {
    try {
      // 30 es el ID para ARL
      const docs: ServerDocInfo[] = await firstValueFrom(this.docSvc.getDocuments(cedula, 30));
      if (Array.isArray(docs) && docs.length > 0) {
        this.arlDoc.set(docs[0]);
      } else {
        this.arlDoc.set(null);
      }
    } catch {
      this.arlDoc.set(null);
    }
  }

  private async refreshFotoForCandidate(cedula: string): Promise<void> {
    try {
      // 89 es el ID para FOTO
      const docs: ServerDocInfo[] = await firstValueFrom(this.docSvc.getDocuments(cedula, 89));
      if (Array.isArray(docs) && docs.length > 0) {
        this.fotoDoc.set(docs[0]);
      } else {
        this.fotoDoc.set(null);
      }
    } catch {
      this.fotoDoc.set(null);
    }
  }

  private setBiometriaFromCandidate(cand: any): void {
    const b = cand?.biometria ?? null;
    if (!b) { this.biometria.set(null); return; }
    this.biometria.set({
      firma: Array.isArray(b.firma) ? b.firma[0] : b.firma ?? null,
      huella: Array.isArray(b.huella) ? b.huella[0] : b.huella ?? null,
      foto: Array.isArray(b.foto) ? b.foto[0] : b.foto ?? null,
      created_at: b.created_at,
      updated_at: b.updated_at,
    });
  }

  private isBioStale(b: any, maxMin = 3): boolean {
    const ts = b?.updated_at || b?.created_at;
    if (!ts) return false;
    const t = Date.parse(String(ts));
    if (Number.isNaN(t)) return false;
    const ageMin = (Date.now() - t) / 60000;
    return ageMin > maxMin;
  }

  private getBioDoc(kind: BioKind): any | null {
    const bio = this.biometria();
    const raw = (bio as any)?.[kind];
    if (!raw) return null;
    return Array.isArray(raw) ? (raw[0] ?? null) : raw;
  }

  private getBioUrl(kind: BioKind): string | null {
    const doc = this.getBioDoc(kind);
    if (!doc) return null;
    return doc.file_url || doc.file || null;
  }

  // =========================================================
  // ✅ GENERAR CARNET INDIVIDUAL (Recruitment Pipeline)
  // =========================================================
  async generarCarnetIndividual(): Promise<void> {
    const cand = this.candidatoSeleccionado();
    if (!cand) {
      await Swal.fire({ icon: 'warning', title: 'Aviso', text: 'No hay candidato seleccionado.' });
      return;
    }

    const ent0 = cand?.entrevistas?.[0];
    const proc0 = ent0?.proceso;
    const contratoBE = proc0?.contrato;

    const carnetGenerado = contratoBE?.carnet_generado === true;

    if (carnetGenerado) {
      const result = await Swal.fire({
        title: 'Carnet ya generado',
        text: 'Este candidato ya tiene un carnet generado previamente. ¿Qué deseas hacer?',
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonText: 'Visualizar',
        denyButtonText: 'Volver a generar',
        cancelButtonText: 'Cancelar'
      });

      if (result.isConfirmed) {
        // VISUALIZAR
        try {
          Swal.fire({ title: 'Buscando carnet...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
          const cedulaQuery = String(cand.numero_documento ?? '').trim();
          const docsResp = await firstValueFrom(this.docSvc.getDocuments(cedulaQuery, 102));
          const docs = Array.isArray(docsResp) ? docsResp : (docsResp?.results || []);
          const carnetDoc = docs.find((d: any) => d.type === 102);

          Swal.close();
          if (carnetDoc && carnetDoc.file_url) {
            window.open(carnetDoc.file_url, '_blank');
          } else {
            await Swal.fire({ icon: 'warning', title: 'No encontrado', text: 'No se encontró el archivo del carnet en el servidor.' });
          }
        } catch (e) {
          Swal.close();
          console.error(e);
          await Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al buscar el carnet.' });
        }
        return;
      } else if (result.isDenied) {
        // Continua con la generacion
      } else {
        return; // Cancelar
      }
    }

    const cedula = String(cand.numero_documento ?? '').trim();
    // Prioritize the frontend mapped UI, fallback to backend contract
    let codigo = String(contratoBE?.codigo_contrato ?? '').trim();
    let centroCosto = String(contratoBE?.Ccentro_de_costos ?? '').trim();
    const fechaIng = String(contratoBE?.fecha_ingreso ?? '').trim();

    // Consultar HomeService para obtener exactamente los mismos campos que la vista de Home
    let cMini: any = {};
    if (cedula) {
      try {
        const resp = await firstValueFrom(this.homeService.getCandidatosMini([cedula]));
        const items = Array.isArray(resp) ? resp : ((resp as any)?.ITEMS ?? (resp as any)?.items ?? []);
        if (items.length > 0) cMini = items[0];
      } catch (e) {
        console.warn('No se pudo obtener el candidato mini para el carnet', e);
      }
    }

    // Replicando la lógica exacta ("pickAny") que usa el Home component
    const pickAny = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return '';
    };

    const searchIn = [cMini, cand]; // Buscar primero en cMini (el de Home), luego en cand (el del Pipeline)

    let familiarNombre = '';
    let familiarTel = '';

    for (const data of searchIn) {
      if (!data) continue;

      if (!familiarNombre) {
        familiarNombre = String(
          pickAny(data?.contacto_emergencia, ['NOMBRES', 'nombres', 'NOMBRE_CONTACTO', 'nombre_contacto', 'NOMBRE', 'nombre']) ||
          pickAny(data?.contacto, ['NOMBRE_CONTACTO', 'nombre_contacto', 'NOMBRES', 'nombres', 'NOMBRE', 'nombre']) ||
          pickAny(data, [
            'FAMILIAR_EMERGENCIA', 'familiar_emergencia',
            'FAMILIAR_EMERGENCIA_NOMBRE', 'familiar_emergencia_nombre',
            'CONTACTO_EMERGENCIA_NOMBRE', 'contacto_emergencia_nombre',
            'NOMBRE_CONTACTO_EMERGENCIA', 'nombre_contacto_emergencia'
          ]) || pickAny(data?.datos_basicos, [
            'FAMILIAR_EMERGENCIA', 'familiar_emergencia',
            'FAMILIAR_EMERGENCIA_NOMBRE', 'familiar_emergencia_nombre',
            'CONTACTO_EMERGENCIA_NOMBRE', 'contacto_emergencia_nombre',
            'NOMBRE_CONTACTO_EMERGENCIA', 'nombre_contacto_emergencia'
          ])
        ).trim();
      }

      if (!familiarTel) {
        familiarTel = String(
          pickAny(data?.contacto_emergencia, ['TELEFONO', 'telefono', 'CELULAR', 'celular', 'CELULAR_CONTACTO', 'celular_contacto']) ||
          pickAny(data?.contacto, ['CELULAR_CONTACTO', 'celular_contacto', 'TELEFONO', 'telefono', 'CELULAR', 'celular']) ||
          pickAny(data, [
            'FAMILIAR_EMERGENCIA_TELEFONO', 'familiar_emergencia_telefono',
            'TELEFONO_FAMILIAR_EMERGENCIA', 'telefono_familiar_emergencia',
            'CONTACTO_EMERGENCIA_TELEFONO', 'contacto_emergencia_telefono',
            'TELEFONO_CONTACTO_EMERGENCIA', 'telefono_contacto_emergencia'
          ]) || pickAny(data?.datos_basicos, [
            'FAMILIAR_EMERGENCIA_TELEFONO', 'familiar_emergencia_telefono',
            'TELEFONO_FAMILIAR_EMERGENCIA', 'telefono_familiar_emergencia',
            'CONTACTO_EMERGENCIA_TELEFONO', 'contacto_emergencia_telefono',
            'TELEFONO_CONTACTO_EMERGENCIA', 'telefono_contacto_emergencia'
          ])
        ).trim();
      }
    }

    console.log('--- ENCONTRADOS PARA CARNET INDIVIDUAL ---');
    console.log('cMini:', cMini);
    console.log('cand:', cand);
    console.log('Familiar Nombre:', familiarNombre);
    console.log('Familiar Tel:', familiarTel);

    const { value: formValues, isConfirmed } = await Swal.fire({
      title: 'Datos del Carnet',
      html: `
        <label style="display:block;text-align:left;font-size:14px;margin-bottom:4px;font-weight:bold;">Fecha de Ingreso</label>
        <input id="swal-fecha" class="swal2-input" style="max-width:90%;margin:0 auto 16px;display:block;" type="date" value="${fechaIng}">
        
        <label style="display:block;text-align:left;font-size:14px;margin-bottom:4px;font-weight:bold;">Código de Contrato</label>
        <input id="swal-codigo" class="swal2-input" style="max-width:90%;margin:0 auto 16px;display:block;" type="text" value="${codigo}">
        
        <label style="display:block;text-align:left;font-size:14px;margin-bottom:4px;font-weight:bold;">Centro de Costo</label>
        <input id="swal-ccosto" class="swal2-input" style="max-width:90%;margin:0 auto 16px;display:block;" type="text" value="${centroCosto}">
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Generar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const f = (document.getElementById('swal-fecha') as HTMLInputElement).value;
        const c = (document.getElementById('swal-codigo') as HTMLInputElement).value;
        const cc = (document.getElementById('swal-ccosto') as HTMLInputElement).value;
        if (!f || !c || !cc) {
          Swal.showValidationMessage('Todos los campos son obligatorios');
          return false;
        }
        return { fecha: f, codigo: c, ccosto: cc };
      }
    });

    if (!isConfirmed || !formValues) return;

    // Build the "row"
    const row = {
      CEDULA: cedula,
      CODIGO: String(formValues.codigo).trim(),
      APELLIDOS: String((cand.primer_apellido ?? '') + ' ' + (cand.segundo_apellido ?? '')).trim(),
      NOMBRES: String((cand.primer_nombre ?? '') + ' ' + (cand.segundo_nombre ?? '')).trim(),
      FECHA_INGRESO: String(formValues.fecha).trim(),
      CENTRO_COSTO: String(formValues.ccosto).trim(),
      FAMILIAR_EMERGENCIA_NOMBRE: familiarNombre,
      FAMILIAR_EMERGENCIA_TELEFONO: familiarTel,
      DOCUMENTO_89_URL: String(this.fotoDoc()?.file_url ?? '').trim()
    };

    if (!Swal.isVisible()) {
      Swal.fire({
        title: 'Generando carnet...',
        text: 'Preparando PDF...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        didOpen: () => Swal.showLoading(),
      });
    }

    try {
      const CARD_W = 280;
      const CARD_H = 440;
      const PAGE_W = CARD_W;
      const PAGE_H = CARD_H;
      const MARGIN = 0;
      const GAP = 0;

      const BLUE_CORP = '#1E54C7';
      const BLUE_SUBTLE = '#EBF0FA';
      const TEXT_MAIN = '#1A1A1A';
      const TEXT_MUTED = '#737373';
      const BLACK = '#000000';

      const isHttp = (u: string) => /^https?:\/\//i.test(u);
      const isDataUrl = (u: string) => /^data:image\//i.test(u);

      const fetchBase64WithFallback = async (mainUrl: string, alts: string[] = []): Promise<string | null> => {
        const tryFetch = async (u: string) => {
          try {
            const res = await fetch(u);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              const base64 = btoa(new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
              let mime = 'image/jpeg';
              if (u.toLowerCase().endsWith('.png')) mime = 'image/png';
              const bv = new Uint8Array(arrayBuffer);
              if (bv.length >= 8 && bv[0] === 0x89 && bv[1] === 0x50 && bv[2] === 0x4e && bv[3] === 0x47) mime = 'image/png';
              return `data:${mime};base64,${base64}`;
            }
          } catch { }
          return null;
        };
        let b64 = await tryFetch(mainUrl);
        if (b64) return b64;
        for (const alt of alts) {
          b64 = await tryFetch(alt);
          if (b64) return b64;
        }
        return null;
      };

      const fetchImageBase64 = async (urlOrData?: string): Promise<string | null> => {
        const raw = String(urlOrData ?? '').trim();
        if (!raw) return null;
        if (isDataUrl(raw)) return raw;
        const clean = raw.replace(/^\/+/, '').replace(/^assets\//, '');
        if (isHttp(raw)) return await fetchBase64WithFallback(raw);
        return await fetchBase64WithFallback(clean, [`assets/${clean}`, `/${clean}`, `./${clean}`]);
      };

      const buildQrDataUrl = async (payload: string): Promise<string> => {
        const key = String(payload ?? '').trim();
        if (!key) return '';
        try {
          return await (QRCode as any).toDataURL(key, { type: 'image/jpeg', errorCorrectionLevel: 'M', margin: 1, width: 300, color: { light: '#ffffffff' } });
        } catch { return ''; }
      };

      const safeTxt = (txt: any) => {
        let s = String(txt ?? '').trim().toUpperCase();
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
      };
      const safeTxtMixed = (txt: any) => {
        let s = String(txt ?? '').trim();
        s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return s.replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ');
      }

      const logoB64 = await fetchImageBase64('logos/Logo_TA.png');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: [PAGE_W, PAGE_H], compress: true });

      const fotoUrl = row.DOCUMENTO_89_URL;
      const qrKey = `${row.CEDULA}|${row.CODIGO}`;
      const [fotoB64, qrB64] = await Promise.all([
        fetchImageBase64(fotoUrl),
        buildQrDataUrl(qrKey)
      ]);

      const processCardSide = (isFront: boolean) => {
        const cx = 0;
        const cy = 0;

        // Background
        doc.setFillColor('#8CD50A');
        doc.rect(0, 0, CARD_W, CARD_H, 'F');

        // Bordes
        doc.setDrawColor(BLACK);
        doc.setLineWidth(1.4);
        doc.rect(cx, cy, CARD_W, CARD_H);
        doc.setLineWidth(0.8);
        doc.rect(cx + 3, cy + 3, CARD_W - 6, CARD_H - 6);

        const innerPad = 14;
        const contentX = cx + innerPad;
        const contentW = CARD_W - 2 * innerPad;
        let cursorY = cy + innerPad;

        if (isFront) {
          const HEADER_H = 40;
          if (logoB64) {
            const format = logoB64.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(logoB64, format, contentX + (contentW - 100) / 2, cursorY, 100, HEADER_H);
          }
          cursorY += HEADER_H + 10;

          const PHOTO_H = CARD_H * 0.36;
          const PHOTO_W = 100;
          if (fotoB64) {
            const format = fotoB64.includes('image/png') ? 'PNG' : 'JPEG';
            try { doc.addImage(fotoB64, format, contentX + (contentW - PHOTO_W) / 2, cursorY, PHOTO_W, PHOTO_H); } catch (e) { }
          } else {
            doc.setFillColor(BLUE_SUBTLE);
            doc.rect(contentX, cursorY, contentW, PHOTO_H, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(TEXT_MUTED);
            doc.text('SIN FOTO', contentX + contentW / 2, cursorY + PHOTO_H / 2, { align: 'center', baseline: 'middle' });
          }
          cursorY += PHOTO_H + 16;

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(14);
          doc.setTextColor(TEXT_MAIN);
          doc.text(safeTxt(row.APELLIDOS), contentX + contentW / 2, cursorY, { align: 'center', maxWidth: contentW });
          cursorY += 15;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(12);
          doc.text(safeTxt(row.NOMBRES), contentX + contentW / 2, cursorY, { align: 'center', maxWidth: contentW });
          cursorY += 12;

          const colQrW = contentW * 0.38;
          const colGap = 8;
          const colDataW = contentW - colQrW - colGap;
          const hAvail = (cy + CARD_H - innerPad) - cursorY;
          const qrSize = Math.min(colQrW, hAvail - 15, 85);
          const qrX = contentX + (colQrW - qrSize) / 2;
          const qrY = cursorY;

          if (qrB64) doc.addImage(qrB64, 'JPEG', qrX, qrY, qrSize, qrSize);

          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.text(safeTxt(row.CEDULA), contentX + colQrW / 2, qrY + qrSize + 12, { align: 'center', maxWidth: colQrW });

          const dataX = contentX + colQrW + colGap;
          let rowY = cursorY + 8;
          const fields = [
            { l: 'Fecha de Ingreso', v: safeTxtMixed(row.FECHA_INGRESO) },
            { l: 'Código', v: safeTxtMixed(row.CODIGO) },
            { l: 'Centro de Costos', v: safeTxtMixed(row.CENTRO_COSTO) },
          ];

          for (const f of fields) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(TEXT_MUTED);
            doc.text(safeTxt(f.l), dataX, rowY);
            rowY += 11;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(TEXT_MAIN);
            doc.text(f.v, dataX, rowY, { maxWidth: colDataW });
            rowY += 16;
          }
        } else {
          cursorY += 10;
          if (logoB64) {
            const format = logoB64.includes('image/png') ? 'PNG' : 'JPEG';
            doc.addImage(logoB64, format, contentX + (contentW - 90) / 2, cursorY, 90, 30);
          }
          cursorY += 50;

          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(TEXT_MUTED);
          doc.text('CONTACTO COORDINADOR DE LA', cx + CARD_W / 2, cursorY, { align: 'center' });
          cursorY += 12;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(BLUE_CORP);
          doc.text('TEMPORAL 3152306148', cx + CARD_W / 2, cursorY, { align: 'center' });
          cursorY += 25;

          doc.setFontSize(13);
          doc.setTextColor(TEXT_MAIN);
          doc.text('ARL', contentX, cursorY);
          doc.setTextColor(BLUE_CORP);
          doc.text('SURA', contentX + contentW, cursorY, { align: 'right' });
          cursorY += 30;

          doc.setFontSize(10);
          doc.setTextColor(BLUE_CORP);
          doc.text('FAMILIAR EN CASO DE EMERGENCIA', cx + CARD_W / 2, cursorY, { align: 'center' });
          cursorY += 10;

          const emStr = [row.FAMILIAR_EMERGENCIA_NOMBRE, row.FAMILIAR_EMERGENCIA_TELEFONO].filter(Boolean).join(' - ') || '—';
          doc.setFillColor(BLUE_SUBTLE);
          doc.rect(contentX, cursorY, contentW, 30, 'F');
          doc.setFontSize(11);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(TEXT_MAIN);
          doc.text(safeTxt(emStr), cx + CARD_W / 2, cursorY + 18, { align: 'center', maxWidth: contentW - 6 });
          cursorY += 45;

          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(1);
          doc.line(contentX, cursorY, contentX + contentW, cursorY);
          cursorY += 15;

          const legal = 'ESTE CARNET ES DE USO EXCLUSIVO DEL TRABAJADOR. EN CASO DE PERDIDA, REPORTAR INMEDIATAMENTE AL COORDINADOR DE LA TEMPORAL. EL USO INDEBIDO DE ESTE DOCUMENTO ACARREARA SANCIONES DISCIPLINARIAS.';
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(TEXT_MUTED);
          doc.text(safeTxtMixed(legal), contentX, cursorY, { maxWidth: contentW, align: 'justify' });
        }
      };

      // FRONT
      processCardSide(true);
      // BACK
      doc.addPage();
      processCardSide(false);

      doc.save(`carnet_${row.CEDULA}.pdf`);

      let backMsg = '';
      try {
        const pdfBlob = doc.output('blob');
        const pdfFile = new File([pdfBlob], `carnet_${row.CEDULA}.pdf`, { type: 'application/pdf' });
        const codigoContrato = row.CODIGO || cand.contrato?.codigo_contrato;
        
        await firstValueFrom(
          codigoContrato 
            ? this.docSvc.guardarDocumento(`carnet_${row.CEDULA}.pdf`, cedula, 102, pdfFile, codigoContrato)
            : this.docSvc.guardarDocumento(`carnet_${row.CEDULA}.pdf`, cedula, 102, pdfFile)
        );
        backMsg = '<br><br><small style="color:green;">El carnet también se guardó correctamente en el historial del candidato.</small>';
      } catch (err) {
        console.error('Error guardando carnet en el backend', err);
        backMsg = '<br><br><small style="color:red;">El carnet se descargó, pero hubo un error al guardarlo en el historial.</small>';
      }

      Swal.close();
      const sendWa = await Swal.fire({
        icon: 'success',
        title: 'Carnet Generado',
        html: `El carnet de ${row.NOMBRES} se descargó correctamente. ¿Quieres enviar un mensaje por WhatsApp diciéndole que adjuntarás el carnet?${backMsg}`,
        showCancelButton: true,
        confirmButtonText: 'Enviar por WhatsApp',
        cancelButtonText: 'Cerrar'
      });

      if (sendWa.isConfirmed) {
        const waStr = cand.contacto?.whatsapp || cand.numCelular || cand.telefono || cand.celular || '';
        let numUrl = '';
        if (waStr) {
          const waNumber = String(waStr).replace(/[^0-9]/g, '');
          numUrl = waNumber ? `57${waNumber}` : '';
        }
        const textToSend = `Hola ${row.NOMBRES}, te damos la bienvenida al equipo. A continuación, adjunto tu carnet digital.`;
        const waUrl = `https://wa.me/${numUrl}?text=${encodeURIComponent(textToSend)}`;
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }

      // Guardar bandera en backend
      if (cedula && ent0?.proceso?.id) {
        try {
          await firstValueFrom(this.registroProceso.updateProcesoByDocumento({
            numero_documento: cedula,
            contrato: { carnet_generado: true } as any
          }, 'PATCH'));
          let proc = cand?.entrevistas?.[0]?.proceso;
          if (proc) {
            if (!proc.contrato) proc.contrato = {};
            proc.contrato.carnet_generado = true;
            this.candidatoSeleccionado.set({ ...cand }); // trigger ui reference update
          }
        } catch (e) {
          console.error('Error actualizando bandera carnet_generado', e);
        }
      }

    } catch (error: any) {
      console.error('❌ Error generando carnet:', error);
      Swal.close();
      await Swal.fire({ icon: 'error', title: 'Error', text: error?.message || 'Ocurrió un error al generar carnet.' });
    }
  }
}
