import { Component, LOCALE_ID, OnInit, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SharedModule } from '../../../../../../shared/shared.module';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { FormArray, FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { catchError, of } from 'rxjs';
import Swal from 'sweetalert2';
import { UtilityServiceService } from '@/app/shared/services/utilityService/utility-service.service';
import { HelpInformationComponent } from '../../components/help-information/help-information.component';
import { MatTableDataSource } from '@angular/material/table';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { HiringService } from '../../service/hiring.service';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DateAdapter, MAT_DATE_FORMATS, MAT_DATE_LOCALE, MatNativeDateModule } from '@angular/material/core';
import { HiringQuestionsComponent } from '../../components/hiring-questions/hiring-questions.component';
import { MomentDateAdapter } from '@angular/material-moment-adapter';
import { Router } from '@angular/router';
import { SeleccionService } from '../../service/seleccion/seleccion.service';
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
  selector: 'app-recruitment-pipeline',
  imports: [
    MatIconModule,
    MatTabsModule,
    SharedModule,
    FormsModule,
    SearchForCandidateComponent,
    SelectionQuestionsComponent,
    HelpInformationComponent,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatDatepickerModule,
    MatNativeDateModule,
    HiringQuestionsComponent

  ],
  templateUrl: './recruitment-pipeline.component.html',
  styleUrl: './recruitment-pipeline.component.css',
  providers: [
    { provide: LOCALE_ID, useValue: 'es-CO' },
    { provide: MAT_DATE_LOCALE, useValue: 'es-CO' },
    { provide: DateAdapter, useClass: MomentDateAdapter, deps: [MAT_DATE_LOCALE] },
    { provide: MAT_DATE_FORMATS, useValue: MY_DATE_FORMATS }
  ]
})

export class RecruitmentPipelineComponent implements OnInit {

  cedulaActual = '';
  codigoContrato = '';
  nombreCandidato = '';
  filtro = '';
  vacantes: any[] = [];
  idvacante = '';
  // Añadir dentro de la clase RecruitmentPipelineComponent
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = [
    'cargo',
    'finca',
    'empresaUsuariaSolicita',
    'experiencia',
    'fechaPublicado',
    'acciones'
  ];
  // Formularios de ayuda
  datosPersonales!: FormGroup;
  // datosPersonalesParte2!: FormGroup;
  // datosTallas!: FormGroup;
  datosFamiliares!: FormGroup;
  datosConyugue!: FormGroup;
  datosPadre!: FormGroup;
  datosMadre!: FormGroup;
  datosReferencias!: FormGroup;
  datosExperienciaLaboral!: FormGroup;
  datosHijos!: FormGroup;
  datosParte3Seccion1!: FormGroup;
  datosParte3Seccion2!: FormGroup;
  datosParte4!: FormGroup;
  //
  examFiles: File[] = []; // Guardamos los archivos PDF por índice
  formGroup3: FormGroup;

  @ViewChild(SelectionQuestionsComponent)
  selectionQuestionsComponent!: SelectionQuestionsComponent;

  @ViewChild(HelpInformationComponent)
  helpInformationComponent!: HelpInformationComponent;

  uploadedFiles: { [key: string]: { file?: File; fileName?: string } } = {
    eps: { fileName: 'No disponible, falta cargar' },
    afp: { fileName: 'No disponible, falta cargar' },
    policivos: { fileName: 'No disponible, falta cargar' },
    procuraduria: { fileName: 'No disponible, falta cargar' },
    contraloria: { fileName: 'No disponible, falta cargar' },
    ramaJudicial: { fileName: 'No disponible, falta cargar' },
    medidasCorrectivas: { fileName: 'No disponible, falta cargar' },
    sisben: { fileName: 'No disponible, falta cargar' },
    ofac: { fileName: 'No disponible, falta cargar' },
    examenesMedicos: { fileName: 'No disponible, falta cargar' },
    figuraHumana: { fileName: 'No disponible, falta cargar' },
    pensionSemanas: { fileName: 'No disponible, falta cargar' },
  };


  typeMap: { [key: string]: number } = {
    eps: 7,
    policivos: 6,
    procuraduria: 3,
    contraloria: 4,
    medidasCorrectivas: 10,
    afp: 11,
    ramaJudicial: 12,
    sisben: 8,
    ofac: 5,
    figuraHumana: 31,
    examenesMedicos: 32,
    pensionSemanas: 33
  };

  filteredExamOptions: string[] = [];

  constructor(
    private vacantesService: VacantesService,
    private utilityService: UtilityServiceService,
    private contratacionService: HiringService,
    private seleccionService: SeleccionService,
    private gestionDocumentalService: GestionDocumentalService,
    private router: Router,
    private fb: FormBuilder,
  ) {

    // Cargar lista completa de exámenes disponibles
    this.filteredExamOptions = [
      'Exámen Ingreso',
      'Colinesterasa',
      'Glicemia Basal',
      'Perfil lípidico',
      'Visiometria',
      'Optometría',
      'Audiometría',
      'Espirometría',
      'Sicometrico',
      'Frotis de uñas',
      'Frotis de garganta',
      'Cuadro hematico',
      'Creatinina',
      'TGO',
      'Coprológico',
      'Osteomuscular',
      'Quimico (Respiratorio - Dermatologico)',
      'Tegumentaria',
      'Cardiovascular',
      'Trabajo en alturas (Incluye test para detección de fobia a las alturas: El AQ (Acrophobia Questionnaire) de Cohen)',
      'Electrocardiograma (Sólo aplica para mayores de 45 años)',
      'Examen Médico',
      'HEPATITIS A Y B',
      'TETANO VACUNA T-D',
      'Exámen médico integral definido para conductores'
    ];

    this.formGroup3 = this.fb.group({
      ips: ['', Validators.required],
      ipsLab: ['', Validators.required],
      selectedExams: [[], Validators.required],
      selectedExamsArray: this.fb.array([]) // Se llenará dinámicamente
    });

    // Para actualizar los campos dinámicos cuando se seleccionan exámenes:
    this.formGroup3.get('selectedExams')!.valueChanges.subscribe((exams: string[]) => {
      const examsArray = this.formGroup3.get('selectedExamsArray') as FormArray;
      // Limpiar primero
      while (examsArray.length) examsArray.removeAt(0);
      // Agregar uno por cada examen seleccionado
      exams.forEach(() => {
        examsArray.push(this.fb.group({
          aptoStatus: ['', Validators.required]
        }));
      });
    });



    this.datosPersonales = this.fb.group({
      tipodedocumento: [''],
      numerodeceduladepersona: [''],
      numerodeceduladepersona2: [''],
      primer_apellido: [''],
      segundo_apellido: [''],
      primer_nombre: [''],
      segundo_nombre: [''],
      //genero: [''],
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
      //zurdo_diestro: [''],
      hacecuantoviveenlazona: [''],
      lugar_anterior_residencia: [''],
      hace_cuanto_se_vino_y_porque: [''],
      zonas_del_pais: [''],
      //donde_le_gustaria_vivir: [''],
      fecha_nacimiento: [''],
      //estudia_actualmente: [''],
      familiar_emergencia: [''],
      parentesco_familiar_emergencia: [''],
      direccion_familiar_emergencia: [''],
      barrio_familiar_emergencia: [''],
      telefono_familiar_emergencia: [''],
      ocupacion_familiar_emergencia: [''],

      tipo_vivienda: [''],
      tipo_vivienda_2p: [''],
      caractteristicas_vivienda: [''],
      servicios: [''],
      personas_con_quien_convive: [''],
      experienciaSignificativa: [''],
      expectativas_de_vida: [''],


    });
    /*
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
        });*/

    this.datosFamiliares = this.fb.group({
      nombre_padre: [''],
      vive_padre: [''],
      ocupacion_padre: [''],
      direccion_padre: [''],
      telefono_padre: [''],
      barrio_padre: [''],

      nombre_madre: [''],
      vive_madre: [''],
      ocupacion_madre: [''],
      direccion_madre: [''],
      telefono_madre: [''],
      barrio_madre: [''],

      nombre_conyugue: [''],
      apellido_conyugue: [''],
      vive_con_el_conyugue: [''],
      direccion_conyugue: [''],
      telefono_conyugue: [''],
      barrio_municipio_conyugue: [''],
      ocupacion_conyugue: ['']
    });
    /*
        this.datosConyugue = this.fb.group({

        });

        this.datosPadre = this.fb.group({

        });

        this.datosMadre = this.fb.group({

        });*/

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
      familia_con_un_solo_ingreso: [''],
      como_se_entero: ['']
    });

    this.datosParte3Seccion2 = this.fb.group({

      num_habitaciones: [''],
      num_personas_por_habitacion: [''],
    });

    this.datosParte4 = this.fb.group({
      actividadesDi: [''],
      motivacion: ['']
    });
  }

  ngOnInit(): void {
    this.loadData();
  }

  async loadData(): Promise<void> {
    this.vacantesService.listarVacantes().pipe(
      catchError((error) => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes', 'error');
        return of([]);
      })
    ).subscribe((response: any[]) => {
      if (!response || response.length === 0) {
        Swal.fire('Error', 'No se encontraron vacantes', 'error');
        return;
      }

      const user = this.utilityService.getUser();
      if (!user) {
        Swal.fire('Error', 'No se encontró información del usuario', 'error');
        return;
      }

      const sedeLoginLower = user.sucursalde?.toLowerCase?.() || '';

      this.vacantes = response.filter(vacante =>
        Array.isArray(vacante.oficinasQueContratan) &&
        vacante.oficinasQueContratan.some((oficina: { nombre: string; }) =>
          oficina.nombre?.toLowerCase() === sedeLoginLower
        )
      );
      this.dataSource.data = this.vacantes;
    });
  }

  filtrarVacantes(): any[] {
    if (!this.filtro) return this.vacantes;
    const filtroLower = this.filtro.toLowerCase();

    return this.vacantes.filter(vacante =>
      [
        vacante.cargo,
        vacante.finca,
        vacante.empresaUsuariaSolicita,
        vacante.temporal
      ]
        .some(field => field?.toLowerCase?.().includes(filtroLower))
    );
  }

  escogerVacante(vacante: any): void {
    Swal.fire(
      'Vacante seleccionada',
      'La vacante ha sido almacenada para ejecutarla en su proceso de selección',
      'success'
    );

    if (vacante) {
      this.idvacante = vacante.id;
      this.helpInformationComponent?.recibirVacante(vacante);
    }
  }

  onCedulaSeleccionada(cedula: string): void {
    this.cedulaActual = cedula;
  }

  onCodigoContrato(codigo: string): void {
    this.codigoContrato = codigo;
  }

  // Método para obtener el nombre completo del candidato
  getFullName(nombre_completo: string): void {
    if (nombre_completo) {
      this.nombreCandidato = nombre_completo;
    } else {
      this.nombreCandidato = '';
    }
  }

  // Este método se llama desde el input en la plantilla HTML
  applyFilterManual(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
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
    const userData = JSON.parse(localStorage.getItem('user') || '{}');
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


  generacionDocumentos() {
    // Guardar cedula y codigoContrato en el localStorage separados
    localStorage.setItem('cedula', this.cedulaActual);
    localStorage.setItem('codigoContrato', this.codigoContrato);
    // empresa
    this.guardarFormulariosEnLocalStorage();
    // Redirige a la página de generación de documentos
    this.router.navigate(['dashboard/hiring/generate-contracting-documents']);
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
      //datosPersonalesParte2: this.datosPersonalesParte2.value,
      //datosTallas: this.datosTallas.value,
      //datosConyugue: this.datosConyugue.value,
      //datosPadre: this.datosPadre.value,
      //datosMadre: this.datosMadre.value,
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







  // Método para fusionar PDFs y almacenarlo en uploadedFiles["examenesMedicos"]
  async imprimirSaludOcupacional(): Promise<void> {
    if (this.examFiles.length === 0 || this.examFiles.every(file => !file)) {
      Swal.fire({
        title: '¡Advertencia!',
        text: 'Debe subir al menos un archivo PDF.',
        icon: 'warning',
        confirmButtonText: 'Ok'
      });
      return;
    }

    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Generando documento PDF...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    try {
      // Crear un nuevo documento PDF
      const mergedPdf = await PDFDocument.create();

      for (const file of this.examFiles) {
        if (file) {
          const fileBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(fileBuffer);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
      }

      // Generar el PDF fusionado en Blob
      const mergedPdfBytes = await mergedPdf.save();
      const pdfBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

      // Guardar el archivo fusionado en uploadedFiles["examenesMedicos"]
      this.subirArchivo(pdfBlob, "examenesMedicos", "SaludOcupacional_Combinado.pdf");

      Swal.close(); // Cerrar la alerta de carga

      this.imprimirDocumentos();

    } catch (error) {
      Swal.close();
      Swal.fire({
        title: '¡Error!',
        text: 'Ocurrió un problema al fusionar los archivos PDF.',
        icon: 'error',
        confirmButtonText: 'Ok'
      });
    }
  }



  // Método que se ejecuta cuando se selecciona un archivo o se genera un PDF en memoria
  subirArchivo(event: any | Blob, campo: string, fileName?: string) {
    let file: File;

    if (event instanceof Blob) {
      // Si es un archivo generado en memoria (como el PDF fusionado)
      file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
    } else {
      // Si es un evento de input file (archivo seleccionado por el usuario)
      file = event.target.files[0];
    }

    if (file) {
      // Verificar si el nombre del archivo tiene más de 100 caracteres
      if (file.name.length > 100) {
        Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');
        return; // Salir de la función si la validación falla
      }

      // Si la validación es exitosa, almacenar el archivo en uploadedFiles
      this.uploadedFiles[campo] = { file: file, fileName: file.name };

      // Mensaje opcional de éxito
      // Swal.fire('Archivo subido', `Archivo ${file.name} subido para ${campo}`, 'success');
    }
  }

  imprimirDocumentos() {
    // Mostrar Swal de carga con ícono animado
    Swal.fire({
      title: 'Subiendo archivos...',
      icon: 'info',
      html: 'Por favor, espere mientras se suben los archivos.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading(); // Mostrar icono de carga animado
      }
    });
    const nombres = ["examenesMedicos", "figuraHumana", "pensionSemanas"];
    // Subir solo los primeros 9 archivos
    this.subirTodosLosArchivos(nombres)
      .then((allFilesUploaded) => {
        if (allFilesUploaded) {
          Swal.close(); // Cerrar el Swal de carga
          // Mostrar mensaje de éxito
          Swal.fire({
            title: '¡Éxito!',
            text: 'Datos y archivos guardados exitosamente',
            icon: 'success',
            confirmButtonText: 'Ok'
          });
        }
      })
      .catch((error) => {
        // Cerrar el Swal de carga y mostrar un mensaje de error
        Swal.close();
        Swal.fire({
          title: 'Error',
          text: `Hubo un error al subir los archivos: ${error}`,
          icon: 'error',
          confirmButtonText: 'Ok'
        });
      });
  }


  // Método para subir todos los archivos almacenados en uploadedFiles
  subirTodosLosArchivos(keysEspecificos: string[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      // Filtrar los archivos válidos basados en las keys específicas proporcionadas
      let archivosAEnviar = Object.keys(this.uploadedFiles)
        .filter(key => {
          const fileData = this.uploadedFiles[key];
          // Incluir solo las keys específicas y con un objeto `file` válido
          return keysEspecificos.includes(key) && fileData && fileData.file;
        })
        .map(key => ({
          key,
          ...this.uploadedFiles[key],
          typeId: this.typeMap[key] // Asignar el tipo documental (typeId)
        }));


      // Si no hay archivos para subir
      if (archivosAEnviar.length === 0) {
        resolve(true); // Resolver inmediatamente si no hay archivos
        return;
      }

      // Crear promesas para cada archivo
      const promesasDeSubida = archivosAEnviar.map(({ key, file, fileName, typeId }) => {
        return new Promise<void>((resolveSubida, rejectSubida) => {
          if (file && typeId) {
            // Verificar si la clave está entre ["examenesMedicos", "figuraHumana", "pensionSemanas"]
            if (["examenesMedicos", "figuraHumana", "pensionSemanas"].includes(key)) {
              // Si la clave coincide, incluir this.codigoContrato en guardarDocumento
              this.gestionDocumentalService
                .guardarDocumento(fileName, this.cedulaActual, typeId, file, this.codigoContrato)
                .subscribe({
                  next: () => {
                    resolveSubida(); // Resolver la promesa de este archivo
                  },
                  error: (error) => {
                    rejectSubida(`Error al subir archivo ${key}: ${error.message}`);
                  }
                });
            } else {
              // Si no coincide, usar el método normal
              this.gestionDocumentalService
                .guardarDocumento(fileName, this.cedulaActual, typeId, file) // Sin this.codigoContrato
                .subscribe({
                  next: () => {
                    resolveSubida(); // Resolver la promesa de este archivo
                  },
                  error: (error) => {
                    rejectSubida(`Error al subir archivo ${key}: ${error.message}`);
                  }
                });
            }
          } else {
            rejectSubida(`Archivo ${key} no tiene datos válidos`);
          }
        });
      });

      // Esperar a que todas las subidas terminen
      Promise.all(promesasDeSubida)
        .then(() => {
          resolve(true); // Resolver cuando todos los archivos hayan sido procesados
        })
        .catch((error) => {
          reject(error); // Rechazar si hay errores en alguna subida
        });
    });
  }

  // Guardar el archivo PDF seleccionado para cada examen
  onFileSelected(event: any, index: number): void {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
      this.examFiles[index] = file;
    } else {
      alert('Por favor, seleccione un archivo PDF válido.');
    }
  }


}
