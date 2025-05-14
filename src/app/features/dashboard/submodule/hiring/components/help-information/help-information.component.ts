import { SharedModule } from '@/app/shared/shared.module';
import { Component, Input, SimpleChanges } from '@angular/core';
import { FormGroup, FormBuilder } from '@angular/forms';
import Swal from 'sweetalert2';
import { MatTabsModule } from '@angular/material/tabs';
import { HiringService } from '../../service/hiring.service';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

@Component({
  selector: 'app-help-information',
  imports: [
    SharedModule,
    MatTabsModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './help-information.component.html',
  styleUrl: './help-information.component.css'
})
export class HelpInformationComponent {
  @Input() cedula: string = '';

  // Formularios
  infoPersonalForm: FormGroup;
  entrevistaForm: FormGroup;
  observacionesForm: FormGroup;
  vacantesForm: FormGroup;
  infoCandidatoForm: any;

  // Variables
  sedeLogin: string = '';
  vacanteActual: any;


  constructor(
    private fb: FormBuilder,
    private hiringService: HiringService,
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
      comoSeEntero: ['']
    });

    // Formulario 2: Entrevista
    this.entrevistaForm = this.fb.group({
      presentoEntrevista: [''],
      laboresRealizadas: [''],
      empresasLaborado: [''],
      tiempoExperiencia: [''],
      escolaridad: [''],
      numHijos: [''],
      quienLosCuida: ['']
    });

    // Formulario 3: Observaciones
    this.observacionesForm = this.fb.group({
      observacionNovedad: [''],
      observacionEvaluador: ['']
    });

    // Formulario 4: Vacantes
    this.vacantesForm = this.fb.group({
      centroCosto: [{ value: '', disabled: true }],
      cargo: [{ value: '', disabled: true }],
      fechaPruebaEntrevista: [{ value: '', disabled: true }],
      horaPruebaEntrevista: [{ value: '', disabled: true }],
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
    console.log('Vacante recibida en HelpInformation:', vacante);
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
    console.log('Usuario:', user);
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
          celular: this.infoCandidatoForm.celular || '',
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

        // Llenar el formulario de Observaciones con los datos de this.infoCandidatoForm
        this.observacionesForm.patchValue({
          observacionNovedad: this.infoCandidatoForm.observacion_novedad || '',
          observacionEvaluador: this.infoCandidatoForm.observacion_evaluador || ''
        });
        // aquí puedes guardar o mostrar el resultado como necesites
      },
      error: (error) => {
        console.error('Error al buscar contratación:', error);
        Swal.fire('Error', 'No se pudo obtener la contratación', 'error');
      }
    });
  }

  // Métodos de guardado (mock)
  guardarInfoPersonal(): void {

    if (this.infoPersonalForm.valid) {
      // Aquí podrías enviar a un servicio
      Swal.fire('Guardado', 'Información personal actualizada correctamente.', 'success');
    }
  }

  guardarEntrevista(): void {
    if (this.entrevistaForm.valid) {
      Swal.fire('Guardado', 'Información de entrevista guardada.', 'success');
    }
  }

  guardarObservaciones(): void {
    if (this.observacionesForm.valid) {
      Swal.fire('Guardado', 'Observaciones registradas.', 'success');
    }
  }

  guardarVacantes(): void {
    if (this.vacantesForm.valid) {
      Swal.fire('Guardado', 'Información de vacantes registrada.', 'success');
    }
  }

  // Obtener el nombre completo
  getFullName(): string {
    const { primer_nombre, segundo_nombre, primer_apellido, segundo_apellido } = this.infoCandidatoForm || {};
    return `${primer_nombre || ''} ${segundo_nombre || ''} ${primer_apellido || ''} ${segundo_apellido || ''}`.trim();
  }

  // Calcular edad a partir del número de días desde 1 de enero de 1900
  calcularEdad(fecha: string): number {
    console.log('Fecha de nacimiento:', fecha);

    const fechaNacimiento = this.convertirAFecha(fecha);
    if (!fechaNacimiento) {
      return NaN; // Si la fecha no es válida
    }

    const today = new Date();
    let age = today.getFullYear() - fechaNacimiento.getFullYear();

    // Restar un año si aún no ha pasado el cumpleaños este año
    const monthDiff = today.getMonth() - fechaNacimiento.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < fechaNacimiento.getDate())) {
      age--;
    }
    return age;
  }

  // Convertir un número de días en una fecha válida (basado en el 1 de enero de 1900)
  convertirAFecha(fecha: string): Date | null {
    // Si la fecha es un número de días (solo contiene dígitos)
    if (/^\d+$/.test(fecha)) {
      const diasDesde1900 = Number(fecha);
      const fechaBase = new Date(1900, 0, 1); // 1 de enero de 1900
      fechaBase.setDate(fechaBase.getDate() + diasDesde1900);

      if (isNaN(fechaBase.getTime())) {
        return null;
      }

      return fechaBase;

      // Si la fecha está en formato "DD/MM/YYYY"
    } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(fecha)) {
      const [dia, mes, anio] = fecha.split('/').map(Number);
      if (!dia || !mes || !anio) {
        return null;
      }

      const fechaValida = new Date(anio, mes - 1, dia);

      if (isNaN(fechaValida.getTime())) {
        return null;
      }

      return fechaValida;

    } else {
      return null;
    }
  }

}
