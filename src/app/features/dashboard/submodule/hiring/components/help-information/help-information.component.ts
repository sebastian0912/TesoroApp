import { SharedModule } from '@/app/shared/shared.module';
import { Component, Input, LOCALE_ID, SimpleChanges } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTabsModule } from '@angular/material/tabs';
import { HiringService } from '../../service/hiring.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule, NativeDateModule } from '@angular/material/core';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
import { MomentDateAdapter } from '@angular/material-moment-adapter';

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
export class HelpInformationComponent {
  @Input() cedula: string = '';

  // Formularios
  infoPersonalForm: FormGroup;
  entrevistaForm: FormGroup;
  vacantesForm: FormGroup;
  infoCandidatoForm: any;

  // Variables
  sedeLogin: string = '';
  vacanteActual: any;


  constructor(
    private fb: FormBuilder,
    private hiringService: HiringService,
    private seleccionService: SeleccionService,
    private utilityService: UtilityServiceService
  ) {
    // Formulario 1: Info personal
    this.infoPersonalForm = this.fb.group({
      oficina: [{ value: '', disabled: true }],
      tipodedocumento: [{ value: '', disabled: true }],
      numerodecedula: [{ value: '', disabled: true }],
      nombreCompleto: [{ value: '', disabled: true }],
      celular: [''],
      whatsapp: [''],
      genero: [''],
      edad: [{ value: '', disabled: true }],
      fechaNacimiento: [{ value: '', disabled: true }],
      barrio: [''],
      tieneExperienciaFlores: [''],
      referenciado: [''],
      comoSeEntero: [''],
    });

    // Formulario 2: Entrevista
    this.entrevistaForm = this.fb.group({
      presentoEntrevista: [''],
      laboresRealizadas: [''],
      empresasLaborado: [''],
      tiempoExperiencia: [''],
      escolaridad: [''],
      numHijos: [''],
      quienLosCuida: [''],
      observacionDelEvaluador: [''],
    });

    // Formulario 4: Vacantes
    this.vacantesForm = this.fb.group({
      centroCosto: [''],
      cargo: [''],
      fechaPruebaEntrevista: [''],
      horaPruebaEntrevista: [''],
      porQuienPregunta: [''],
      retroalimentacionFinal: ['']
    });
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

  private buscarContratacion(): void {
    const user = this.utilityService.getUser();
    if (!user) {
      return;
    }
    this.sedeLogin = user.sucursalde;

    this.hiringService.buscarEncontratacion(this.cedula).subscribe({

      next: (resultado) => {
        console.log('Resultado contratación:', resultado);
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
          fechaNacimiento: this.infoCandidatoForm.fecha_nacimiento || '',
          barrio: this.infoCandidatoForm.barrio || '',
          tieneExperienciaFlores: this.infoCandidatoForm.tiene_experiencia_laboral || '',
          referenciado: this.infoCandidatoForm.referenciado || '',
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

        // aquí puedes guardar o mostrar el resultado como necesites
      },
      error: (error) => {
        Swal.fire('Error', 'No se pudo obtener la contratación', 'error');
      }
    });
  }

  // Métodos de guardado (mock)
  guardarInfoPersonal(): void {

    if (this.infoPersonalForm.valid) {

    }
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

    // ✅ Convertir la fecha a "YYYY-MM-DD" si es un Date
    if (payload.fechaPruebaEntrevista instanceof Date) {
      payload.fechaPruebaEntrevista = payload.fechaPruebaEntrevista.toISOString().slice(0, 10);
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
    console.log('Fecha de nacimiento convertida:', fechaNacimiento);
    if (!fechaNacimiento) return NaN;

    const today = new Date();
    let age = today.getFullYear() - fechaNacimiento.getFullYear();
    console.log('Edad calculada:', age);
    const monthDiff = today.getMonth() - fechaNacimiento.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < fechaNacimiento.getDate())
    ) {
      age--;
    }

    return age;
  }


}
