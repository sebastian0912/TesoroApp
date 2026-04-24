import {  Component, Inject, OnInit, PLATFORM_ID , ChangeDetectionStrategy, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { isPlatformBrowser } from '@angular/common';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { IncapacidadService } from '../../services/incapacidad/incapacidad.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { MatDialog } from '@angular/material/dialog';
import { MatOptionModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { saveAs } from 'file-saver';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { DatePipe } from '@angular/common'; // Importa DatePipe
import { forkJoin, mergeMap } from 'rxjs';
import * as ExcelJS from 'exceljs';

interface ColumnTitle {
  [key: string]: string;
}


@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-vista-total-incapacidades',
  standalone: true,
  imports: [
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatOptionModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    ReactiveFormsModule,
    MatIconModule,
    FormsModule,
    MatCardModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatExpansionModule,
    MatDividerModule,
    MatTooltipModule,
    MatChipsModule,
    MatBadgeModule
],
  templateUrl: './vista-total-incapacidades.component.html',
  styleUrl: './vista-total-incapacidades.component.css',
  providers: [DatePipe, provideNativeDateAdapter()]
} )
export class VistaTotalIncapacidadesComponent implements OnInit, AfterViewInit {
  @ViewChild('pagT1', { static: false }) paginatorTabla1!: MatPaginator;
  @ViewChild('pagT4', { static: false }) paginatorTabla4!: MatPaginator;
  @ViewChild('sortT1', { static: false }) sortT1!: MatSort;
  @ViewChild('sortT4', { static: false }) sortT4!: MatSort;

  // Filtros rápidos inline por tabla
  quickFilterT1: string = '';
  quickFilterT4: string = '';

  // Loading state granular por acción (permite mostrar spinner específico por botón)
  downloadingExcel = false;
  downloadingDia = false;
  downloadingRango = false;
  downloadingDiaSevenet = false;
  downloadingRangoSevenet = false;
  isLoading = false; // carga inicial de tablas
  query: string = '';
  username: string = '';

  isSidebarHidden = false;

  hoy: string = new Date().toISOString().split('T')[0];
  // Modelos bidireccionales con mat-datepicker → Date
  fechaInicio: Date | null = null;
  fechaFin: Date | null = null;
  fechaSeleccionada: Date | null = null;

  /** Convierte Date a string ISO corto (yyyy-MM-dd) que espera el backend */
  private toIsoDate(d: Date | null | string): string {
    if (!d) return '';
    if (typeof d === 'string') return d;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  toggleSidebar() {
    this.isSidebarHidden = !this.isSidebarHidden;
  }

  [key: string]: any;
  columnTitlesTable1excel: Record<string, string> = {
    marcaTemporal: 'Marca Temporal',
    Oficina: 'Oficina',
    consecutivoSistema: 'Consecutivo Sistema',
    numero_de_contrato: 'Número de Contrato',
    Temporal: 'Temporal',
    Fecha_de_Envio_Incapacidad_Fisica: 'Fecha de Envío Incapacidad Física',
    Tipo_de_documento: 'Tipo de Documento',
    Numero_de_documento: 'Número de Documento',

    nombre: 'Nombre',
    apellido: 'Apellido',
    centrodecosto: 'Centro de Costo',
    tipo_incapacidad: 'Tipo Incapacidad',
    codigo_diagnostico: 'Código Diagnóstico',
    descripcion_diagnostico: 'Descripción Diagnóstico',
    F_inicio: 'Fecha de Inicio Incapacidad',
    F_final: 'Fecha Final de la Incapacidad',
    dias_incapacidad: 'Días Incapacidad',
    Dias_temporal: 'Días Temporal',
    dias_eps: 'Días EPS',
    edad: 'Edad',
    sexo: 'Sexo',
    fecha_de_ingreso_temporal: 'Fecha de Ingreso Temporal',
    celular_o_telefono_01: 'Celular o Teléfono 01',
    celular_o_telefono_02: 'Celular o Teléfono 02',
    correoElectronico: 'Correo Electrónico',
    nombre_eps: 'Nombre EPS',
    estado_incapacidad: 'Estado Incapacidad',
    prorroga: 'Prórroga',
    Incapacidad_transcrita: 'Incapacidad Transcrita',
    numero_de_incapacidad: 'Número de Incapacidad',
    nit_de_la_IPS: 'NIT de la IPS',
    ips_punto_de_atencion: 'IPS Punto de Atención',
    fondo_de_pensiones: 'Fondo de Pensiones',
    nombre_de_quien_recibio: 'Nombre de Quien Recibió',
    dias_de_diferencia: 'Días de Diferencia entre fecha de envio a fecha actual',
    observaciones: 'Observaciones',
    quiencorrespondepago: 'Quién Corresponde el Pago',
    estado_documento_incapacidad: 'Estado Documento Incapacidad',
    estado_robot_doctor: 'Estado Robot Doctor',

    tipo_de_documento_doctor_atendido: 'Tipo de Documento Doctor Atendido',
    numero_de_documento_doctor: 'Número de Documento Doctor',
    nombre_doctor: 'Nombre Doctor',
    responsable_de_envio: 'Responsable de Envío',
  };

  columnTitlesTable4excel: Record<string, string> = {
    fecha_de_recepcion_de_la_incapacidad: 'Fecha de recepción de la incapacidad',
    fecha_de_radicado_eps: 'Fecha de radicado EPS',
    confirmacion_fecha_de_radicacion: 'Fecha de confirmación de radicación',
    numero_de_radicado: 'Número de radicado',
    quien_radico: 'Quién radicó',
    respuesta_de_la_eps: 'Respuesta de la EPS',
    codigo_respuesta_eps: 'Código de respuesta EPS',
    fecha_de_respuesta_eps: 'Fecha de respuesta EPS',
    numero_de_incapacidad_eps: 'Número de incapacidad EPS',
    dias_pagos_incapacidad: 'Días pagos incapacidad',
    valor_incapacidad: 'Valor incapacidad',
    numero_transaccion_eps_arl: 'Número de transacción EPS/ARL',
    transaccion_empresa_usuaria: 'Transacción empresa usuaria',
    quien_corresponde_el_pago_final: 'Quién corresponde el pago final',
    respuesta_final_incapacidad: 'Respuesta final incapacidad',
    fecha_revision_por_parte_de_incapacidades: 'Fecha de revisión por parte de incapacidades',
    estado_del_documento_incapacidad: 'Estado del documento de incapacidad',
    aquien_corresponde_el_pago: 'A quién corresponde el pago',
    a_donde_se_radico: 'A dónde se radicó',
  };
  ColumnsTable1 = [
    'Tipo_de_documento',
    'Numero_de_documento',
    'numero_de_contrato',
    'nombre',
    'apellido',
    'celular_o_telefono_01',
    'celular_o_telefono_02',
    'Oficina',
    'Temporal',
    'edad',
    'observaciones',
    'Dias_temporal',
    'F_inicio',
    'F_final',
    'Fecha_de_Envio_Incapacidad_Fisica',
    'Incapacidad_transcrita',
    'centrodecosto',
    'codigo_diagnostico',
    'consecutivoSistema',
    'correoElectronico',
    'descripcion_diagnostico',
    'dias_de_diferencia',
    'dias_eps',
    'dias_incapacidad',
    'empresa',
    'estado_incapacidad',
    'estado_robot_doctor',
    'fecha_de_ingreso_temporal',
    'fondo_de_pensiones',
    'ips_punto_de_atencion',
    'marcaTemporal',
    'nit_de_la_IPS',
    'nombre_de_quien_recibio',
    'nombre_doctor',
    'nombre_eps',
    'numero_de_documento_doctor',
    'numero_de_incapacidad',
    'prorroga',
    'responsable_de_envio',
    'sexo',
    'tipo_de_documento_doctor_atendido',
    'tipo_incapacidad',
    'quiencorrespondepago',
    'estado_documento_incapacidad'

  ];

  columnTitlesTable1 = {
    'dias_temporal': 'Días Temporal',
    'f_inicio': 'Fecha de Inicio',
    'fecha_de_envio_incapacidad_fisica': 'Fecha de Envío Incapacidad Física',
    'incapacidad_transcrita': 'Incapacidad Transcrita',
    'numero_de_documento': 'Número de Documento',
    'oficina': 'Oficina',
    'temporal': 'Temporal',
    'tipo_de_documento': 'Tipo de Documento',
    'apellido': 'Apellido',
    'celular_o_telefono_01': 'Celular o Teléfono 01',
    'celular_o_telefono_02': 'Celular o Teléfono 02',
    'centrodecosto': 'Centro de Costo',
    'codigo_diagnostico': 'Código Diagnóstico',
    'consecutivoSistema': 'Consecutivo Sistema',
    'correoElectronico': 'Correo Electrónico',
    'descripcion_diagnostico': 'Descripción Diagnóstico',
    'dias_de_diferencia': 'Días de Diferencia',
    'dias_eps': 'Días EPS',
    'dias_incapacidad': 'Días Incapacidad',
    'edad': 'Edad',
    'empresa': 'Empresa',
    'estado_incapacidad': 'Estado Incapacidad',
    'estado_robot_doctor': 'Estado Robot Doctor',
    'fecha_de_ingreso_temporal': 'Fecha de Ingreso Temporal',
    'fondo_de_pensiones': 'Fondo de Pensiones',
    'ips_punto_de_atencion': 'IPS Punto de Atención',
    'marcaTemporal': 'Marca Temporal',
    'nit_de_la_IPS': 'NIT de la IPS',
    'nombre': 'Nombre',
    'nombre_de_quien_recibio': 'Nombre de Quien Recibió',
    'nombre_doctor': 'Nombre Doctor',
    'nombre_eps': 'Nombre EPS',
    'numero_de_contrato': 'Número de Contrato',
    'numero_de_documento_doctor': 'Número de Documento Doctor',
    'numero_de_incapacidad': 'Número de Incapacidad',
    'observaciones': 'Observaciones',
    'prorroga': 'Prórroga',
    'responsable_de_envio': 'Responsable de Envío',
    'sexo': 'Sexo',
    'tipo_de_documento_doctor_atendido': 'Tipo de Documento Doctor Atendido',
    'tipo_incapacidad': 'Tipo Incapacidad',
    'quiencorrespondepago': 'Quién Corresponde el Pago',
    'estado_documento_incapacidad': 'Estado Documento Incapacidad'
  };

  displayedColumnsTable4 = [
    'Numero_de_documento',
    'a_donde_se_radico',
    'aquien_corresponde_el_pago',
    'codigo_respuesta_eps',
    'confirmacionn_fecha_de_radicacion',
    'consecutivoSistema_id',
    'dias_pagos_incapacidad',
    'estado_del_documento_incapacidad',
    'fecha_de_recepcion_de_la_incapacidad',
    'fecha_de_respuesta_eps',
    'fecha_ed_radicado_eps',
    'fecha_revision_por_parte_de_incapacidades',
    'numero_de_incapacidad_eps',
    'numero_de_radicado',
    'numero_transaccion_eps_arl',
    'quien_corresponde_el_pago_final',
    'quien_radico',
    'respuesta_de_la_eps',
    'respuesta_final_incapacidad',
    'transaccion_empresa_usuaria',
    'valor_incapacidad'
  ];
  columnTitlesTable4 = {
    'consecutivoSistema_id': 'Número de consecutivo del sistema',
    'confirmacion_fecha_de_radicacion': 'Fecha de confirmación de radicación',
    'fecha_de_recepcion_de_la_incapacidad': 'Fecha de recepción de la incapacidad',
    'fecha_revision_por_parte_de_incapacidades': 'Fecha de revisión por parte de incapacidades',
    'estado_del_documento_incapacidad': 'Estado del documento de incapacidad',
    'aquien_corresponde_el_pago': 'A quién corresponde el pago',
    'fecha_de_radicado_eps': 'Fecha de radicado EPS',
    'numero_de_radicado': 'Número de radicado',
    'a_donde_se_radico': 'A dónde se radicó',
    'quien_radico': 'Quién radicó',
    'respuesta_de_la_eps': 'Respuesta de la EPS',
    'codigo_respuesta_eps': 'Código de respuesta EPS',
    'fecha_de_respuesta_eps': 'Fecha de respuesta EPS',
    'numero_de_incapacidad_eps': 'Número de incapacidad EPS',
    'dias_pagos_incapacidad': 'Días pagos incapacidad',
    'valor_incapacidad': 'Valor incapacidad',
    'numero_transaccion_eps_arl': 'Número de transacción EPS/ARL',
    'transaccion_empresa_usuaria': 'Transacción empresa usuaria',
    'quien_corresponde_el_pago_final': 'Quién corresponde el pago final',
    'respuesta_final_incapacidad': 'Respuesta final incapacidad'
  };

  dataSourceTable1 = new MatTableDataSource<any>();
  dataSourceTable4 = new MatTableDataSource<any>();
  copiadataSourceTable1 = new MatTableDataSource<any>();
  copiadataSourceTable4 = new MatTableDataSource<any>();
  tiposIncapacidad: string[] = [
    'ENFERMEDAD GENERAL',
    'LICENCIA DE MATERNIDAD',
    'LICENCIA PATERNIDAD',
    'ACCIDENTE DE TRABAJO',
    'SOAT / ACCIDENTE DE TRANCITO',
    'ENFERMEDAD LABORAL'
  ];
  documentos = [
  { key: 'historial_clinico', label: 'Historial clínico' },
  { key: 'archivo_incapacidad', label: 'Archivo Incapacidad' },
  { key: 'furat', label: 'FURAT' },
  { key: 'soat', label: 'SOAT' },
  { key: 'furips', label: 'FURIPS' },
  { key: 'registro_civil', label: 'Registro Civil' },
  { key: 'registro_de_nacido_vivo', label: 'Registro de Nacido Vivo' },
  { key: 'formulario_salud_total', label: 'Formulario de Salud Total' }
];
  resultsincapacidades: any[] = [];
  resultsarl: any[] = [];
  resultssst: any[] = [];
  myForm: FormGroup;
  user: any;
  correo: any;
  filteredData: any[] = [];
  isSearched = false;
  overlayVisible = false;
  loaderVisible = false;
  counterVisible = false;
  temporales: string[] = ['Tu Alianza', 'Apoyo Laboral'];
  filterCriteria: any = {
    numeroDeDocumento: '',
    fechaInicio: '',
    temporal: '',
    estadoIncapacidad: ''
  };
  isFilterCollapsed = true;
  isloadeddata = false;
  constructor(
   @Inject(PLATFORM_ID) private platformId: Object,
    private incapacidadService: IncapacidadService,
    private router: Router,
    private fb: FormBuilder,
    private datePipe: DatePipe,
    private cdref: ChangeDetectorRef
  ) {
    this.myForm = this.fb.group({
      confirmacion_fecha_de_radicacion_inicio: ['', Validators.required],
      confirmacion_fecha_de_radicacion_fin: ['', Validators.required]
    });


  }

  async ngOnInit(): Promise<void> {
    this.setupFormListeners();
    this.loadData();
    const user = await this.getUser();

    if (user) {
      this.username = `${user.primer_nombre} ${user.primer_apellido}`;
    }
  }

  ngAfterViewInit(): void {
    // Conectar paginadores y sort con sus data sources
    if (this.paginatorTabla1) this.dataSourceTable1.paginator = this.paginatorTabla1;
    if (this.paginatorTabla4) this.dataSourceTable4.paginator = this.paginatorTabla4;
    if (this.sortT1) this.dataSourceTable1.sort = this.sortT1;
    if (this.sortT4) this.dataSourceTable4.sort = this.sortT4;

    // filterPredicate para búsqueda rápida (todas las columnas visibles)
    this.dataSourceTable1.filterPredicate = this._makeFilterPredicate(this.ColumnsTable1);
    this.dataSourceTable4.filterPredicate = this._makeFilterPredicate(this.displayedColumnsTable4);
  }

  private _makeFilterPredicate(columns: string[]) {
    return (row: any, filter: string) => {
      if (!filter) return true;
      const needle = filter.toLowerCase();
      for (const col of columns) {
        const v = row?.[col];
        if (v != null && String(v).toLowerCase().includes(needle)) return true;
      }
      return false;
    };
  }

  // Aplicar filtro rápido (escribe directo en dataSource.filter)
  applyQuickFilterT1(value: string) {
    this.quickFilterT1 = value;
    this.dataSourceTable1.filter = (value || '').trim().toLowerCase();
    if (this.dataSourceTable1.paginator) this.dataSourceTable1.paginator.firstPage();
  }

  applyQuickFilterT4(value: string) {
    this.quickFilterT4 = value;
    this.dataSourceTable4.filter = (value || '').trim().toLowerCase();
    if (this.dataSourceTable4.paginator) this.dataSourceTable4.paginator.firstPage();
  }

  clearQuickFilterT1() { this.applyQuickFilterT1(''); }
  clearQuickFilterT4() { this.applyQuickFilterT4(''); }

  // Formatear valores de celda: null/empty/"N/A" → "—" (em-dash)
  fmt(value: any): string {
    if (value == null || value === '' || value === 'N/A' || value === 'null' || value === 'undefined') return '—';
    return String(value);
  }

  // Clase semántica para estado_incapacidad
  estadoClass(estado: any): string {
    const s = String(estado || '').toLowerCase();
    if (!s || s === 'null' || s === 'undefined') return '';
    if (s.includes('pag') || s.includes('aprob') || s.includes('ok')) return 'disab-chip-status disab-chip-status-ok';
    if (s.includes('pend') || s.includes('revisi') || s.includes('proces')) return 'disab-chip-status disab-chip-status-pending';
    if (s.includes('rech') || s.includes('anul') || s.includes('fals')) return 'disab-chip-status disab-chip-status-danger';
    return 'disab-chip-status disab-chip-status-neutral';
  }

  // trackBy para las filas: evita re-renderizar filas idénticas cuando cambia la referencia del array
  trackByConsecutivo = (_: number, row: any) => row?.consecutivoSistema ?? row?.idReporte ?? _;

  mostrarCargando(estado: boolean) { 
    if (estado) {
      Swal.fire({
        title: 'Cargando...',
        html: 'Por favor espera mientras se carga la información',
        allowOutsideClick: false,
        allowEscapeKey: false,   
        didOpen: () => Swal.showLoading()
      });
    } else {
      Swal.close();
    }
  }

  cargarInformacion(estado: boolean) {
    this.mostrarCargando(estado);
  }

  private initializeLoader(): void {
    const isLoading = !this.isloadeddata;
    this.toggleLoader(isLoading);
    this.toggleOverlay(isLoading);
  }

  private setupFormListeners(): void {
    this.myForm.get('confirmacion_fecha_de_radicacion_inicio')?.valueChanges.subscribe(value => {
      this.filterCriteria.fechaInicio = this.formatDate(value, 'dd-MM-YYYY', 'es-CO');
    });

    this.myForm.get('confirmacion_fecha_de_radicacion_fin')?.valueChanges.subscribe(value => {
      this.filterCriteria.fechaFin = this.formatDate(value, 'dd-MM-YYYY', 'es-CO');
    });
  }

  private formatDate(date: any, p0: string, p1: string): string {
    return this.datePipe.transform(date, 'dd-MM-YYYY') || '';
  }

  toggleFilter(): void {
    this.isFilterCollapsed = !this.isFilterCollapsed;
  }

  toggleOverlay(visible: boolean): void {
    this.overlayVisible = visible;
  }

  toggleLoader(visible: boolean, showCounter: boolean = false): void {
    this.loaderVisible = visible;
    this.counterVisible = showCounter;
  }

private loadData(): void {
  console.time('Total Load');

  // Barra de progreso superior no bloqueante (reemplaza el overlay modal de Swal)
  this.isLoading = true;
  this.cdref.markForCheck();

  // pageSize inicial razonable: la UI pagina de a 25-100 y solo necesita las más recientes.
  // Para ver más, el usuario usa el filtro por fecha/documento (que va al backend indexado).
  forkJoin({
    incapacidades: this.incapacidadService.traerTodosDatosIncapacidad({ pageSize: 500 }),
    reporte: this.incapacidadService.traerTodosDatosReporte({ pageSize: 500 })
  }).subscribe({
    next: ({ incapacidades, reporte }) => {
      this.handleDataSuccess(incapacidades || [], reporte.data || []);
      this.isLoading = false;
      this.cdref.markForCheck();
      console.timeEnd('Total Load');
    },
    error: (err: any) => {
      this.isLoading = false;
      this.cdref.markForCheck();
      const status = err?.status;
      let msg = 'No se pudo cargar la información.';
      if (status === 0 || err?.message?.includes?.('ERR_CONNECTION_RESET')) {
        msg = 'El servidor cerró la conexión antes de terminar (payload grande). Intenta filtrar por fecha o por cédula para reducir la consulta.';
      } else if (status === 401 || status === 403) {
        msg = 'Sesión expirada o sin permisos. Vuelve a iniciar sesión.';
      } else if (status === 500) {
        msg = 'Error interno del servidor. Reporta esta incidencia.';
      }
      this.handleError(msg);
    }
  });
}



  private handleDataSuccess(incapacidades: any[], reporte: any[]): void {
    this.dataSourceTable1.data = incapacidades;
    this.dataSourceTable4.data = reporte;
    this.copiadataSourceTable1.data = incapacidades;
    this.copiadataSourceTable4.data = reporte;
    this.toggleLoader(false, false);
    this.toggleOverlay(false);
  }

  private handleError(errorMessage: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: errorMessage,
      confirmButtonText: 'Aceptar'
    });
    this.toggleLoader(false, false);
    this.toggleOverlay(false);
  }

  applyDateFilter(): void {
    const fechaInicio = this.formatDate(this.myForm.get('confirmacion_fecha_de_radicacion_inicio')?.value, 'dd-MM-YYYY', 'es-CO');
    // Verifica que la fecha de inicio esté presente
    if (!fechaInicio) {
      this.showWarning('Por favor, selecciona una fecha para filtrar.');
      return;
    }

    // Convierte la fecha de inicio al formato de Date
    const fechaInicioDate = new Date(fechaInicio);

    // Filtra los datos según la fecha de inicio proporcionada
    const filteredData = this.dataSourceTable1.data.filter(item => {
      const itemDate = new Date(item.F_inicio);
      return this.isDateWithinRange(itemDate, fechaInicioDate);
    });

    // Muestra un mensaje si no hay datos filtrados o actualiza las tablas con los datos filtrados
    if (filteredData.length === 0) {
      this.showInfo('No se encontraron datos con los criterios seleccionados.');
    } else {
      this.updateDataSources(filteredData);
    }
  }

  // Función actualizada para manejar solo la fecha de inicio
  private isDateWithinRange(itemDate: Date, startDate: Date): boolean {
    // Verifica que la fecha del elemento sea igual o posterior a la fecha de inicio
    return itemDate.getTime() >= startDate.getTime();
  }


  private showInfo(message: string): void {
    Swal.fire({
      icon: 'info',
      title: 'Información',
      text: message,
      confirmButtonText: 'Aceptar'
    });
  }

  private showWarning(message: string): void {
    Swal.fire({
      icon: 'warning',
      title: 'Advertencia',
      text: message,
      confirmButtonText: 'Aceptar'
    });
  }

  private updateDataSources(data: any[]): void {
    this.dataSourceTable1.data = data;
    this.dataSourceTable1._updateChangeSubscription();
    this.dataSourceTable4.data = data;
    this.dataSourceTable4._updateChangeSubscription();
  }

  applyFilter(): void {
    const filteredData = this.filterData(this.dataSourceTable1.data);
    const filteredData2 = this.filterData(this.dataSourceTable4.data);

    if (filteredData.length === 0) {
      this.showInfo('No se encontraron datos con los criterios seleccionados.');
      this.resetFilterCriteria();
      this.dataSourceTable1.data = this.copiadataSourceTable1.data;
      this.dataSourceTable4.data = this.copiadataSourceTable4.data;
    }else{
      this.updateDataSources(filteredData);
      this.resetFilterCriteria();
    }

  }

  private filterData(data: any[]): any[] {
    return data.filter(item => this.matchesCriteria(item));
  }
  private empresaAbreviaturas: { [key: string]: string } = {
    'Tu Alianza': 'TA',
    'Apoyo Laboral': 'AL',
    // Agrega más correspondencias según sea necesario
  };
  private matchesCriteria(item: any): boolean {
    const { numeroDeDocumento, fechaInicio, temporal, tipoIncapacidad } = this.filterCriteria;

    // Obtener la abreviatura de la empresa si existe
    const empresaAbreviada = temporal ? this.empresaAbreviaturas[temporal.trim()] : '';

    return this.exactStringMatch(item.Numero_de_documento, numeroDeDocumento) ||
      this.dateMatch(item.f_inicio, fechaInicio) ||

      this.stringMatch(item.Temporal, empresaAbreviada) ||
      this.exactStringMatch(item.tipo_incapacidad, tipoIncapacidad);
  }

  private exactStringMatch(value: string, filterValue: string): boolean {
    return value?.toLowerCase().trim() === filterValue?.toLowerCase().trim();
  }

  private stringMatch(value: string, filterValue: string): boolean {
    console.log(value, filterValue);

    if (!value || !filterValue) return false; // Asegura que ambos valores existan antes de comparar
    return value.toLowerCase().trim().includes(filterValue.toLowerCase().trim());
  }

  private dateMatch(date: string, filterDate: string): boolean {
    if (!date || !filterDate) return false; // Verifica si alguna fecha es inválida o está vacía

    const formattedDate = new Date(date).toISOString().split('T')[0];
    const formattedFilterDate = new Date(filterDate).toISOString().split('T')[0];

    return formattedDate === formattedFilterDate; // Devuelve el resultado de la comparación booleana
  }

  private resetFilterCriteria(): void {
    this.filterCriteria = { numeroDeDocumento: '', fechaInicio: '', empresa: '', tipoIncapacidad: '' };

  }

    async getUser(): Promise<any> {
      if (isPlatformBrowser(this.platformId)) {
        const user = localStorage.getItem('user');
        if (user) {
          return JSON.parse(user);
        }
      }
      return null;
    }

async downloadExcel(): Promise<void> {
  this.downloadingExcel = true;
  this.cdref.markForCheck();
  try {
    await this._downloadExcelImpl();
  } finally {
    this.downloadingExcel = false;
    this.cdref.markForCheck();
  }
}

private async _downloadExcelImpl(): Promise<void> {
  const combinedData = this.combineDataForExcel();
  console.log('Datos combinados para Excel:', combinedData);

  // Si no hay datos, generar hoja vacía con mensaje
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Incapacidades y Reporte');

  if (!combinedData || combinedData.length === 0) {
    worksheet.addRow(['No hay datos disponibles']);
  } else {
    // 1) Encabezados: tomar keys del primer objeto
    const headers = Object.keys(combinedData[0]);

    // Agregar fila de encabezados
    worksheet.addRow(headers);

    // Agregar las filas de datos
    combinedData.forEach(item => {
      const row = headers.map(h => item[h]);
      worksheet.addRow(row);
    });

    // 2) Estilar la primera fila (encabezados)
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      // Fuente en negrita y blanca
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };

      // Relleno azul oscuro
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E78' } // azul oscuro 
      };

      // Bordes gruesos en todos los lados
      cell.border = {
        top: { style: 'thick', color: { argb: 'FF000000' } },
        left: { style: 'thick', color: { argb: 'FF000000' } },
        bottom: { style: 'thick', color: { argb: 'FF000000' } },
        right: { style: 'thick', color: { argb: 'FF000000' } }
      };

      // Centrar texto vertical y horizontalmente
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // 3) Hacer que la fila de encabezados tenga altura mayor 
    headerRow.height = 22;

    // 4) Ajustar ancho de columnas automáticamente 
    headers.forEach((h, i) => {
      const maxLength = Math.max(
        h.length,
        ...combinedData.map(r => {
          const v = r[h];
          return v === null || v === undefined ? 0 : String(v).length;
        })
      );
      // ajustar ancho
      worksheet.getColumn(i + 1).width = Math.min(50, Math.max(10, Math.ceil(maxLength * 1.2)));
    });
  }

  // AGREGAR HOJA DE METADATOS
  const wsMeta = workbook.addWorksheet('Metadatos');
  const nombreUsuario = this.username || 'Usuario desconocido';
  const fechaActual = new Date().toLocaleString();
  const filtros = [
    `Documento: ${this.filterCriteria?.numeroDeDocumento || 'Todos'}`,
    `Fecha Inicio: ${this.filterCriteria?.fechaInicio || 'Todos'}`,
    `Temporal: ${this.filterCriteria?.temporal || 'Todos'}`,
    `Tipo Incapacidad: ${this.filterCriteria?.tipoIncapacidad || 'Todos'}`
  ];

  wsMeta.addRow(['Reporte generado por', nombreUsuario]);
  wsMeta.addRow(['Fecha de generación', fechaActual]);
  wsMeta.addRow([]);
  wsMeta.addRow(['Filtros aplicados']);
  filtros.forEach(f => wsMeta.addRow([f]));

  // Generar buffer y descargar
  const buf = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/octet-stream' });

  const formattedDate = new Date().toISOString().split('T')[0];
  saveAs(blob, `Reporte_${formattedDate}.xlsx`);
}


downloadDocs(fecha: Date | string | null, sevenet: boolean) {
  const fechaStr = this.toIsoDate(fecha);
  if (!fechaStr) {
    Swal.fire({ icon: 'warning', title: 'Falta fecha', text: 'Selecciona una fecha válida.' });
    return;
  }
  if (sevenet) this.downloadingDiaSevenet = true;
  else this.downloadingDia = true;
  this.cdref.markForCheck();

  this.incapacidadService.descargarTodoComoZip(fechaStr, sevenet)
    .then(() => {
      Swal.fire({ icon: 'success', title: '¡Descarga completada!', timer: 1800, showConfirmButton: false });
    })
    .catch(err => {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron descargar los documentos por fecha' });
      console.error(err);
    })
    .finally(() => {
      if (sevenet) this.downloadingDiaSevenet = false;
      else this.downloadingDia = false;
      this.cdref.markForCheck();
    });
}


downloadDocsRango(sevenet: boolean) {
  if (!this.fechaInicio || !this.fechaFin) {
    Swal.fire({ icon: 'warning', title: 'Faltan fechas', text: 'Debes seleccionar ambas fechas: inicio y fin.' });
    return;
  }

  const inicio = this.toIsoDate(this.fechaInicio);
  const fin = this.toIsoDate(this.fechaFin);

  if (new Date(inicio) > new Date(fin)) {
    Swal.fire({ icon: 'warning', title: 'Rango inválido', text: 'La fecha de inicio no puede ser mayor que la fecha fin.' });
    return;
  }

  const rango = { inicio, fin };

  if (sevenet) this.downloadingRangoSevenet = true;
  else this.downloadingRango = true;
  this.cdref.markForCheck();

  this.incapacidadService.descargarZipPorRango(rango, sevenet)
    .then(() => {
      Swal.fire({ icon: 'success', title: '¡Descarga completada!', timer: 1800, showConfirmButton: false });
    })
    .catch(err => {
      Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo descargar el rango de documentos.' });
      console.error(err);
    })
    .finally(() => {
      if (sevenet) this.downloadingRangoSevenet = false;
      else this.downloadingRango = false;
      this.cdref.markForCheck();
    });
}



private combineDataForExcel(): any[] {
    const reporteMap = this.createReportMap();
    console.log('Mapa de Reporte:', reporteMap); // <-- Esto imprime el mapa completo
  return this.dataSourceTable1.data.map((item: any) => {
    console.log('Registro:', item); // <-- Esto imprime el objeto tal como llega
    const row = this.combineItemData(item, reporteMap);
    return row;
  });
}

  private createReportMap(): Map<string, any> {
    const map = new Map<string, any>();
    this.dataSourceTable4.data.forEach((item: any) => {
      const mappedItem = this.mapDataWithTitles([item], this.columnTitlesTable4excel)[0];
      if (item['consecutivoSistema_id']) {
        map.set(item['consecutivoSistema_id'], mappedItem);
      }
    });
    return map;
  }

  private combineItemData(item: any, reporteMap: Map<string, any>): any {
    const mappedItem = this.mapDataWithTitles([item], this.columnTitlesTable1excel)[0];
    const reporteItem = reporteMap.get(item['consecutivoSistema']);
    Object.keys(this.columnTitlesTable4excel).forEach(key => {
      mappedItem[this.columnTitlesTable4excel[key]] = reporteItem?.[this.columnTitlesTable4excel[key]] || '';
    });
    return mappedItem;
  }

  mapDataWithTitles(data: any[], columnTitles: ColumnTitle): any[] {
    return data.map(item => {
      const mappedItem: any = {};
      for (const key in columnTitles) {
        if (item.hasOwnProperty(key)) {
          mappedItem[columnTitles[key]] = item[key];
        }
      }
      return mappedItem;
    });
  }



  playSound(success: boolean): void {
    const audio = new Audio(success ? 'Sounds/positivo.mp3' : 'Sounds/negativo.mp3');
    audio.play();
  }

  resetFileInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = '';
  }
  toTitleCase(text: string, columnTitles: ColumnTitle): string {
    return columnTitles[text] || text
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
