import { SharedModule } from '@/app/shared/shared.module';
import { Component, Input, LOCALE_ID, OnInit, SimpleChanges } from '@angular/core';
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

export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY'
  }
};

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

  // Formularios
  infoPersonalForm: FormGroup;
  entrevistaForm: FormGroup;
  vacantesForm: FormGroup;
  infoCandidatoForm: any;

  // Variables
  sedeLogin: string = '';
  vacanteActual: any;

  formGroup2: FormGroup;
  formGroup4: FormGroup;
  codigoContrato: string = '';

  constructor(
    private fb: FormBuilder,
    private hiringService: HiringService,
    private seleccionService: SeleccionService,
    private utilityService: UtilityServiceService,
    private gestionDocumentalService: GestionDocumentalService
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
    this.infoPersonalForm = this.fb.group({
      oficina: [''],
      tipodedocumento: [''],
      numerodecedula: [''],
      nombreCompleto: [''],
      celular: [''],
      whatsapp: [''],
      genero: [''],
      edad: [''],
      fechaNacimiento: [''],
      fechaExpedicion: [''],
      barrio: [''],
      tieneExperienciaFlores: [''],
      referenciado: [''],
      nombreReferenciado: [''], // Campo adicional para el nombre del referenciado
      comoSeEntero: [''],
    });

    // Formulario 2: Entrevista
    this.entrevistaForm = this.fb.group({
      laboresRealizadas: [''],
      empresasLaborado: [''],
      tiempoExperiencia: [''],
      escolaridad: [''],
      numHijos: [''],
      edadesHijos: [''],
      quienLosCuida: [''],
      aplicaObservacion: ['', Validators.required],
      motivoNoAplica: [''],
      hijos: this.fb.array([])
    });

    // Formulario 4: Vacantes
    this.vacantesForm = this.fb.group({
      tipo: ['', Validators.required],
      centroCosto: [''],
      cargo: [''],
      empresaUsuaria: [''],
      area: [''],
      fechaIngreso: [''],
      salario: [''],
      fechaPruebaEntrevista: [''],
      horaPruebaEntrevista: [''],
      direccionEmpresa: [''],
      porQuienPregunta: [''],
      retroalimentacionFinal: ['']
    });
  }

  ngOnInit(): void {
    // Lógica para requerir motivo solo si eligen NO APLICA:
    this.entrevistaForm.get('aplicaObservacion')!.valueChanges.subscribe(val => {
      const motivo = this.entrevistaForm.get('motivoNoAplica');
      if (val === 'NO_APLICA') {
        motivo?.setValidators([Validators.required]);
      } else {
        motivo?.clearValidators();
        motivo?.setValue('');
      }
      motivo?.updateValueAndValidity();
    });

    this.entrevistaForm.get('numHijos')?.valueChanges.subscribe(n => {
      this.actualizarHijos(+n || 0);
    });
  }

  get hijosFormArray(): FormArray {
    return this.entrevistaForm.get('hijos') as FormArray;
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
    this.entrevistaForm.get('numHijos')?.setValue(hijosBackend.length, { emitEvent: false });
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
    if (!user) {
      return;
    }
    this.sedeLogin = user.sucursalde;

    this.hiringService.buscarEncontratacion(this.cedula).subscribe({

      next: (resultado) => {
        this.infoCandidatoForm = resultado.data[0];
        // Llenar el formulario de Info Personal con los datos de this.infoCandidatoForm
        this.infoPersonalForm.patchValue({
          oficina: this.sedeLogin || 'No disponible',
          tipodedocumento: this.infoCandidatoForm.tipodedocumento || 'No disponible',
          numerodecedula: this.infoCandidatoForm.numerodeceduladepersona || 'No disponible',
          nombreCompleto: this.getFullName(),
          celular: this.infoCandidatoForm.celular || this.infoCandidatoForm.whatsapp || '',
          whatsapp: this.infoCandidatoForm.whatsapp || '',
          genero: this.infoCandidatoForm.genero || '',
          edad: this.calcularEdad(this.infoCandidatoForm.fecha_nacimiento) || '',
          fechaNacimiento: this.parseFechaDDMMYYYY(this.infoCandidatoForm.fecha_nacimiento),
          fechaExpedicion: this.parseFechaDDMMYYYY(this.infoCandidatoForm.fecha_expedicion_cc),
          barrio: this.infoCandidatoForm.barrio || '',
          tieneExperienciaFlores: this.infoCandidatoForm.tiene_experiencia_laboral || '',
          referenciado: this.infoCandidatoForm.referenciado || '',
          nombreReferenciado: this.infoCandidatoForm.nombre_referenciado || '',
          comoSeEntero: this.infoCandidatoForm.como_se_entero || ''
        });

        // Llenar el formulario de Entrevista con los datos de this.infoCandidatoForm
        this.entrevistaForm.patchValue({
          presentoEntrevista: this.infoCandidatoForm.presento_entrevista || '',
          eps: this.infoCandidatoForm.eps || '',
          revisionAntecedentes: this.infoCandidatoForm.revision_antecedentes || '',
          laboresRealizadas: this.infoCandidatoForm.labores_realizadas || '',
          empresasLaborado: this.infoCandidatoForm.empresas_laborado || '',
          tiempoExperiencia: this.infoCandidatoForm.tiempo_experiencia || '',
          escolaridad: this.infoCandidatoForm.escolaridad || '',
          numHijos: this.infoCandidatoForm.num_hijos_dependen_economicamente || '',
          quienLosCuida: this.infoCandidatoForm.quien_los_cuida || ''
        });
      },
      error: (error) => {
        Swal.fire('Error', 'No se pudo obtener la contratación', 'error');
      }
    });
  }

  // Métodos de guardado (mock)
  guardarInfoPersonal(): void {
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
        Swal.fire({
          title: 'Guardado',
          text: 'Información personal guardada correctamente.',
          icon: 'success',
          confirmButtonText: 'Ok'
        });
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



  guardarEntrevista(): void {
    if (this.entrevistaForm.invalid) {
      this.entrevistaForm.markAllAsTouched();
      Swal.fire('Error', 'Debes completar todos los campos obligatorios de la entrevista.', 'error');
      return;
    }

    // Construir objeto a enviar, añadiendo la cédula
    const payload = { ...this.entrevistaForm.value, numero: this.cedula };

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
      next: () => {
        Swal.fire('Guardado', 'Vacantes guardadas correctamente.', 'success');
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
}
