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
  standalone: true,
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
  cedulaActual = signal<string>('');
  codigoContratoActual = signal<string>('');
  nombreCandidato = signal<string>('');
  idInfoEntrevistaAndrea = signal<number>(0);
  idProcesoSeleccion = signal<number | null>(null);
  idvacante = signal<number>(0);
  idVacanteContratacion = signal<number>(0);

  fotoDataUrl = signal<string | null>(null);
  tieneFoto = computed(() => !!this.fotoDataUrl());

  sede = signal<string>('');
  abreviacionSede = signal<string>('');

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

  // ───────── Form Parte 3 ─────────
  formGroup3: FormGroup = this.fb.group({
    ips: ['', Validators.required],
    ipsLab: ['', Validators.required],
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
    // 0) Usuario/sede
    this.initUsuarioYAbreviacion();

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

    // 2) Reaccionar a cédula
    effect(() => {
      const ced = this.cedulaActual().trim();
      if (!ced) return;

      // 2.1 Foto
      this.hiring.buscarEncontratacion(ced).pipe(
        take(1),
        catchError(() => of(null))
      ).subscribe((resp: any) => {
        const raw = resp?.data?.[0]?.fotoSoliciante ?? null;
        this.fotoDataUrl.set(typeof raw === 'string' && raw.trim() ? raw.trim() : null);
      });

      // 2.2 Código de contratación
      this.seleccionService.buscarEncontratacion(ced).pipe(
        take(1),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.codigoContratoActual.set('');
            this.snack.open('No hay contratación asociada.', 'OK', { duration: 2500 });
            return of(null);
          }
          this.snack.open('Error al consultar contratación', 'OK', { duration: 3500 });
          return of(null);
        })
      ).subscribe((resp: any) => {
        if (resp) this.codigoContratoActual.set(resp?.codigo_contrato || '');
      });

      // 2.3 Procesos de selección
      this.hiring.traerDatosSeleccion(ced).pipe(
        take(1),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            Swal.fire('Atención', 'No fue posible crear el proceso de selección automáticamente.', 'warning');
            return of(null);
          }
          this.snack.open('Error al traer datos de selección', 'OK', { duration: 5000 });
          return of(null);
        })
      ).subscribe(async (response: any) => {
        if (!response) return;

        if (response.created && response.createdId) {
          this.idProcesoSeleccion.set(response.createdId);
          this.iniciarNuevoProcesoUI();
          await Swal.fire('Listo', 'Se creó el proceso de selección automáticamente.', 'success');
          return;
        }

        const list = Array.isArray(response?.procesoSeleccion) ? response.procesoSeleccion : [];
        if (!list.length) {
          this.iniciarNuevoProcesoUI();
          return;
        }

        const topTwo = [...list]
          .filter(x => typeof x?.id === 'number')
          .sort((a, b) => b.id - a.id)
          .slice(0, 2);

        const chosen = await this.elegirProcesoBonitoSinIdONuevo(topTwo);
        if (!chosen) return;

        if (chosen === 'NEW') {
          this.iniciarNuevoProcesoUI();
          return;
        }

        // Continuar con proceso existente
        this.idProcesoSeleccion.set(chosen.id);
        this.idVacanteContratacion.set(chosen?.vacante ?? null);

        this.formGroup3.patchValue({
          ips: chosen?.ips ?? '',
          ipsLab: chosen?.ipslab ?? chosen?.ipsLab ?? '',
        });

        // Exámenes + aptos -> NO reemplazar el FormArray (no usar setControl)
        const examenesArr = String(chosen?.examenes || '')
          .split(',').map((s: string) => s.trim()).filter(Boolean);
        const aptosArr = String(chosen?.aptosExamenes || '')
          .split(',').map((s: string) => s.trim()).filter(Boolean);
        const len = Math.min(examenesArr.length, aptosArr.length);

        this.formGroup3.get('selectedExams')?.setValue(examenesArr.slice(0, len));

        const arr = this.selectedExamsArray;
        while (arr.length) arr.removeAt(0);
        aptosArr.slice(0, len).forEach(status => {
          arr.push(this.fb.group({ aptoStatus: [status || 'APTO', Validators.required] }));
        });
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

  // ───────── API UI ─────────
  onCedulaSeleccionada(cedula: string): void {
    this.cedulaActual.set((cedula ?? '').trim());
    this.mostrarTabla();
  }
  onIdInfoEntrevistaAndreaChange(id: number): void { this.idInfoEntrevistaAndrea.set(id); }
  onIdVacanteChange(id: number): void { this.idvacante.set(id); }

  // Usa deshabilitarContratacion() en el template
  getFullName(nombre_completo: string): void {
    this.nombreCandidato.set(nombre_completo ? String(nombre_completo) : '');
  }

  generacionDocumentos(): void {
    const ced = this.cedulaActual();
    if (!ced) { Swal.fire('Error', 'Debe seleccionar un candidato primero', 'error'); return; }
    localStorage.setItem('cedula', ced);
    localStorage.setItem('codigoContrato', this.codigoContratoActual());
    this.guardarFormulariosEnLocalStorage();
    this.router.navigate(['dashboard/hiring/generate-contracting-documents']);
  }

  guardarFormulariosEnLocalStorage(): void {
    const stored = localStorage.getItem('formularios');
    const current = stored ? JSON.parse(stored) : {};
    const payload = {
      ...current,
      vacante: this.idvacante() !== 0 ? this.idvacante() : this.idVacanteContratacion(),
      entrevista_andrea: this.idInfoEntrevistaAndrea(),
    };
    localStorage.setItem('formularios', JSON.stringify(payload));
  }

  // ───────── Salud ocupacional (PDF) ─────────
  private isPdf(file?: File | null): file is File {
    return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name));
  }

  async imprimirSaludOcupacional(): Promise<void> {
    const pdfs = (this.examFiles() ?? []).filter(f => this.isPdf(f));
    if (!pdfs.length) { Swal.fire('¡Advertencia!', 'Debe subir al menos un archivo PDF.', 'warning'); return; }

    Swal.fire({ title: 'Procesando...', icon: 'info', text: 'Generando documento PDF...', allowOutsideClick: false, allowEscapeKey: false, didOpen: () => Swal.showLoading() });

    try {
      try {
        await firstValueFrom(
          this.seleccionService
            .crearSeleccionParteTresCandidato(this.formGroup3, this.cedulaActual(), this.idProcesoSeleccion())
            .pipe(take(1))
        );
      } catch { /* noop */ }

      this.seleccionService
        .generarCodigoContratacion(this.abreviacionSede(), this.cedulaActual())
        .pipe(take(1))
        .subscribe({
          next: (r) => this.codigoContratoActual.set(r?.nuevo_codigo ?? this.codigoContratoActual())
        });

      const mergedPdf = await PDFDocument.create();
      for (const file of pdfs) {
        const buf = await file.arrayBuffer();
        const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
      }
      const mergedBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(mergedBytes).buffer], { type: 'application/pdf' });
      const mergedName = `SaludOcupacional_Combinado_${new Date().toISOString().slice(0, 10)}.pdf`;
      const mergedFile = new File([blob], mergedName, { type: 'application/pdf' });

      this.uploadedFiles.update(u => ({ ...u, examenesMedicos: { file: mergedFile, fileName: mergedName } }));
      try { await this.subirArchivo(mergedFile, 'examenesMedicos', mergedName); } catch { /* noop */ }

      const idEnt = this.idInfoEntrevistaAndrea();
      if (idEnt) {
        this.infoVacantesService
          .setEstadoVacanteAplicante(idEnt, 'examenes_medicos', true)
          .pipe(take(1))
          .subscribe({ next: () => { }, error: () => { } });
      }

      Swal.close();
      if (typeof (this as any).imprimirDocumentos === 'function') (this as any).imprimirDocumentos();
      await Swal.fire('¡Éxito!', 'El PDF de Salud Ocupacional fue generado y guardado correctamente.', 'success');
    } catch (error) {
      Swal.close();
      Swal.fire('¡Error!', 'Ocurrió un problema al fusionar los archivos PDF.', 'error');
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

    const keys = ['examenesMedicos', 'figuraHumana', 'pensionSemanas'];
    this.subirTodosLosArchivos(keys)
      .then(() => Swal.fire('¡Éxito!', 'Datos y archivos guardados exitosamente', 'success'))
      .catch((e) => Swal.fire('Error', `Hubo un error al subir los archivos: ${e}`, 'error'));
  }

  async subirTodosLosArchivos(keys: string[]): Promise<boolean> {
    const map = this.uploadedFiles();
    const archivos = Object.keys(map)
      .filter(k => keys.includes(k) && map[k]?.file)
      .map(k => ({ key: k, file: map[k]!.file!, fileName: map[k]!.fileName!, typeId: this.typeMap[k] }));

    if (!archivos.length) return true;

    const ced = this.cedulaActual();
    const codigo = this.codigoContratoActual();

    const results = await Promise.allSettled(
      archivos.map(({ key, file, fileName, typeId }) => {
        return new Promise<void>((ok, fail) => {
          const obs = (['examenesMedicos', 'figuraHumana', 'pensionSemanas'].includes(key))
            ? this.docSvc.guardarDocumento(fileName, ced, typeId, file, codigo)
            : this.docSvc.guardarDocumento(fileName, ced, typeId, file);
          obs.subscribe({ next: () => ok(), error: (e) => fail(`Error al subir ${key}: ${e?.message || e}`) });
        });
      })
    );

    const rejected = results.find(r => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (rejected) throw rejected.reason;
    return true;
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
    const ced = this.cedulaActual();
    if (!ced) { Swal.fire('Error', 'Debe seleccionar un candidato primero', 'error'); return; }

    this.infoVacantesService.getVacantesPorNumero(ced).pipe(
      catchError(() => { Swal.fire('Error', 'Ocurrió un error al cargar las vacantes del candidato', 'error'); return of([]); })
    ).subscribe((response: any[]) => {
      if (!response?.length) { Swal.fire('Error', 'No se encontraron vacantes para este candidato', 'error'); return; }

      const fixIso = (v: any): Date | null => {
        if (!v) return null;
        const d1 = new Date(v);
        if (!isNaN(d1.getTime())) return d1;
        const m = String(v).match(/^(.*\.\d{3})\d*(.*)$/);
        return m ? new Date(m[1] + m[2]) : null;
      };
      const data = response.map(r => ({ ...r, created_at: fixIso(r.created_at) }));

      const columns: ColumnDefinition[] = [
        { name: 'created_at', header: 'Fecha de creación', type: 'date', width: '180px' },
        { name: 'oficina', header: 'Oficina', type: 'text', width: '160px' },
        { name: 'aplica_o_no_aplica', header: 'Aplica o no aplica', type: 'text', width: '280px' },
        { name: 'motivoNoAplica', header: 'Motivo no aplica', type: 'text', width: '220px' },
        { name: 'aplicaObservacion', header: 'Retroalimentación', type: 'text', width: '280px' },
        { name: 'detalle', header: 'Detalle', type: 'text', width: '320px' },
        { name: 'actions', header: '', type: 'custom', width: '72px', stickyEnd: true, filterable: false },
      ];

      const ref = this.dialog.open(StandardFilterTable, { minWidth: '90vw', height: '65vh' });
      ref.componentInstance.tableTitle = 'Vacantes del candidato';
      ref.componentInstance.columnDefinitions = columns;
      ref.componentInstance.data = data;
      ref.componentInstance.pageSizeOptions = [10, 20, 50];
      ref.componentInstance.defaultPageSize = 10;
    });
  }

  // ───────── Cámara ─────────
  openCamera(): void {
    const dialogRef = this.dialog.open(CameraDialogComponent, {
      width: 'min(96vw, 720px)',
      maxWidth: '96vw',
      panelClass: 'camera-dialog',
      autoFocus: false,
      disableClose: true,
      data: { initialPreviewUrl: this.fotoDataUrl() || null },
    });

    dialogRef.afterClosed().pipe(
      filter((res): res is CameraDialogResult => !!res),
      switchMap((res) => {
        const dataUrl$ = res.previewUrl?.startsWith('data:')
          ? of(res.previewUrl as string)
          : from(this.fileToDataURL(res.file));
        return dataUrl$.pipe(
          switchMap((base64: string) =>
            this.seleccionService.subirFotoBase64(this.cedulaActual(), base64)
          ),
        );
      }),
      take(1),
      catchError((err) => {
        Swal.fire('Error', `No se pudo subir la foto: ${err?.message || err}`, 'error');
        return of(null);
      }),
    ).subscribe((resp: any) => {
      if (resp?.ok || resp?.success) {
        Swal.fire('Éxito', 'Foto subida exitosamente', 'success');
      } else if (resp !== null) {
        Swal.fire('Error', 'No se pudo subir la foto', 'error');
      }
    });
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
  private async initUsuarioYAbreviacion(): Promise<void> {
    try {
      const user: any = await this.util.getUser();
      const sedeNombre = user?.sede?.nombre ?? user?.sucursalde ?? '';
      this.sede.set(sedeNombre);
      this.abreviacionSede.set(this.abreviaciones[sedeNombre] || sedeNombre);
    } catch {
      this.sede.set(''); this.abreviacionSede.set('');
    }
  }

  private iniciarNuevoProcesoUI(): void {
    this.idProcesoSeleccion.set(null);
    this.formGroup3.patchValue({ ips: '', ipsLab: '', selectedExams: [] });
    const arr = this.selectedExamsArray;
    while (arr.length) arr.removeAt(0);
    this.recalcHayNoApto();
  }

  private recalcHayNoApto(): void {
    const arr = (this.selectedExamsArray.value ?? []) as Array<{ aptoStatus?: string }>;
    this.hayNoApto.set(Array.isArray(arr) && arr.some(x => this.isNoApto(x?.aptoStatus)));
  }

  private async elegirProcesoBonitoSinIdONuevo(items: any[]): Promise<any | 'NEW' | null> {
    const card = (it: any, checked = false) => {
      const fecha = this.formatMarcaTemporal(it?.marcaTemporal);
      const evaluador = this.escapeHtml(it?.nombre_evaluador || '—');
      const ips = this.escapeHtml(it?.ips || '');
      return `
        <label class="proc-card">
          <input type="radio" name="procOption" value="${it.id}" ${checked ? 'checked' : ''}/>
          <div class="card">
            <div class="card-row"><span class="date">${fecha}</span></div>
            <div class="card-body">
              <div><b>Evaluador:</b> ${evaluador}</div>
              ${ips ? `<div><b>IPS:</b> ${ips}</div>` : ''}
            </div>
          </div>
        </label>`;
    };
    const newCard = `
      <label class="proc-card">
        <input type="radio" name="procOption" value="NEW"/>
        <div class="card new">
          <div class="new-title">Crear nuevo proceso</div>
          <div class="new-sub">Comenzar desde cero</div>
        </div>
      </label>`;

    const { isConfirmed } = await Swal.fire({
      title: '¿Cómo deseas continuar?',
      html: `
        <style>
          .proc-wrap{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:6px}
          .proc-card{cursor:pointer}
          .proc-card input{display:none}
          .proc-card .card{width:300px;padding:12px 14px;border-radius:14px;border:1px solid #e5e7eb;transition:.15s;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06)}
          .proc-card .card.new{background:#f8fafc;border-style:dashed}
          .proc-card .new-title{font-weight:700;color:#0f172a}
          .proc-card .new-sub{font-size:12px;color:#64748b}
          .proc-card input:checked + .card{border-color:#3f51b5;box-shadow:0 0 0 3px rgba(63,81,181,.15)}
          .proc-card .card-row{display:flex;justify-content:flex-start;align-items:center;margin-bottom:8px}
          .date{font-size:13px;color:#374151;font-weight:600}
          .card-body{font-size:13px;color:#374151;line-height:1.35}
        </style>
        <div class="proc-wrap">
          ${items[0] ? card(items[0], true) : ''}
          ${items[1] ? card(items[1]) : ''}
          ${newCard}
        </div>`,
      focusConfirm: false,
      allowOutsideClick: false,
      confirmButtonText: 'Continuar',
      preConfirm: () => {
        const sel = (document.querySelector('input[name="procOption"]:checked') as HTMLInputElement)?.value;
        if (!sel) { Swal.showValidationMessage('Selecciona una opción'); return false as any; }
        (Swal as any).selectedOption = sel; return true;
      }
    });
    if (!isConfirmed) return null;
    const sel = (Swal as any).selectedOption as string;
    if (sel === 'NEW') return 'NEW';
    const idSel = Number(sel);
    return items.find(it => it.id === idSel) ?? null;
  }

  private formatMarcaTemporal(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    try {
      return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
    } catch { return d.toLocaleString(); }
  }
  private escapeHtml(s: string): string {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }
}
