import { SharedModule } from '@/app/shared/shared.module';
import { Component, EventEmitter, Input, LOCALE_ID, OnInit, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTabsModule } from '@angular/material/tabs';
import { HiringService } from '../../service/hiring.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { GestionDocumentalService } from '../../service/gestion-documental/gestion-documental.service';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { firstValueFrom } from 'rxjs';

export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY'
  }
};

// Interfaces útiles
interface OficinaDTO { nombre: string; numeroDeGenteRequerida: number; ruta: boolean; }

interface PublicacionDTO {
  id: number;
  cargo: string;
  oficinasQueContratan: OficinaDTO[];
  empresaUsuariaSolicita: string;
  finca: string | null;
  ubicacionPruebaTecnica: string | null;
  experiencia: string | null;
  fechadePruebatecnica: string | null; // "YYYY-MM-DD"
  horadePruebatecnica: string | null;  // "HH:mm:ss"
  observacionVacante: string | null;
  fechadeIngreso: string | null;       // "YYYY-MM-DD"
  temporal: string | null;
  descripcion: string | null;
  fechaPublicado: string; // "YYYY-MM-DD"
  quienpublicolavacante: string | null;
  estadovacante: string | null;
  salario: string | null;           // "0.00" ó null
  codigoElite: string | null;
  area: string | null;
  pruebaOContratacion: string | null; // "Prueba" | "Contratación" | ...
  tipoContratacion: string | null;
  municipio: string[] | null;
  auxilioTransporte: string | null;
}

@Component({
  selector: 'app-help-information',
  imports: [
    SharedModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './help-information.component.html',
  styleUrl: './help-information.component.css',
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]

})
export class HelpInformationComponent implements OnInit {
  @Input() cedula: string = '';
  @Output() idVacante = new EventEmitter<number>();
  @Input() vacanteSeleccionadaId: any;

  private _idInfoEntrevistaAndrea: number = 0;
  @Input() set idInfoEntrevistaAndrea(value: number) {
    this._idInfoEntrevistaAndrea = value;
  }

  get idInfoEntrevistaAndrea(): number { return this._idInfoEntrevistaAndrea; }

  private _idProcesoSeleccion: number | null = null;
  @Input() set idProcesoSeleccion(value: number | null) {
    this._idProcesoSeleccion = value;
  }
  get idProcesoSeleccion(): number | null { return this._idProcesoSeleccion; }
  get hijosFA(): FormArray {
    return this.infoPersonalForm.get('hijos') as FormArray;
  }
  pendingVacanteId: number | null = null;

  // Formularios
  infoPersonalForm: FormGroup;
  vacantesForm: FormGroup;

  // Variables
  sedeLogin: string = '';
  vacanteActual: any;
  formGroup4: FormGroup;
  codigoContrato: string = '';
  readonly SEED_EXP_COUNT = 3;

  opcionesPromocion: string[] = [
    "CHAT SERVICIO AL CLIENTE (WHATSAPP, REDES SOCIALES)",
    "CONVOCATORIA EXTERNA (MUNICIPIO, LOCALIDAD, BARRIO)",
    "PERIFONEO (CARRO, MOTO)",
    "PUNTO FÍSICO DIRECTO (PREGUNTÓ EN LA OFICINA TEMPORAL)",
    "RED SOCIAL (FACEBOOK, INSTAGRAM, TIKTOK)",
    "REFERENCIADO POR ALGUIEN QUE YA TRABAJA/O EN LA TEMPORAL",
    "VOLANTES (A PIE)",
    "YA HABÍA TRABAJADO CON NOSOTROS"
  ];

  meses = Array.from({ length: 11 }, (_, i) => i + 1);  // 1..11
  anios = Array.from({ length: 80 }, (_, i) => i + 1);  // 1..80

  // Usa el formulario real (no uno “any” sin inicializar)
  get tiempoResidenciaParsed() {
    const v = this.infoPersonalForm?.value?.tiempoResidencia as string | null;
    if (!v) return null;
    if (v === 'LIFETIME') return { unit: 'LIFETIME', quantity: null, label: 'Toda la vida' };
    const [u, q] = v.split(':');
    const n = Number(q);
    if (u === 'M') return { unit: 'MONTH', quantity: n, label: `${n} ${n === 1 ? 'mes' : 'meses'}` };
    if (u === 'Y') return { unit: 'YEAR', quantity: n, label: `${n} ${n === 1 ? 'año' : 'años'}` };
    return null;
  }

  // Lista estado civil
  estadosCiviles: any[] = [
    { codigo: 'SO', descripcion: 'SO (Soltero)' },
    { codigo: 'UL', descripcion: 'UL (Unión Libre) ' },
    { codigo: 'CA', descripcion: 'CA (Casado)' },
    { codigo: 'SE', descripcion: 'SE (Separado)' },
    { codigo: 'VI', descripcion: 'VI (Viudo)' },
  ];

  vacantes: PublicacionDTO[] = [];
  vacanteSeleccionada: PublicacionDTO | null = null;

  selectedVacanteId: number | null = null;

  constructor(
    private fb: FormBuilder,
    private hiringService: HiringService,
    private seleccionService: SeleccionService,
    private utilityService: UtilityServiceService,
    private gestionDocumentalService: GestionDocumentalService,
    private infoVacantesService: InfoVacantesService,
    private vacantesService: VacantesService
  ) {

    this.formGroup4 = this.fb.group({
      empresaUsuaria: [''],
      fechaIngreso: [null],
      salario: [''],
      auxTransporte: [''],
      rodamiento: [''],
      auxMovilidad: [''],
      bonificacion: ['']
    });

    // Formulario 1: Info personal
    this.infoPersonalForm = this.fb.group({
      // ORIGINALES
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

      // CAMPOS ADICIONALES
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
      // ← boolean | null
      estudiaActualmente: [null as boolean | null, Validators.required],

      experiencias: this.fb.array([]),
      observacionEvaluador: [''],
      motivoEspera: [''],
    });

    // Formulario 2: Vacantes
    this.vacantesForm = this.fb.group({
      tipo: ['', Validators.required],
      empresaUsuaria: [''],
      cargo: [''],
      area: [''],
      fechaIngreso: [''],
      salario: [''],
      fechaPruebaEntrevista: [''],
      horaPruebaEntrevista: [''],
      direccionEmpresa: ['']
    });

    if (this.experienciasFA.length === 0) this.seedExperiencias();

    // === Reglas dinámicas ===
    // 1) Motivo no aplica
    this.infoPersonalForm.get('aplicaObservacion')!.valueChanges.subscribe(val => {
      const motivo = this.infoPersonalForm.get('motivoNoAplica');
      if (val === 'NO_APLICA') {
        motivo?.setValidators([Validators.required]);
      } else {
        motivo?.clearValidators();
        motivo?.setValue('');
      }
      motivo?.updateValueAndValidity();
    });

    // 2) Hijos
    this.infoPersonalForm.get('tieneHijos')?.valueChanges.subscribe((tiene: boolean) => {
      const cuidador = this.infoPersonalForm.get('cuidadorHijos');
      const num = this.infoPersonalForm.get('numeroHijos');

      if (tiene) {
        cuidador?.addValidators([Validators.required, Validators.maxLength(120)]);
        num?.addValidators([Validators.required, Validators.min(1)]);
      } else {
        cuidador?.clearValidators();
        cuidador?.setValue('');
        num?.clearValidators();
        num?.setValue(0, { emitEvent: true });
        this.setHijosCount(0);
      }
      cuidador?.updateValueAndValidity();
      num?.updateValueAndValidity();
    });

    // Sincronizar numHijos <-> numeroHijos
    this.infoPersonalForm.get('numHijos')?.valueChanges.subscribe(n => {
      const parsed = Number(n) || 0;
      const actual = this.infoPersonalForm.get('numeroHijos')?.value ?? 0;
      if (actual !== parsed) this.infoPersonalForm.get('numeroHijos')?.setValue(parsed, { emitEvent: false });
      this.setHijosCount(parsed);
    });

    this.infoPersonalForm.get('numeroHijos')?.valueChanges.subscribe(n => {
      const parsed = Number(n) || 0;
      const actual = this.infoPersonalForm.get('numHijos')?.value ?? 0;
      if (actual !== parsed) this.infoPersonalForm.get('numHijos')?.setValue(parsed, { emitEvent: false });
      this.setHijosCount(parsed);
    });

    // 3) Experiencia flores
    this.infoPersonalForm.get('experienciaFlores')?.valueChanges.subscribe(val => {
      const tipo = this.infoPersonalForm.get('tipoExperienciaFlores');
      const otro = this.infoPersonalForm.get('otroExperiencia');

      if (val === 'Sí') {
        tipo?.setValidators([Validators.required]);
      } else {
        tipo?.setValue('');
        otro?.setValue('');
        tipo?.clearValidators();
        otro?.clearValidators();
      }
      tipo?.updateValueAndValidity();
      otro?.updateValueAndValidity();

      const tieneCtrl = this.infoPersonalForm.get('tieneExperienciaFlores');
      if (tieneCtrl && tieneCtrl.value !== val) {
        tieneCtrl.setValue(val, { emitEvent: false });
      }
    });

    this.infoPersonalForm.get('tipoExperienciaFlores')?.valueChanges.subscribe(value => {
      const otro = this.infoPersonalForm.get('otroExperiencia');
      if (value === 'OTROS') {
        otro?.setValidators([Validators.required, Validators.maxLength(64)]);
      } else {
        otro?.setValue('');
        otro?.clearValidators();
      }
      otro?.updateValueAndValidity();
    });

    // 4) Edad desde fechaNacimiento
    this.infoPersonalForm.get('fechaNacimiento')?.valueChanges.subscribe((f: any) => {
      const edad = this.calcEdad(f);
      this.infoPersonalForm.get('edad')?.setValue(edad, { emitEvent: false });
    });

    // 5) Armar nombreCompleto
    ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido'].forEach(ctrl => {
      this.infoPersonalForm.get(ctrl)?.valueChanges.subscribe(() => {
        const v = this.infoPersonalForm.value;
        const full = [v.primerNombre, v.segundoNombre, v.primerApellido, v.segundoApellido]
          .filter(Boolean).join(' ').trim();
        this.infoPersonalForm.get('nombreCompleto')?.setValue(full, { emitEvent: false });
      });
    });
  }

  ngOnInit(): void {
    const user = this.utilityService.getUser();
    if (!user) {
      Swal.fire('Error', 'No se encontró información del usuario', 'error');
      return;
    }

    this.vacantesService.getVacantesPorOficina(user.sede.nombre)
      .subscribe((vacantes: PublicacionDTO[]) => {
        this.setVacantes(vacantes ?? []);
      });

    // (duplicado defensivo por si el form viene ya con valor)
    this.infoPersonalForm.get('aplicaObservacion')!.updateValueAndValidity();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cedula'] && this.cedula) {
      this.buscarContratacion();

      this.seleccionService.getSeleccion(this.cedula).subscribe((seleccion: any) => {
        const procesos = Array.isArray(seleccion?.procesoSeleccion) ? seleccion.procesoSeleccion : [];
        if (!procesos.length) return;

        const maxProceso = procesos.reduce((acc: any, it: any) => !acc || (it?.id ?? -Infinity) > acc.id ? it : acc, null);
        const vacanteId = Number(maxProceso?.vacante);
        if (!vacanteId) return;

        if (this.vacantes?.length) {
          this.onVacanteIdChange(vacanteId);
        } else {
          this.pendingVacanteId = vacanteId; // se aplicará en setVacantes()
        }
      });
    }
  }

  get experienciasFA(): FormArray {
    return this.infoPersonalForm.get('experiencias') as FormArray;
  }
  get hijosFormArray(): FormArray {
    return this.infoPersonalForm.get('hijos') as FormArray;
  }

  // ===== Hijos (FormArray) =====
  private setHijosCount(n: number): void {
    const fa = this.hijosFormArray;
    while (fa.length < n) fa.push(this.fb.group({ edad: ['', Validators.required] }));
    while (fa.length > n) fa.removeAt(fa.length - 1);
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
    // Campo “edadesHijos” si lo necesitas mostrar
    const edades = (hijos || []).map(x => x?.edad).filter(e => e != null).join(', ');
    this.infoPersonalForm.get('edadesHijos')?.setValue(edades);
  }

  /** ===== Experiencias (FormArray) ===== */
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
      // si no hay datos, deja semillas
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

  // ===== Utilidades =====
  private calcEdad(f?: any): string {
    if (!f) return '';
    const d = new Date(f), h = new Date();
    let e = h.getFullYear() - d.getFullYear();
    const m = h.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < d.getDate())) e--;
    return String(e);
  }

  LABELS_INFO: Record<string, string> = {
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

  private buildInvalidList(): { html: string; firstKey?: string } {
    const f = this.infoPersonalForm;
    const lines: string[] = [];
    let firstKey: string | undefined;

    const push = (key: string, msg: string) => {
      if (!firstKey) firstKey = key;
      lines.push(`<li><b>${this.LABELS_INFO[key] ?? key}:</b> ${msg}</li>`);
    };

    Object.entries(f.controls).forEach(([key, control]) => {
      if (!control || control.valid) return;
      const errors = control.errors || {};

      if (errors['required']) push(key, 'es obligatorio.');
      if (errors['pattern']) {
        if (key === 'celular' || key === 'whatsapp') {
          push(key, 'formato inválido (debe iniciar con 3 y tener 10 dígitos).');
        } else {
          push(key, 'formato inválido.');
        }
      }
      if (errors['minlength']) push(key, `mínimo ${errors['minlength'].requiredLength} caracteres.`);
      if (errors['maxlength']) push(key, `máximo ${errors['maxlength'].requiredLength} caracteres.`);
      if (errors['min']) push(key, `debe ser al menos ${errors['min'].min}.`);
      if (errors['max']) push(key, `debe ser como máximo ${errors['max'].max}.`);
    });

    // Reglas condicionales
    const exp = f.get('experienciaFlores')?.value;
    if (exp === 'Sí') {
      if (!f.get('tipoExperienciaFlores')?.value) {
        push('tipoExperienciaFlores', 'es obligatorio cuando hay experiencia en flores.');
      } else if (f.get('tipoExperienciaFlores')?.value === 'OTROS' &&
        !String(f.get('otroExperiencia')?.value || '').trim()) {
        push('otroExperiencia', 'es obligatorio cuando el tipo es "OTROS".');
      }
    }

    if (f.get('referenciado')?.value === 'SI' &&
      !String(f.get('nombreReferenciado')?.value || '').trim()) {
      push('nombreReferenciado', 'es obligatorio cuando "Referenciado" es "Sí".');
    }

    if (f.get('tieneHijos')?.value === true) {
      if (!String(f.get('cuidadorHijos')?.value || '').trim()) {
        push('cuidadorHijos', 'es obligatorio cuando "¿Tiene hijos?" es "Sí".');
      }
      const nH = Number(f.get('numeroHijos')?.value ?? 0);
      if (!nH || nH < 1) push('numeroHijos', 'debe ser al menos 1 cuando "¿Tiene hijos?" es "Sí".');
      const hijosFA = f.get('hijos') as FormArray;
      if (hijosFA && hijosFA.length) {
        hijosFA.controls.forEach((grp, idx) => {
          const edadCtrl = (grp as FormGroup).get('edad');
          if (!edadCtrl?.value && edadCtrl?.touched) push('hijos', `falta la edad del hijo #${idx + 1}.`);
        });
      }
    }

    if (f.get('observacionEvaluador')?.value === 'ESPERA DE VACANTE') {
      const motivo = String(f.get('motivoEspera')?.value || '');
      if (!motivo.trim()) push('motivoEspera', 'es obligatorio cuando la observación es "ESPERA DE VACANTE".');
      else if (motivo.length > 300) push('motivoEspera', 'máximo 300 caracteres.');
    }

    if (f.get('aplicaObservacion')?.value === 'NO_APLICA' &&
      !String(f.get('motivoNoAplica')?.value || '').trim()) {
      push('motivoNoAplica', 'debe especificarse cuando es "NO APLICA".');
    }

    if (String(f.get('oficina')?.value || '') === 'BRIGADA' &&
      !String(f.get('brigadaDe')?.value || '').trim()) {
      push('brigadaDe', 'es obligatorio cuando la oficina es "BRIGADA".');
    }

    const html = lines.length
      ? `<ul style="text-align:left;margin:0;padding-left:18px;">${lines.join('')}</ul>`
      : '';
    return { html, firstKey };
  }

  private scrollToControl(key?: string) {
    if (!key) return;
    const el = document.querySelector(`[formcontrolname="${key}"]`) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => el.focus(), 200);
    }
  }

  guardarInfoPersonal(): void {
    if (this.infoPersonalForm.invalid) {
      this.infoPersonalForm.markAllAsTouched();
      const { html, firstKey } = this.buildInvalidList();
      Swal.fire({ title: 'Revisa la información', html: html || 'Por favor, completa los campos obligatorios.', icon: 'warning', confirmButtonText: 'Entendido' })
        .then(() => this.scrollToControl(firstKey));
      return;
    }

    const { html, firstKey } = this.buildInvalidList();
    if (html) {
      Swal.fire({ title: 'Faltan datos', html, icon: 'warning', confirmButtonText: 'Entendido' })
        .then(() => this.scrollToControl(firstKey));
      return;
    }

    const info: any = { ...this.infoPersonalForm.value, id: this._idInfoEntrevistaAndrea };

    const toYMD = (v: any) => {
      if (!v) return v;
      if (v instanceof Date) {
        const yyyy = v.getFullYear();
        const mm = String(v.getMonth() + 1).padStart(2, '0');
        const dd = String(v.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }
      if (typeof v === 'string' && v.length > 10) return v.slice(0, 10);
      return v;
    };
    info.fechaNacimiento = toYMD(info.fechaNacimiento);
    info.fechaExpedicion = toYMD(info.fechaExpedicion);

    Object.keys(info).forEach(k => { if (typeof info[k] === 'string') info[k] = info[k].toUpperCase(); });
    info.estudiaActualmente = this.toSiNo(this.infoPersonalForm.value.estudiaActualmente);

    this.seleccionService.guardarInfoPersonal(info).subscribe({
      next: (resp) => {
        Swal.fire({ title: 'Guardado', text: 'Información personal guardada correctamente.', icon: 'success', confirmButtonText: 'Ok' });
        if (resp && resp.id) {
          this.infoVacantesService
            .setEstadoVacanteAplicante(this._idInfoEntrevistaAndrea, 'entrevistado', true)
            .subscribe({ next: () => { }, error: () => { } });
        }
      },
      error: (err) => {
        const msg = err?.error?.detail || 'No se pudo guardar la información personal.';
        Swal.fire({ title: 'Error', text: msg, icon: 'error', confirmButtonText: 'Ok' });
      }
    });
  }

  private toSiNo(v: boolean | null): 'SI' | 'NO' | null {
    return v == null ? null : (v ? 'SI' : 'NO');
  }

  onVacanteIdChange(id: number | string): void {
    const idNum = Number(id);
    this.selectedVacanteId = idNum;
    const v = this.vacantes?.find(x => Number(x.id) === idNum) || null;
    this.vacanteSeleccionada = v;
    if (v) this.patchVacanteToForm(v);
  }

  emitirIdSiSeleccionado(): void {
    if (typeof this.selectedVacanteId === 'number') this.idVacante.emit(this.selectedVacanteId);
  }
  /** Normaliza texto: minúsculas, sin tildes, trim. */
  private norm(s: any): string {
    return (s ?? '')
      .toString()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  /** De API → UI (Form): "Prueba"/"Contratación" → "Prueba técnica"/"Autorización de ingreso" */
  private mapApiTipoToForm(apiVal: any): '' | 'Prueba técnica' | 'Autorización de ingreso' {
    const t = this.norm(apiVal);
    if (t === 'prueba' || t === 'prueba tecnica' || t === 'prueba_tecnica') return 'Prueba técnica';
    if (t.startsWith('contrat') || (t.includes('autorizacion') && t.includes('ingreso'))) return 'Autorización de ingreso';
    return '';
  }

  /** De UI (Form) → API: "Prueba técnica"/"Autorización de ingreso" → "Prueba"/"Contratación" */
  private mapFormTipoToApi(formVal: any): string {
    const t = this.norm(formVal);
    if (t === 'prueba tecnica') return 'Prueba';
    if (t === 'autorizacion de ingreso') return 'Contratación';
    return formVal ?? '';
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
    });

    this.vacantesForm.get('tipo')?.updateValueAndValidity({ emitEvent: true });
  }

  private setVacantes(lista: PublicacionDTO[]): void {
    this.vacantes = lista || [];
    if (this.pendingVacanteId != null) {
      this.onVacanteIdChange(this.pendingVacanteId);
      this.pendingVacanteId = null;
    }
  }

  parseFechaDDMMYYYY(fechaStr: any): Date | null {
    if (!fechaStr) return null;
    if (fechaStr instanceof Date) return fechaStr;
    if (/^\d{4}-\d{2}-\d{2}/.test(fechaStr)) return new Date(fechaStr);
    if (fechaStr.includes('/')) {
      const [dia, mes, anio] = fechaStr.split('/');
      if (dia && mes && anio) return new Date(+anio, +mes - 1, +dia);
    }
    return null;
  }

  private buscarContratacion(): void {
    const user = this.utilityService.getUser();
    if (!user) return;
    this.sedeLogin = user.sede.nombre;

    this.infoVacantesService.getVacantesPorNumero(this.cedula).subscribe({
      next: (resultado) => {
        const contratacion = resultado?.[0];
        if (contratacion) this.patchInfoPersonalFromApi(contratacion);
      },
      error: () => Swal.fire('Error', 'No se pudo obtener la contratación', 'error')
    });
  }

  private patchInfoPersonalFromApi(data: any): void {
    const expTxt = (data?.cuenta_experiencia_flores ?? '').toString().trim();
    const expSi = this.boolFromText(expTxt) === true;
    const experienciaFlores = expSi ? 'Sí' : (expTxt ? 'No' : '');

    const municipioExp = data?.municipio_expedicion ?? data?.municipioExpedicion ?? '';
    const nombreCompleto = [data?.primer_nombre, data?.segundo_nombre, data?.primer_apellido, data?.segundo_apellido]
      .filter(Boolean).join(' ').trim();
    console.log(data)
    this.infoPersonalForm.patchValue({
      tipodedocumento: data?.tipo_documento ?? '',
      numerodecedula: data?.numero ?? this.cedula ?? '',
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

    // Hijos desde backend (centralizado)
    this.setHijosDesdeBackend(Array.isArray(data?.hijos) ? data.hijos : []);

    // Experiencias desde backend (acepta varias llaves)
    const rawExp =
      Array.isArray(data?.experiencias) ? data.experiencias :
        Array.isArray(data?.experiencia_laboral) ? data.experiencia_laboral :
          Array.isArray(data?.experiencias_laborales) ? data.experiencias_laborales :
            [];
    this.setExperienciasDesdeBackend(rawExp);

    this.infoPersonalForm.get('motivoNoAplica')?.updateValueAndValidity();
  }

  private toDate(v: any): Date | null {
    if (!v) return null;
    return v instanceof Date ? v : new Date(String(v));
  }

  private boolFromText(v: any): boolean | null {
    if (v === true || v === false) return v;
    if (v == null) return null;
    const s = String(v).trim().toLowerCase();
    if (s === 'true' || s === 'sí' || s === 'si' || s === '1') return true;
    if (s === 'false' || s === 'no' || s === '0') return false;
    return null;
  }

  guardarEntrevista(): void {
    if (this.infoPersonalForm.invalid) {
      this.infoPersonalForm.markAllAsTouched();
      Swal.fire('Error', 'Debes completar todos los campos obligatorios de la entrevista.', 'error');
      return;
    }
    const payload = { ...this.infoPersonalForm.value, numero: this.cedula };
    this.seleccionService.guardarEntrevista(payload).subscribe({
      next: () => Swal.fire('Guardado', 'Información de entrevista guardada correctamente.', 'success'),
      error: () => Swal.fire('Error', 'No se pudo guardar la información de la entrevista.', 'error')
    });
  }

  async guardarVacantes(): Promise<void> {
    if (this.vacantesForm.invalid) {
      this.vacantesForm.markAllAsTouched();
      await Swal.fire('Error', 'Debes completar todos los campos obligatorios.', 'error');
      return;
    }

    const normDate = (v: any): string => {
      if (!v) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      const s = String(v);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const m = s.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
      if (m) return s; // por si llega "HH:MM:SS" como fecha (defensivo)
      const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m2) {
        const [_, d, mo, y] = m2;
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      const d2 = new Date(s);
      return isNaN(d2.getTime()) ? '' : d2.toISOString().slice(0, 10);
    };
    const normTime = (v: any): string | null => {
      if (!v) return null;
      const s = String(v).trim();
      const m = s.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return null;
      const hh = String(Math.min(23, Math.max(0, +m[1]))).padStart(2, '0');
      const mm = String(Math.min(59, Math.max(0, +m[2]))).padStart(2, '0');
      return `${hh}:${mm}`;
    };

    const fv: any = { ...this.vacantesForm.value, id: this._idInfoEntrevistaAndrea };
    Object.keys(fv).forEach(key => { if (typeof fv[key] === 'string') fv[key] = fv[key].toUpperCase(); });

    const payloadVacante = {
      numerodeceduladepersona: String(this.cedula).trim(),
      tipo: fv.tipo ?? '',
      centro_costo_entrevista: fv.empresaUsuaria ?? '',
      cargo: fv.cargo ?? '',
      area_entrevista: fv.area ?? '',
      fecha_prueba_entrevista: normDate(fv.fechaPruebaEntrevista),
      hora_prueba_entrevista: normTime(fv.horaPruebaEntrevista),
      direccion_empresa: fv.direccionEmpresa ?? '',
      fechaIngreso: normDate(fv.fechaIngreso),
      salario: fv.salario != null ? String(fv.salario) : '',
      vacante: this.vacanteSeleccionada?.id ?? (fv.vacante ?? null)
    };

    Swal.fire({ title: 'Guardando…', text: 'Procesando información de vacantes.', icon: 'info', allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });

    try {
      const respParte2: any = await firstValueFrom(
        this.seleccionService.crearSeleccionParteDosCandidato(this.vacantesForm, this.cedula, this._idProcesoSeleccion)
      );
      if (respParte2?.id && !this.idProcesoSeleccion) {
        this.idProcesoSeleccion = respParte2.id;
      }

      const respGuardar: any = await firstValueFrom(this.seleccionService.guardarVacantes(payloadVacante));
      Swal.close();

      if (respGuardar && respGuardar.id) {
        this.infoVacantesService.setEstadoVacanteAplicante(this._idInfoEntrevistaAndrea, 'prueba_tecnica', true)
          .subscribe({ next: () => { }, error: () => { } });
      }

      if (this.vacanteSeleccionada?.id) {
        this.vacantesService.setEstadoVacanteAplicante(this.vacanteSeleccionada.id, 'preseleccionado', this.cedula)
          .subscribe({ next: () => { }, error: () => { } });

        this.seleccionService.setVacante(this.cedula, this.vacanteSeleccionada.id)
          .subscribe({ next: () => { }, error: () => { } });

        this.emitirIdSiSeleccionado?.();
      }

      await Swal.fire({ icon: 'success', title: 'Guardado', text: 'Información de vacantes guardada correctamente.' });

    } catch (err: any) {
      console.error('guardarVacantes error:', err);
      Swal.close();
      await Swal.fire({ icon: 'error', title: 'Error', text: err?.error?.detail || err?.message || 'No se pudo guardar la información de vacantes.' });
    }
  }

  convertirAFecha(fecha: string): Date | null {
    if (/^\d+$/.test(fecha)) {
      const diasDesde1900 = Number(fecha);
      const fechaBase = new Date(1900, 0, 1);
      fechaBase.setDate(fechaBase.getDate() + diasDesde1900);
      return isNaN(fechaBase.getTime()) ? null : fechaBase;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha)) {
      const [dia, mes, anio] = fecha.split('/').map(Number);
      const fechaValida = new Date(anio, mes - 1, dia);
      return isNaN(fechaValida.getTime()) ? null : fechaValida;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const fechaValida = new Date(fecha);
      return isNaN(fechaValida.getTime()) ? null : fechaValida;
    } else {
      return null;
    }
  }

  calcularEdad(fecha: string): number {
    const fechaNacimiento = this.convertirAFecha(fecha);
    if (!fechaNacimiento) return NaN;
    const today = new Date();
    let age = today.getFullYear() - fechaNacimiento.getFullYear();
    const monthDiff = today.getMonth() - fechaNacimiento.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < fechaNacimiento.getDate())) age--;
    return age;
  }

  getPercentage(formGroup: FormGroup): number {
    const totalFields = Object.keys(formGroup.controls).length;
    const filledFields = Object.values(formGroup.controls).filter(control => {
      const value = control.value;
      if (Array.isArray(value)) return value.length > 0;
      return value !== null && value !== undefined && value !== '';
    }).length;
    return Math.round((filledFields / totalFields) * 100);
  }

  imprimirContratacion(): void {
    this.seleccionService.crearSeleccionParteCuatroCandidato(this.formGroup4.value, this.cedula, this.codigoContrato).subscribe(
      response => {
        if (response.message === 'success') {
          Swal.fire({ title: '¡Éxito!', text: 'Datos guardados exitosamente', icon: 'success', confirmButtonText: 'Ok' });
        }
      },
      () => Swal.fire({ title: '¡Error!', text: 'Error al guardar los datos', icon: 'error', confirmButtonText: 'Ok' })
    );
  }

  isAutorizacion(): boolean {
    return this.vacantesForm.get('tipo')?.value === 'Autorización de ingreso';
  }
  isPrueba(): boolean {
    return this.vacantesForm.get('tipo')?.value === 'Prueba técnica';
  }
  onTipoChange(tipo: string): void {
    if (tipo === 'Autorización de ingreso') {
      this.vacantesForm.patchValue({ area: '', fechaPruebaEntrevista: '', horaPruebaEntrevista: '', direccionEmpresa: '' });
    } else if (tipo === 'Prueba técnica') {
      this.vacantesForm.patchValue({ fechaIngreso: '', salario: '' });
    }
  }

  // KPIs
  totalRequerida(v: any): number {
    const oficinas = Array.isArray(v?.oficinasQueContratan) ? v.oficinasQueContratan : [];
    return oficinas.reduce((acc: number, o: any) => acc + this.toInt(o?.numeroDeGenteRequerida), 0);
  }
  countPre(v: any): number {
    const p = v?.preseleccionados;
    if (Array.isArray(p)) return p.length;
    return this.toInt(p);
  }
  countCont(v: any): number {
    const c = v?.contratados;
    if (Array.isArray(c)) return c.length;
    return this.toInt(c);
  }
  pillClasePre(v: any): string {
    const req = this.totalRequerida(v);
    const pre = this.countPre(v);
    return pre >= req ? 'pill-ok' : 'pill-error';
  }
  pillClaseCont(v: any): string {
    const req = this.totalRequerida(v);
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
  private toInt(v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string') {
      const m = v.match(/-?\d+/);
      return m ? parseInt(m[0], 10) : 0;
    }
    return 0;
  }
  private buildExperienciaGroup(required = true): FormGroup {
    return this.fb.group({
      empresa: ['', required ? [Validators.required, Validators.maxLength(120)] : [Validators.maxLength(120)]],
      labores: ['', required ? [Validators.required, Validators.maxLength(800)] : [Validators.maxLength(800)]],
      tiempo: ['', required ? [Validators.required, Validators.maxLength(80)] : [Validators.maxLength(80)]],
      labores_principales: ['', required ? [Validators.required, Validators.maxLength(800)] : [Validators.maxLength(800)]],
    });
  }
  private seedExperiencias(n = this.SEED_EXP_COUNT): void {
    const fa = this.experienciasFA;
    while (fa.length < n) fa.push(this.buildExperienciaGroup(false));
  }

  readonly MAX_EXP = 12;

  agregarExperiencia(prefill?: Partial<{ empresa: string; tiempo: string; labores: string; labores_principales: string }>) {
    const fa = this.experienciasFA;

    if (fa.length >= this.MAX_EXP) {
      Swal.fire('Límite alcanzado', `Máximo ${this.MAX_EXP} experiencias.`, 'info');
      return;
    }

    const grp = this.buildExperienciaGroup(false); // sin requeridos por defecto
    if (prefill) {
      grp.patchValue({
        empresa: prefill.empresa ?? '',
        tiempo: prefill.tiempo ?? '',
        labores: prefill.labores ?? '',
        labores_principales: prefill.labores_principales ?? (prefill as any)?.laboresPrincipales ?? '',
      });
    }

    fa.push(grp);
    this.infoPersonalForm.markAsDirty();

    // (Opcional) enfocar el primer input de la nueva tarjeta
    setTimeout(() => {
      try {
        const el = document.querySelector(
          `[formarrayname="experiencias"] .card:last-of-type input[formcontrolname="empresa"]`
        ) as HTMLInputElement | null;
        el?.focus();
      } catch { }
    }, 0);
  }
}
