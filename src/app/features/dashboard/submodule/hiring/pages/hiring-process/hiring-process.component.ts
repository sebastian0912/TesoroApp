import { SharedModule } from '@/app/shared/shared.module';
import { Component } from '@angular/core';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { HiringService } from '../../service/hiring.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import Swal from 'sweetalert2';
import { HiringQuestionsComponent } from '../../components/hiring-questions/hiring-questions.component';
import { Router } from '@angular/router';
import { UtilityServiceService } from '../../../../../../shared/services/utilityService/utility-service.service';

@Component({
  selector: 'app-hiring-process',
  imports: [
    MatIconModule,
    MatTabsModule,
    SharedModule,
    SearchForCandidateComponent,
    SelectionQuestionsComponent,
    MatDatepickerModule,
    MatNativeDateModule,
    HiringQuestionsComponent
  ],
  templateUrl: './hiring-process.component.html',
  styleUrl: './hiring-process.component.css'
})

export class HiringProcessComponent {
  cedulaActual: string = '';
  codigoContrato: string = '';

  // Formularios de ayuda
  datosPersonales!: FormGroup;
  datosPersonalesParte2!: FormGroup;
  datosTallas!: FormGroup;
  datosConyugue!: FormGroup;
  datosPadre!: FormGroup;
  datosMadre!: FormGroup;
  datosReferencias!: FormGroup;
  datosExperienciaLaboral!: FormGroup;
  datosHijos!: FormGroup;
  datosParte3Seccion1!: FormGroup;
  datosParte3Seccion2!: FormGroup;
  datosParte4!: FormGroup;

  constructor(
    private contratacionService: HiringService,
    private utilityServiceService: UtilityServiceService,
    private fb: FormBuilder,
    private router: Router
  ) {
    this.datosPersonales = this.fb.group({
      tipodedocumento: [''],
      numerodeceduladepersona: [''],
      primer_apellido: [''],
      segundo_apellido: [''],
      primer_nombre: [''],
      segundo_nombre: [''],
      genero: [''],
      primercorreoelectronico: [''],
      celular: [''],
      whatsapp: [''],
      departamento: [''],
      municipio: [''],
      estado_civil: [''],
      direccion_residencia: [''],
      barrio: [''],
      fecha_expedicion_cc: [''],
      departamento_expedicion_cc: [''],
      municipio_expedicion_cc: [''],
      lugar_nacimiento_municipio: [''],
      lugar_nacimiento_departamento: [''],
      rh: [''],
      zurdo_diestro: [''],
      hacecuantoviveenlazona: [''],
      lugar_anterior_residencia: [''],
      hace_cuanto_se_vino_y_porque: [''],
      zonas_del_pais: [''],
      donde_le_gustaria_vivir: [''],
      fecha_nacimiento: [''],
      estudia_actualmente: [''],
      familiar_emergencia: [''],
      parentesco_familiar_emergencia: [''],
      direccion_familiar_emergencia: [''],
      barrio_familiar_emergencia: [''],
      telefono_familiar_emergencia: [''],
      ocupacion_familiar_emergencia: ['']
    });

    this.datosPersonalesParte2 = this.fb.group({
      escolaridad: [''],
      estudiosExtra: [''],
      nombre_institucion: [''],
      ano_finalizacion: [''],
      titulo_obtenido: ['']
    });

    this.datosTallas = this.fb.group({
      chaqueta: [''],
      pantalon: [''],
      camisa: [''],
      calzado: ['']
    });

    this.datosConyugue = this.fb.group({
      nombre_conyugue: [''],
      apellido_conyugue: [''],
      num_doc_identidad_conyugue: [''],
      vive_con_el_conyugue: [''],
      direccion_conyugue: [''],
      telefono_conyugue: [''],
      barrio_municipio_conyugue: [''],
      ocupacion_conyugue: ['']
    });

    this.datosPadre = this.fb.group({
      nombre_padre: [''],
      vive_padre: [''],
      ocupacion_padre: [''],
      direccion_padre: [''],
      telefono_padre: [''],
      barrio_padre: ['']
    });

    this.datosMadre = this.fb.group({
      nombre_madre: [''],
      vive_madre: [''],
      ocupacion_madre: [''],
      direccion_madre: [''],
      telefono_madre: [''],
      barrio_madre: ['']
    });

    this.datosReferencias = this.fb.group({
      nombre_referencia_personal1: [''],
      telefono_referencia_personal1: [''],
      ocupacion_referencia_personal1: [''],
      tiempo_conoce_referencia_personal1: [''],
      nombre_referencia_personal2: [''],
      telefono_referencia_personal2: [''],
      ocupacion_referencia_personal2: [''],
      tiempo_conoce_referencia_personal2: [''],
      nombre_referencia_familiar1: [''],
      telefono_referencia_familiar1: [''],
      ocupacion_referencia_familiar1: [''],
      parentesco_referencia_familiar1: [''],
      nombre_referencia_familiar2: [''],
      telefono_referencia_familiar2: [''],
      ocupacion_referencia_familiar2: [''],
      parentesco_referencia_familiar2: ['']
    });

    this.datosExperienciaLaboral = this.fb.group({
      nombre_expe_laboral1_empresa: [''],
      direccion_empresa1: [''],
      telefonos_empresa1: [''],
      nombre_jefe_empresa1: [''],
      fecha_retiro_empresa1: [''],
      motivo_retiro_empresa1: [''],
      cargo_empresa1: [''],
      empresas_laborado: [''],
      labores_realizadas: [''],
      rendimiento: [''],
      porqueRendimiento: [''],
      personas_a_cargo: [''],
      como_es_su_relacion_familiar: ['']
    });

    this.datosHijos = this.fb.group({
      num_hijos_dependen_economicamente: [''],
      quien_los_cuida: [''],
      hijosArray: this.fb.array([]) // Inicializamos el FormArray vacío
    });

    this.datosParte3Seccion1 = this.fb.group({
      personas_con_quien_convive: [''],
      familia_con_un_solo_ingreso: [''],
      como_se_entero: ['']
    });

    this.datosParte3Seccion2 = this.fb.group({
      tipo_vivienda: [''],
      num_habitaciones: [''],
      num_personas_por_habitacion: [''],
      tipo_vivienda_2p: [''],
      caractteristicas_vivienda: [''],
      servicios: [''],
      expectativas_de_vida: ['']
    });

    this.datosParte4 = this.fb.group({
      actividadesDi: [''],
      experienciaSignificativa: [''],
      motivacion: ['']
    });
  }

  onCedulaSeleccionada(cedula: string) {
    this.cedulaActual = cedula;
    this.loadData();
  }

  onCodigoContrato(codigo: string): void {
    this.codigoContrato = codigo;
  }

  loadData() {
    this.contratacionService.buscarEncontratacion(this.cedulaActual).subscribe(
      (data) => {
        this.llenarInformacion(data.data[0]);
      },
      (error) => {
        Swal.fire({
          title: '¡Error!',
          text: 'Hubo un error al cargar los datos.',
          icon: 'error',
          confirmButtonText: 'Ok',
        });
      }
    );
  }

  llenarInformacion(infoformulario: any) {

    if (infoformulario) {
      // Llenar el formulario de Info Personal con los datos de infoformulario
      this.datosPersonales.patchValue({
        tipodedocumento: infoformulario.tipodedocumento || 'No disponible',
        numerodeceduladepersona: infoformulario.numerodeceduladepersona || 'No disponible',
        primer_apellido: infoformulario.primer_apellido || '',
        segundo_apellido: infoformulario.segundo_apellido || '',
        primer_nombre: infoformulario.primer_nombre || '',
        segundo_nombre: infoformulario.segundo_nombre || '',
        genero: infoformulario.genero || '',
        primercorreoelectronico: infoformulario.primercorreoelectronico || '',
        celular: infoformulario.celular || '',
        whatsapp: infoformulario.whatsapp || '',
        departamento: infoformulario.departamento || '',
        municipio: infoformulario.municipio || '',
        estado_civil: infoformulario.estado_civil || '',
        direccion_residencia: infoformulario.direccion_residencia || '',
        barrio: infoformulario.barrio || '',
        fecha_expedicion_cc: this.convertirAFecha(infoformulario.fecha_expedicion_cc),
        departamento_expedicion_cc: infoformulario.departamento_expedicion_cc || '',
        municipio_expedicion_cc: infoformulario.municipio_expedicion_cc || '',
        lugar_nacimiento_municipio: infoformulario.lugar_nacimiento_municipio || '',
        lugar_nacimiento_departamento: infoformulario.lugar_nacimiento_departamento || '',
        rh: infoformulario.rh || '',
        zurdo_diestro: infoformulario.zurdo_diestro || '',
        hacecuantoviveenlazona: infoformulario.hacecuantoviveenlazona || '',
        lugar_anterior_residencia: infoformulario.lugar_anterior_residencia || '',
        hace_cuanto_se_vino_y_porque: infoformulario.hace_cuanto_se_vino_y_porque || '',
        zonas_del_pais: infoformulario.zonas_del_pais || '',
        donde_le_gustaria_vivir: infoformulario.donde_le_gustaria_vivir || '',
        fecha_nacimiento: this.convertirAFecha(infoformulario.fecha_nacimiento),
        estudia_actualmente: infoformulario.estudia_actualmente || '',
        familiar_emergencia: infoformulario.familiar_emergencia || '',
        parentesco_familiar_emergencia: infoformulario.parentesco_familiar_emergencia || '',
        direccion_familiar_emergencia: infoformulario.direccion_familiar_emergencia || '',
        barrio_familiar_emergencia: infoformulario.barrio_familiar_emergencia || '',
        telefono_familiar_emergencia: infoformulario.telefono_familiar_emergencia || '',
        ocupacion_familiar_emergencia: infoformulario.ocupacion_familiar_emergencia || ''
      });

      this.datosPersonalesParte2.patchValue({
        escolaridad: infoformulario.escolaridad || 'No disponible',
        estudiosExtra: infoformulario.estudiosExtra || 'No disponible',
        nombre_institucion: infoformulario.nombre_institucion || '',
        ano_finalizacion: infoformulario.ano_finalizacion || '',
        titulo_obtenido: infoformulario.titulo_obtenido || ''
      });

      this.datosTallas.patchValue({
        chaqueta: infoformulario.chaqueta || 'No disponible',
        pantalon: infoformulario.pantalon || 'No disponible',
        camisa: infoformulario.camisa || 'No disponible',
        calzado: infoformulario.calzado || 'No disponible'
      });

      this.datosConyugue.patchValue({
        nombre_conyugue: infoformulario.nombre_conyugue || '',
        apellido_conyugue: infoformulario.apellido_conyugue || '',
        num_doc_identidad_conyugue: infoformulario.num_doc_identidad_conyugue || '',
        vive_con_el_conyugue: infoformulario.vive_con_el_conyugue || '',
        direccion_conyugue: infoformulario.direccion_conyugue || '',
        telefono_conyugue: infoformulario.telefono_conyugue || '',
        barrio_municipio_conyugue: infoformulario.barrio_municipio_conyugue || '',
        ocupacion_conyugue: infoformulario.ocupacion_conyugue || ''
      });

      this.datosPadre.patchValue({
        nombre_padre: infoformulario.nombre_padre || '',
        vive_padre: infoformulario.vive_padre || '',
        ocupacion_padre: infoformulario.ocupacion_padre || '',
        direccion_padre: infoformulario.direccion_padre || '',
        telefono_padre: infoformulario.telefono_padre || '',
        barrio_padre: infoformulario.barrio_padre || ''
      });

      this.datosMadre.patchValue({
        nombre_madre: infoformulario.nombre_madre || '',
        vive_madre: infoformulario.vive_madre || '',
        ocupacion_madre: infoformulario.ocupacion_madre || '',
        direccion_madre: infoformulario.direccion_madre || '',
        telefono_madre: infoformulario.telefono_madre || '',
        barrio_madre: infoformulario.barrio_madre || ''
      });

      this.datosReferencias.patchValue({
        nombre_referencia_personal1: infoformulario.nombre_referencia_personal1 || '',
        telefono_referencia_personal1: infoformulario.telefono_referencia_personal1 || '',
        ocupacion_referencia_personal1: infoformulario.ocupacion_referencia_personal1 || '',
        tiempo_conoce_referencia_personal1: infoformulario.tiempo_conoce_referencia_personal1 || '',
        nombre_referencia_personal2: infoformulario.nombre_referencia_personal2 || '',
        telefono_referencia_personal2: infoformulario.telefono_referencia_personal2 || '',
        ocupacion_referencia_personal2: infoformulario.ocupacion_referencia_personal2 || '',
        tiempo_conoce_referencia_personal2: infoformulario.tiempo_conoce_referencia_personal2 || '',
        nombre_referencia_familiar1: infoformulario.nombre_referencia_familiar1 || '',
        telefono_referencia_familiar1: infoformulario.telefono_referencia_familiar1 || '',
        ocupacion_referencia_familiar1: infoformulario.ocupacion_referencia_familiar1 || '',
        parentesco_referencia_familiar1: infoformulario.parentesco_referencia_familiar1 || '',
        nombre_referencia_familiar2: infoformulario.nombre_referencia_familiar2 || '',
        telefono_referencia_familiar2: infoformulario.telefono_referencia_familiar2 || '',
        ocupacion_referencia_familiar2: infoformulario.ocupacion_referencia_familiar2 || '',
        parentesco_referencia_familiar2: infoformulario.parentesco_referencia_familiar2 || ''
      });

      this.datosExperienciaLaboral.patchValue({
        nombre_expe_laboral1_empresa: infoformulario.nombre_expe_laboral1_empresa || '',
        direccion_empresa1: infoformulario.direccion_empresa1 || '',
        telefonos_empresa1: infoformulario.telefonos_empresa1 || '',
        nombre_jefe_empresa1: infoformulario.nombre_jefe_empresa1 || '',
        fecha_retiro_empresa1: this.convertirAFecha(infoformulario.fecha_retiro_empresa1) || '',
        motivo_retiro_empresa1: infoformulario.motivo_retiro_empresa1 || '',
        cargo_empresa1: infoformulario.cargo_empresa1 || '',
        empresas_laborado: infoformulario.empresas_laborado || '',
        labores_realizadas: infoformulario.labores_realizadas || '',
        rendimiento: infoformulario.rendimiento || '',
        porqueRendimiento: infoformulario.porqueRendimiento || '',
        personas_a_cargo: infoformulario.personas_a_cargo || '',
        como_es_su_relacion_familiar: infoformulario.como_es_su_relacion_familiar || ''
      });

      this.datosParte3Seccion1.patchValue({
        personas_con_quien_convive: infoformulario.personas_con_quien_convive || '',
        familia_con_un_solo_ingreso: infoformulario.familia_con_un_solo_ingreso || '',
        como_se_entero: infoformulario.como_se_entero || ''
      });

      this.datosParte3Seccion2.patchValue({
        tipo_vivienda: infoformulario.tipo_vivienda || '',
        num_habitaciones: infoformulario.num_habitaciones || '',
        num_personas_por_habitacion: infoformulario.num_personas_por_habitacion || '',
        tipo_vivienda_2p: infoformulario.tipo_vivienda_2p || '',
        caractteristicas_vivienda: infoformulario.caracteristicas_vivienda || '',
        servicios: infoformulario.servicios || '',
        expectativas_de_vida: infoformulario.expectativas_de_vida || ''
      });

      this.datosParte4.patchValue({
        actividadesDi: infoformulario.actividadesDi || '',
        experienciaSignificativa: infoformulario.experienciaSignificativa || '',
        motivacion: infoformulario.motivacion || ''
      });

      this.datosHijos.patchValue({
        num_hijos_dependen_economicamente: infoformulario.num_hijos_dependen_economicamente || '',
        quien_los_cuida: infoformulario.quien_los_cuida || ''
      });

      // Llenar el arreglo de hijos si está disponible
      if (infoformulario.hijos && Array.isArray(infoformulario.hijos)) {
        this.llenarDatosHijos(infoformulario.hijos);
      }
    }

  }

  // Método para agregar un hijo al FormArray
  agregarHijo(hijo: any) {
    const hijoForm = this.fb.group({
      nombre: [hijo.nombre || ''],
      sexo: [hijo.sexo || ''],
      fecha_nacimiento: [hijo.fecha_nacimiento || ''],
      no_documento: [hijo.no_documento || ''],
      estudia_o_trabaja: [hijo.estudia_o_trabaja || ''],
      curso: [hijo.curso || '']
    });
    this.hijosArray.push(hijoForm);
  }

  // Método para llenar el FormArray con el arreglo de hijos
  llenarDatosHijos(hijos: any[]) {
    this.hijosArray.clear(); // Limpiamos el FormArray antes de llenarlo
    hijos.forEach(hijo => this.agregarHijo(hijo));
  }


  async validarCampos() {
    // Helper para formatear fechas en dd/mm/yyyy
    const formatFecha = (fecha: string | Date | null): string => {
      if (!fecha) return '';
      const dateObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
      const dia = String(dateObj.getDate()).padStart(2, '0');
      const mes = String(dateObj.getMonth() + 1).padStart(2, '0'); // Meses comienzan en 0
      const anio = dateObj.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };

    // Helper para formatear fecha y hora local en dd/mm/yyyy hh:mm:ss
    const formatFechaHora = (fecha: string | Date): string => {
      const dateObj = typeof fecha === 'string' ? new Date(fecha) : fecha;
      const dia = String(dateObj.getDate()).padStart(2, '0');
      const mes = String(dateObj.getMonth() + 1).padStart(2, '0');
      const anio = dateObj.getFullYear();
      const horas = String(dateObj.getHours()).padStart(2, '0');
      const minutos = String(dateObj.getMinutes()).padStart(2, '0');
      const segundos = String(dateObj.getSeconds()).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;
    };

    // Obtener datos del local storage
    const userData = this.utilityServiceService.getUser() || 'null';
    const nombreQuienValidoInformacion = `${userData.primer_nombre || ''} ${userData.primer_apellido || ''}`.trim();

    // Obtén los valores del formulario y formatea las fechas
    const payload = {
      numeroCedula: this.cedulaActual, // Asegúrate de obtener la cédula del formulario o componente
      codigoContrato: this.codigoContrato, // Asegúrate de obtener el código de contrato
      nombreQuienValidoInformacion, // Usa el nombre completo obtenido del local storage
      fechaHoraValidacion: formatFechaHora(new Date()), // Formatea la fecha con hora local
      primerApellido: this.datosPersonales.get('primer_apellido')?.value,
      segundoApellido: this.datosPersonales.get('segundo_apellido')?.value,
      primerNombre: this.datosPersonales.get('primer_nombre')?.value,
      segundoNombre: this.datosPersonales.get('segundo_nombre')?.value,
      fechaNacimiento: formatFecha(this.datosPersonales.get('fecha_nacimiento')?.value),
      fechaExpedicionCC: formatFecha(this.datosPersonales.get('fecha_expedicion_cc')?.value),
    };

    // Llama al servicio
    try {
      const response = await this.contratacionService.validarInformacionContratacion(payload);
      Swal.fire({
        title: '¡Información validada!',
        text: 'La información ha sido validada correctamente.',
        icon: 'success',
        confirmButtonText: 'Ok',
      });
    } catch (error) {
      Swal.fire({
        title: '¡Error!',
        text: 'Hubo un error al enviar la información.',
        icon: 'error',
        confirmButtonText: 'Ok',
      });
    }
  }

  get hijosArray(): FormArray {
    return this.datosHijos.get('hijosArray') as FormArray;
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


  generacionDocumentos() {
    // Guardar cedula y codigoContrato en el localStorage separados
    localStorage.setItem('cedula', this.cedulaActual);
    localStorage.setItem('codigoContrato', this.codigoContrato);
    // empresa
    this.guardarFormulariosEnLocalStorage();
    // Redirige a la página de generación de documentos
    this.router.navigate(['dashboard/hiring/generate-contracting-documents', this.cedulaActual]);
  }

  guardarFormulariosEnLocalStorage() {
    // Leer lo que ya hay en localStorage
    const stored = localStorage.getItem('formularios');
    let formularios: any = {};

    if (stored) {
      formularios = JSON.parse(stored); // conservar lo anterior
    }

    // Actualizar o agregar los datos nuevos
    formularios = {
      ...formularios, // mantiene lo que ya tenía
      datosPersonales: this.datosPersonales.value,
      datosPersonalesParte2: this.datosPersonalesParte2.value,
      datosTallas: this.datosTallas.value,
      datosConyugue: this.datosConyugue.value,
      datosPadre: this.datosPadre.value,
      datosMadre: this.datosMadre.value,
      datosReferencias: this.datosReferencias.value,
      datosExperienciaLaboral: this.datosExperienciaLaboral.value,
      datosHijos: this.datosHijos.value,
      datosParte3Seccion1: this.datosParte3Seccion1.value,
      datosParte3Seccion2: this.datosParte3Seccion2.value,
      datosParte4: this.datosParte4.value,

    };

    // Guardar de nuevo el objeto completo
    localStorage.setItem('formularios', JSON.stringify(formularios));
  }


}
