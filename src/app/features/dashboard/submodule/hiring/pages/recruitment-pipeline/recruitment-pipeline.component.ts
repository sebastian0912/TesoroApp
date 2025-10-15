import {
  Component, LOCALE_ID, inject, effect, signal, computed, DestroyRef
} from '@angular/core';
import { Router } from '@angular/router';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { MomentDateAdapter } from '@angular/material-moment-adapter';

import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatBadgeModule } from '@angular/material/badge';

import { FormsModule, FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { SharedModule } from '@/app/shared/shared.module';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { HiringQuestionsComponent } from '../../components/hiring-questions/hiring-questions.component';
import { HelpInformationComponent } from '../../components/help-information/help-information.component';
import { CameraDialogComponent, CameraDialogResult } from '../../components/camera-dialog/camera-dialog.component';

import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { HiringService } from '../../service/hiring.service';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';

import { MatSnackBar } from '@angular/material/snack-bar';
import { PDFDocument } from 'pdf-lib';
import { catchError, filter, firstValueFrom, from, of, switchMap, take, startWith, merge } from 'rxjs';
import Swal from 'sweetalert2';
import { ColumnDefinition, StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProcesoUpdateByDocumentRequest, RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';

export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};

@Component({
  selector: 'app-recruitment-pipeline',
  imports: [
    FormsModule,
    MatIconModule, MatTabsModule, MatDatepickerModule, MatNativeDateModule,
    MatTooltipModule, MatDialogModule, MatBadgeModule,
    SharedModule,
    SearchForCandidateComponent, SelectionQuestionsComponent, HiringQuestionsComponent, HelpInformationComponent,
  ],
  templateUrl: './recruitment-pipeline.component.html',
  styleUrl: './recruitment-pipeline.component.css',
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

  fotoDataUrl = signal<string | null>(null);
  tieneFoto = computed(() => !!this.fotoDataUrl());
  firmaDataUrl = signal<string | null>(null);
  tieneFirma = computed(() => !!this.firmaDataUrl());
  huellaDataUrl = signal<string | null>(null);
  tieneHuella = computed(() => !!this.huellaDataUrl());

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
    SUBA: 'SUB', TOCANCIPÁ: 'TOC', USME: 'USM',
  };

  // ───────── DI ─────────
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private destroyRef = inject(DestroyRef);

  private util = inject(UtilityServiceService);
  private infoVacantesService = inject(InfoVacantesService);
  private vacantesService = inject(VacantesService);
  private hiring = inject(HiringService);
  private seleccionService = inject(SeleccionService);
  private docSvc = inject(GestionDocumentalService);
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

  // === Señal computada para el template (úsala como función en el HTML) ===
  deshabilitarContratacion = computed(() => this.hayNoApto());

  constructor() {
    // helper local para parsear JSON seguro
    const safeJson = <T>(raw: any, fallback: T): T => {
      try {
        if (typeof raw !== 'string') return fallback;
        const parsed = JSON.parse(raw);
        return (Array.isArray(parsed) || typeof parsed === 'object') ? (parsed as T) : fallback;
      } catch {
        return fallback;
      }
    };

    // 1) Mantén SIEMPRE la MISMA instancia de FormArray → clear() + push()
    this.selectedExamsCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((exams: string[]) => {
        const arr = this.selectedExamsArray;
        while (arr.length) arr.removeAt(0); // clear()
        (exams || []).forEach(() =>
          arr.push(this.fb.group({ aptoStatus: ['APTO', Validators.required] }))
        );
        this.recalcHayNoApto();
      });

    // 1.1) Recalcular “hayNoApto” cuando cambie cualquier control del FormArray
    merge(this.selectedExamsArray.valueChanges, this.selectedExamsArray.statusChanges)
      .pipe(startWith(this.selectedExamsArray.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalcHayNoApto());

    // 2) Reaccionar a cédula (cosas generales de cabecera)
    effect(() => {
      console.log('Candidato cambiado:', this.candidatoSeleccionado());
      this.getFullName();
      this.getNumeroDocumento();
    });

    // 2.1) Autollenar Salud Ocupacional desde la PRIMERA entrevista → proceso.examen_medico
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
        this.formGroup3.patchValue(
          { ips: '', ipsLab: '', selectedExams: [] },
          { emitEvent: false }
        );
        while (formArray.length) formArray.removeAt(0);
        this.recalcHayNoApto();
        return;
      }

      // Parsear strings JSON
      const exams: string[] = safeJson<string[]>(em.examenes, []);
      const results: Array<{ aptoStatus?: string }> = safeJson(em.resultados, []);

      // 1) Patch simples (esto disparará el valueChanges que repuebla el FormArray)
      this.formGroup3.patchValue(
        {
          ips: em.ips ?? '',
          ipsLab: em.ips_lab ?? '',
          selectedExams: exams ?? [],
        },
        { emitEvent: true }
      );

      // 2) Tras repoblar el FormArray, parchear aptoStatus uno a uno
      setTimeout(() => {
        const len = formArray.length;
        for (let i = 0; i < len; i++) {
          const fg = formArray.at(i) as FormGroup;
          fg.patchValue({ aptoStatus: results[i]?.aptoStatus || 'APTO' }, { emitEvent: false });
        }
        this.recalcHayNoApto();
      });
    });

    // 3) Aviso/lock por “NO APTO”
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
    const c = this.candidatoSeleccionado(); // puede ser null
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
    this.numeroDocumento = c?.numero_documento != null
      ? String(c.numero_documento).trim()
      : '';
  }


  generacionDocumentos(): void {

    this.router.navigate(['dashboard/hiring/generate-contracting-documents']);
  }

  // ───────── Salud ocupacional (PDF) ─────────
  private isPdf(file?: File | null): file is File {
    return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
  }

  async imprimirSaludOcupacional(): Promise<void> {
    // 1) Tomar valores del form y candidato
    const f = this.formGroup3.value; // { ips, ipsLab, selectedExams, selectedExamsArray }
    const numeroDocumento = this.candidatoSeleccionado()?.numero_documento;

    if (!numeroDocumento) {
      await Swal.fire({
        title: 'Falta el número de documento del candidato',
        icon: 'info',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
      });
      return;
    }

    // 2) Construir payload para /gestion_contratacion/procesos/update-by-document/
    //    Enviar examen_medico como bloque anidado + arrays en JSON string
    const payload: ProcesoUpdateByDocumentRequest = {
      numero_documento: numeroDocumento,

      // Si además quieres tocar algo del proceso, descomenta:
      // publicacion: this.vacanteSeleccionada()?.id ?? null,
      // vacante_tipo: 'Prueba técnica', // o 'Autorización de ingreso'
      // vacante_salario: '1500000',

      examen_medico: {
        ips: f?.ips ?? null,
        ips_lab: f?.ipsLab ?? null,
        examenes: JSON.stringify(f?.selectedExams ?? []),
        resultados: JSON.stringify(f?.selectedExamsArray ?? []),
      },

      // Opcional: ajustar etapas (recuerda: son excluyentes en backend)
      // prueba_tecnica: true,
      // autorizado: false,
    };

    try {
      // Loader (no usar await aquí)
      Swal.fire({
        title: 'Guardando salud ocupacional...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      // 3) Llamada (asegúrate de que el servicio use la URL con SLASH final)
      //    /gestion_contratacion/procesos/update-by-document/
      await this.registroProceso.updateProcesoByDocumento(payload, 'PATCH').toPromise();

      // cerrar el loader antes del toast de éxito
      Swal.close();

      await Swal.fire({
        title: 'Examen médico guardado',
        icon: 'success',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true,
      });
    } catch (err: any) {
      // cerrar el loader si hubo error
      Swal.close();

      const msg = err?.error?.detail || 'No se pudo guardar salud ocupacional.';
      await Swal.fire({
        title: 'Error',
        text: msg,
        icon: 'error',
        confirmButtonText: 'OK',
      });
      console.error(err);
    }
  }

  subirArchivo(event: any | Blob, campo: string, fileName?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let file: File | undefined;
      if (event instanceof Blob) file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
      else file = event?.target?.files?.[0];

      if (!file) return reject('No se recibió archivo');
      if (file.name.length > 100) { Swal.fire('Error', 'El nombre del archivo no debe exceder 100 caracteres', 'error'); return reject('Nombre demasiado largo'); }

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
    console.log('Mostrando tabla de procesos de selección');

    const columns: ColumnDefinition[] = [
      { name: 'created_at', header: 'Fecha de creación', type: 'date', width: '180px' },
      { name: 'oficina', header: 'Oficina', type: 'text', width: '160px' },
      { name: 'aplica_o_no_aplica', header: 'Aplica o no aplica', type: 'text', width: '280px' },
      { name: 'motivoNoAplica', header: 'Motivo no aplica', type: 'text', width: '220px' },
      { name: 'aplicaObservacion', header: 'Retroalimentación', type: 'text', width: '280px' },
      { name: 'detalle', header: 'Detalle', type: 'text', width: '320px' },
      { name: 'actions', header: '', type: 'custom', width: '72px', stickyEnd: true, filterable: false },
    ];
  }

  // ───────── Cámara ─────────
  openCamera(): void {
    console.log('Abriendo cámara...');
  }

  verHuella(): void {
    // Ajusta la fuente según tu estado/servicio
    const raw = this.huellaDataUrl?.() ?? null;
    this.showBase64('Huella', raw);
  }

  verFirma(): void {
    // Ajusta la fuente según tu estado/servicio
    const raw = this.firmaDataUrl?.() ?? null;
    this.showBase64('Firma', raw);
  }


  // Helpers
  private normalizeDataUrl(raw: string | null | undefined, defaultMime = 'image/png'): string | null {
    if (!raw) return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (s.startsWith('data:')) return s;                  // ya viene como data URL

    // Heurísticos por encabezado base64
    if (/^JVBERi0/.test(s)) return `data:application/pdf;base64,${s}`; // PDF
    if (/^iVBOR/.test(s)) return `data:image/png;base64,${s}`;        // PNG
    if (/^\/9j\//.test(s)) return `data:image/jpeg;base64,${s}`;       // JPG

    return `data:${defaultMime};base64,${s}`;             // fallback
  }

  private isPdfDataUrl(url: string): boolean {
    return url.startsWith('data:application/pdf');
  }

  // Viewer genérico con Swal
  private async showBase64(title: string, raw: string | null, alt = title) {
    const url = this.normalizeDataUrl(raw);
    if (!url) {
      this.snack?.open?.(`No hay ${title.toLowerCase()} disponible.`, 'OK', { duration: 2500 });
      return;
    }

    // Para PDF es mejor abrir pestaña nueva
    if (this.isPdfDataUrl(url)) {
      window.open(url, '_blank');
      return;
    }

    const { isConfirmed } = await Swal.fire({
      title,
      html: `<img src="${url}" alt="${alt}" style="max-width:100%;height:auto;border-radius:8px;" />`,
      width: '48rem',
      heightAuto: false,
      showCloseButton: true,
      showCancelButton: true,
      cancelButtonText: 'Cerrar'
    });

    if (isConfirmed) window.open(url, '_blank');
  }


  private fileToDataURL(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  // ───────── Helpers ─────────
  private iniciarNuevoProcesoUI(): void {
    this.formGroup3.patchValue({ ips: '', ipsLab: '', selectedExams: [] });
    const arr = this.selectedExamsArray;
    while (arr.length) arr.removeAt(0);
    this.recalcHayNoApto();
  }

  private recalcHayNoApto(): void {
    const arr = (this.selectedExamsArray.value ?? []) as Array<{ aptoStatus?: string }>;
    this.hayNoApto.set(Array.isArray(arr) && arr.some(x => this.isNoApto(x?.aptoStatus)));
  }

  // Elige automáticamente el proceso más reciente o 'NEW' si no hay items
  private async elegirProcesoBonitoSinIdONuevo(
    items: any[]
  ): Promise<any | 'NEW' | null> {
    if (!Array.isArray(items) || items.length === 0) return 'NEW';
    return this.elegirUltimoProceso(items);
  }

  // Helper: retorna el item más "reciente" por marcaTemporal (o por id si no hay fecha/empate)
  private elegirUltimoProceso(items: any[]): any {
    const toEpoch = (it: any): number => {
      const raw =
        it?.marcaTemporal ??
        it?.fecha ??
        it?.created_at ??
        it?.updated_at ??
        null;

      // Acepta Date o string; tolera "YYYY-MM-DD HH:mm:ss" o ISO
      if (raw instanceof Date) return raw.getTime();
      if (typeof raw === 'string') {
        // Normaliza espacio -> 'T' para mejorar el parseo en algunos entornos
        const str = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
        const t = Date.parse(str);
        if (!Number.isNaN(t)) return t;
      }
      return NaN; // sin fecha válida
    };

    const toId = (it: any): number => Number(it?.id) || -Infinity;

    return items.reduce((best, cur) => {
      const tb = toEpoch(best);
      const tc = toEpoch(cur);

      // Si uno no tiene fecha válida, gana el que sí tiene
      if (Number.isNaN(tb) && !Number.isNaN(tc)) return cur;
      if (!Number.isNaN(tb) && Number.isNaN(tc)) return best;

      // Si ambos tienen fecha válida, gana el más reciente
      if (!Number.isNaN(tb) && !Number.isNaN(tc)) {
        if (tc > tb) return cur;
        if (tc < tb) return best;
        // Empate por fecha -> desempata por id mayor
        return toId(cur) > toId(best) ? cur : best;
      }

      // Si ninguno tiene fecha válida -> desempata por id mayor
      return toId(cur) > toId(best) ? cur : best;
    }, items[0]);
  }

}
