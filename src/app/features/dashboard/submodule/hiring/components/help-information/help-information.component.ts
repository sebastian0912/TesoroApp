import { SharedModule } from '@/app/shared/shared.module';
import { Component, EventEmitter, Input, LOCALE_ID, OnInit, Output, SimpleChanges } from '@angular/core';
import { FormGroup, FormBuilder, Validators, FormArray } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTabsModule } from '@angular/material/tabs';
import { HiringService } from '../../service/hiring.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule, NativeDateModule } from '@angular/material/core';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { PDFDocument } from 'pdf-lib';
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
  horadePruebatecnica: string | null; // "HH:mm:ss"
  observacionVacante: string | null;
  fechadeIngreso: string | null; // "YYYY-MM-DD"
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
    NativeDateModule
  ],
  templateUrl: './help-information.component.html',
  styleUrl: './help-information.component.css',
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]

})
export class HelpInformationComponent implements OnInit {
  @Input() cedula: string = '';
  examFiles: File[] = [];
  @Output() idVacante = new EventEmitter<number>();
  @Input() vacanteSeleccionadaId: any;
  private _idInfoEntrevistaAndrea: number = 0;
  @Input() set idInfoEntrevistaAndrea(value: number) {
    this._idInfoEntrevistaAndrea = value;
  }
  pendingVacanteId: number | null = null;

  // Formularios
  infoPersonalForm: FormGroup;
  vacantesForm: FormGroup;
  infoCandidatoForm: any;

  // Variables
  sedeLogin: string = '';
  vacanteActual: any;
  formGroup4: FormGroup;
  codigoContrato: string = '';

  private _idProcesoSeleccion: number | null = null;
  @Input() set idProcesoSeleccion(value: number | null) {
    this._idProcesoSeleccion = value;
    // Aquí reaccionas cada vez que cambie
    // ej: this.form.patchValue({ seleccion: value ?? null });
  }

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

  get idProcesoSeleccion(): number | null {
    return this._idProcesoSeleccion;
  }

  get tiempoResidenciaParsed() {
    const v = this.infoCandidatoForm.value.tiempoResidencia as string | null;
    if (!v) return null;
    if (v === 'LIFETIME') return { unit: 'LIFETIME', quantity: null, label: 'Toda la vida' };
    const [u, q] = v.split(':');
    const n = Number(q);
    if (u === 'M') return { unit: 'MONTH', quantity: n, label: `${n} ${n === 1 ? 'mes' : 'meses'}` };
    if (u === 'Y') return { unit: 'YEAR', quantity: n, label: `${n} ${n === 1 ? 'año' : 'años'}` };
    return null;
  }

  // id de info entrevista andrea
  onIdInfoEntrevistaAndreaChange(id: number): void {
    this.idInfoEntrevistaAndrea = id;
  }

  //  Lista estado civil
  estadosCiviles: any[] = [
    {
      codigo: 'SO',
      descripcion: 'SO (Soltero)',
    },
    {
      codigo: 'UL',
      descripcion: 'UL (Unión Libre) ',
    },
    {
      codigo: 'CA',
      descripcion: 'CA (Casado)',
    },
    {
      codigo: 'SE',
      descripcion: 'SE (Separado)',
    },
    {
      codigo: 'VI',
      descripcion: 'VI (Viudo)',
    },
  ];


  vacantes: PublicacionDTO[] = [];
  vacanteSeleccionada: PublicacionDTO | null = null;

  oficinasNombres(oficinas?: OficinaDTO[] | null): string {
    if (!oficinas || oficinas.length === 0) return '';
    return oficinas.map(o => o?.nombre).filter(Boolean).join(', ');
  }

  // NO tocamos vacanteSeleccionada; usamos un id aparte
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
      salario: ['1423500'],
      auxTransporte: [''],
      rodamiento: [''],
      auxMovilidad: [''],
      bonificacion: ['']
    });

    // Formulario 1: Info personal
    // Dentro del constructor (o donde inicializas los formularios)
    this.infoPersonalForm = this.fb.group({
      // --- TUS CAMPOS ORIGINALES ---
      tipodedocumento: ['', Validators.required],
      numerodecedula: [
        '',
        [Validators.required, Validators.pattern(/^\d+$/)]
      ],
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
      // --- CAMPOS QUE FALTABAN (TRAÍDOS DE formVacante) ---
      primerApellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
      segundoApellido: ['', [Validators.maxLength(30)]],
      primerNombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(30)]],
      segundoNombre: ['', [Validators.maxLength(30)]],
      lugarNacimiento: ['', Validators.required],

      experienciaFlores: ['', Validators.required], // coexistirá con tieneExperienciaFlores
      tipoExperienciaFlores: [''],
      otroExperiencia: [''],

      oficina: ['', Validators.required],
      brigadaDe: [''],

      correo_usuario: ['', [Validators.required, Validators.pattern(/^[^@\s]+$/)]], // mismo patrón que usas
      correo_dominio: ['', Validators.required],

      estadoCivil: ['', Validators.required],
      conQuienViveChecks: [[], Validators.required],

      tieneHijos: [null, Validators.required],
      cuidadorHijos: [''],
      numeroHijos: [0],

      tiempoResidencia: ['', Validators.required],
      proyeccion1Ano: ['', Validators.required],
      //estudiaActualmente: [null, Validators.required],

      experiencias: this.fb.array([]), // arreglo dinámico (empresa, labores, tiempo, labores_principales)
      observacionEvaluador: [''],
      motivoEspera: [''],

    });


    // Formulario 4: Vacantes
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

    // 2) Hijos: activar validadores con tieneHijos y sincronizar cantidades
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

    // Sincronizar numHijos <-> numeroHijos y ajustar FormArray
    this.infoPersonalForm.get('numHijos')?.valueChanges.subscribe(n => {
      const parsed = Number(n) || 0;
      const actual = this.infoPersonalForm.get('numeroHijos')?.value ?? 0;
      if (actual !== parsed) {
        this.infoPersonalForm.get('numeroHijos')?.setValue(parsed, { emitEvent: false });
      }
      this.setHijosCount(parsed);
    });

    this.infoPersonalForm.get('numeroHijos')?.valueChanges.subscribe(n => {
      const parsed = Number(n) || 0;
      const actual = this.infoPersonalForm.get('numHijos')?.value ?? 0;
      if (actual !== parsed) {
        this.infoPersonalForm.get('numHijos')?.setValue(parsed, { emitEvent: false });
      }
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

      // Mantener en sync (opcional) con tieneExperienciaFlores
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

    // 4) Calcular edad desde fechaNacimiento
    this.infoPersonalForm.get('fechaNacimiento')?.valueChanges.subscribe((f: any) => {
      const edad = this.calcEdad(f);
      this.infoPersonalForm.get('edad')?.setValue(edad, { emitEvent: false });
    });

    // 5) Construir nombreCompleto desde nombres/apellidos (opcional)
    const nombrePartes = ['primerNombre', 'segundoNombre', 'primerApellido', 'segundoApellido'];
    nombrePartes.forEach(ctrl => {
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



    this.vacantesService.getVacantesPorOficina(user.sucursalde)
      .subscribe((vacantes: PublicacionDTO[]) => {
        this.vacantes = vacantes ?? [];
        // (opcional) autoseleccionar la primera:
        // if (this.vacantes.length) this.onVacanteIdChange(this.vacantes[0].id);
      });


    // Lógica para requerir motivo solo si eligen NO APLICA:
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

  }

  get experienciasFA(): FormArray {
    return this.infoPersonalForm.get('experiencias') as FormArray;
  }


  private createHijoGroup(hijo: any = {}): FormGroup {
    return this.fb.group({
      edad: [hijo.edad ?? '', Validators.required]
    });
  }


  addExperiencia(): void {
    this.experienciasFA.push(this.fb.group({
      empresa: ['', [Validators.required, Validators.maxLength(120)]],
      tiempo: ['', [Validators.required, Validators.maxLength(80)]],
      labores: ['', [Validators.required, Validators.maxLength(800)]],
      labores_principales: ['', [Validators.required, Validators.maxLength(800)]],
    }));
  }

  removeExperiencia(i: number): void {
    this.experienciasFA.removeAt(i);
  }



  // -------- Hijos (estructura local) --------

  get hijosFormArray(): FormArray {
    return this.infoPersonalForm.get('hijos') as FormArray;
  }

  actualizarHijos(cantidad: number) {
    const hijos = this.hijosFormArray;
    while (hijos.length < cantidad) {
      hijos.push(this.fb.group({
        nombre: [''],
        sexo: [''],
        fecha_nacimiento: [''],
        no_documento: [''],
        estudia_o_trabaja: [''],
        curso: ['']
      }));
    }
    while (hijos.length > cantidad) {
      hijos.removeAt(hijos.length - 1);
    }
  }

  private buildHijoGroup(): FormGroup {
    return this.fb.group({
      edad: ['', Validators.required]
    });
  }

  private setHijosCount(n: number): void {
    const fa = this.hijosFormArray;
    while (fa.length < n) fa.push(this.buildHijoGroup());
    while (fa.length > n) fa.removeAt(fa.length - 1);
  }

  setHijosDesdeBackend(hijosBackend: any[]) {
    const hijos = this.hijosFormArray;
    hijos.clear();
    hijosBackend.forEach(h => {
      hijos.push(this.fb.group({
        nombre: [h.nombre ?? ''],
        sexo: [h.sexo ?? ''],
        fecha_nacimiento: [h.fecha_nacimiento ?? ''],
        no_documento: [h.no_documento ?? ''],
        estudia_o_trabaja: [h.estudia_o_trabaja ?? ''],
        curso: [h.curso ?? ''],
      }));
    });
    this.infoPersonalForm.get('numHijos')?.setValue(hijosBackend.length, { emitEvent: false });
    this.infoPersonalForm.get('numeroHijos')?.setValue(hijosBackend.length, { emitEvent: false });
  }

  // -------- Utilidades --------
  private calcEdad(f?: any): string {
    if (!f) return '';
    const d = new Date(f), h = new Date();
    let e = h.getFullYear() - d.getFullYear();
    const m = h.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && h.getDate() < d.getDate())) e--;
    return String(e);
  }

  // Métodos de guardado (mock)
  guardarInfoPersonal(): void {
    if (this.infoPersonalForm.invalid) {
      Swal.fire({
        title: 'Error',
        text: 'Por favor, completa todos los campos requeridos.',
        icon: 'error',
        confirmButtonText: 'Ok'
      });
      // que campos faltan para que sea valido
      const invalidFields = Object.keys(this.infoPersonalForm.controls).filter(field => this.infoPersonalForm.get(field)?.invalid);
      console.log('Campos inválidos:', invalidFields);
      return;
    }

    // Clonamos el objeto para no afectar el formulario original
    const info = { ...this.infoPersonalForm.value };
    // añadir id
    info.id = this._idInfoEntrevistaAndrea;

    // Si el campo es un Date, lo convertimos a string "YYYY-MM-DD"
    if (info.fechaNacimiento instanceof Date) {
      const yyyy = info.fechaNacimiento.getFullYear();
      const mm = (info.fechaNacimiento.getMonth() + 1).toString().padStart(2, '0');
      const dd = info.fechaNacimiento.getDate().toString().padStart(2, '0');
      info.fechaNacimiento = `${yyyy}-${mm}-${dd}`;
    }

    // Si es string con hora ("2006-09-24T05:00:00.000Z"), lo recortamos
    if (typeof info.fechaNacimiento === 'string' && info.fechaNacimiento.length > 10) {
      info.fechaNacimiento = info.fechaNacimiento.slice(0, 10);
    }

    // CADA UNO DE LOS CAMPOS EN MAYUSCULA SOSTENIDA
    Object.keys(info).forEach(key => {
      if (typeof info[key] === 'string') {
        info[key] = info[key].toUpperCase();
      }
    });

    this.seleccionService.guardarInfoPersonal(info).subscribe({
      next: (resp) => {
        // ✅ primero guardó la info
        Swal.fire({
          title: 'Guardado',
          text: 'Información personal guardada correctamente.',
          icon: 'success',
          confirmButtonText: 'Ok'
        });
        // 👇 ahora actualizamos el estado entrevistado=true
        if (resp && resp.id) {
          this.infoVacantesService
            .setEstadoVacanteAplicante(this._idInfoEntrevistaAndrea, 'entrevistado', true)
            .subscribe({
              next: (estadoResp) => {
                console.log('✅ Estado entrevistado actualizado:', estadoResp);
              },
              error: (err) => {
                console.error('❌ Error al actualizar entrevistado', err);
              }
            });
        }
      },
      error: (err) => {
        Swal.fire({
          title: 'Error',
          text: 'No se pudo guardar la información personal.',
          icon: 'error',
          confirmButtonText: 'Ok'
        });
      }
    });
  }

  onVacanteIdChange(id: number | string): void {
    const idNum = Number(id);
    this.selectedVacanteId = idNum;

    const v = this.vacantes?.find(x => Number(x.id) === idNum) || null;
    this.vacanteSeleccionada = v;

    if (v) {
      this.patchVacanteToForm(v);
      // Si usas OnPush:
      // this.cdr.markForCheck();
    }
  }

  // si también quieres re-emitir tras guardar:
  emitirIdSiSeleccionado(): void {
    if (typeof this.selectedVacanteId === 'number') {
      this.idVacante.emit(this.selectedVacanteId);
    }
  }

  private patchVacanteToForm(v: PublicacionDTO): void {
    // deducir tipo desde la vacante (si aplica)


    // helpers de conversión
    const toDate = (yyyyMmDd: string | null) =>
      yyyyMmDd ? new Date(`${yyyyMmDd}T00:00:00`) : null;

    const toTime = (hhmmss: string | null) =>
      hhmmss ? hhmmss.slice(0, 5) : null; // "HH:mm:ss" -> "HH:mm"

    const salarioNum =
      v.salario && v.salario !== '0.00' ? Number(v.salario) : null;

    this.vacantesForm.patchValue({
      // comunes

      empresaUsuaria: v.empresaUsuariaSolicita ?? '',
      cargo: v.cargo ?? '',

      // autorización
      fechaIngreso: toDate(v.fechadeIngreso),
      salario: salarioNum,

      // prueba
      area: v.area ?? '',
      fechaPruebaEntrevista: toDate(v.fechadePruebatecnica),
      horaPruebaEntrevista: toTime(v.horadePruebatecnica),
      direccionEmpresa: v.ubicacionPruebaTecnica ?? ''
    });

    // Si cambiaste 'tipo', fuerza *ngIf del template a reevaluar
    this.vacantesForm.get('tipo')?.updateValueAndValidity({ emitEvent: true });
  }

  private setVacantes(lista: PublicacionDTO[]): void {
    this.vacantes = lista || [];

    if (this.pendingVacanteId != null) {
      // ahora sí existe la opción, aplica selección
      this.onVacanteIdChange(this.pendingVacanteId);
      this.pendingVacanteId = null;
    }
  }



  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cedula'] && this.cedula) {
      this.buscarContratacion();

      this.seleccionService.getSeleccion(this.cedula).subscribe((seleccion: any) => {
        const procesos = Array.isArray(seleccion?.procesoSeleccion) ? seleccion.procesoSeleccion : [];
        if (!procesos.length) return;

        // max por id:
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


  recibirVacante(vacante: any): void {
    this.vacanteActual = vacante;
    if (this.vacanteActual) {
      this.vacantesForm.patchValue({
        centroCosto: this.vacanteActual.empresaUsuariaSolicita,
        cargo: this.vacanteActual.cargo,
        fechaPruebaEntrevista: this.vacanteActual.fechadePruebatecnica,
        horaPruebaEntrevista: this.vacanteActual.horadePruebatecnica
      });
    }
  }

  parseFechaDDMMYYYY(fechaStr: any): Date | null {
    if (!fechaStr) return null;

    // Si viene como objeto Date, retorna igual
    if (fechaStr instanceof Date) return fechaStr;

    // Si ya viene en formato "yyyy-mm-dd" o "yyyy-mm-ddTHH:mm:ss"
    if (/^\d{4}-\d{2}-\d{2}/.test(fechaStr)) {
      return new Date(fechaStr);
    }

    // Si viene en formato "dd/mm/yyyy"
    if (fechaStr.includes('/')) {
      const [dia, mes, anio] = fechaStr.split('/');
      if (dia && mes && anio) {
        return new Date(+anio, +mes - 1, +dia);
      }
    }

    return null; // No reconoce el formato
  }

  private buscarContratacion(): void {
    const user = this.utilityService.getUser();
    if (!user) return;
    this.sedeLogin = user.sucursalde;

    this.infoVacantesService.getVacantesPorNumero(this.cedula).subscribe({
      next: (resultado) => {
        const contratacion = resultado?.[0];
        if (contratacion) {
          this.patchInfoPersonalFromApi(contratacion);
        }
      },
      error: () => {
        Swal.fire('Error', 'No se pudo obtener la contratación', 'error');
      }
    });
  }


  private fillHijosFromApi(numeroHijos: number, hijosApi: Array<any> | null | undefined): void {
    // Ajusta la cantidad de controles
    this.actualizarHijos(Number(numeroHijos) || 0);

    // Si el backend trae solo edades, úsalas para el campo 'edadesHijos'
    if (Array.isArray(hijosApi) && hijosApi.length) {
      const edades = hijosApi
        .map(h => h?.edad)
        .filter(e => e !== undefined && e !== null)
        .join(', ');
      this.infoPersonalForm.get('edadesHijos')?.setValue(edades);
    } else {
      this.infoPersonalForm.get('edadesHijos')?.setValue('');
    }
  }



  private patchInfoPersonalFromApi(data: any): void {
    // Experiencia en flores -> 'Sí'/'No' (y espejo en tieneExperienciaFlores 'SI'/'NO')
    const expTxt = (data?.cuenta_experiencia_flores ?? '').toString().trim();
    const expSi = this.boolFromText(expTxt) === true;
    const experienciaFlores = expSi ? 'Sí' : (expTxt ? 'No' : '');

    // APLICA / NO_APLICA
    const aplicaSel = (data?.aplica_o_no_aplica ?? data?.aplicaObservacion ?? '').toString().trim();

    // Correo -> split usuario/dominio
    const { usuario: correo_usuario, dominio: correo_dominio } = this.splitCorreo(data?.correo);

    // Preferencias y equivalentes
    const municipioExp = data?.municipio_expedicion ?? data?.municipioExpedicion ?? '';
    const nombreCompleto = [data?.primer_nombre, data?.segundo_nombre, data?.primer_apellido, data?.segundo_apellido]
      .filter(Boolean).join(' ').trim();

    // Patch principal
    this.infoPersonalForm.patchValue({
      // originales
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
      // faltantes/extra
      primerApellido: data?.primer_apellido ?? '',
      segundoApellido: data?.segundo_apellido ?? '',
      primerNombre: data?.primer_nombre ?? '',
      segundoNombre: data?.segundo_nombre ?? '',
      lugarNacimiento: data?.lugar_nacimiento ?? '',

      experienciaFlores,                 // 'Sí'/'No'

      otroExperiencia: data?.otro_experiencia ?? '',

      oficina: data?.oficina ?? '',
      brigadaDe: data?.brigada_de ?? '',

      correo_usuario,
      correo_dominio,

      estadoCivil: data?.estado_civil ?? '',
      conQuienViveChecks: Array.isArray(data?.con_quien_vive) ? data.con_quien_vive : [],

      tieneHijos: this.boolFromText(data?.tiene_hijos),
      cuidadorHijos: data?.cuidador_hijos ?? '',
      numeroHijos: data?.numero_hijos ?? 0,

      tiempoResidencia: data?.tiempo_residencia ?? '',
      proyeccion1Ano: data?.proyeccion_1_ano ?? '',
      estudiaActualmente: (this.boolFromText(data?.estudiaActualmente) ?? null),

      observacionEvaluador: data?.aplicaObservacion ?? '',
    });

    // Sincronizar hijos (FormArray y edades)
    this.fillHijosFromApi(data?.numero_hijos, data?.hijos);

    // 🔹 Experiencias (FormArray)
    if (Array.isArray(data?.hijos)) {
      const fa = this.hijosFA; // getter que devuelve this.infoPersonalForm.get('hijos') as FormArray
      fa.clear(); // limpiar antes de llenar
      data.hijos.forEach((hijo: any) => {
        fa.push(this.fb.group({
          edad: [hijo.edad ?? '']
        }));
      });
    } else {
      // Si no viene arreglo, sincronizar con número de hijos
      this.fillHijosFromApi(data?.numero_hijos, []);
    }

    // 🔹 Experiencias laborales (FormArray)
    if (Array.isArray(data?.experiencias)) {
      const faExp = this.experienciasFA; // getter -> this.infoPersonalForm.get('experiencias') as FormArray
      faExp.clear(); // limpiar antes de llenar
      data.experiencias.forEach((exp: any) => {
        faExp.push(this.fb.group({
          tiempo: [exp.tiempo ?? ''],
          empresa: [exp.empresa ?? ''],
          labores: [exp.labores ?? ''],
          labores_principales: [exp.labores_principales ?? '']
        }));
      });
    } else {
      // Si no viene arreglo, asegurarse de limpiar
      this.experienciasFA.clear();
    }


    // Validación adicional
    this.infoPersonalForm.get('motivoNoAplica')?.updateValueAndValidity();
  }

  get hijosFA(): FormArray {
    return this.infoPersonalForm.get('hijos') as FormArray;
  }




  private toDate(v: any): Date | null {
    if (!v) return null;
    // Acepta 'YYYY-MM-DD' ó Date
    return v instanceof Date ? v : new Date(String(v));
  }

  private splitCorreo(correo?: string): { usuario: string; dominio: string } {
    if (!correo || typeof correo !== 'string' || !correo.includes('@')) {
      return { usuario: '', dominio: '' };
    }
    const [u, d] = correo.split('@');
    return { usuario: u || '', dominio: (d || '').toUpperCase() };
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

    // Construir objeto a enviar, añadiendo la cédula
    const payload = { ...this.infoPersonalForm.value, numero: this.cedula };

    this.seleccionService.guardarEntrevista(payload).subscribe({
      next: (resp) => {
        Swal.fire('Guardado', 'Información de entrevista guardada correctamente.', 'success');
      },
      error: (error) => {
        Swal.fire('Error', 'No se pudo guardar la información de la entrevista.', 'error');
      }
    });
  }

  async guardarVacantes(): Promise<void> {
    if (this.vacantesForm.invalid) {
      this.vacantesForm.markAllAsTouched();
      await Swal.fire('Error', 'Debes completar todos los campos obligatorios.', 'error');
      return;
    }

    // Helpers locales
    const normDate = (v: any): string => {
      if (!v) return '';
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      const s = String(v);
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                 // YYYY-MM-DD
      const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);         // DD/MM/YYYY
      if (m) {
        const [_, d, mo, y] = m;
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

    // Tomar valores del form
    const fv = this.vacantesForm.value;
    fv.id = this._idInfoEntrevistaAndrea;
    // COLOCAR EN MAYÚSCULAS
    Object.keys(fv).forEach(key => {
      if (typeof fv[key] === 'string') {
        fv[key] = fv[key].toUpperCase();
      }
    });
    // Payload para tu endpoint de "guardar vacantes" (si lo usas aparte de Parte 2)
    // Mapeado a los nombres de backend:
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
      // Si tienes una vacante seleccionada, priorízala
      vacante: this.vacanteSeleccionada?.id ?? (fv.vacante ?? null)
    };

    // Loader
    Swal.fire({
      title: 'Guardando…',
      text: 'Procesando información de vacantes.',
      icon: 'info',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // 1) Guardar/actualizar PARTE 2 del proceso (correcto, NO parte 3)
      //    Enviamos el id del proceso si lo tienes; creará uno nuevo si no.
      // TODA LA INFO DEL FORMULARIO EN MAYÚSCULAS

      const respParte2: any = await firstValueFrom(
        this.seleccionService.crearSeleccionParteDosCandidato(
          this.vacantesForm,               // acepta FormGroup o .value (tu service lo maneja)
          this.cedula,
          this._idProcesoSeleccion   // usa el nombre consistente en tu componente
        )
      );

      // Si backend devuelve id del proceso, consérvalo
      if (respParte2?.id && !this.idProcesoSeleccion) {
        this.idProcesoSeleccion = respParte2.id;
      }

      // 2) Guardar "vacantes" (si usas un endpoint adicional para otro modelo)
      const respGuardar: any = await firstValueFrom(
        this.seleccionService.guardarVacantes(payloadVacante)
      );

      Swal.close();

      // 3) Acciones post-guardado (estados/relaciones)
      if (respGuardar && respGuardar.id) {
        // marcar prueba_técnica=true en tu InfoVacantes (si aplica)
        this.infoVacantesService
          .setEstadoVacanteAplicante(this._idInfoEntrevistaAndrea, 'prueba_tecnica', true)
          .subscribe({
            next: r => console.log('✅ Estado prueba_tecnica actualizado:', r),
            error: err => console.warn('❌ No se pudo actualizar prueba_tecnica', err)
          });
      }

      // marcar preseleccionado y asignar vacante (si hay vacanteSeleccionada)
      if (this.vacanteSeleccionada?.id) {
        this.vacantesService
          .setEstadoVacanteAplicante(this.vacanteSeleccionada.id, 'preseleccionado', this.cedula)
          .subscribe({
            next: r => console.log('✅ Estado preseleccionado actualizado:', r),
            error: err => console.warn('❌ No se pudo actualizar preseleccionado', err)
          });

        this.seleccionService
          .setVacante(this.cedula, this.vacanteSeleccionada.id)
          .subscribe({
            next: r => console.log('✅ Vacante asignada correctamente:', r),
            error: err => console.warn('❌ Error al asignar vacante', err)
          });

        // (opcional) emitir id hacia el padre
        this.emitirIdSiSeleccionado?.();
      }

      await Swal.fire({
        icon: 'success',
        title: 'Guardado',
        text: 'Información de vacantes guardada correctamente.',
      });

    } catch (err: any) {
      console.error('guardarVacantes error:', err);
      Swal.close();
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: err?.error?.detail || err?.message || 'No se pudo guardar la información de vacantes.'
      });
    }
  }


  // Obtener el nombre completo
  getFullName(): string {
    const { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido } = this.infoCandidatoForm || {};
    return `${primer_nombre || ''} ${segundo_nombre || ''} ${primer_apellido || ''} ${segundo_apellido || ''}`.trim();
  }

  // Convierte días desde 1900, DD/MM/YYYY o YYYY-MM-DD a Date
  convertirAFecha(fecha: string): Date | null {
    if (/^\d+$/.test(fecha)) {
      const diasDesde1900 = Number(fecha);
      const fechaBase = new Date(1900, 0, 1);
      fechaBase.setDate(fechaBase.getDate() + diasDesde1900);
      if (isNaN(fechaBase.getTime())) return null;
      return fechaBase;
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha)) {
      const [dia, mes, anio] = fecha.split('/').map(Number);
      if (!dia || !mes || !anio) return null;
      const fechaValida = new Date(anio, mes - 1, dia);
      if (isNaN(fechaValida.getTime())) return null;
      return fechaValida;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      const fechaValida = new Date(fecha);
      if (isNaN(fechaValida.getTime())) return null;
      return fechaValida;
    } else {
      return null;
    }
  }

  // Calcula la edad a partir de una fecha string
  calcularEdad(fecha: string): number {
    const fechaNacimiento = this.convertirAFecha(fecha);
    if (!fechaNacimiento) return NaN;

    const today = new Date();
    let age = today.getFullYear() - fechaNacimiento.getFullYear();
    const monthDiff = today.getMonth() - fechaNacimiento.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < fechaNacimiento.getDate())
    ) {
      age--;
    }

    return age;
  }

  // Método para calcular el porcentaje de llenado de un FormGroup
  getPercentage(formGroup: FormGroup): number {
    const totalFields = Object.keys(formGroup.controls).length;
    const filledFields = Object.values(formGroup.controls).filter(control => {
      const value = control.value;

      // Ignorar campos vacíos y arreglos vacíos
      if (Array.isArray(value)) {
        return value.length > 0; // Solo contar como lleno si el arreglo tiene elementos
      }

      return value !== null && value !== undefined && value !== ''; // Considerar los valores no vacíos
    }).length;

    return Math.round((filledFields / totalFields) * 100);
  }

  // Método para imprimir los datos de los formularios
  imprimirContratacion(): void {
    this.seleccionService.crearSeleccionParteCuatroCandidato(this.formGroup4.value, this.cedula, this.codigoContrato).subscribe(
      response => {
        if (response.message === 'success') {
          Swal.fire({
            title: '¡Éxito!',
            text: 'Datos guardados exitosamente',
            icon: 'success',
            confirmButtonText: 'Ok'
          });
        }
      },
      error => {
        Swal.fire({
          title: '¡Error!',
          text: 'Error al guardar los datos',
          icon: 'error',
          confirmButtonText: 'Ok'
        });
      }
    );
  }

  isAutorizacion(): boolean {
    return this.vacantesForm.get('tipo')?.value === 'Autorización de ingreso';
  }

  isPrueba(): boolean {
    return this.vacantesForm.get('tipo')?.value === 'Prueba técnica';
  }

  onTipoChange(tipo: string): void {
    // Limpia los campos irrelevantes según el tipo
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














  // Total requerido (suma oficinas)
  totalRequerida(v: any): number {
    const oficinas = Array.isArray(v?.oficinasQueContratan) ? v.oficinasQueContratan : [];
    return oficinas.reduce((acc: number, o: any) => acc + this.toInt(o?.numeroDeGenteRequerida), 0);
  }

  // Conteos robustos: admiten array | number | string
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

  // Clases de color para las píldoras (verde, naranja, rojo)
  pillClasePre(v: any): string {
    const req = this.totalRequerida(v);
    const pre = this.countPre(v);
    return pre >= req ? 'pill-ok' : 'pill-error';
  }
  pillClaseCont(v: any): string {
    const req = this.totalRequerida(v);
    const pre = this.countPre(v);
    const cont = this.countCont(v);
    if (cont >= req) return 'pill-ok';           // verde
    if (pre >= req && cont < req) return 'pill-warn'; // naranja
    return 'pill-error';                          // rojo
  }

  // Oficinas compactas "Nombre (n), ..."
  oficinasResumen(ofs: any[]): string {
    if (!Array.isArray(ofs) || !ofs.length) return '—';
    return ofs
      .map(o => `${o?.nombre ?? 'Oficina'} (${this.toInt(o?.numeroDeGenteRequerida)})`)
      .join(', ');
  }

  // Fecha corta (YYYY-MM-DD) sin pipes
  formatShortDate(d: any): string {
    if (!d) return '—';
    const date = new Date(d);
    if (isNaN(date.getTime())) return '—';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // Conversión robusta a entero
  private toInt(v: unknown): number {
    if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
    if (typeof v === 'string') {
      const m = v.match(/-?\d+/);
      return m ? parseInt(m[0], 10) : 0;
    }
    return 0;
  }


}
