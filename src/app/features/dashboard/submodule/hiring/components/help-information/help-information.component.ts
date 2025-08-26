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

  // Formularios
  infoPersonalForm: FormGroup;
  vacantesForm: FormGroup;
  infoCandidatoForm: any;

  // Variables
  sedeLogin: string = '';
  vacanteActual: any;

  formGroup2: FormGroup;
  formGroup4: FormGroup;
  codigoContrato: string = '';

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

    this.formGroup2 = this.fb.group({
      centroCosto: [''],
      cargo: [''],
      areaEntrevista: [''],
      fechaPruebaEntrevista: [''],
      horaPruebaEntrevista: [''],
      direccionEmpresa: ['']
    });

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
      comoSeEntero: [''],
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
      estudiaActualmente: [null, Validators.required],

      experiencias: this.fb.array([]), // arreglo dinámico (empresa, labores, tiempo, labores_principales)
      observacionEvaluador: [''],

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
      return;
    }

    // Clonamos el objeto para no afectar el formulario original
    const info = { ...this.infoPersonalForm.value };

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
            .setEstadoVacanteAplicante(resp.id, 'entrevistado', true)
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

  onVacanteIdChange(id: number): void {
    this.selectedVacanteId = id;
    const v = this.vacantes.find(x => x.id === id) || null;
    this.vacanteSeleccionada = v;
    if (v) this.patchVacanteToForm(v);
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



  ngOnChanges(changes: SimpleChanges): void {
    if (changes['cedula'] && this.cedula) {
      this.buscarContratacion();
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

  guardarVacantes(): void {
    if (this.vacantesForm.invalid) {
      this.vacantesForm.markAllAsTouched();
      Swal.fire('Error', 'Debes completar todos los campos obligatorios.', 'error');
      return;
    }

    const payload = { ...this.vacantesForm.value, numero: this.cedula };

    if (payload.fechaPruebaEntrevista) {
      // Si es tipo Date, pásalo a YYYY-MM-DD
      if (payload.fechaPruebaEntrevista instanceof Date) {
        payload.fechaPruebaEntrevista = payload.fechaPruebaEntrevista.toISOString().slice(0, 10);
      } else if (typeof payload.fechaPruebaEntrevista === 'string') {
        // Si es string tipo ISO (con T), pásalo a YYYY-MM-DD
        if (payload.fechaPruebaEntrevista.includes('T')) {
          payload.fechaPruebaEntrevista = payload.fechaPruebaEntrevista.substring(0, 10);
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(payload.fechaPruebaEntrevista)) {
          // Si ya es YYYY-MM-DD, déjalo igual
        } else {
          // Intenta parsear cualquier otro string válido
          const d = new Date(payload.fechaPruebaEntrevista);
          if (!isNaN(d.getTime())) {
            payload.fechaPruebaEntrevista = d.toISOString().slice(0, 10);
          }
        }
      }
    }

    this.seleccionService.guardarVacantes(payload).subscribe({
      next: (resp) => {
        Swal.fire('Guardado', 'Vacantes guardadas correctamente.', 'success');

        // ✅ ahora marcamos prueba_tecnica=true
        if (resp && resp.id) {
          this.infoVacantesService
            .setEstadoVacanteAplicante(resp.id, 'prueba_tecnica', true)
            .subscribe({
              next: (estadoResp) => {
                console.log('✅ Estado prueba_tecnica actualizado:', estadoResp);
              },
              error: (err) => {
                console.error('❌ Error al actualizar prueba_tecnica', err);
              }
            });
          this.vacantesService.setEstadoVacanteAplicante(this.vacanteSeleccionada?.id, 'preseleccionado', this.cedula).subscribe({
            next: (estadoResp) => {
              console.log('✅ Estado preseleccionado actualizado:', estadoResp);
            },
            error: (err) => {
              console.error('❌ Error al actualizar preseleccionado', err);
            }
          });
          this.seleccionService.setVacante(this.cedula, this.vacanteSeleccionada?.id).subscribe({
            next: (estadoResp) => {
              console.log('✅ Vacante asignada correctamente:', estadoResp);
            },
            error: (err) => {
              console.error('❌ Error al asignar vacante', err);
            }
          });
          this.emitirIdSiSeleccionado(); // Emitir el ID de la vacante seleccionada
        }

      },
      error: (error) => {
        Swal.fire('Error', 'No se pudo guardar las vacantes.', 'error');
      }
    });
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

  // Método para imprimir los datos de los formularios
  imprimirEntrevistaPrueba(): void {
    // this.formGroup2.value.vacante = this.idvacante;
    this.seleccionService.crearSeleccionParteDosCandidato(this.formGroup2.value, this.cedula, this.codigoContrato).subscribe(
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
