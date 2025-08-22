import { Component, LOCALE_ID, OnInit, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SharedModule } from '../../../../../../shared/shared.module';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { AbstractControl, FormArray, FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { InfoVacantesService } from '../../service/info-vacantes/info-vacantes.service';
import { TablaComponent } from '@/app/shared/components/tabla/tabla.component';
import { ColumnConfig } from '@/app/shared/models/advanced-table-interface';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ColumnDefinition, StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';

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
    HiringQuestionsComponent,
    MatTooltipModule,

    MatDialogModule

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
  idInfoEntrevistaAndrea = 0;
  filtro = '';
  vacantes: any[] = [];
  idvacante = 0;
  idVacanteContratacion = 0;
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
    eps: { fileName: 'Adjuntar documento' },
    afp: { fileName: 'Adjuntar documento' },
    policivos: { fileName: 'Adjuntar documento' },
    procuraduria: { fileName: 'Adjuntar documento' },
    contraloria: { fileName: 'Adjuntar documento' },
    ramaJudicial: { fileName: 'Adjuntar documento' },
    medidasCorrectivas: { fileName: 'Adjuntar documento' },
    sisben: { fileName: 'Adjuntar documento' },
    ofac: { fileName: 'Adjuntar documento' },
    examenesMedicos: { fileName: 'Adjuntar documento' },
    figuraHumana: { fileName: 'Adjuntar documento' },
    pensionSemanas: { fileName: 'Adjuntar documento' },
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

  // Donde uses el componente TablaComponent (ej. en un componente padre)
  columns: ColumnConfig[] = [
    {
      header: 'Fecha de Creación',
      columnDef: 'created_at',
      type: 'date',
      cellFn: (row: any) => new Date(row.created_at).toLocaleString(), // Puedes ajustar formato
      placeholder: 'Filtrar por fecha'
    },
    {
      header: 'Observación de Aplicación',
      columnDef: 'aplicaObservacion',
      type: 'text',
      placeholder: 'Buscar...'
    },
    {
      header: 'Motivo No Aplica',
      columnDef: 'motivoNoAplica',
      type: 'text',
      placeholder: 'Buscar...'
    },
    {
      header: 'Retroalimentación Final',
      columnDef: 'retroalimentacion_final',
      type: 'text',
      placeholder: 'Buscar...'
    }
  ];

  constructor(
    private vacantesService: VacantesService,
    private utilityService: UtilityServiceService,
    private contratacionService: HiringService,
    private seleccionService: SeleccionService,
    private gestionDocumentalService: GestionDocumentalService,
    private router: Router,
    private fb: FormBuilder,
    private infoVacantesService: InfoVacantesService,
    private dialog: MatDialog
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
    const user = this.utilityService.getUser();
    if (!user) {
      Swal.fire('Error', 'No se encontró información del usuario', 'error');
      return;
    }


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

    this.contratacionService.traerDatosSeleccion(this.cedulaActual).subscribe((response: any) => {
      const list = response?.procesoSeleccion;
      if (!Array.isArray(list) || list.length === 0) return;

      // ✅ primer elemento
      const data = list[1];

      // ----- 1) Setear IPS / IPSLAB -----
      this.formGroup3.patchValue({
        ips: data?.ips ?? '',
        // en el JSON viene "ipslab" (todo minúscula). Mapea a tu control "ipsLab".
        ipsLab: data?.ipslab ?? data?.ipsLab ?? ''
      });

      // ----- 2) Parsear examenes y aptosExamenes -----
      const examenesArr = String(data?.examenes || '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);

      const aptosArr = String(data?.aptosExamenes || '')
        .split(',')
        .map(s => s.trim().toUpperCase())
        .filter(Boolean);

      // Emparejar longitudes (por seguridad)
      const len = Math.min(examenesArr.length, aptosArr.length);
      const selectedExams = examenesArr.slice(0, len);
      const selectedAptos = aptosArr.slice(0, len);

      // ----- 3) Cargar en el formulario -----
      // selectedExams: lista simple (tu <mat-select multiple> o donde la uses)
      this.formGroup3.get('selectedExams')?.setValue(selectedExams);

      // selectedExamsArray: FormArray de grupos { aptoStatus: 'APTO'|'NO APTO' }
      const fa = this.fb.array(
        selectedAptos.map(status =>
          this.fb.group({
            aptoStatus: [status || 'APTO'] // si falta, por defecto APTO
          })
        )
      );

      this.formGroup3.setControl('selectedExamsArray', fa);

      // (Opcional) Si además quieres llenar otros campos que coincidan por nombre:
      // this.formGroup3.patchValue(data, { onlySelf: false });
    });
  }


  onCodigoContrato(codigo: string): void {
    this.codigoContrato = codigo;
    console.log('Código de contrato:', this.codigoContrato);
  }

  // id de info entrevista andrea
  onIdInfoEntrevistaAndreaChange(id: number): void {
    this.idInfoEntrevistaAndrea = id;
  }

  //OnIdVacanteChange
  onIdVacanteChange(id: number): void {
    this.idvacante = id;
    console.log('ID de vacante cambiado:', id);
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
    console.log('Generando documentos...');
    console.log('Cedula actual:', this.cedulaActual);
    console.log('Codigo de contrato:', this.codigoContrato);

    // Si no existe la cedula, mostrar un mensaje de error
    if (!this.cedulaActual || !this.codigoContrato) {
      Swal.fire('Error', 'Debe seleccionar un candidato primero', 'error');
      return;
    }
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
    console.log('idInfoEntrevistaAndrea:', this.idInfoEntrevistaAndrea);
    console.log('idVacanteContratacion:', this.idVacanteContratacion);
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
      vacante: this.idvacante !== 0
        ? this.idvacante
        : this.idVacanteContratacion,
      entrevista_andrea: this.idInfoEntrevistaAndrea

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
      const mergedPdf = await PDFDocument.create();

      for (const file of this.examFiles) {
        if (file) {
          const fileBuffer = await file.arrayBuffer();
          const pdf = await PDFDocument.load(fileBuffer);
          const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
      }

      const mergedPdfBytes = await mergedPdf.save();
      const pdfBlob = new Blob([mergedPdfBytes], { type: 'application/pdf' });

      this.subirArchivo(pdfBlob, "examenesMedicos", "SaludOcupacional_Combinado.pdf");

      Swal.close();
      this.imprimirDocumentos();

      // 📌 Actualizar estado examenes_medicos
      if (this.idInfoEntrevistaAndrea) {
        this.infoVacantesService
          .setEstadoVacanteAplicante(this.idInfoEntrevistaAndrea, 'examenes_medicos', true)
          .subscribe({
            next: () => console.log('Estado examenes_medicos actualizado ✅'),
            error: () => console.warn('No se pudo actualizar el estado examenes_medicos ❌')
          });
      }

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

  // flag para evitar múltiples alerts durante el change detection
  private _warnedNoApto = false;

  get deshabilitarContratacion(): boolean {
    const fa = this.formGroup3?.get('selectedExamsArray') as FormArray | null;
    if (!fa || !Array.isArray(fa.controls) || fa.length === 0) {
      this._warnedNoApto = false;
      return false;
    }

    const hayNoApto = fa.controls.some((ctrl: AbstractControl) => {
      const v = String(ctrl.get('aptoStatus')?.value || '').trim().toUpperCase();
      return v === 'NO APTO';
    });

    if (hayNoApto && !this._warnedNoApto) {
      this._warnedNoApto = true;

      Swal.fire({
        icon: 'warning',
        title: 'Examen no apto',
        text: 'Hay al menos un examen con resultado "NO APTO". Se deshabilitará la pestaña de Contratación.',
        confirmButtonText: 'Entendido',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => {
        // 🔔 Solo avisa, no procesa
        this.utilityService.nextStep.emit();
      });
    } else {
      this.utilityService.nextStep.emit();
    }




    if (!hayNoApto && this._warnedNoApto) {
      this._warnedNoApto = false;
    }

    return hayNoApto;
  }


  onIdVacanteFromHiring(id: number): void {
    this.idVacanteContratacion = id;
    console.log('📌 ID de vacante recibido desde contratación:', id);
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

  mostrarTabla() {
    if (!this.cedulaActual) {
      Swal.fire('Error', 'Debe seleccionar un candidato primero', 'error');
      return;
    }

    this.infoVacantesService.getVacantesPorNumero(this.cedulaActual).pipe(
      catchError((error) => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes del candidato', 'error');
        return of([]);
      })
    ).subscribe((response: any[]) => {
      if (!response || response.length === 0) {
        Swal.fire('Error', 'No se encontraron vacantes para este candidato', 'error');
        return;
      }

      // --- Definición de columnas para StandardFilterTable ---
      const columns: ColumnDefinition[] = [
        { name: 'created_at', header: 'Fecha de creación', type: 'date', width: '180px' },
        { name: 'oficina', header: 'Oficina', type: 'text', width: '160px' },
        { name: 'aplica_o_no_aplica', header: 'Aplica o no aplica', type: 'text', width: '280px' },
        { name: 'motivoNoAplica', header: 'Motivo no aplica', type: 'text', width: '220px' },
        { name: 'aplicaObservacion', header: 'Retroalimentación', type: 'text', width: '280px' },
        { name: 'detalle', header: 'Detalle', type: 'text', width: '320px' },
        { name: 'actions', header: '', type: 'custom', width: '72px', stickyEnd: true, filterable: false },
      ];

      // (Opcional) Normaliza created_at a Date si llega con microsegundos (p.ej. 6 dígitos)
      const fixIso = (v: any): Date | null => {
        if (!v) return null;
        const d1 = new Date(v);
        if (!isNaN(d1.getTime())) return d1;
        const m = String(v).match(/^(.*\.\d{3})\d*(.*)$/);
        return m ? new Date(m[1] + m[2]) : null;
      };

      // Puedes pasar el response tal cual; StandardFilterTable solo renderiza lo que esté en columnDefinitions.
      // Aquí dejo el created_at “arreglado” para garantizar el sort/pipe de fecha.
      const data = response.map(r => ({
        ...r,
        created_at: fixIso(r.created_at)
      }));

      // --- Abre StandardFilterTable en un MatDialog y setea los @Input ---
      const dialogRef = this.dialog.open(StandardFilterTable, {
        minWidth: '90vw',
        height: '65vh'
      });

      dialogRef.componentInstance.tableTitle = 'Vacantes del candidato';
      dialogRef.componentInstance.columnDefinitions = columns;
      dialogRef.componentInstance.data = data;
      dialogRef.componentInstance.pageSizeOptions = [10, 20, 50];
      dialogRef.componentInstance.defaultPageSize = 10;

      console.log('Vacantes encontradas:', response);
    });
  }


}
