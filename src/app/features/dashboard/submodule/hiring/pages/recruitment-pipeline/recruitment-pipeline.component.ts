import {
  Component, LOCALE_ID, inject, effect, signal, computed, DestroyRef
} from '@angular/core';
import { Router } from '@angular/router';

import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatDateFormats } from '@angular/material/core';
import { MomentDateAdapter, MatMomentDateModule } from '@angular/material-moment-adapter';

import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';

import { FormsModule, FormArray, FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

import { SharedModule } from '@/app/shared/shared.module';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { HiringQuestionsComponent } from '../../components/hiring-questions/hiring-questions.component';
import { HelpInformationComponent } from '../../components/help-information/help-information.component';
import { CameraDialogComponent } from '../../components/camera-dialog/camera-dialog.component';

import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';

import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom, merge, startWith } from 'rxjs';
import Swal from 'sweetalert2';
import { ColumnDefinition } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import { TableDialogComponent } from '@/app/shared/components/table-dialog/table-dialog.component';


export const MY_DATE_FORMATS: MatDateFormats = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

type ExamenResultadoForm = { aptoStatus?: string };
type BioKind = 'foto' | 'huella' | 'firma';

@Component({
  selector: 'app-recruitment-pipeline',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule,
    MatIconModule, MatTabsModule, MatDatepickerModule, MatMomentDateModule,
    MatTooltipModule, MatDialogModule, MatBadgeModule,
    SharedModule,
    SearchForCandidateComponent, SelectionQuestionsComponent, HiringQuestionsComponent, HelpInformationComponent,
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

  // Previews locales (para mostrar en modal si existen)
  fotoDataUrl = signal<string | null>(null);
  firmaDataUrl = signal<string | null>(null);
  huellaDataUrl = signal<string | null>(null);

  // Biometría desde backend
  biometria = signal<{ firma?: any; huella?: any; foto?: any; created_at?: string; updated_at?: string } | null>(null);

  // Flags (solo backend)
  private tieneFirmaSrv = computed(() => !!this.getBioDoc('firma'));
  private tieneHuellaSrv = computed(() => !!this.getBioDoc('huella'));
  private tieneFotoSrv = computed(() => !!this.getBioDoc('foto'));

  // Flags UI (preview local o backend)
  tieneFirmaUI = computed(() => !!(this.firmaDataUrl() || this.tieneFirmaSrv()));
  tieneHuellaUI = computed(() => !!(this.huellaDataUrl() || this.tieneHuellaSrv()));
  tieneFotoUI = computed(() => !!(this.fotoDataUrl() || this.tieneFotoSrv()));

  // Helpers para badges (si prefieres usar estos en el template)
  badge(kind: BioKind) { return this.tiene(kind) ? '✓' : '✗'; }
  badgeColor(kind: BioKind) { return this.tiene(kind) ? 'primary' : 'warn'; }
  tiene(kind: BioKind): boolean {
    return !!(this.bioLocal(kind) || this.getBioUrl(kind));
  }

  sede = signal<string>('');
  examFiles = signal<File[]>([]);
  uploadedFiles = signal<Record<string, { file?: File; fileName?: string }>>({
    examenesMedicos: { fileName: 'Adjuntar documento' },
  });

  readonly typeMap: Record<string, number> = { examenesMedicos: 32 };

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

  private util = inject(UtilityServiceService);
  private registroProceso = inject(RegistroProcesoContratacion);

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

  private isNoApto = (v: unknown) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[\s_]+/g, '')
      .toUpperCase() === 'NOAPTO';

  // === Señal computada para el template ===
  deshabilitarContratacion = computed(() => this.hayNoApto());

  constructor() {
    const safeJson = <T>(raw: any, fallback: T): T => {
      try {
        if (typeof raw !== 'string') return fallback;
        const parsed = JSON.parse(raw);
        return (Array.isArray(parsed) || typeof parsed === 'object') ? (parsed as T) : fallback;
      } catch { return fallback; }
    };

    // 1) Mantener MISMA instancia de FormArray → clear() + push()
    this.selectedExamsCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((exams: string[]) => {
        const arr = this.selectedExamsArray;
        while (arr.length) arr.removeAt(0);
        (exams || []).forEach(() =>
          arr.push(this.fb.group({ aptoStatus: ['APTO', Validators.required] }))
        );
        this.recalcHayNoApto();
      });

    // 1.1) Recalcular “hayNoApto”
    merge(this.selectedExamsArray.valueChanges, this.selectedExamsArray.statusChanges)
      .pipe(startWith(this.selectedExamsArray.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalcHayNoApto());

    // 2) Cédula + biometría (embebida y refresh opcional)
    effect(() => {
      this.getFullName();
      this.getNumeroDocumento();

      const cand = this.candidatoSeleccionado();
      const ced = cand?.numero_documento ? String(cand.numero_documento) : null;

      this.setBiometriaFromCandidate(cand);

      const bio = cand?.biometria ?? null;
      if (ced && (!bio || this.isBioStale(bio))) {
        this.refreshBiometriaForCandidate(ced).catch(() => this.biometria.set(null));
      }

      this.mostrarTabla();
    });

    // 3) Autollenar Salud Ocupacional desde la PRIMERA entrevista
    effect(() => {
      const cand = this.candidatoSeleccionado();
      const formArray = this.selectedExamsArray;

      if (!cand || !cand.entrevistas?.length) {
        this.formGroup3.reset();
        while (formArray.length) formArray.removeAt(0);
        this.recalcHayNoApto();
        return;
      }

      const ent = cand.entrevistas[0];
      const proc = ent?.proceso;
      const em = proc?.examen_medico;

      if (!em) {
        this.formGroup3.patchValue({ ips: '', ipsLab: '', selectedExams: [] }, { emitEvent: false });
        while (formArray.length) formArray.removeAt(0);
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
        this.recalcHayNoApto();
      });
    });

    // 4) Aviso/lock por “NO APTO”
    effect(() => {
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
    this.router.navigate(['dashboard/hiring/generate-contracting-documents']);
  }

  // ───────── Salud ocupacional (PDF) ─────────
  private isPdf(file?: File | null): file is File {
    return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
  }

  private normalizarSedeAbbr(raw: string | undefined | null): string {
    const s = (raw || '').toString().trim().toUpperCase();
    return this.abreviaciones[s] || s;
  }

  async imprimirSaludOcupacional(): Promise<void> {
    const f = this.formGroup3.value;
    const numeroDocumento = this.candidatoSeleccionado()?.numero_documento;
    if (!numeroDocumento) {
      await Swal.fire({ title: 'Falta el número de documento del candidato', icon: 'info', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, timerProgressBar: true });
      return;
    }

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
      numero_documento: numeroDocumento,
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

    try {
      Swal.fire({ title: 'Guardando salud ocupacional...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
      const resp = await firstValueFrom(this.registroProceso.updateProcesoByDocumento(payload, 'PATCH'));
      Swal.close();

      const codigo = (resp as any)?.proceso?.contrato_codigo as string | undefined;
      const okMsg = hayNoApto
        ? 'Examen médico guardado · Proceso RECHAZADO por NO APTO'
        : (codigo ? `Examen médico guardado · Contrato: ${codigo}` : 'Examen médico guardado');

      await Swal.fire({ title: okMsg, icon: 'success', toast: true, position: 'top-end', showConfirmButton: false, timer: 2500, timerProgressBar: true });
    } catch (err: unknown) {
      Swal.close();
      const http = err as any;
      const msg = http?.error?.detail || http?.message || 'No se pudo guardar salud ocupacional.';
      await Swal.fire({ title: 'Error', text: msg, icon: 'error', confirmButtonText: 'OK' });
      console.error(err);
    }
  }

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

      this.uploadedFiles.update(u => ({ ...u, [campo]: { file, fileName: file.name } }));
      resolve();
    });
  }

  imprimirDocumentos(): void {
    Swal.fire({ title: 'Subiendo archivos...', icon: 'info', html: 'Por favor, espere…', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => Swal.showLoading() });
  }

  onFileSelected(evt: any, index: number): void {
    const f: File | undefined = evt?.target?.files?.[0];
    if (this.isPdf(f)) {
      const arr = [...(this.examFiles() ?? [])];
      arr[index] = f!;
      this.examFiles.set(arr);
    } else {
      Swal.fire('Archivo inválido', 'Seleccione un PDF válido.', 'warning');
    }
  }

  // ───────── Tabla ─────────
  mostrarTabla(): void {
    const ced = this.candidatoSeleccionado()?.numero_documento || this.numeroDocumento;
    if (!ced) {
      Swal.fire('Info', 'Selecciona primero un candidato.', 'info');
      return;
    }

    Swal.fire({
      icon: 'info',
      title: 'Cargando registros…',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    this.registroProceso.listProcesosMiniByDocumento(String(ced)).subscribe({
      next: (rows: any) => {
        Swal.close();

        // Normaliza: el servicio puede devolver objeto o arreglo
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
          // acciones podrían ir aquí
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
  // ───────── Cámara ─────────
  // ───────── Cámara ─────────
  async openCamera(): Promise<void> {
    // foto existente: primero la local (dataURL), si no, la del backend
    const initialPreview =
      this.fotoDataUrl() || this.getBioUrl('foto') || null;

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

    // Cedula a usar para el upload
    const numero = this.candidatoSeleccionado()?.numero_documento || this.numeroDocumento;
    if (!numero) {
      await Swal.fire('Información', 'Selecciona un candidato antes de tomar la foto.', 'info');
      return;
    }

    // Preview local (para la UI)
    this.fotoDataUrl.set(result.previewUrl);

    // Subir al backend (si hay file)
    try {
      Swal.fire({ title: 'Subiendo foto...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

      await firstValueFrom(this.registroProceso.uploadFoto(String(numero), result.file));

      Swal.close();
      await Swal.fire('Éxito', 'Foto subida correctamente', 'success');

      // Refrescar biometría para que el badge se ponga ✓
      await this.refreshBiometriaForCandidate(String(numero));
    } catch (err) {
      console.error(err);
      Swal.close();
      await Swal.fire('Error', 'No se pudo subir la foto', 'error');
    }
  }



  // ───────── Ver archivos con una sola función ─────────
  ver(kind: BioKind): void {
    const label = kind === 'huella' ? 'Huella' : kind === 'firma' ? 'Firma' : 'Foto';

    // 1) Si hay preview local (data URL), mostrar en modal
    const local = this.bioLocal(kind);
    if (local) { this.showBase64(label, local); return; }

    // 2) Si hay URL remota, abrir en pestaña nueva (evita CSP)
    const url = this.getBioUrl(kind);
    if (!url) {
      this.snack.open(`No hay ${label.toLowerCase()} disponible.`, 'OK', { duration: 2500 });
      return;
    }
    this.openInNewTab(url);
  }

  // Wrappers para no romper plantillas antiguas
  verHuella(): void { this.ver('huella'); }
  verFirma(): void { this.ver('firma'); }
  verFoto(): void { this.ver('foto'); }

  // Helpers —–––––––––––––––––––––––––––––––––
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
    return new File([bytes], filename, { type: mime });
  }

  private recalcHayNoApto(): void {
    const arr = (this.selectedExamsArray.value ?? []) as ExamenResultadoForm[];
    this.hayNoApto.set(Array.isArray(arr) && arr.some(x => this.isNoApto(x?.aptoStatus)));
  }

  private async elegirProcesoBonitoSinIdONuevo(items: any[]): Promise<any | 'NEW' | null> {
    if (!Array.isArray(items) || items.length === 0) return 'NEW';
    return this.elegirUltimoProceso(items);
  }

  private elegirUltimoProceso(items: any[]): any {
    const toEpoch = (it: any): number => {
      const raw = it?.marcaTemporal ?? it?.fecha ?? it?.created_at ?? it?.updated_at ?? null;
      if (raw instanceof Date) return raw.getTime();
      if (typeof raw === 'string') {
        const str = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
        const t = Date.parse(str);
        if (!Number.isNaN(t)) return t;
      }
      return NaN;
    };

    const toId = (it: any): number => Number(it?.id) || -Infinity;

    return items.reduce((best, cur) => {
      const tb = toEpoch(best);
      const tc = toEpoch(cur);
      if (Number.isNaN(tb) && !Number.isNaN(tc)) return cur;
      if (!Number.isNaN(tb) && Number.isNaN(tc)) return best;
      if (!Number.isNaN(tb) && !Number.isNaN(tc)) {
        if (tc > tb) return cur;
        if (tc < tb) return best;
        return toId(cur) > toId(best) ? cur : best;
      }
      return toId(cur) > toId(best) ? cur : best;
    }, items[0]);
  }

  // ===== Biometría =====
  private async refreshBiometriaForCandidate(cedula: string): Promise<void> {
    try {
      const data: any = await firstValueFrom(this.registroProceso.getBiometriaPorCedula(cedula));
      // Puede venir como objeto {firma,huella,foto} o como arrays; nos quedamos con el primero.
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
}
