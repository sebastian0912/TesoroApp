import { Component, inject, LOCALE_ID, OnInit, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SharedModule } from '../../../../../../shared/shared.module';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { AbstractControl, FormArray, FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { catchError, firstValueFrom, of, take, throwError } from 'rxjs';
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
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';

export const MY_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY'
  }
};

interface Usuario {
  primer_nombre: string;
  primer_apellido: string;
  rol: string;
  sucursalde: string;
}

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
  idProcesoSeleccion: number | null = null; // id interno del proceso de selección

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
    examenesMedicos: { fileName: 'Adjuntar documento' },
  };

  typeMap: { [key: string]: number } = {
    examenesMedicos: 32
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
    this.initUsuarioYAbreviacion();
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

  private snackBar = inject(MatSnackBar);

  async onCedulaSeleccionada(cedula: string): Promise<void> {
    this.cedulaActual = cedula;
    this.mostrarTabla();

    // 1) Contratación: si 404 solo limpia y sigue (no crea nada aquí)
    this.seleccionService.buscarEncontratacion(this.cedulaActual)
      .pipe(
        take(1),
        catchError((err: HttpErrorResponse) => {
          if (err.status === 404) {
            this.codigoContratoActual = '';
            this.snackBar.open('No hay contratación asociada.', 'OK', { duration: 2500 });
            return of(null);
          }
          this.snackBar.open('Error al consultar contratación', 'OK', { duration: 3500 });
          console.error('buscarEncontratacion error:', err);
          return of(null);
        })
      )
      .subscribe((resp: any) => {
        this.codigoContratoActual = resp?.codigo_contrato || '';
      });

    // 2) Datos de selección: el backend crea (201) cuando antes era 404
    this.contratacionService.traerDatosSeleccion(this.cedulaActual)
      .pipe(
        take(1),
        catchError((err: HttpErrorResponse) => {
          // Si llega 404 aquí, normalmente falló la creación automática o no existe candidato
          if (err.status === 404) {

            Swal.fire('Atención', 'No fue posible crear el proceso de selección automáticamente.', 'warning');
            return of(null);
          }
          this.snackBar.open('Error al traer datos de selección', 'OK', { duration: 10000 });
          console.error('traerDatosSeleccion error:', err);
          return of(null);
        })
      )
      .subscribe(async (response: any) => {
        if (!response) return;
        // Caso creado por el backend (antes recibías 404)
        if (response.created && response.createdId) {
          this.idProcesoSeleccion = response.createdId;
          Swal.fire('Listo', 'Se creó el proceso de selección automáticamente.', 'success');
          this.iniciarNuevoProcesoUI(); // arranca flujo de nuevo proceso con el id
          return;
        }

        // Caso normal: ya había historial
        const list = Array.isArray(response?.procesoSeleccion) ? response.procesoSeleccion : [];
        if (list.length === 0) {
          // Respaldo defensivo
          this.iniciarNuevoProcesoUI();
          return;
        }

        // Top 2 por id DESC
        const topTwo = [...list]
          .filter(x => typeof x?.id === 'number')
          .sort((a, b) => b.id - a.id)
          .slice(0, 2);

        // Mostrar selector (permite “nuevo proceso”)
        const chosen = await this.elegirProcesoBonitoSinIdONuevo(topTwo);
        if (!chosen) return;

        // Si el usuario elige crear uno nuevo desde el selector
        if (chosen === 'NEW') {
          this.iniciarNuevoProcesoUI();
          return;
        }

        // --- Continuar con proceso existente ---
        const data = chosen;
        this.idProcesoSeleccion = data.id;
        this.idVacanteContratacion = data?.vacante ?? null;

        // 1) IPS / IPSLAB
        this.formGroup3.patchValue({
          ips: data?.ips ?? '',
          ipsLab: data?.ipslab ?? data?.ipsLab ?? ''
        });

        // 2) Exámenes y aptos
        const examenesArr = String(data?.examenes || '')
          .split(',').map((s: string) => s.trim()).filter(Boolean);

        const aptosArr = String(data?.aptosExamenes || '')
          .split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);

        const len = Math.min(examenesArr.length, aptosArr.length);
        const selectedExams = examenesArr.slice(0, len);
        const selectedAptos = aptosArr.slice(0, len);

        this.formGroup3.get('selectedExams')?.setValue(selectedExams);

        const fa = this.fb.array(
          selectedAptos.map((status: string) =>
            this.fb.group({ aptoStatus: [status || 'APTO'] })
          )
        );
        this.formGroup3.setControl('selectedExamsArray', fa);
      });
  }



  /** Limpia UI para iniciar un proceso nuevo */
  private iniciarNuevoProcesoUI(): void {
    this.idProcesoSeleccion = null; // nuevo proceso
    // Limpia campos relevantes
    this.formGroup3.patchValue({
      ips: '',
      ipsLab: '',
      selectedExams: []
    });
    this.formGroup3.setControl('selectedExamsArray', this.fb.array([]));
  }

  /** Modal con 2 tarjetas + opción “Crear nuevo proceso”; retorna objeto elegido o 'NEW' o null si cancela */
  private async elegirProcesoBonitoSinIdONuevo(items: any[]): Promise<any | 'NEW' | null> {
    const card = (it: any, checked = false) => {
      const fechaBonita = this.formatMarcaTemporal(it?.marcaTemporal);
      const evaluador = this.escapeHtml(it?.nombre_evaluador || '—');
      const ips = this.escapeHtml(it?.ips || '');
      return `
      <label class="proc-card">
        <input type="radio" name="procOption" value="${it.id}" ${checked ? 'checked' : ''}/>
        <div class="card">
          <div class="card-row">
            <span class="date">${fechaBonita}</span>
          </div>
          <div class="card-body">
            <div><b>Evaluador:</b> ${evaluador}</div>
            ${ips ? `<div><b>IPS:</b> ${ips}</div>` : ''}
          </div>
        </div>
      </label>
    `;
    };

    const newCard = `
    <label class="proc-card">
      <input type="radio" name="procOption" value="NEW"/>
      <div class="card new">
        <div class="new-title">Crear nuevo proceso</div>
        <div class="new-sub">Comenzar desde cero</div>
      </div>
    </label>
  `;

    const { isConfirmed } = await Swal.fire({
      title: '¿Cómo deseas continuar?',
      html: `
      <style>
        .proc-wrap{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:6px}
        .proc-card{cursor:pointer}
        .proc-card input{display:none}
        .proc-card .card{
          width: 300px; padding: 12px 14px; border-radius: 14px;
          border: 1px solid #e5e7eb; transition: all .15s ease; background: #fff;
          box-shadow: 0 1px 3px rgba(0,0,0,.06);
        }
        .proc-card .card.new{
          background: #f8fafc;
          border-style: dashed;
        }
        .proc-card .new-title{font-weight:700; color:#0f172a}
        .proc-card .new-sub{font-size:12px; color:#64748b}
        .proc-card input:checked + .card{
          border-color: #3f51b5; box-shadow: 0 0 0 3px rgba(63,81,181,.15);
        }
        .proc-card .card-row{display:flex;justify-content:flex-start;align-items:center;margin-bottom:8px}
        .date{font-size:13px;color:#374151;font-weight:600}
        .card-body{font-size:13px;color:#374151;line-height:1.35}
        .note{margin-top:8px;font-size:12px;color:#6b7280}
      </style>
      <div class="proc-wrap">
        ${items[0] ? card(items[0], true) : ''}
        ${items[1] ? card(items[1]) : ''}
        ${newCard}
      </div>
      <div class="note">
        Selecciona el registro por <b>fecha</b> (marcaTemporal) con el que quieres continuar
        o elige <b>Crear nuevo proceso</b>.
      </div>
    `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Continuar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const sel = (document.querySelector('input[name="procOption"]:checked') as HTMLInputElement)?.value;
        if (!sel) {
          Swal.showValidationMessage('Selecciona una opción');
          return false as any;
        }
        // guardamos en dataset de swal para leerlo luego
        (Swal as any).selectedOption = sel;
        return true;
      }
    });

    if (!isConfirmed) return null;

    const sel = (Swal as any).selectedOption as string;
    if (sel === 'NEW') return 'NEW';
    const idSel = Number(sel);
    return items.find(it => it.id === idSel) ?? null;
  }

  /** Formatea marcaTemporal a es-CO / America/Bogota o devuelve original si no se puede. */
  private formatMarcaTemporal(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    try {
      return d.toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'America/Bogota'
      });
    } catch {
      return d.toLocaleString();
    }
  }

  /** Anti XSS mínimo para texto plano en HTML */
  private escapeHtml(s: string): string {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  // id de info entrevista andrea
  onIdInfoEntrevistaAndreaChange(id: number): void {
    this.idInfoEntrevistaAndrea = id;
  }

  //OnIdVacanteChange
  onIdVacanteChange(id: number): void {
    this.idvacante = id;
    console.log('Vacante recibida de contratación:', id);
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

    // Si no existe la cedula, mostrar un mensaje de error
    if (!this.cedulaActual) {
      Swal.fire('Error', 'Debe seleccionar un candidato primero', 'error');
      return;
    }

    // Guardar cedula y codigoContrato en el localStorage separados
    localStorage.setItem('cedula', this.cedulaActual);
    localStorage.setItem('codigoContrato', this.codigoContratoActual);
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
      vacante: this.idvacante !== 0
        ? this.idvacante
        : this.idVacanteContratacion,
      entrevista_andrea: this.idInfoEntrevistaAndrea

    };

    // Guardar de nuevo el objeto completo
    localStorage.setItem('formularios', JSON.stringify(formularios));
  }

  sede = '';
  abreviacionSede = '';
  codigoContratoActual = '';
  /* diccionario de abreviaciones */
  private readonly abreviaciones: Record<string, string> = {
    ADMINISTRATIVOS: 'ADM', ANDES: 'AND', BOSA: 'BOS', CARTAGENITA: 'CAR',
    FACA_PRIMERA: 'FPR', FACA_PRINCIPAL: 'FPC', FONTIBÓN: 'FON', FORANEOS: 'FOR',
    FUNZA: 'FUN', MADRID: 'MAD', MONTE_VERDE: 'MV', ROSAL: 'ROS',
    SOACHA: 'SOA', SUBA: 'SUB', TOCANCIPÁ: 'TOC', USME: 'USM',
  };

  private initUsuarioYAbreviacion(): void {
    const user = this.utilityService.getUser() as Usuario | null;
    if (!user) { return; }

    this.sede = user.sucursalde;
    this.abreviacionSede = this.abreviaciones[this.sede] || this.sede;
  }



  private generarNuevoCodigoContrato(): void {
    this.seleccionService.generarCodigoContratacion(this.abreviacionSede, this.cedulaActual)
      .pipe(take(1))
      .subscribe({
        next: r => {
          this.codigoContratoActual = r.nuevo_codigo;
          Swal.fire('Éxito', 'Código de contrato generado correctamente: ' + this.codigoContratoActual, 'success');
        },
        error: () => Swal.fire('Error', 'No se pudo generar el código', 'error')
      });
  }


  private isPdf(file: File | undefined | null): file is File {
    return !!file && (
      file.type === 'application/pdf' ||
      /\.pdf$/i.test(file.name || '')
    );
  }

  // Método para fusionar PDFs y almacenar en uploadedFiles["examenesMedicos"]
  async imprimirSaludOcupacional(): Promise<void> {
    // Normaliza y valida archivos
    const pdfs = (this.examFiles || []).filter(f => this.isPdf(f));
    if (!pdfs.length) {
      Swal.fire({
        title: '¡Advertencia!',
        text: 'Debe subir al menos un archivo PDF.',
        icon: 'warning',
        confirmButtonText: 'Ok'
      });
      return;
    }

    // Loader
    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Generando documento PDF...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // 1) (Opcional) Crear/actualizar parte 3 antes de fusionar
      try {
        await firstValueFrom(
          this.seleccionService.crearSeleccionParteTresCandidato(
            this.formGroup3,
            this.cedulaActual,
            this.idProcesoSeleccion
          )
        );
      } catch (e) {
        console.warn('No se pudo crear/actualizar Parte 3, se continúa igual.', e);
        // seguimos; no bloquea la fusión de PDF
      }


      this.seleccionService.generarCodigoContratacion(this.abreviacionSede, this.cedulaActual)
        .pipe(take(1))
        .subscribe({
          next: r => {
            this.codigoContratoActual = r.nuevo_codigo;

          },
          error: () => console.warn('No se pudo generar el código de contrato')
        });

      // 2) Fusionar PDFs
      const mergedPdf = await PDFDocument.create();
      for (const file of pdfs) {
        const fileBuffer = await file.arrayBuffer();
        const pdf = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
      }

      const mergedPdfBytes = await mergedPdf.save();
      const mergedName = `SaludOcupacional_Combinado_${new Date().toISOString().slice(0, 10)}.pdf`;
      const mergedFile = new File([mergedPdfBytes], mergedName, { type: 'application/pdf' });

      // 3) Guardar en uploadedFiles["examenesMedicos"]
      this.uploadedFiles['examenesMedicos'] = {
        fileName: mergedName,
        file: mergedFile
      };

      // 4) (Opcional) Subir inmediatamente si tu flujo lo requiere
      // Si tu helper acepta Blob/File + key + fileName:
      try {
        await this.subirArchivo(mergedFile, 'examenesMedicos', mergedName);
      } catch (upErr) {
        console.warn('No se pudo subir el PDF combinado ahora. Queda en uploadedFiles.', upErr);
        // No bloquea; ya quedó en uploadedFiles para reintento posterior
      }

      // 5) Actualizar estado examenes_medicos
      if (this.idInfoEntrevistaAndrea) {
        this.infoVacantesService
          .setEstadoVacanteAplicante(this.idInfoEntrevistaAndrea, 'examenes_medicos', true)
          .subscribe({
            next: () => console.log('Estado examenes_medicos actualizado ✅'),
            error: () => console.warn('No se pudo actualizar el estado examenes_medicos ❌')
          });
      }

      Swal.close();

      // 6) (Opcional) seguir con tu flujo
      if (typeof this.imprimirDocumentos === 'function') {
        this.imprimirDocumentos();
      }

      await Swal.fire({
        title: '¡Éxito!',
        text: 'El PDF de Salud Ocupacional fue generado y guardado correctamente.',
        icon: 'success',
        confirmButtonText: 'Ok'
      });

    } catch (error) {
      console.error(error);
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
    console.log('Vacante recibida de contratación:', id);
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

    });
  }


}
