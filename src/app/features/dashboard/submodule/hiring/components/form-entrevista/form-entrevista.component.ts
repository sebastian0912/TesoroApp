import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  OnInit,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ValidatorFn,
  AbstractControl,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { DateAdapter } from '@angular/material/core';
import { ActivatedRoute } from '@angular/router';
import { Observable, firstValueFrom, map, startWith, take } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import Swal from 'sweetalert2';

import colombia from '../../../../../../data/colombia.json';
import { SharedModule } from '@/app/shared/shared.module';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { RegistroProcesoContratacion } from '../../service/registro-proceso-contratacion/registro-proceso-contratacion';
import {
  GestionParametrizacionService,
  CatalogValue,
} from '../../../users/services/gestion-parametrizacion/gestion-parametrizacion.service';

@Component({
  selector: 'app-form-entrevista',
  standalone: true,
  imports: [MatIconModule, SharedModule],
  templateUrl: './form-entrevista.component.html',
  styleUrls: ['./form-entrevista.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormEntrevistaComponent implements OnInit {
  // ====== Inputs / Servicios ======
  candidatoSeleccionado = input<any | null>(null);

  private readonly fb = inject(FormBuilder);
  private readonly dateAdapter = inject<DateAdapter<Date>>(
    DateAdapter as any
  );
  private readonly route = inject(ActivatedRoute);
  private readonly util = inject(UtilityServiceService);
  private readonly candidateService = inject(RegistroProcesoContratacion);
  private readonly catalogos = inject(GestionParametrizacionService);

  // ====== Catálogos ======
  tipoDocOpciones$: Observable<CatalogValue[]> =
    this.catalogos.listDatosByTablaCodigo('TIPOS_IDENTIFICACION', {
      activo: true,
    });

  escolaridadOpciones$: Observable<CatalogValue[]> =
    this.catalogos.listDatosByTablaCodigo('NIVELES_ESCOLARIDAD', {
      activo: true,
    });

  estadoCivilOpciones$: Observable<CatalogValue[]> =
    this.catalogos.listDatosByTablaCodigo('ESTADOS_CIVILES', {
      activo: true,
    });

  conQuienViveOpciones$: Observable<CatalogValue[]> = this.catalogos
    .listDatosByTablaCodigo('CATALOGO_CON_QUIEN_VIVE', { activo: true })
    .pipe(
      map((opts) => {
        const seen = new Set<string>();
        return (opts ?? []).filter((o) => {
          const k = String(o['codigo'] ?? '').trim().toUpperCase();
          if (!k || seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      })
    );

  dominioCorreoOpciones$: Observable<CatalogValue[]> =
    this.catalogos.listDatosByTablaCodigo('DOMINIOS', { activo: true });

  comoSeEnteroOpciones$: Observable<CatalogValue[]> =
    this.catalogos.listDatosByTablaCodigo('CATALOGO_MARKETING', {
      activo: true,
    });

  // ====== Form / estado ======
  formVacante!: FormGroup;
  isSubmitting = false;
  lockedOffice?: string;

  // Agrupadores lógicos (ex "steps") para validación seccional
  step1Ctrl = new FormGroup({});
  step2Ctrl = new FormGroup({});
  step3Ctrl = new FormGroup({});
  step4Ctrl = new FormGroup({});
  step5Ctrl = new FormGroup({});
  step6Ctrl = new FormGroup({});
  step7Ctrl = new FormGroup({});

  // Auxiliares
  readonly emailUserPattern = '^[^@\\s]+$';
  readonly otroExperienciaControl = new FormControl('', [
    Validators.maxLength(64),
  ]);

  // Autocomplete ciudades
  allCities: string[] = [];
  filteredCities$!: Observable<string[]>;
  filteredCitiesNacimiento$!: Observable<string[]>;

  // Listas fijas
  readonly SEED_EXP_COUNT = 0;
  readonly meses = Array.from({ length: 11 }, (_, i) => i + 1);
  readonly anios = Array.from({ length: 80 }, (_, i) => i + 1);
  readonly sexos = ['M', 'F'] as const;
  readonly oficinas = [
    'VIRTUAL',
    'ADMINISTRATIVOS',
    'CARTAGENITA',
    'FACA_PRIMERA',
    'FACA_PRINCIPAL',
    'FONTIBÓN',
    'FORANEOS',
    'FUNZA',
    'MADRID',
    'ROSAL',
    'SOACHA',
    'SUBA',
    'TOCANCIPÁ',
    'ZIPAQUIRÁ',
    'BRIGADA',
  ] as const;

  // Campos usados para validar cada bloque
  private readonly step1Fields = [
    'oficina',
    'tipo_doc',
    'numero_documento',
    'fecha_expedicion',
    'mpio_expedicion',
  ];
  private readonly step2Fields = [
    'primer_apellido',
    'primer_nombre',
    'fecha_nacimiento',
    'mpio_nacimiento',
    'sexo',
    'estado_civil',
  ];
  private readonly step3Fields = [
    'barrio',
    'celular',
    'whatsapp',
    'personas_con_quien_convive',
    'hace_cuanto_vive',
  ];

  constructor() {
    this.dateAdapter.setLocale('es-CO');

    // =======================
    // Definición del form
    // =======================
    this.formVacante = this.fb.group({
      // Identificación / documento
      oficina: ['', Validators.required],
      tipo_doc: ['', Validators.required],
      numero_documento: [
        '',
        [
          Validators.required,
          Validators.pattern(/^X?\d+$/i),
          Validators.minLength(6),
          Validators.maxLength(15),
        ],
      ],
      fecha_expedicion: ['', Validators.required],
      mpio_expedicion: ['', Validators.required],

      // Datos personales
      primer_apellido: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(30),
        ],
      ],
      segundo_apellido: ['', [Validators.maxLength(30)]],
      primer_nombre: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(30),
        ],
      ],
      segundo_nombre: ['', [Validators.maxLength(30)]],
      fecha_nacimiento: ['', Validators.required],
      edad: [{ value: '', disabled: true }],
      mpio_nacimiento: ['', Validators.required],
      sexo: ['', Validators.required],
      estado_civil: ['', Validators.required],

      // Contacto / domicilio
      barrio: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(40),
        ],
      ],
      celular: ['', [Validators.required, Validators.pattern(/^3\d{9}$/)]],
      whatsapp: [
        '',
        [
          Validators.required,
          Validators.pattern(/^3\d{9}$/),
          Validators.maxLength(10),
        ],
      ],
      personas_con_quien_convive: [
        [],
        [Validators.required, this.minLengthArray(1)],
      ],
      hace_cuanto_vive: ['', Validators.required],

      // Información familiar
      tieneHijos: [null, Validators.required],
      cuidadorHijos: [''],
      numeroHijos: [0],
      hijos: this.fb.array([]),

      // Formación / experiencia
      nivel: [null, Validators.required],
      estudiaActualmente: [null, Validators.required],
      proyeccion1Ano: ['', Validators.required],
      experienciaFlores: ['', Validators.required],
      tipoExperienciaFlores: [''],
      otroExperiencia: this.otroExperienciaControl,

      // Historial laboral
      experiencias: this.fb.array([]),

      // Entrevista
      comoSeEntero: ['', [Validators.maxLength(120), Validators.required]],
      referenciado: [null, Validators.required], // 'SI' | 'NO'
      nombreReferenciado: ['', [Validators.maxLength(120)]],
      aplicaObservacion: ['', Validators.required], // 'APLICA' | 'NO_APLICA' | 'EN_ESPERA'
      motivoEspera: [''],
      motivoNoAplica: [''],

      // Aux
      brigadaDe: [''],
    });

    // =======================
    // Reacciones dinámicas
    // =======================

    // Edad calculada
    this.ctrl('fecha_nacimiento')
      .valueChanges.pipe(
        startWith(this.ctrl('fecha_nacimiento').value)
      )
      .subscribe(() => this.setEdad());

    // Hijos
    this.ctrl('tieneHijos')
      .valueChanges.pipe(startWith(this.ctrl('tieneHijos').value))
      .subscribe((tiene: boolean) => this.setupHijosValidators(!!tiene));

    this.ctrl('numeroHijos')
      .valueChanges.pipe(startWith(this.ctrl('numeroHijos').value))
      .subscribe((n: number) => this.setHijosCount(Number(n) || 0));

    // Experiencia en flores
    this.ctrl('experienciaFlores')
      .valueChanges.pipe(startWith(this.ctrl('experienciaFlores').value))
      .subscribe((val) => {
        const tipoCtrl = this.ctrl('tipoExperienciaFlores');
        if (val !== 'Sí') {
          tipoCtrl.setValue('', { emitEvent: false });
          tipoCtrl.clearValidators();
          this.otroExperienciaControl.reset('', { emitEvent: false });
          this.otroExperienciaControl.clearValidators();
        } else {
          tipoCtrl.setValidators([Validators.required]);
        }
        tipoCtrl.updateValueAndValidity({ emitEvent: false });
        this.otroExperienciaControl.updateValueAndValidity({
          emitEvent: false,
        });
        this.refreshSteps();
      });

    // Tipo de experiencia = OTROS -> obliga descripción
    this.ctrl('tipoExperienciaFlores')
      .valueChanges.pipe(startWith(this.ctrl('tipoExperienciaFlores').value))
      .subscribe((value) => {
        if (value === 'OTROS') {
          this.otroExperienciaControl.setValidators([
            Validators.required,
            Validators.maxLength(64),
          ]);
        } else {
          this.otroExperienciaControl.reset('', { emitEvent: false });
          this.otroExperienciaControl.clearValidators();
        }
        this.otroExperienciaControl.updateValueAndValidity({
          emitEvent: false,
        });
        this.refreshSteps();
      });

    // Referenciado -> nombreReferenciado requerido si "SI"
    this.ctrl('referenciado')
      .valueChanges.pipe(startWith(this.ctrl('referenciado').value))
      .subscribe((v) => {
        const nombreRef = this.ctrl('nombreReferenciado');
        if (v === 'SI') {
          nombreRef.setValidators([
            Validators.required,
            Validators.maxLength(120),
          ]);
        } else {
          nombreRef.clearValidators();
          nombreRef.setValue('', { emitEvent: false });
        }
        nombreRef.updateValueAndValidity({ emitEvent: false });
        this.step7Ctrl.updateValueAndValidity({ emitEvent: false });
        this.refreshSteps();
      });

    // aplicaObservacion -> obliga el motivo según el caso
    this.ctrl('aplicaObservacion')
      .valueChanges.pipe(startWith(this.ctrl('aplicaObservacion').value))
      .subscribe((v) => {
        const motEsp = this.ctrl('motivoEspera');
        const motNoAp = this.ctrl('motivoNoAplica');

        if (v === 'EN_ESPERA') {
          motEsp.setValidators([
            Validators.required,
            Validators.maxLength(300),
          ]);
          motNoAp.clearValidators();
          motNoAp.setValue('', { emitEvent: false });
        } else if (v === 'NO_APLICA') {
          motNoAp.setValidators([
            Validators.required,
            Validators.maxLength(300),
          ]);
          motEsp.clearValidators();
          motEsp.setValue('', { emitEvent: false });
        } else if (v === 'APLICA') {
          motEsp.clearValidators();
          motEsp.setValue('', { emitEvent: false });
          motNoAp.clearValidators();
          motNoAp.setValue('', { emitEvent: false });
        } else {
          motEsp.clearValidators();
          motEsp.setValue('', { emitEvent: false });
          motNoAp.clearValidators();
          motNoAp.setValue('', { emitEvent: false });
        }

        motEsp.updateValueAndValidity({ emitEvent: false });
        motNoAp.updateValueAndValidity({ emitEvent: false });
        this.step7Ctrl.updateValueAndValidity({ emitEvent: false });
        this.refreshSteps();
      });

    // Cuando cambie el candidato seleccionado, rellenamos el form
    effect(() => {
      const cand = this.candidatoSeleccionado();
      console.log('Candidato seleccionado cambiado:', cand);
      this.rellenarForm(cand);
    });
  }

  // =======================
  // Ciclo de vida
  // =======================
  ngOnInit(): void {
    // Vinculamos controles de la sección de contacto/domicilio para refrescar validación
    this.linkStepToControls(this.step3Ctrl, this.step3Fields);

    this.hydrateOfficeFromQuery();
    this.loadCities();
    this.setupAutocomplete();
    this.setupAutocompleteNacimiento();
    this.seedExperiencias();

    // Validadores por bloque
    this.step1Ctrl.setValidators(this.makeValidator(this.step1Fields));

    this.step2Ctrl.setValidators(this.makeValidator(this.step2Fields));

    this.step3Ctrl.setValidators(this.makeValidator(this.step3Fields));

    this.step4Ctrl.setValidators(
      this.makeValidator(['tieneHijos'], () => {
        if (this.ctrl('tieneHijos').value !== true) return true;
        return (
          this.areValid(['cuidadorHijos', 'numeroHijos']) && this.hijosFA.valid
        );
      })
    );

    this.step5Ctrl.setValidators(
      this.makeValidator(
        ['nivel', 'estudiaActualmente', 'proyeccion1Ano', 'experienciaFlores'],
        () => {
          const exp = this.ctrl('experienciaFlores').value === 'Sí';
          if (!exp) return true;
          if (!this.areValid(['tipoExperienciaFlores'])) return false;
          return this.ctrl('tipoExperienciaFlores').value === 'OTROS'
            ? this.otroExperienciaControl.valid
            : true;
        }
      )
    );

    this.step6Ctrl.setValidators(() =>
      this.experienciasFA.valid ? null : { stepInvalid: true }
    );

    // Bloque de entrevista
    this.step7Ctrl.setValidators(() => {
      const val = (n: string) => (this.ctrl(n).value ?? '').toString().trim();

      // ¿Cómo se enteró?
      const comoSeEnteroOk = !!val('comoSeEntero');

      // Referenciado
      const referenciado = this.ctrl('referenciado').value;
      const nombreReferenciadoOk =
        referenciado === 'SI' ? !!val('nombreReferenciado') : true;

      // Observación evaluador
      const aplica = val('aplicaObservacion');
      let aplicaOk = false;

      if (aplica === 'EN_ESPERA') {
        const m = val('motivoEspera');
        aplicaOk = !!m && m.length <= 300;
      } else if (aplica === 'NO_APLICA') {
        const m = val('motivoNoAplica');
        aplicaOk = !!m && m.length <= 300;
      } else if (aplica === 'APLICA') {
        aplicaOk = true;
      } else {
        aplicaOk = false;
      }

      const ok = comoSeEnteroOk && nombreReferenciadoOk && aplicaOk;
      return ok ? null : { stepInvalid: true };
    });

    // Cuando cambie cualquier cosa en el formulario, refrescamos validación de las secciones
    this.formVacante.statusChanges.subscribe(() => this.refreshSteps());
    this.refreshSteps();

    // Debug opcional
    this.tipoDocOpciones$.pipe(take(1)).subscribe((opts) => {
      console.log('Opciones de tipo de documento:', opts);
    });
  }

  // =======================
  // Autocomplete ciudades
  // =======================
  private loadCities(): void {
    const list = colombia as Array<{
      id: number;
      departamento: string;
      ciudades: string[];
    }>;
    const set = new Set<string>();
    list.forEach((d) => d.ciudades?.forEach((c) => set.add(c)));
    this.allCities = Array.from(set).sort((a, b) =>
      a.localeCompare(b, 'es', { sensitivity: 'base' })
    );
  }

  get municipioCtrl() {
    return this.ctrl('mpio_expedicion');
  }
  get lugarNacimientoCtrl() {
    return this.ctrl('mpio_nacimiento');
  }

  private setupAutocomplete(): void {
    this.filteredCities$ = this.municipioCtrl.valueChanges.pipe(
      startWith(this.municipioCtrl.value || ''),
      map((v) => this.filterCities(String(v ?? '')))
    );
  }

  private setupAutocompleteNacimiento(): void {
    this.filteredCitiesNacimiento$ =
      this.lugarNacimientoCtrl.valueChanges.pipe(
        startWith(this.lugarNacimientoCtrl.value || ''),
        map((v) => this.filterCities(String(v ?? '')))
      );
  }

  private filterCities(value: string): string[] {
    const norm = (s: string) =>
      s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const q = norm(value);
    return q
      ? this.allCities.filter((c) => norm(c).includes(q)).slice(0, 50)
      : this.allCities.slice(0, 50);
  }

  onMunicipioSelected(e: MatAutocompleteSelectedEvent) {
    this.municipioCtrl.setValue(e.option.value);
  }

  onLugarNacimientoSelected(e: MatAutocompleteSelectedEvent) {
    this.lugarNacimientoCtrl.setValue(e.option.value);
  }

  // =======================
  // Hijos
  // =======================
  get hijosFA(): FormArray {
    return this.formVacante.get('hijos') as FormArray;
  }

  private buildHijoGroup(): FormGroup {
    return this.fb.group({
      numero_de_documento: [
        '',
        [
          Validators.pattern(/^\d+$/),
          Validators.minLength(6),
          Validators.maxLength(15),
        ],
      ],
      fecha_nac: [null, [Validators.required]],
    });
  }

  private setHijosCount(n: number): void {
    const fa = this.hijosFA;
    while (fa.length < n) fa.push(this.buildHijoGroup());
    while (fa.length > n) fa.removeAt(fa.length - 1);
    this.refreshSteps();
  }

  private setupHijosValidators(tiene: boolean): void {
    const cuidador = this.ctrl('cuidadorHijos');
    const num = this.ctrl('numeroHijos');

    if (tiene) {
      cuidador.addValidators([Validators.required, Validators.maxLength(120)]);
      num.addValidators([Validators.required, Validators.min(1)]);
    } else {
      cuidador.clearValidators();
      cuidador.setValue('', { emitEvent: false });

      num.clearValidators();
      num.setValue(0, { emitEvent: false });

      this.setHijosCount(0);
    }

    cuidador.updateValueAndValidity({ emitEvent: false });
    num.updateValueAndValidity({ emitEvent: false });
  }

  // =======================
  // Experiencias laborales
  // =======================
  get experienciasFA(): FormArray {
    return this.formVacante.get('experiencias') as FormArray;
  }

  addExperiencia(): void {
    this.experienciasFA.push(this.buildExperienciaGroup(true));
    this.refreshSteps();
  }

  removeExperiencia(i: number): void {
    if (i >= this.SEED_EXP_COUNT) this.experienciasFA.removeAt(i);
    this.refreshSteps();
  }

  private buildExperienciaGroup(required = true): FormGroup {
    const req = required
      ? [Validators.required, Validators.maxLength(255)]
      : [Validators.maxLength(255)];

    return this.fb.group({
      empresa: ['', req],
      tiempo_trabajado: ['', [Validators.maxLength(50)]],
      labores_realizadas: ['', [Validators.maxLength(255)]],
      labores_principales: ['', [Validators.maxLength(255)]],
    });
  }

  private seedExperiencias(n = this.SEED_EXP_COUNT): void {
    while (this.experienciasFA.length < n) {
      this.experienciasFA.push(this.buildExperienciaGroup(false));
    }
  }

  // =======================
  // Helpers de validación
  // =======================
  private ctrl(name: string) {
    return this.formVacante.get(name)!;
  }

  private areValid(keys: string[]): boolean {
    return keys.every((k) => {
      const c = this.ctrl(k);
      return !!c && (c.disabled || c.valid);
    });
  }

  private makeValidator(
    keys: string[],
    extra?: () => boolean
  ): ValidatorFn {
    return () =>
      this.areValid(keys) && (extra ? extra() : true)
        ? null
        : { stepInvalid: true };
  }

  private minLengthArray(min: number): ValidatorFn {
    return (ctrl: AbstractControl): ValidationErrors | null => {
      const v = ctrl.value as unknown;
      return Array.isArray(v) && v.length >= min
        ? null
        : { minLengthArray: { required: min } };
    };
  }

  private linkStepToControls(step: FormGroup, keys: string[]) {
    keys.forEach((k) =>
      this.ctrl(k).valueChanges.subscribe(() => {
        step.updateValueAndValidity({ onlySelf: true, emitEvent: false });
      })
    );
  }

  // Forzar validación de una sección tras patchValue
  private forceValidateStep(stepCtrl: FormGroup, keys: string[]) {
    keys.forEach((k) =>
      this.ctrl(k).updateValueAndValidity({ emitEvent: false })
    );
    stepCtrl.updateValueAndValidity({ onlySelf: true, emitEvent: false });
  }

  // Revalida todos los bloques lógicos
  refreshSteps(): void {
    this.step1Ctrl.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false,
    });
    this.step2Ctrl.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false,
    });
    this.step3Ctrl.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false,
    });
    this.step4Ctrl.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false,
    });
    this.step5Ctrl.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false,
    });
    this.step6Ctrl.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false,
    });
    this.step7Ctrl.updateValueAndValidity({
      onlySelf: true,
      emitEvent: false,
    });
  }

  private setEdad(): void {
    const v = this.ctrl('fecha_nacimiento').value;
    const d = v instanceof Date ? v : v ? new Date(v) : null;
    let edad: number | '' = '';

    if (d && !isNaN(d.getTime())) {
      const t = new Date();
      let a = t.getFullYear() - d.getFullYear();
      const m = t.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
      edad = Math.max(0, a);
    }

    this.ctrl('edad').setValue(edad, { emitEvent: false });
  }

  // =======================
  // Hidratar desde la URL (oficina)
  // =======================
  private normalizeOffice(s: string): string {
    return s
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[\s-]+/g, '_')
      .toUpperCase();
  }

  private hydrateOfficeFromQuery() {
    this.route.queryParamMap.subscribe((params) => {
      const raw = (params.get('oficina') || params.get('o') || '').trim();

      if (!raw) {
        this.ctrl('oficina').enable({ emitEvent: false });
        this.lockedOffice = undefined;
        return this.refreshSteps();
      }

      const norm = this.normalizeOffice(raw);
      const mapOficinas = new Map(
        this.oficinas.map((o) => [this.normalizeOffice(o), o])
      );
      const match = mapOficinas.get(norm);

      if (match) {
        this.ctrl('oficina').setValue(match, { emitEvent: false });
        this.ctrl('oficina').disable({ emitEvent: false });
        this.lockedOffice = match;

        if (match === 'BRIGADA') {
          const brig = params.get('brigada');
          if (brig) {
            this.ctrl('brigadaDe').setValue(brig, { emitEvent: false });
          }
        }
      }

      this.refreshSteps();
    });
  }

  // =======================
  // Rellenar el form desde el candidato seleccionado
  // =======================
  private rellenarForm(cand: any): void {
    if (!cand) return;

    const toDate = (v: any): Date | null => {
      if (!v) return null;
      const d = v instanceof Date ? v : new Date(v);
      return isNaN(d.getTime()) ? null : d;
    };

    const onlyDigits = (s: any) =>
      String(s ?? '')
        .replace(/\D+/g, '')
        .trim();

    const info_cc = cand?.info_cc ?? {};
    const residencia = cand?.residencia ?? {};
    const contacto = cand?.contacto ?? {};
    const entrevistas = Array.isArray(cand?.entrevistas)
      ? cand.entrevistas
      : [];
    const oficina = entrevistas[0]?.oficina ?? '';

    const fechaNac = toDate(cand?.fecha_nacimiento);
    const fechaExp = toDate(info_cc?.fecha_expedicion);

    console.log('Rellenando formulario con candidato:', cand);

    // 1) patchValue sin emitir eventos
    this.formVacante.patchValue(
      {
        oficina: oficina || '',
        tipo_doc: cand?.tipo_doc || '',
        numero_documento: cand?.numero_documento || '',
        fecha_expedicion: fechaExp,
        mpio_expedicion: info_cc?.mpio_expedicion || '',

        primer_apellido: cand?.primer_apellido || '',
        segundo_apellido: cand?.segundo_apellido || '',
        primer_nombre: cand?.primer_nombre || '',
        segundo_nombre: cand?.segundo_nombre || '',
        fecha_nacimiento: fechaNac,
        mpio_nacimiento: info_cc?.mpio_nacimiento || '',
        sexo: cand?.sexo || '',
        estado_civil: cand?.estado_civil || '',

        barrio: residencia?.barrio || '',
        celular: contacto?.celular || '',
        whatsapp: contacto?.whatsapp || '',
        hace_cuanto_vive: residencia?.hace_cuanto_vive || '',

        nivel: cand?.formaciones?.[0]?.nivel || '',
        proyeccion1Ano: entrevistas?.[0]?.como_se_proyecta || '',
        estudiaActualmente: !!cand?.vivienda?.estudia_actualmente,
        experienciaFlores: cand?.experiencia_resumen?.tiene_experiencia
          ? 'Sí'
          : 'No',
        tipoExperienciaFlores:
          cand?.experiencia_resumen?.area_experiencia || '',

        comoSeEntero: entrevistas?.[0]?.como_se_entero || '',
        referenciado: entrevistas?.[0]?.referenciado ? 'SI' : 'NO',
        nombreReferenciado: entrevistas?.[0]?.nombre_referenciado || '',
        aplicaObservacion:
          entrevistas?.[0]?.proceso?.aplica_o_no_aplica || '',
        motivoEspera: entrevistas?.[0]?.proceso?.motivo_espera || '',
        motivoNoAplica:
          entrevistas?.[0]?.proceso?.motivo_no_aplica || '',
      },
      { emitEvent: false }
    );

    // 2) Validar secciones inmediatamente después del patch
    this.forceValidateStep(this.step1Ctrl, this.step1Fields);
    this.forceValidateStep(this.step2Ctrl, this.step2Fields);

    // 3) Campos derivados (recalcula edad)
    this.ctrl('fecha_nacimiento').setValue(fechaNac, {
      emitEvent: true,
    });

    // 4) “¿Con quién vive?”
    const rawConvive = String(
      cand?.vivienda?.personas_con_quien_convive ?? ''
    );
    const tokens = rawConvive
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    this.conQuienViveOpciones$.pipe(take(1)).subscribe((opts) => {
      const up = (x: any) => String(x ?? '').trim().toUpperCase();
      const selectedCodes = tokens
        .map((tok) => {
          const TK = up(tok);
          const found = opts.find(
            (o) =>
              up(o['codigo']) === TK || up(o['descripcion']) === TK
          );
          return found ? String(found['codigo']) : null;
        })
        .filter((x): x is string => !!x);

      this.ctrl('personas_con_quien_convive').setValue(
        selectedCodes,
        { emitEvent: false }
      );
      this.forceValidateStep(this.step3Ctrl, this.step3Fields);
      this.refreshSteps();
    });

    // 5) Información familiar (hijos)
    const hijosArr = Array.isArray(cand?.hijos) ? cand.hijos : [];

    this.formVacante.patchValue(
      {
        tieneHijos: hijosArr.length > 0,
        cuidadorHijos: cand?.vivienda?.responsable_hijos || '',
        numeroHijos: hijosArr.length,
      },
      { emitEvent: false }
    );

    this.setHijosCount(hijosArr.length);

    hijosArr.forEach((h: any, i: number) => {
      const fg = this.hijosFA.at(i) as FormGroup;
      fg?.patchValue(
        {
          numero_de_documento: onlyDigits(h?.numero_de_documento),
          fecha_nac: toDate(h?.fecha_nac),
        },
        { emitEvent: false }
      );
    });

    // 6) Historial laboral
    const exps = Array.isArray(cand?.experiencias)
      ? cand.experiencias
      : [];
    const totalCards = Math.max(exps.length, this.SEED_EXP_COUNT);

    while (this.experienciasFA.length < totalCards) {
      this.experienciasFA.push(this.buildExperienciaGroup(false));
    }
    while (this.experienciasFA.length > totalCards) {
      this.experienciasFA.removeAt(this.experienciasFA.length - 1);
    }

    exps.forEach((e: any, i: number) => {
      (this.experienciasFA.at(i) as FormGroup)?.patchValue(
        {
          empresa: (e?.empresa ?? '').toString(),
          tiempo_trabajado: (e?.tiempo_trabajado ?? '').toString(),
          labores_realizadas: (e?.labores_realizadas ?? '').toString(),
          labores_principales: (e?.labores_principales ?? '').toString(),
        },
        { emitEvent: false }
      );
    });

    for (let i = exps.length; i < totalCards; i++) {
      (this.experienciasFA.at(i) as FormGroup)?.patchValue(
        {
          empresa: '',
          tiempo_trabajado: '',
          labores_realizadas: '',
          labores_principales: '',
        },
        { emitEvent: false }
      );
    }

    // 7) Forzar validación final de todas las secciones
    this.forceValidateStep(this.step3Ctrl, this.step3Fields);
    this.step4Ctrl.updateValueAndValidity({ emitEvent: false });
    this.step5Ctrl.updateValueAndValidity({ emitEvent: false });
    this.step6Ctrl.updateValueAndValidity({ emitEvent: false });
    this.step7Ctrl.updateValueAndValidity({ emitEvent: false });

    // 8) Recalcular el formulario completo
    this.formVacante.updateValueAndValidity({ emitEvent: false });
    this.refreshSteps();
  }

  // =======================
  // Helpers de formato
  // =======================

  // Siempre devolver fechas como 'YYYY-MM-DD' o null
  private toYMD(value: any): string | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');

    return `${y}-${m}-${day}`;
  }

  private normalizeDocForSubmit(tipo: string, raw: any): string {
    const digits = String(raw ?? '').replace(/\D+/g, '').trim();
    return !digits ? digits : tipo === 'CC' ? digits : `X${digits}`;
  }

  // =======================
  // Submit
  // =======================
  async onSubmit() {
    console.log('onSubmit llamado');

    if (this.isSubmitting) return;

    if (this.formVacante.invalid) {
      this.formVacante.markAllAsTouched();
      await Swal.fire(
        'Error',
        'Por favor complete todos los campos requeridos.',
        'error'
      );
      return;
    }

    this.isSubmitting = true;
    try {
      const raw = this.formVacante.getRawValue();

      // Normalizamos payload antes de enviarlo
      const payload = {
        ...raw,

        // Documento con regla X + dígitos si no es CC
        numero_documento: this.normalizeDocForSubmit(
          raw.tipo_doc,
          raw.numero_documento
        ),

        // Fechas principales en YYYY-MM-DD
        fecha_expedicion: this.toYMD(raw.fecha_expedicion),
        fecha_nacimiento: this.toYMD(raw.fecha_nacimiento),

        // Hijos: formatear fecha_nac
        hijos: Array.isArray(raw.hijos)
          ? raw.hijos.map((h: any) => ({
            ...h,
            fecha_nac: this.toYMD(h?.fecha_nac),
          }))
          : [],

        // Por si el backend espera string plano, no Date
        brigadaDe: raw.brigadaDe ?? '',
      };

      // Guardar candidato / marcar entrevista como realizada
      await firstValueFrom(
        this.candidateService.upsertCandidatoByDocumentoFromForm(payload, {
          entrevistado: true,
        })
      );

      await Swal.fire({
        icon: 'success',
        title: 'Listo',
        text: 'Datos guardados y entrevista marcada.',
      });
    } catch (e: any) {
      const msg =
        e?.error?.detail || e?.message || 'No se pudo guardar.';
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: msg,
      });
    } finally {
      this.isSubmitting = false;
    }
  }
}
