import { SharedModule } from '@/app/shared/shared.module';
import {
  Component, ChangeDetectionStrategy,
  effect, input, output, computed, signal, inject, DestroyRef, LOCALE_ID,
  OnInit
} from '@angular/core';
import {
  FormGroup, FormBuilder, Validators, FormArray
} from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, startWith, tap } from 'rxjs/operators';
import { of, firstValueFrom } from 'rxjs';
import Swal from 'sweetalert2';

import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { GestionParametrizacionService } from '../../../users/services/gestion-parametrizacion/gestion-parametrizacion.service';

// ================== Constantes ==================
export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY'
  }
};

interface OficinaDTO { nombre: string; numeroDeGenteRequerida: number; ruta: boolean; }
interface PublicacionDTO {
  id: number;
  cargo: string;
  oficinasQueContratan: OficinaDTO[];
  empresaUsuariaSolicita: string;
  finca: string | null;
  ubicacionPruebaTecnica: string | null;
  experiencia: string | null;
  fechadePruebatecnica: string | null;
  horadePruebatecnica: string | null;
  observacionVacante: string | null;
  fechadeIngreso: string | null;
  temporal: string | null;
  descripcion: string | null;
  fechaPublicado: string;
  quienpublicolavacante: string | null;
  estadovacante: string | null;
  salario: string | null;
  codigoElite: string | null;
  area: string | null;
  pruebaOContratacion: string | null;
  tipoContratacion: string | null;
  municipio: string[] | null;
  auxilioTransporte: string | null;
}

@Component({
  selector: 'app-help-information',
  standalone: true,
  imports: [SharedModule, MatTabsModule, MatDatepickerModule, MatNativeDateModule],
  templateUrl: './help-information.component.html',
  styleUrls: ['./help-information.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]
})
export class HelpInformationComponent implements OnInit {


  // ========= Inputs/Outputs basados en signals =========
  cedula = input<string>('');
  vacanteSeleccionadaId = input<number | null>(null);
  idProcesoSeleccion = input<number | null>(null);
  idInfoEntrevistaAndrea = input<number | null>(null);
  idVacante = output<number>(); // Angular 19+ output()

  // ========= Inyección =========
  private fb = inject(FormBuilder);
  private gp = inject(GestionParametrizacionService);
  private seleccionService = inject(SeleccionService);
  private infoVacantesService = inject(InfoVacantesService);
  private vacantesService = inject(VacantesService);
  public utilService = inject(UtilityServiceService);
  private destroyRef = inject(DestroyRef);

  // ========= Estado local (signals) =========
  vacantes = signal<PublicacionDTO[]>([]);
  vacanteSeleccionada = signal<PublicacionDTO | null>(null);
  selectedVacanteId = signal<number | null>(null);

  // ========= Formularios =========
  infoPersonalForm: FormGroup;
  vacantesForm: FormGroup;

  sede: string | undefined;

  // Selects de tiempo
  meses = Array.from({ length: 11 }, (_, i) => i + 1);  // 1..11
  anios = Array.from({ length: 80 }, (_, i) => i + 1);  // 1..80

  get hijosFormArray(): FormArray {
    return this.infoPersonalForm.get('hijos') as FormArray;
  }

  // ========= Catálogos a signals =========
  private _estadosCiviles$ = this.gp
    .listMetaValoresByTablaCodigo('ESTADOS_CIVILES', { activo: true })
    .pipe(catchError(() => of([])));

  private _opcionesPromo$ = this.gp
    .listMetaValoresByTablaCodigo('CATALOGO_MARKETING', { activo: true })
    .pipe(catchError(() => of([])));

  estadosCiviles = toSignal(this._estadosCiviles$, { initialValue: [] as any[] });
  opcionesPromocion = toSignal(this._opcionesPromo$, { initialValue: [] as any[] });

  // ========= Derivados (computed) =========
  private tipoCtrl = this.fb.control<string>('', { nonNullable: true });
  tipoSig = toSignal(this.tipoCtrl.valueChanges.pipe(startWith(this.tipoCtrl.value)));
  isAutorizacion = computed(() => this.tipoSig() === 'Autorización de ingreso');
  isPrueba = computed(() => this.tipoSig() === 'Prueba técnica');

  totalRequerida = computed(() => {
    const v = this.vacanteSeleccionada();
    const ofs = Array.isArray(v?.oficinasQueContratan) ? v!.oficinasQueContratan : [];
    return ofs.reduce((acc, o) => acc + this.toInt(o?.numeroDeGenteRequerida), 0);
  });

  // ========= Labels/constantes =========
  readonly MAX_EXP = 12;
  readonly SEED_EXP_COUNT = 3;

  readonly LABELS_INFO: Record<string, string> = {
    tipodedocumento: 'Tipo de documento',
    numerodecedula: 'Número de cédula',
    municipio: 'Municipio',
    municipioExpedicion: 'Municipio de expedición',
    nombreCompleto: 'Nombre completo',
    celular: 'Celular',
    whatsapp: 'WhatsApp',
    genero: 'Sexo',
    edad: 'Edad',
    fechaNacimiento: 'Fecha de nacimiento',
    fechaExpedicion: 'Fecha de expedición',
    barrio: 'Barrio',
    tieneExperienciaFlores: '¿Tiene experiencia en flores?',
    experienciaFlores: '¿Tiene experiencia en flores?',
    tipoExperienciaFlores: 'Tipo de experiencia en flores',
    otroExperiencia: 'Otro tipo de experiencia',
    referenciado: 'Referenciado',
    nombreReferenciado: 'Nombre del referenciado',
    comoSeEntero: '¿Cómo se enteró?',
    laboresRealizadas: 'Labores realizadas',
    empresasLaborado: 'Empresas donde ha laborado',
    tiempoExperiencia: 'Tiempo de experiencia',
    escolaridad: 'Escolaridad',
    numHijos: 'Número de hijos (legacy)',
    edadesHijos: 'Edades de los hijos (legacy)',
    quienLosCuida: 'Quién los cuida (legacy)',
    aplicaObservacion: '¿Observación del evaluador?',
    motivoNoAplica: 'Motivo (No aplica)',
    hijos: 'Hijos',
    primerApellido: 'Primer apellido',
    segundoApellido: 'Segundo apellido',
    primerNombre: 'Primer nombre',
    segundoNombre: 'Segundo nombre',
    lugarNacimiento: 'Lugar de nacimiento',
    oficina: 'Oficina',
    brigadaDe: 'Brigada',
    estadoCivil: 'Estado civil',
    conQuienViveChecks: 'Con quién vive',
    tieneHijos: '¿Tiene hijos?',
    cuidadorHijos: 'Quién cuida a los hijos',
    numeroHijos: 'Número de hijos',
    tiempoResidencia: 'Tiempo de residencia',
    proyeccion1Ano: 'Proyección a 1 año',
    experiencias: 'Experiencias',
    observacionEvaluador: 'Observación del evaluador',
    motivoEspera: 'Motivo de espera',
    estudiaActualmente: '¿Estudia actualmente?'
  };

  // ========= Constructor =========
  constructor() {
    // --- Form 1
    this.infoPersonalForm = this.fb.group({
      tipodedocumento: ['', Validators.required],
      numerodecedula: ['', [Validators.required, Validators.pattern(/^\d+$/)]],
      municipio: [''],
      municipioExpedicion: ['', Validators.required],
      nombreCompleto: [''],
      celular: ['', [Validators.required, Validators.pattern(/^3\d{9}$/)]],
      whatsapp: ['', [Validators.required, Validators.pattern(/^3\d{9}$/), Validators.maxLength(10)]],
      genero: ['', Validators.required],
      edad: [''],
      fechaNacimiento: ['', Validators.required],
      fechaExpedicion: ['', Validators.required],
      barrio: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(40)]],
      tieneExperienciaFlores: ['', Validators.required],
      referenciado: [''],
      nombreReferenciado: [''],
      comoSeEntero: ['', Validators.required],
      laboresRealizadas: [''],
      empresasLaborado: [''],
      tiempoExperiencia: [''],
      escolaridad: [null, Validators.required],
      numHijos: [0],
      edadesHijos: [''],
      quienLosCuida: [''],
      aplicaObservacion: ['', Validators.required],
      motivoNoAplica: [''],
      hijos: this.fb.array([]),

      primerApellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
      segundoApellido: ['', [Validators.maxLength(30)]],
      primerNombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
      segundoNombre: ['', [Validators.maxLength(30)]],
      lugarNacimiento: ['', Validators.required],

      experienciaFlores: ['', Validators.required],
      tipoExperienciaFlores: [''],
      otroExperiencia: [''],

      oficina: ['', Validators.required],
      brigadaDe: [''],

      estadoCivil: ['', Validators.required],
      conQuienViveChecks: [[], Validators.required],

      tieneHijos: [null, Validators.required],
      cuidadorHijos: [''],
      numeroHijos: [0],

      tiempoResidencia: ['', Validators.required],
      proyeccion1Ano: ['', Validators.required],
      estudiaActualmente: [null as boolean | null, Validators.required],

      experiencias: this.fb.array([]),
      observacionEvaluador: [''],
      motivoEspera: [''],
    });

    // --- Form 2 (inyectamos tipoCtrl para poder observarlo como signal)
    this.vacantesForm = this.fb.group({
      tipo: this.tipoCtrl,
      empresaUsuaria: [''],
      cargo: [''],
      area: [''],
      fechaIngreso: [''],
      salario: [''],
      fechaPruebaEntrevista: [''],
      horaPruebaEntrevista: [''],
      direccionEmpresa: ['']
    });

    // --- Effect: reaccionar a inputs
    effect(() => {
      this.onInputsChanged(
        this.cedula(),
        this.vacanteSeleccionadaId(),
        this.idProcesoSeleccion(),
        this.idInfoEntrevistaAndrea()
      );
    });

    // Sincronizar selectedVacanteId con el input
    effect(() => {
      this.selectedVacanteId.set(this.vacanteSeleccionadaId());
    });
  }

  ngOnInit() {
    const user = this.utilService.getUser();
    if (user) {
      this.sede = user.sede.nombre || null;
      if (this.sede) {
        this.vacantesService.getVacantesPorOficina(this.sede).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: (vacantes) => {
            this.vacantes.set(vacantes);
          },
          error: (error) => {
          }
        });
      }
    }

  }

  // ===== Getters cortos =====
  get hijosFA(): FormArray { return this.infoPersonalForm.get('hijos') as FormArray; }
  get experienciasFA(): FormArray { return this.infoPersonalForm.get('experiencias') as FormArray; }

  // ===== Handlers =====
  private onInputsChanged(
    cedula: string,
    vacanteId: number | null,
    idProceso: number | null,
    idInfo: number | null
  ) {
    // 1) Prefill de info personal por cédula o idInfo (si el servicio lo soporta)
    (async () => {
      try {
        const svc: any = this.infoVacantesService as any;
        if (cedula && typeof svc.getVacantesPorNumero === 'function') {
          const data = await firstValueFrom<any[]>(
            svc.getVacantesPorNumero(cedula)
          );

          if (Array.isArray(data) && data.length > 0) {
            const info = data[0] as Record<string, any>;
            this.patchInfoPersonalFromApi(info);
          }
        }
      } catch {
        /* noop */
      }
    })();


    // 2) Prefill de proceso/vacante por idProceso (si existe el método)
    (async () => {
      try {
        const svc: any = this.seleccionService as any;
        if (idProceso && typeof svc.getSeleccionPorId === 'function') {
          const resp: any = await firstValueFrom(svc.getSeleccionPorId(idProceso)); // <-- cast
          const p = resp?.procesoSeleccion ?? resp;
          if (p) this.patchProcesoSeleccionToForms(p);
        }
      } catch { /* noop */ }
    })();


    // 3) Selección de vacante si viene desde el padre
    if (vacanteId != null) this.onVacanteIdChange(vacanteId);
  }

  onVacanteIdChange(id: number | string): void {
    const idNum = Number(id);
    this.selectedVacanteId.set(idNum);
    const v = this.vacantes().find(x => Number(x.id) === idNum) || null;
    this.vacanteSeleccionada.set(v);
    if (v) this.patchVacanteToForm(v);
  }

  emitirIdSiSeleccionado(): void {
    const id = this.selectedVacanteId();
    if (typeof id === 'number') this.idVacante.emit(id);
  }

  // ===== Experiencias =====
  private buildExperienciaGroup(required = true) {
    const req = required ? Validators.required : null;
    const max = (n: number) => Validators.maxLength(n);
    return this.fb.group({
      empresa: ['', [req, max(120)].filter(Boolean) as any],
      labores: ['', [req, max(800)].filter(Boolean) as any],
      tiempo: ['', [req, max(80)].filter(Boolean) as any],
      labores_principales: ['', [req, max(800)].filter(Boolean) as any],
    });
  }

  agregarExperiencia(prefill?: Partial<{ empresa: string; tiempo: string; labores: string; labores_principales: string }>) {
    if (this.experienciasFA.length >= this.MAX_EXP) {
      Swal.fire('Límite alcanzado', `Máximo ${this.MAX_EXP} experiencias.`, 'info');
      return;
    }
    const grp = this.buildExperienciaGroup(false);
    if (prefill) grp.patchValue({
      empresa: prefill.empresa ?? '',
      tiempo: prefill.tiempo ?? '',
      labores: prefill.labores ?? '',
      labores_principales: prefill.labores_principales ?? (prefill as any)?.laboresPrincipales ?? '',
    });
    this.experienciasFA.push(grp);
    this.infoPersonalForm.markAsDirty();
    setTimeout(() => {
      (document.querySelector(`[formarrayname="experiencias"] .card:last-of-type input[formcontrolname="empresa"]`) as HTMLInputElement | null)?.focus();
    });
  }

  // ===== Guardar Info Personal =====
  private toSiNo(v: boolean | null): 'SI' | 'NO' | null { return v == null ? null : (v ? 'SI' : 'NO'); }
  private normTextAll(obj: any) { Object.keys(obj).forEach(k => { if (typeof obj[k] === 'string') obj[k] = obj[k].toUpperCase(); }); }
  private toYMD(v: any) {
    if (!v) return v;
    if (v instanceof Date) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
    if (typeof v === 'string' && v.length > 10) return v.slice(0, 10);
    return v;
  }

  async guardarInfoPersonal(): Promise<void> {
    const { html, firstKey } = this.buildInvalidList();
    if (this.infoPersonalForm.invalid || html) {
      this.infoPersonalForm.markAllAsTouched();
      await Swal.fire({ title: 'Revisa la información', html: html || 'Por favor, completa los campos obligatorios.', icon: 'warning' });
      this.scrollToControl(firstKey);
      return;
    }

    const info: any = { ...this.infoPersonalForm.value, id: this.idInfoEntrevistaAndrea() };
    info.fechaNacimiento = this.toYMD(info.fechaNacimiento);
    info.fechaExpedicion = this.toYMD(info.fechaExpedicion);
    this.normTextAll(info);
    info.estudiaActualmente = this.toSiNo(this.infoPersonalForm.value.estudiaActualmente);

    this.seleccionService.guardarInfoPersonal(info).pipe(
      tap((resp: any) => {
        Swal.fire({ title: 'Guardado', text: 'Información personal guardada correctamente.', icon: 'success' });
        if (resp?.id) {
          this.infoVacantesService
            .setEstadoVacanteAplicante(this.idInfoEntrevistaAndrea(), 'entrevistado', true)
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
        }
      }),
      catchError(err => {
        Swal.fire({ title: 'Error', text: err?.error?.detail || 'No se pudo guardar la información personal.', icon: 'error' });
        return of(null);
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }

  // ===== Vacantes =====
  private normDate(v: any): string {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    const d2 = new Date(s);
    return isNaN(d2.getTime()) ? '' : d2.toISOString().slice(0, 10);
  }
  private normTime(v: any): string | null {
    if (!v) return null;
    const m = String(v).trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const hh = String(Math.min(23, Math.max(0, +m[1]))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, +m[2]))).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  private norm(s: any): string {
    return (s ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
  }
  private mapApiTipoToForm(apiVal: any): '' | 'Prueba técnica' | 'Autorización de ingreso' {
    const t = this.norm(apiVal);
    if (t === 'prueba' || t === 'prueba tecnica' || t === 'prueba_tecnica') return 'Prueba técnica';
    if (t.startsWith('contrat') || (t.includes('autorizacion') && t.includes('ingreso'))) return 'Autorización de ingreso';
    return '';
  }

  private patchVacanteToForm(v: PublicacionDTO): void {
    const toDate = (yyyyMmDd: string | null) => yyyyMmDd ? new Date(`${yyyyMmDd}T00:00:00`) : null;
    const toTime = (hhmmss: string | null) => hhmmss ? hhmmss.slice(0, 5) : null;
    const salarioNum = v.salario && v.salario !== '0.00' ? Number(v.salario) : null;

    this.vacantesForm.patchValue({
      tipo: this.mapApiTipoToForm(v.pruebaOContratacion),
      empresaUsuaria: v.empresaUsuariaSolicita ?? '',
      cargo: v.cargo ?? '',
      fechaIngreso: toDate(v.fechadeIngreso),
      salario: salarioNum,
      area: v.area ?? '',
      fechaPruebaEntrevista: toDate(v.fechadePruebatecnica),
      horaPruebaEntrevista: toTime(v.horadePruebatecnica),
      direccionEmpresa: v.ubicacionPruebaTecnica ?? ''
    }, { emitEvent: true });
  }

  private patchProcesoSeleccionToForms(p: any): void {
    // Mapea la estructura que mostraste en tu ejemplo de backend
    const toDate = (yyyyMmDd?: string | null) => (yyyyMmDd ? new Date(`${yyyyMmDd}T00:00:00`) : null);
    const toTime = (hhmm?: string | null) => (hhmm ? String(hhmm).slice(0, 5) : null);

    this.vacantesForm.patchValue({
      tipo: this.mapApiTipoToForm(p?.tipo ?? p?.pruebaOContratacion),
      empresaUsuaria: p?.centro_costo_entrevista ?? p?.empresa_usuario ?? '',
      cargo: p?.cargo ?? '',
      area: p?.area_entrevista ?? '',
      fechaPruebaEntrevista: toDate(p?.fecha_prueba_entrevista),
      horaPruebaEntrevista: toTime(p?.hora_prueba_entrevista),
      direccionEmpresa: p?.direccion_empresa ?? '',
      fechaIngreso: toDate(p?.fechaIngreso),
      salario: p?.salario ? Number(p.salario) : null
    }, { emitEvent: true });

    // Si el proceso trae id de vacante, sincroniza selección
    if (p?.vacante != null) {
      const id = Number(p.vacante);
      this.selectedVacanteId.set(id);
      const v = this.vacantes().find(x => Number(x.id) === id) || null;
      this.vacanteSeleccionada.set(v);
    }
  }

  private boolFromText(v: any): boolean | null {
    if (v === true || v === false) return v;
    if (v == null) return null;
    const s = String(v).trim().toLowerCase();
    if (s === 'true' || s === 'sí' || s === 'si' || s === '1') return true;
    if (s === 'false' || s === 'no' || s === '0') return false;
    return null;
  }

  private calcEdad(f?: any): string {
    if (!f) return '';
    const d = new Date(f), h = new Date();
    let e = h.getFullYear() - d.getFullYear();
    const m = h.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < d.getDate())) e--;
    return String(e);
  }

  private toDate(v: any): Date | null {
    if (!v) return null;
    return v instanceof Date ? v : new Date(String(v));
  }

  setHijosDesdeBackend(hijos: any[]) {
    const fa = this.hijosFormArray;
    fa.clear();
    (hijos || []).forEach(h => {
      fa.push(this.fb.group({
        nombre: [h?.nombre ?? ''],
        sexo: [h?.sexo ?? ''],
        fecha_nacimiento: [h?.fecha_nacimiento ?? ''],
        no_documento: [h?.no_documento ?? ''],
        estudia_o_trabaja: [h?.estudia_o_trabaja ?? ''],
        curso: [h?.curso ?? ''],
        edad: [h?.edad ?? '']
      }));
    });
    const n = hijos?.length ?? 0;
    this.infoPersonalForm.get('numHijos')?.setValue(n, { emitEvent: false });
    this.infoPersonalForm.get('numeroHijos')?.setValue(n, { emitEvent: false });
    const edades = (hijos || []).map(x => x?.edad).filter(e => e != null).join(', ');
    this.infoPersonalForm.get('edadesHijos')?.setValue(edades);
  }

  private seedExperiencias(n = this.SEED_EXP_COUNT): void {
    const fa = this.experienciasFA;
    while (fa.length < n) fa.push(this.buildExperienciaGroup(false));
  }

  private setExperienciasDesdeBackend(raw: any[]): void {
    const cleaned = (Array.isArray(raw) ? raw : [])
      .map((e: any) => ({
        empresa: (e?.empresa ?? '').toString().trim(),
        tiempo: (e?.tiempo ?? '').toString().trim(),
        labores: (e?.labores ?? '').toString().trim(),
        labores_principales: (e?.labores_principales ?? e?.laboresPrincipales ?? '').toString().trim(),
      }))
      .filter(e => e.empresa || e.tiempo || e.labores || e.labores_principales);

    if (!cleaned.length) {
      this.infoPersonalForm.setControl('experiencias', this.fb.array([]));
      this.seedExperiencias(this.SEED_EXP_COUNT);
      return;
    }

    const newFA = this.fb.array(
      cleaned.map(v =>
        this.fb.group({
          empresa: [v.empresa, [Validators.maxLength(120)]],
          labores: [v.labores, [Validators.maxLength(800)]],
          tiempo: [v.tiempo, [Validators.maxLength(80)]],
          labores_principales: [v.labores_principales, [Validators.maxLength(800)]],
        })
      )
    );
    this.infoPersonalForm.setControl('experiencias', newFA);
  }

  private patchInfoPersonalFromApi(data: any): void {
    const expTxt = (data?.cuenta_experiencia_flores ?? '').toString().trim();
    const expSi = this.boolFromText(expTxt) === true;
    const experienciaFlores = expSi ? 'Sí' : (expTxt ? 'No' : '');

    const municipioExp = data?.municipio_expedicion ?? data?.municipioExpedicion ?? '';
    const nombreCompleto = [data?.primer_nombre, data?.segundo_nombre, data?.primer_apellido, data?.segundo_apellido]
      .filter(Boolean).join(' ').trim();

    this.infoPersonalForm.patchValue({
      tipodedocumento: data?.tipo_documento ?? '',
      numerodecedula: data?.numero ?? this.cedula() ?? '',
      municipio: data?.municipio ?? '',
      municipioExpedicion: municipioExp,
      nombreCompleto,
      celular: data?.celular ?? '',
      whatsapp: data?.whatsapp ?? '',
      genero: data?.genero ?? '',
      edad: this.calcEdad(data?.fecha_nacimiento),
      fechaNacimiento: this.toDate(data?.fecha_nacimiento),
      fechaExpedicion: this.toDate(data?.fecha_expedicion),
      barrio: data?.barrio ?? '',
      tieneExperienciaFlores: expSi ? 'SI' : (expTxt ? 'NO' : ''),
      tipoExperienciaFlores: data?.tipoExperienciaFlores ?? '',
      referenciado: data?.referenciado ?? '',
      nombreReferenciado: data?.nombreReferenciado ?? '',
      comoSeEntero: data?.como_se_entero ?? '',
      laboresRealizadas: data?.labores_especificas ?? '',
      empresasLaborado: data?.fincas_que_ha_trabajado ?? '',
      tiempoExperiencia: data?.tiempo_experiencia ?? '',
      escolaridad: data?.nivel_escolaridad || data?.escolaridad || null,
      numHijos: data?.numero_hijos ?? 0,
      quienLosCuida: data?.quien_los_cuida ?? data?.cuidador_hijos ?? '',
      aplicaObservacion: data?.aplica_o_no_aplica ?? '',
      motivoNoAplica: data?.motivoNoAplica ?? '',

      primerApellido: data?.primer_apellido ?? '',
      segundoApellido: data?.segundo_apellido ?? '',
      primerNombre: data?.primer_nombre ?? '',
      segundoNombre: data?.segundo_nombre ?? '',
      lugarNacimiento: data?.lugar_nacimiento ?? '',

      experienciaFlores,
      otroExperiencia: data?.otro_experiencia ?? '',

      oficina: data?.oficina ?? '',
      brigadaDe: data?.brigada_de ?? '',

      estadoCivil: data?.estado_civil ?? '',
      conQuienViveChecks: Array.isArray(data?.con_quien_vive) ? data.con_quien_vive : [],

      tieneHijos: this.boolFromText(data?.tiene_hijos),
      cuidadorHijos: data?.cuidador_hijos ?? '',
      numeroHijos: data?.numero_hijos ?? 0,

      tiempoResidencia: data?.tiempo_residencia ?? '',
      proyeccion1Ano: data?.proyeccion_1_ano ?? '',
      estudiaActualmente: (this.boolFromText(data?.estudiaActualmente) ?? null),

      observacionEvaluador: data?.aplicaObservacion ?? '',
      motivoEspera: data?.motivoEspera ?? '',
    });

    // Hijos y experiencias
    this.setHijosDesdeBackend(Array.isArray(data?.hijos) ? data.hijos : []);
    const rawExp =
      Array.isArray(data?.experiencias) ? data.experiencias :
        Array.isArray(data?.experiencia_laboral) ? data.experiencia_laboral :
          Array.isArray(data?.experiencias_laborales) ? data.experiencias_laborales : [];
    this.setExperienciasDesdeBackend(rawExp);

    this.infoPersonalForm.get('motivoNoAplica')?.updateValueAndValidity();
  }

  async guardarVacantes(): Promise<void> {
    if (this.vacantesForm.invalid) {
      this.vacantesForm.markAllAsTouched();
      await Swal.fire('Error', 'Debes completar todos los campos obligatorios.', 'error');
      return;
    }

    const fv: any = { ...this.vacantesForm.value, id: this.idInfoEntrevistaAndrea() };
    this.normTextAll(fv);

    const payloadVacante = {
      numerodeceduladepersona: String(this.cedula()).trim(),
      tipo: fv.tipo ?? '',
      centro_costo_entrevista: fv.empresaUsuaria ?? '',
      cargo: fv.cargo ?? '',
      area_entrevista: fv.area ?? '',
      fecha_prueba_entrevista: this.normDate(fv.fechaPruebaEntrevista),
      hora_prueba_entrevista: this.normTime(fv.horaPruebaEntrevista),
      direccion_empresa: fv.direccionEmpresa ?? '',
      fechaIngreso: this.normDate(fv.fechaIngreso),
      salario: fv.salario != null ? String(fv.salario) : '',
      vacante: this.vacanteSeleccionada()?.id ?? fv.vacante ?? null
    };

    Swal.fire({ title: 'Guardando…', text: 'Procesando información de vacantes.', icon: 'info', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });

    try {
      const respParte2: any = await firstValueFrom(
        this.seleccionService.crearSeleccionParteDosCandidato(this.vacantesForm, this.cedula(), this.idProcesoSeleccion())
      );

      const respGuardar: any = await firstValueFrom(this.seleccionService.guardarVacantes(payloadVacante));
      Swal.close();

      if (respGuardar?.id) {
        this.infoVacantesService.setEstadoVacanteAplicante(this.idInfoEntrevistaAndrea(), 'prueba_tecnica', true)
          .pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      }

      if (this.vacanteSeleccionada()?.id) {
        const idVac = this.vacanteSeleccionada()!.id;
        this.vacantesService.setEstadoVacanteAplicante(idVac, 'preseleccionado', this.cedula())
          .pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
        this.seleccionService.setVacante(this.cedula(), idVac)
          .pipe(takeUntilDestroyed(this.destroyRef)).subscribe();

        this.emitirIdSiSeleccionado();
      }

      await Swal.fire({ icon: 'success', title: 'Guardado', text: 'Información de vacantes guardada correctamente.' });
    } catch (err: any) {
      Swal.close();
      await Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.detail || err?.message || 'No se pudo guardar la información de vacantes.' });
    }
  }

  // ── Wrapper para usar en el template con argumento ──
  totalRequeridaOf(v: any): number {
    const ofs = Array.isArray(v?.oficinasQueContratan) ? v.oficinasQueContratan : [];
    return ofs.reduce((acc: number, o: any) => acc + this.toInt(o?.numeroDeGenteRequerida), 0);
  }

  // ── KPIs/estilos que usa el template ──
  countPre(v: any): number {
    const p = v?.preseleccionados;
    return Array.isArray(p) ? p.length : this.toInt(p);
  }
  countCont(v: any): number {
    const c = v?.contratados;
    return Array.isArray(c) ? c.length : this.toInt(c);
  }
  pillClasePre(v: any): string {
    const req = this.totalRequeridaOf(v);
    const pre = this.countPre(v);
    return pre >= req ? 'pill-ok' : 'pill-error';
  }
  pillClaseCont(v: any): string {
    const req = this.totalRequeridaOf(v);
    const pre = this.countPre(v);
    const cont = this.countCont(v);
    if (cont >= req) return 'pill-ok';
    if (pre >= req && cont < req) return 'pill-warn';
    return 'pill-error';
  }
  oficinasResumen(ofs: any[]): string {
    if (!Array.isArray(ofs) || !ofs.length) return '—';
    return ofs.map(o => `${o?.nombre ?? 'Oficina'} (${this.toInt(o?.numeroDeGenteRequerida)})`).join(', ');
  }
  formatShortDate(d: any): string {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ── Handler que el template invoca ──
  onTipoChange(tipo: string): void {
    if (tipo === 'Autorización de ingreso') {
      this.vacantesForm.patchValue({
        area: '',
        fechaPruebaEntrevista: '',
        horaPruebaEntrevista: '',
        direccionEmpresa: ''
      });
    } else if (tipo === 'Prueba técnica') {
      this.vacantesForm.patchValue({
        fechaIngreso: '',
        salario: ''
      });
    }
  }

  // ===== Validación compacta =====
  private buildInvalidList(): { html: string; firstKey?: string } {
    const f = this.infoPersonalForm;
    const lines: string[] = [];
    let firstKey: string | undefined;
    const push = (key: string, msg: string) => { if (!firstKey) firstKey = key; lines.push(`<li><b>${this.LABELS_INFO[key] ?? key}:</b> ${msg}</li>`); };

    // genérico
    Object.entries(f.controls).forEach(([key, c]) => {
      if (!c || c.valid) return;
      const e = c.errors || {};
      if (e['required']) push(key, 'es obligatorio.');
      if (e['pattern']) push(key, (key === 'celular' || key === 'whatsapp') ? 'debe iniciar con 3 y tener 10 dígitos.' : 'formato inválido.');
      if (e['minlength']) push(key, `mínimo ${e['minlength'].requiredLength} caracteres.`);
      if (e['maxlength']) push(key, `máximo ${e['maxlength'].requiredLength} caracteres.`);
    });

    // reglas condicionales
    const exp = f.get('experienciaFlores')?.value;
    if (exp === 'Sí') {
      if (!f.get('tipoExperienciaFlores')?.value) push('tipoExperienciaFlores', 'es obligatorio cuando hay experiencia en flores.');
      else if (f.get('tipoExperienciaFlores')?.value === 'OTROS' && !String(f.get('otroExperiencia')?.value || '').trim())
        push('otroExperiencia', 'es obligatorio cuando el tipo es "OTROS".');
    }
    if (f.get('referenciado')?.value === 'SI' && !String(f.get('nombreReferenciado')?.value || '').trim())
      push('nombreReferenciado', 'es obligatorio cuando "Referenciado" es "Sí".');

    if (f.get('tieneHijos')?.value === true) {
      if (!String(f.get('cuidadorHijos')?.value || '').trim()) push('cuidadorHijos', 'es obligatorio cuando "¿Tiene hijos?" es "Sí".');
      const nH = Number(f.get('numeroHijos')?.value ?? 0); if (!nH || nH < 1) push('numeroHijos', 'al menos 1.');
    }

    if (f.get('observacionEvaluador')?.value === 'ESPERA DE VACANTE') {
      const motivo = String(f.get('motivoEspera')?.value || ''); if (!motivo.trim()) push('motivoEspera', 'es obligatorio.');
      else if (motivo.length > 300) push('motivoEspera', 'máximo 300 caracteres.');
    }

    if (f.get('aplicaObservacion')?.value === 'NO_APLICA' && !String(f.get('motivoNoAplica')?.value || '').trim())
      push('motivoNoAplica', 'debe especificarse cuando es "NO APLICA".');

    if (String(f.get('oficina')?.value || '') === 'BRIGADA' && !String(f.get('brigadaDe')?.value || '').trim())
      push('brigadaDe', 'es obligatorio cuando la oficina es "BRIGADA".');

    const html = lines.length ? `<ul style="text-align:left;margin:0;padding-left:18px;">${lines.join('')}</ul>` : '';
    return { html, firstKey };
  }

  private scrollToControl(key?: string) {
    if (!key) return;
    const el = document.querySelector(`[formcontrolname="${key}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => el?.focus(), 200);
  }

  // ===== Utilidades varias =====
  private toInt(v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string') { const m = v.match(/-?\d+/); return m ? parseInt(m[0], 10) : 0; }
    return 0;
  }
}
