import { Component, inject, LOCALE_ID, OnInit, ViewChild } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { SharedModule } from '../../../../../../shared/shared.module';
import { SearchForCandidateComponent } from '../../components/search-for-candidate/search-for-candidate.component';
import { SelectionQuestionsComponent } from '../../components/selection-questions/selection-questions.component';
import { AbstractControl, FormArray, FormBuilder, FormGroup, FormsModule, Validators } from '@angular/forms';
import { VacantesService } from '../../service/vacantes/vacantes.service';
import { catchError, filter, firstValueFrom, from, of, switchMap, take } from 'rxjs';
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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ColumnDefinition, StandardFilterTable } from '@/app/shared/components/standard-filter-table/standard-filter-table';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ColumnConfig } from '@/app/shared/models/advanced-table-interface';
import { CameraDialogComponent, CameraDialogResult } from '../../components/camera-dialog/camera-dialog.component';
import { MatBadgeModule } from '@angular/material/badge';

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
    MatDialogModule,
    MatBadgeModule
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

  /* ────────── estado/candidato ────────── */
  cedulaActual = '';
  codigoContratoActual = '';
  nombreCandidato = '';
  idInfoEntrevistaAndrea = 0;
  idProcesoSeleccion: number | null = null;

  /* ────────── vacantes ────────── */
  filtro = '';
  vacantes: any[] = [];
  idvacante = 0;
  idVacanteContratacion = 0;
  dataSource = new MatTableDataSource<any>([]);
  displayedColumns: string[] = ['cargo', 'finca', 'empresaUsuariaSolicita', 'experiencia', 'fechaPublicado', 'acciones'];

  /* ────────── formularios ────────── */
  datosPersonales!: FormGroup;
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
  tieneFoto = false;
  fotoDataUrl: string | null = null;

  examFiles: File[] = []; // PDFs cargados individualmente
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

  // Columnas para el componente TablaComponent (si lo usas en otra vista)
  columns: ColumnConfig[] = [
    {
      header: 'Fecha de Creación',
      columnDef: 'created_at',
      type: 'date',
      cellFn: (row: any) => new Date(row.created_at).toLocaleString(),
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

  /* ────────── sesión ────────── */
  sede = '';
  abreviacionSede = '';

  /* abreviaciones de sedes */
  private readonly abreviaciones: Record<string, string> = {
    ADMINISTRATIVOS: 'ADM', ANDES: 'AND', BOSA: 'BOS', CARTAGENITA: 'CAR',
    FACA_PRIMERA: 'FPR', FACA_PRINCIPAL: 'FPC', FONTIBÓN: 'FON', FORANEOS: 'FOR',
    FUNZA: 'FUN', MADRID: 'MAD', MONTE_VERDE: 'MV', ROSAL: 'ROS',
    SOACHA: 'SOA', SUBA: 'SUB', TOCANCIPÁ: 'TOC', USME: 'USM',
  };

  private snackBar = inject(MatSnackBar);

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

    // Catálogo de exámenes
    this.filteredExamOptions = [
      'Exámen Ingreso', 'Colinesterasa', 'Glicemia Basal', 'Perfil lípidico', 'Visiometria', 'Optometría', 'Audiometría',
      'Espirometría', 'Sicometrico', 'Frotis de uñas', 'Frotis de garganta', 'Cuadro hematico', 'Creatinina', 'TGO',
      'Coprológico', 'Osteomuscular', 'Quimico (Respiratorio - Dermatologico)', 'Tegumentaria', 'Cardiovascular',
      'Trabajo en alturas (Incluye test para detección de fobia a las alturas: El AQ (Acrophobia Questionnaire) de Cohen)',
      'Electrocardiograma (Sólo aplica para mayores de 45 años)', 'Examen Médico', 'HEPATITIS A Y B', 'TETANO VACUNA T-D',
      'Exámen médico integral definido para conductores'
    ];

    // Parte 3 (exámenes)
    this.formGroup3 = this.fb.group({
      ips: ['', Validators.required],
      ipsLab: ['', Validators.required],
      selectedExams: [[], Validators.required],
      selectedExamsArray: this.fb.array([]) // dinámico según selectedExams
    });

    this.formGroup3.get('selectedExams')!.valueChanges.subscribe((exams: string[]) => {
      const examsArray = this.formGroup3.get('selectedExamsArray') as FormArray;
      while (examsArray.length) examsArray.removeAt(0);
      exams.forEach(() => {
        examsArray.push(this.fb.group({ aptoStatus: ['', Validators.required] }));
      });
    });

    // Formularios base
    this.datosPersonales = this.fb.group({
      tipodedocumento: [''],
      numerodeceduladepersona: [''],
      numerodeceduladepersona2: [''],
      primer_apellido: [''],
      segundo_apellido: [''],
      primer_nombre: [''],
      segundo_nombre: [''],
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
      hacecuantoviveenlazona: [''],
      lugar_anterior_residencia: [''],
      hace_cuanto_se_vino_y_porque: [''],
      zonas_del_pais: [''],
      fecha_nacimiento: [''],
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
      hijosArray: this.fb.array([]),
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

  async ngOnInit(): Promise<void> {
    await this.initUsuarioYAbreviacion();
    await this.loadData();
  }

  /* ========= helpers usuario ========= */
  private async initUsuarioYAbreviacion(): Promise<void> {
    try {
      const user: any = await this.utilityService.getUser();
      const sedeNombre = user?.sede?.nombre ?? user?.sucursalde ?? '';
      this.sede = sedeNombre;
      this.abreviacionSede = this.abreviaciones[sedeNombre] || sedeNombre;
    } catch {
      this.sede = '';
      this.abreviacionSede = '';
    }
  }

  /* ========= cargar vacantes por sede ========= */
  private async loadData(): Promise<void> {
    let user: any;
    try {
      user = await this.utilityService.getUser();
    } catch {
      Swal.fire('Error', 'No se encontró información del usuario', 'error');
      return;
    }
    if (!user) {
      Swal.fire('Error', 'No se encontró información del usuario', 'error');
      return;
    }

    this.vacantesService.listarVacantes().pipe(
      catchError(() => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes', 'error');
        return of([]);
      })
    ).subscribe((response: any[]) => {
      if (!response?.length) {
        Swal.fire('Error', 'No se encontraron vacantes', 'error');
        return;
      }

      const sedeLoginLower = user?.sede?.nombre?.toLowerCase?.() || user?.sucursalde?.toLowerCase?.() || '';
      this.vacantes = response.filter(v =>
        Array.isArray(v?.oficinasQueContratan) &&
        v.oficinasQueContratan.some((oficina: { nombre: string }) =>
          oficina?.nombre?.toLowerCase() === sedeLoginLower
        )
      );

      this.dataSource.data = this.vacantes;
      // Filtro general por texto
      this.dataSource.filterPredicate = (row, filter) =>
        ['cargo', 'finca', 'empresaUsuariaSolicita', 'temporal']
          .some(k => String((row as any)[k] ?? '').toLowerCase().includes(filter));
    });
  }

  filtrarVacantes(): any[] {
    if (!this.filtro) return this.vacantes;
    const f = this.filtro.toLowerCase();
    return this.vacantes.filter(v =>
      ['cargo', 'finca', 'empresaUsuariaSolicita', 'temporal']
        .some(k => String(v?.[k] ?? '').toLowerCase().includes(f))
    );
  }

  /* ========= outputs desde SearchForCandidate ========= */
  async onCedulaSeleccionada(cedula: string): Promise<void> {
    this.cedulaActual = (cedula ?? '').trim();
    this.mostrarTabla();

   this.contratacionService.buscarEncontratacion(this.cedulaActual).subscribe({
      next: (resp: any) => {
        const raw = resp?.data?.[0]?.fotoSoliciante ?? null; // viene como data:image/png;base64,...
        if (typeof raw === 'string' && raw.trim().length > 0) {
          this.fotoDataUrl = raw.trim();
          this.tieneFoto = true;
        } else {
          this.fotoDataUrl = null;
          this.tieneFoto = false;
        }
      },
      error: () => {
        this.fotoDataUrl = null;
        this.tieneFoto = false;
        Swal.fire('Error', 'Error al consultar contratación', 'error');
      }
    });

    // 1) Contratación (si 404: limpiar y seguir)
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

    // 2) Datos de selección (el backend puede crear automáticamente)
    this.contratacionService.traerDatosSeleccion(this.cedulaActual)
      .pipe(
        take(1),
        catchError((err: HttpErrorResponse) => {
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

        // Caso “creado” por el backend
        if (response.created && response.createdId) {
          this.idProcesoSeleccion = response.createdId;
          Swal.fire('Listo', 'Se creó el proceso de selección automáticamente.', 'success');
          this.iniciarNuevoProcesoUI();
          return;
        }

        // Caso existente
        const list = Array.isArray(response?.procesoSeleccion) ? response.procesoSeleccion : [];
        if (!list.length) {
          this.iniciarNuevoProcesoUI();
          return;
        }

        // Top 2 por id DESC
        const topTwo = [...list]
          .filter(x => typeof x?.id === 'number')
          .sort((a, b) => b.id - a.id)
          .slice(0, 2);

        const chosen = await this.elegirProcesoBonitoSinIdONuevo(topTwo);
        if (!chosen) return;

        if (chosen === 'NEW') {
          this.iniciarNuevoProcesoUI();
          return;
        }

        // Continuar con proceso existente
        const data = chosen;
        this.idProcesoSeleccion = data.id;
        this.idVacanteContratacion = data?.vacante ?? null;

        // IPS
        this.formGroup3.patchValue({
          ips: data?.ips ?? '',
          ipsLab: data?.ipslab ?? data?.ipsLab ?? ''
        });

        // Exámenes / aptos
        const examenesArr = String(data?.examenes || '')
          .split(',').map((s: string) => s.trim()).filter(Boolean);

        const aptosArr = String(data?.aptosExamenes || '')
          .split(',').map((s: string) => s.trim().toUpperCase()).filter(Boolean);

        const len = Math.min(examenesArr.length, aptosArr.length);
        const selectedExams = examenesArr.slice(0, len);
        const selectedAptos = aptosArr.slice(0, len);

        this.formGroup3.get('selectedExams')?.setValue(selectedExams);
        const fa = this.fb.array(
          selectedAptos.map((status: string) => this.fb.group({ aptoStatus: [status || 'APTO'] }))
        );
        this.formGroup3.setControl('selectedExamsArray', fa);
      });
  }

  /** Limpia UI para iniciar un proceso nuevo */
  private iniciarNuevoProcesoUI(): void {
    this.idProcesoSeleccion = null;
    this.formGroup3.patchValue({ ips: '', ipsLab: '', selectedExams: [] });
    this.formGroup3.setControl('selectedExamsArray', this.fb.array([]));
  }

  /** Selector bonito de procesos previos o crear nuevo */
  private async elegirProcesoBonitoSinIdONuevo(items: any[]): Promise<any | 'NEW' | null> {
    const card = (it: any, checked = false) => {
      const fechaBonita = this.formatMarcaTemporal(it?.marcaTemporal);
      const evaluador = this.escapeHtml(it?.nombre_evaluador || '—');
      const ips = this.escapeHtml(it?.ips || '');
      return `
        <label class="proc-card">
          <input type="radio" name="procOption" value="${it.id}" ${checked ? 'checked' : ''}/>
          <div class="card">
            <div class="card-row"><span class="date">${fechaBonita}</span></div>
            <div class="card-body">
              <div><b>Evaluador:</b> ${evaluador}</div>
              ${ips ? `<div><b>IPS:</b> ${ips}</div>` : ''}
            </div>
          </div>
        </label>`;
    };

    const newCard = `
      <label class="proc-card">
        <input type="radio" name="procOption" value="NEW"/>
        <div class="card new">
          <div class="new-title">Crear nuevo proceso</div>
          <div class="new-sub">Comenzar desde cero</div>
        </div>
      </label>`;

    const { isConfirmed } = await Swal.fire({
      title: '¿Cómo deseas continuar?',
      html: `
        <style>
          .proc-wrap{display:flex;gap:12px;flex-wrap:wrap;justify-content:center;margin-top:6px}
          .proc-card{cursor:pointer}
          .proc-card input{display:none}
          .proc-card .card{width:300px;padding:12px 14px;border-radius:14px;border:1px solid #e5e7eb;transition:.15s;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06)}
          .proc-card .card.new{background:#f8fafc;border-style:dashed}
          .proc-card .new-title{font-weight:700;color:#0f172a}
          .proc-card .new-sub{font-size:12px;color:#64748b}
          .proc-card input:checked + .card{border-color:#3f51b5;box-shadow:0 0 0 3px rgba(63,81,181,.15)}
          .proc-card .card-row{display:flex;justify-content:flex-start;align-items:center;margin-bottom:8px}
          .date{font-size:13px;color:#374151;font-weight:600}
          .card-body{font-size:13px;color:#374151;line-height:1.35}
        </style>
        <div class="proc-wrap">
          ${items[0] ? card(items[0], true) : ''}
          ${items[1] ? card(items[1]) : ''}
          ${newCard}
        </div>`,
      focusConfirm: false,
      // no se puede salir sin elegir
      allowOutsideClick: false,
      confirmButtonText: 'Continuar',
      preConfirm: () => {
        const sel = (document.querySelector('input[name="procOption"]:checked') as HTMLInputElement)?.value;
        if (!sel) { Swal.showValidationMessage('Selecciona una opción'); return false as any; }
        (Swal as any).selectedOption = sel; return true;
      }
    });

    if (!isConfirmed) return null;
    const sel = (Swal as any).selectedOption as string;
    if (sel === 'NEW') return 'NEW';
    const idSel = Number(sel);
    return items.find(it => it.id === idSel) ?? null;
  }

  private formatMarcaTemporal(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    try {
      return d.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' });
    } catch { return d.toLocaleString(); }
  }
  private escapeHtml(s: string): string {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
  }

  // Id de info entrevista andrea
  onIdInfoEntrevistaAndreaChange(id: number): void { this.idInfoEntrevistaAndrea = id; }
  onIdVacanteChange(id: number): void { this.idvacante = id; }

  getFullName(nombre_completo: string): void {
    this.nombreCandidato = nombre_completo ? String(nombre_completo) : '';
  }

  /* ========= filtro tabla vacantes ========= */
  applyFilterManual(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = filterValue;
  }

  /* ========= validación/guardado de campos ========= */
  async validarCampos() {
    const formatFecha = (fecha: string | Date | null): string => {
      if (!fecha) return '';
      const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      return `${dia}/${mes}/${anio}`;
    };
    const formatFechaHora = (fecha: string | Date): string => {
      const d = typeof fecha === 'string' ? new Date(fecha) : fecha;
      const dia = String(d.getDate()).padStart(2, '0');
      const mes = String(d.getMonth() + 1).padStart(2, '0');
      const anio = d.getFullYear();
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      const s = String(d.getSeconds()).padStart(2, '0');
      return `${dia}/${mes}/${anio} ${h}:${m}:${s}`;
    };

    const userData = JSON.parse(localStorage.getItem('user') || '{}');
    const nombreQuienValidoInformacion = `${userData?.datos_basicos?.nombres || ''} ${userData?.datos_basicos?.apellidos || ''}`.trim();

    const payload = {
      numeroCedula: this.cedulaActual,
      codigoContrato: this.codigoContratoActual,
      nombreQuienValidoInformacion,
      fechaHoraValidacion: formatFechaHora(new Date()),
      primerApellido: this.datosPersonales.get('primer_apellido')?.value,
      segundoApellido: this.datosPersonales.get('segundo_apellido')?.value,
      primerNombre: this.datosPersonales.get('primer_nombre')?.value,
      segundoNombre: this.datosPersonales.get('segundo_nombre')?.value,
      fechaNacimiento: formatFecha(this.datosPersonales.get('fecha_nacimiento')?.value),
      fechaExpedicionCC: formatFecha(this.datosPersonales.get('fecha_expedicion_cc')?.value),
    };

    try {
      await this.contratacionService.validarInformacionContratacion(payload);
      Swal.fire('¡Información validada!', 'La información ha sido validada correctamente.', 'success');
    } catch {
      Swal.fire('¡Error!', 'Hubo un error al enviar la información.', 'error');
    }
  }

  /* ========= hijos ========= */
  get hijosArray(): FormArray {
    return this.datosHijos.get('hijosArray') as FormArray;
  }
  agregarHijo(hijo: any) {
    const hijoForm = this.fb.group({
      nombre: [hijo?.nombre || ''],
      sexo: [hijo?.sexo || ''],
      fecha_nacimiento: [hijo?.fecha_nacimiento || ''],
      no_documento: [hijo?.no_documento || ''],
      estudia_o_trabaja: [hijo?.estudia_o_trabaja || ''],
      curso: [hijo?.curso || '']
    });
    this.hijosArray.push(hijoForm);
  }
  llenarDatosHijos(hijos: any[]) {
    this.hijosArray.clear();
    (hijos || []).forEach(h => this.agregarHijo(h));
  }

  /* ========= documentos ========= */
  generacionDocumentos() {
    if (!this.cedulaActual) {
      Swal.fire('Error', 'Debe seleccionar un candidato primero', 'error'); return;
    }

    localStorage.setItem('cedula', this.cedulaActual);
    localStorage.setItem('codigoContrato', this.codigoContratoActual);
    this.guardarFormulariosEnLocalStorage();
    this.router.navigate(['dashboard/hiring/generate-contracting-documents']);
  }

  guardarFormulariosEnLocalStorage() {
    const stored = localStorage.getItem('formularios');
    let formularios: any = stored ? JSON.parse(stored) : {};

    formularios = {
      ...formularios,
      datosPersonales: this.datosPersonales.value,
      datosReferencias: this.datosReferencias.value,
      datosExperienciaLaboral: this.datosExperienciaLaboral.value,
      datosHijos: this.datosHijos.value,
      datosParte3Seccion1: this.datosParte3Seccion1.value,
      datosParte3Seccion2: this.datosParte3Seccion2.value,
      datosParte4: this.datosParte4.value,
      vacante: this.idvacante !== 0 ? this.idvacante : this.idVacanteContratacion,
      entrevista_andrea: this.idInfoEntrevistaAndrea
    };

    localStorage.setItem('formularios', JSON.stringify(formularios));
  }

  private isPdf(file: File | undefined | null): file is File {
    return !!file && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name || ''));
  }

  async imprimirSaludOcupacional(): Promise<void> {
    const pdfs = (this.examFiles ?? []).filter(f => this.isPdf(f));
    if (!pdfs.length) {
      Swal.fire('¡Advertencia!', 'Debe subir al menos un archivo PDF.', 'warning');
      return;
    }

    Swal.fire({
      title: 'Procesando...',
      icon: 'info',
      text: 'Generando documento PDF...',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    try {
      // 1) Persistir Parte 3 (no bloqueante para el resto si falla)
      try {
        await firstValueFrom(
          this.seleccionService
            .crearSeleccionParteTresCandidato(this.formGroup3, this.cedulaActual, this.idProcesoSeleccion)
            .pipe(take(1))
        );
      } catch (e) {
        console.warn('No se pudo crear/actualizar Parte 3, se continúa igual.', e);
      }

      // 2) Generar/actualizar código de contratación (no bloqueante)
      this.seleccionService
        .generarCodigoContratacion(this.abreviacionSede, this.cedulaActual)
        .pipe(take(1))
        .subscribe({
          next: (r) => { this.codigoContratoActual = r?.nuevo_codigo ?? this.codigoContratoActual; },
          error: () => console.warn('No se pudo generar el código de contrato')
        });

      // 3) Fusionar PDFs con pdf-lib
      const mergedPdf = await PDFDocument.create();
      for (const file of pdfs) {
        const buf = await file.arrayBuffer();
        const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        pages.forEach(p => mergedPdf.addPage(p));
      }

      // 4) Guardar bytes y convertir a ArrayBuffer estándar para evitar el error de TS
      const mergedBytes = await mergedPdf.save();               // Uint8Array
      const bytesCopy = new Uint8Array(mergedBytes);            // copia con ArrayBuffer "normal"
      const blob = new Blob([bytesCopy.buffer], { type: 'application/pdf' });

      const mergedName = `SaludOcupacional_Combinado_${new Date().toISOString().slice(0, 10)}.pdf`;
      const mergedFile = new File([blob], mergedName, { type: 'application/pdf' });

      // 5) Guardar para subida
      this.uploadedFiles['examenesMedicos'] = { fileName: mergedName, file: mergedFile };

      // 6) Subir inmediatamente (opcional)
      try {
        await this.subirArchivo(mergedFile, 'examenesMedicos', mergedName);
      } catch (upErr) {
        console.warn('No se pudo subir el PDF combinado ahora. Queda en uploadedFiles.', upErr);
      }

      // 7) Marcar estado en proceso
      if (this.idInfoEntrevistaAndrea) {
        this.infoVacantesService
          .setEstadoVacanteAplicante(this.idInfoEntrevistaAndrea, 'examenes_medicos', true)
          .pipe(take(1))
          .subscribe({ next: () => { }, error: () => { } });
      }

      Swal.close();

      // 8) Continuar flujo (si aplica)
      if (typeof this.imprimirDocumentos === 'function') {
        this.imprimirDocumentos();
      }

      await Swal.fire('¡Éxito!', 'El PDF de Salud Ocupacional fue generado y guardado correctamente.', 'success');

    } catch (error) {
      console.error(error);
      Swal.close();
      Swal.fire('¡Error!', 'Ocurrió un problema al fusionar los archivos PDF.', 'error');
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

    const hayNoApto = fa.controls.some((ctrl: AbstractControl) =>
      String(ctrl.get('aptoStatus')?.value || '').trim().toUpperCase() === 'NO APTO'
    );

    if (hayNoApto && !this._warnedNoApto) {
      this._warnedNoApto = true;
      Swal.fire({
        icon: 'warning',
        title: 'Examen no apto',
        text: 'Hay al menos un examen con resultado "NO APTO". Se deshabilitará la pestaña de Contratación.',
        confirmButtonText: 'Entendido',
        allowOutsideClick: false,
        allowEscapeKey: false
      }).then(() => this.utilityService.nextStep.emit());
    } else {
      this.utilityService.nextStep.emit();
    }

    if (!hayNoApto && this._warnedNoApto) this._warnedNoApto = false;
    return hayNoApto;
  }

  onIdVacanteFromHiring(id: number): void {
    this.idVacanteContratacion = id;
  }

  /* ========= subida de archivos ========= */
  // Acepta: (1) Blob (p.ej. PDF fusionado) o (2) evento de input file
  subirArchivo(event: any | Blob, campo: string, fileName?: string) {
    return new Promise<void>((resolve, reject) => {
      let file: File;

      if (event instanceof Blob) {
        file = new File([event], fileName || 'archivo.pdf', { type: 'application/pdf' });
      } else {
        file = event?.target?.files?.[0];
      }

      if (!file) return reject('No se recibió archivo');

      if (file.name.length > 100) {
        Swal.fire('Error', 'El nombre del archivo no debe exceder los 100 caracteres', 'error');
        return reject('Nombre demasiado largo');
      }

      this.uploadedFiles[campo] = { file, fileName: file.name };
      resolve();
    });
  }

  imprimirDocumentos() {
    Swal.fire({
      title: 'Subiendo archivos...',
      icon: 'info',
      html: 'Por favor, espere mientras se suben los archivos.',
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => Swal.showLoading()
    });

    const nombres = ['examenesMedicos', 'figuraHumana', 'pensionSemanas'];

    this.subirTodosLosArchivos(nombres)
      .then(() => {
        Swal.close();
        Swal.fire('¡Éxito!', 'Datos y archivos guardados exitosamente', 'success');
      })
      .catch((error) => {
        Swal.close();
        Swal.fire('Error', `Hubo un error al subir los archivos: ${error}`, 'error');
      });
  }

  subirTodosLosArchivos(keysEspecificos: string[]): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const archivosAEnviar = Object.keys(this.uploadedFiles)
        .filter(key => keysEspecificos.includes(key) && this.uploadedFiles[key]?.file)
        .map(key => ({ key, ...this.uploadedFiles[key], typeId: this.typeMap[key] }));

      if (!archivosAEnviar.length) return resolve(true);

      const promesas = archivosAEnviar.map(({ key, file, fileName, typeId }) => {
        return new Promise<void>((ok, fail) => {
          if (!file || !typeId) return fail(`Archivo ${key} no tiene datos válidos`);

          // Para estos tipos incluimos código de contrato
          if (['examenesMedicos', 'figuraHumana', 'pensionSemanas'].includes(key)) {
            this.gestionDocumentalService
              .guardarDocumento(fileName, this.cedulaActual, typeId, file, this.codigoContratoActual)
              .subscribe({ next: () => ok(), error: (e) => fail(`Error al subir ${key}: ${e?.message || e}`) });
          } else {
            this.gestionDocumentalService
              .guardarDocumento(fileName, this.cedulaActual, typeId, file)
              .subscribe({ next: () => ok(), error: (e) => fail(`Error al subir ${key}: ${e?.message || e}`) });
          }
        });
      });

      Promise.all(promesas).then(() => resolve(true)).catch(reject);
    });
  }

  onFileSelected(event: any, index: number): void {
    const file = event?.target?.files?.[0];
    if (file && file.type === 'application/pdf') {
      this.examFiles[index] = file;
    } else {
      Swal.fire('Archivo inválido', 'Por favor, seleccione un archivo PDF válido.', 'warning');
    }
  }

  /* ========= tabla de vacantes del candidato ========= */
  mostrarTabla() {
    if (!this.cedulaActual) {
      Swal.fire('Error', 'Debe seleccionar un candidato primero', 'error'); return;
    }

    this.infoVacantesService.getVacantesPorNumero(this.cedulaActual).pipe(
      catchError(() => {
        Swal.fire('Error', 'Ocurrió un error al cargar las vacantes del candidato', 'error');
        return of([]);
      })
    ).subscribe((response: any[]) => {
      if (!response?.length) {
        Swal.fire('Error', 'No se encontraron vacantes para este candidato', 'error');
        return;
      }

      const columns: ColumnDefinition[] = [
        { name: 'created_at', header: 'Fecha de creación', type: 'date', width: '180px' },
        { name: 'oficina', header: 'Oficina', type: 'text', width: '160px' },
        { name: 'aplica_o_no_aplica', header: 'Aplica o no aplica', type: 'text', width: '280px' },
        { name: 'motivoNoAplica', header: 'Motivo no aplica', type: 'text', width: '220px' },
        { name: 'aplicaObservacion', header: 'Retroalimentación', type: 'text', width: '280px' },
        { name: 'detalle', header: 'Detalle', type: 'text', width: '320px' },
        { name: 'actions', header: '', type: 'custom', width: '72px', stickyEnd: true, filterable: false },
      ];

      const fixIso = (v: any): Date | null => {
        if (!v) return null;
        const d1 = new Date(v);
        if (!isNaN(d1.getTime())) return d1;
        const m = String(v).match(/^(.*\.\d{3})\d*(.*)$/);
        return m ? new Date(m[1] + m[2]) : null;
      };

      const data = response.map(r => ({ ...r, created_at: fixIso(r.created_at) }));

      const dialogRef = this.dialog.open(StandardFilterTable, { minWidth: '90vw', height: '65vh' });
      dialogRef.componentInstance.tableTitle = 'Vacantes del candidato';
      dialogRef.componentInstance.columnDefinitions = columns;
      dialogRef.componentInstance.data = data;
      dialogRef.componentInstance.pageSizeOptions = [10, 20, 50];
      dialogRef.componentInstance.defaultPageSize = 10;
    });
  }

  uploadedFiles2: Record<string, { file: File; fileName: string; previewUrl?: string }> = {};

  openCamera(): void {
    const dialogRef = this.dialog.open(CameraDialogComponent, {
      width: 'min(96vw, 720px)',
      maxWidth: '96vw',
      panelClass: 'camera-dialog',
      autoFocus: false,
      disableClose: true,
      data: {
        initialPreviewUrl: this.fotoDataUrl || null   // ⬅️ pasa la foto actual si existe
      }
    });

    dialogRef.afterClosed().pipe(
      filter((res): res is CameraDialogResult => !!res),
      switchMap((res) => {
        const dataUrl$ = res.previewUrl?.startsWith('data:')
          ? of(res.previewUrl)
          : from(this.fileToDataURL(res.file)); // helper abajo
        return dataUrl$.pipe(
          switchMap((base64) =>
            this.seleccionService.subirFotoBase64(this.cedulaActual, base64)
          ),
          catchError((err) => {
            this.snackBar.open('Error al subir la foto', 'OK', { duration: 5000 });
            console.error('subirFotoBase64 error:', err);
            return of(null);
          })
        );
      }),
      take(1)
    ).subscribe((resp: any) => {
      if (resp?.ok || resp?.success) {
        this.snackBar.open('Foto subida exitosamente', 'OK', { duration: 3000 });
        // refresca estado local
        if (this.fotoDataUrl) {
          this.tieneFoto = true;
        }
      } else if (resp !== null) {
        this.snackBar.open('No se pudo subir la foto', 'OK', { duration: 4000 });
      }
    });
  }

  // Helper: File -> dataURL
  private fileToDataURL(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }



}
