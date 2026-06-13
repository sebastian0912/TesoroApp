import { Injectable } from '@angular/core';
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from '@/environments/environment';

export interface ConceptoNomina {
  id_concepto?: number;
  codigo: string;
  descripcion: string;
  abreviatura?: string | null;
  naturaleza: 'DEVENGO' | 'DEDUCCION' | 'APORTE_EMPLEADO' | 'APORTE_EMPLEADOR' | 'PROVISION' | 'OTRO';
  unidad: 'HORA' | 'DIA' | 'VALOR';
  /** Categoría funcional (DIA_AUSENCIA, HORA_EXTRA, VALOR_BONIFICACION…).
   *  Editable desde V16. */
  categoria?: string | null;
  /** Tabla satélite donde el motor escribe la novedad importada (V19).
   *  Es la fuente global de routing — el homologador puede sobreescribir
   *  por cliente, pero el camino feliz consulta esta columna. */
  tabla_destino?: string | null;
  /** Campo de {@link tabla_destino} que recibe la cantidad/valor. */
  campo_destino?: string | null;
  afecta_ibc: boolean;
  activo: boolean;
  naturaleza_display?: string;
  unidad_display?: string;
}

export type EstadoHomologacion = 'HOMOLOGADO' | 'HOMOLOGADO_CON_OBSERVACION' | 'REVISAR' | 'SIN_HOMOLOGACION';

export interface HomologadorExterno {
  id_homologacion?: number;
  concepto: number;
  concepto_codigo?: string;
  concepto_descripcion?: string;
  concepto_naturaleza?: string;
  entidad_externa: number;
  entidad_nombre?: string;
  entidad_nit?: string;
  codigo_externo: string;
  concepto_externo: string;
  clasificacion_externa?: string | null;
  tabla_operativa_destino?: string | null;
  campo_operativo_destino?: string | null;
  estado_homologacion: EstadoHomologacion;
  estado_display?: string;
  observacion?: string | null;
  activo: boolean;
  creado_at?: string;
  actualizado_at?: string;
}

export interface Client {
  id_entidad: number;
  id_org?: number; // Alias para compatibilidad
  nombre_legal: string;
  nit: string;
}

export interface CostCenter {
  id_ceco: number;
  nombre: string;
  codigo_interno: string;
}

/** Estados permitidos para el campo estado_pago de una liquidación. */
export type EstadoPagoNomina = 'PENDIENTE' | 'APROBADA' | 'PAGADA';
export const ESTADOS_PAGO_NOMINA: EstadoPagoNomina[] = ['PENDIENTE', 'APROBADA', 'PAGADA'];

// ── Desprendible de nómina ────────────────────────────────────────────────
/**
 * Shape exacto que devuelve `GET /payroll/desprendible/{id_nomina_emp}` en
 * ms-payroll (DesprendibleDtos.java). Tipado en snake_case para reflejar lo
 * que viaja por HTTP — la conversión a camelCase la haría el interceptor
 * si la necesitamos, pero la UI puede consumir snake_case directamente.
 */
export interface DesprendibleEmpresa {
  razon_social: string | null;
  nombre_comercial: string | null;
  nit: string | null;
  logo_url: string | null;
  area_emisora: string | null;
  texto_pie: string | null;
  color_primario: string | null;
  color_secundario: string | null;
}
export interface DesprendibleEmpleado {
  tipo_documento: string | null;
  numero_documento: string | null;
  nombre_completo: string | null;
  primer_nombre: string | null;
  primer_apellido: string | null;
  cargo: string | null;
  ceco_nombre: string | null;
  empresa_usuaria: string | null;
}
export interface DesprendibleContrato {
  codigo_contrato: string | null;
  fecha_ingreso: string | null;
  fecha_retiro: string | null;
  salario_base: number | null;
  tipo_contrato: string | null;
  estado_contrato: string | null;
  banco: string | null;
  numero_cuenta_enmascarado: string | null;
  forma_pago: string | null;
}
export interface DesprendibleNominaPeriodo {
  periodo_inicio: string | null;
  periodo_fin: string | null;
  periodo_texto: string | null;
  fecha_pago: string | null;
  fecha_emision: string | null;
  estado_pago: string | null;
}
export interface DesprendibleConcepto {
  codigo_concepto: string;
  nombre_concepto: string;
  cantidad: number | null;
  valor: number | null;
  unidad: string | null;
  tipo_concepto: 'DEVENGO' | 'DEDUCCION';
}
export interface DesprendibleTotales {
  total_devengos: number | null;
  total_deducciones: number | null;
  neto_pagar: number | null;
}
export interface DesprendiblePrestamoEfectivo {
  saldo_anterior: number | null;
  nuevo_desembolso: number | null;
  abono_periodo: number | null;
  nuevo_saldo: number | null;
  numero_cuotas: number | null;
  valor_cuota_fija: number | null;
}
export interface DesprendibleBonoMercado {
  saldo_anterior: number | null;
  nuevo_bono: number | null;
  abono_periodo: number | null;
  nuevo_saldo: number | null;
}
export interface DesprendiblePrestamos {
  efectivo: DesprendiblePrestamoEfectivo;
  mercado: DesprendibleBonoMercado;
  seguro_funerario: number | null;
  total_deuda_actual: number | null;
}
export interface DesprendibleFirma {
  nombre_empleado: string | null;
  responsable_nomina: string | null;
  area_responsable: string | null;
}
export interface DesprendibleData {
  empresa: DesprendibleEmpresa;
  empleado: DesprendibleEmpleado;
  contrato: DesprendibleContrato;
  nomina: DesprendibleNominaPeriodo;
  devengos: DesprendibleConcepto[];
  deducciones: DesprendibleConcepto[];
  totales: DesprendibleTotales;
  prestamos: DesprendiblePrestamos;
  observaciones: string | null;
  firma: DesprendibleFirma;
}

// ── Empleados (editor individual) ─────────────────────────────────────────
export interface EmpleadoContrato {
  id_contrato?: number;
  codigo_contrato_client?: string | null;
  id_ceco?: number | null;
  centro_de_costo?: string;
  id_cliente?: number | null;
  cliente_nombre?: string;
  id_banco?: number | null;
  banco_nombre?: string;
  id_eps?: number | null;
  eps_nombre?: string;
  id_afp?: number | null;
  afp_nombre?: string;
  id_ccf?: number | null;
  ccf_nombre?: string;
  fecha_ingreso?: string | null;
  fecha_retiro?: string | null;
  salario_basico?: number | string | null;
  auxilio_transporte_ley?: boolean;
  numero_cuenta_bancaria?: string | null;
  forma_pago?: string | null;
  fecha_inicio_prima?: string | null;
  fecha_inicio_cesantias?: string | null;
  fecha_inicio_vacaciones?: string | null;
  estado?: 'ACTIVO' | 'INACTIVO' | 'FINALIZADO' | 'RETIRADO';
}

export interface Empleado {
  id_persona?: number;
  tipo_documento?: string;
  numero_documento?: string;
  primer_nombre?: string;
  segundo_nombre?: string | null;
  primer_apellido?: string;
  segundo_apellido?: string | null;
  nombre_completo?: string;
  fecha_nacimiento?: string | null;
  genero?: string | null;
  email?: string | null;
  es_pensionado?: boolean;
  cantidad_hijos?: number | null;
  contrato_activo?: EmpleadoContrato | null;
  contratos?: EmpleadoContrato[];
}

export interface EmpleadosQuery {
  q?: string;
  cliente_id?: number | null;
  ceco_id?: number | null;
  estado?: string;
  solo_con_contrato?: 0 | 1;
  page?: number;
  page_size?: number;
}

export interface Paged<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

// ── Cálculo con plantilla de novedades (Excel LONG, no persiste) ─────────
export interface ConceptoSinHomologar {
  codigo: string;
  concepto: string;
  filas: number;
}

export interface CalculoConNovedadesResponse {
  hoja_usada: string;
  hojas_disponibles: string[];
  total_filas_excel: number;
  filas_omitidas_sin_cedula: number;
  cedulas_excel: number;
  cedulas_en_sistema: number;
  cedulas_sin_contrato_cliente: number;
  cedulas_resueltas: number;
  cedulas_no_encontradas: string[];
  cedulas_fuera_de_alcance: string[];
  conceptos_sin_homologar: ConceptoSinHomologar[];
  errores_cache: Array<{ contrato_id: number; tabla: string; campo: string; error: string }>;
  contratos_calculados: number;
  contratos_con_novedad: number;
  contratos_sin_novedad: number;
  contratos_data: any[];
  empleados: any[];
  totales: { total_devengado: string; total_deducido: string; neto: string };
  warnings: string[];
  periodo: {
    id: number;
    descripcion: string;
    fecha_inicio: string;
    fecha_fin: string;
    es_invalido: boolean;
  };
  // Incremento 2.5/2.6 — snapshot server-side + diagnóstico/conciliación.
  calculation_id?: string;
  puede_cerrar?: boolean;
  conciliacion?: ConciliacionNovedades;
  diagnostico_novedades?: DiagnosticoNovedad[];
  bloqueantes?: DiagnosticoNovedad[];
  comparacion_recargos?: any;
  fecha_expiracion?: string;
}

export interface ConciliacionNovedades {
  total_recibidas: number;
  procesadas: number;
  informativas: number;
  sin_homologacion: number;
  no_soportadas: number;
  sin_contrato?: number;
  rechazadas: number;
  conciliacion_correcta: boolean;
  modos_motor?: string;
  puede_cerrar?: boolean;
  total_bloqueantes?: number;
}

export interface DiagnosticoNovedad {
  documento: string;
  codigo_externo: string;
  concepto: string;
  valor_entrada?: string | null;
  unidad?: string;
  tabla_destino?: string | null;
  campo_destino?: string | null;
  modo_motor?: string;
  estado: string;     // PROCESADA | INFORMATIVO | SIN_HOMOLOGACION | NO_SOPORTADO_POR_MODO | SIN_CONSUMIDOR | CONFIGURACION_INCONSISTENTE | FECHA_CAUSACION_REQUERIDA | DUPLICACION_SUM | SIN_CONTRATO
  severidad: string;  // OK | INFO | WARNING | ERROR
  bloqueante: boolean;
  consumidor?: string;
  mensaje?: string;
}

// Estado de la resolución nombre→id contra catálogos:
// OK | NO_ENCONTRADO | INACTIVO | VACIO
export type FkEstado = 'OK' | 'NO_ENCONTRADO' | 'INACTIVO' | 'VACIO';

export interface FkResolucion {
  excel: string | null;
  detectada: string | null;
  id_detectado: number | null;
  estado: FkEstado;
}

export interface PreviewResolucion {
  empresa: FkResolucion;
  eps: FkResolucion;
  afp: FkResolucion;
  banco: FkResolucion;
  ccf: FkResolucion;
  ceco: FkResolucion;
}

export interface PreviewRegistro {
  fila_excel?: number;
  tipo_documento?: string;
  numero_documento?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  nombre_completo?: string;
  codigo_contrato?: string;
  empresa_usuaria?: string;
  centro_costo?: string;
  cliente?: string;
  // Valor CRUDO de la celda de empresa usuaria antes de la extracción. Cuando la
  // columna es compuesta ("Empresa Usuaria y Centro de Costo") es el texto completo
  // y `cliente` es el nombre ya extraído (recortado antes del marcador de centro de
  // costo). Cuando es una columna simple ("Cliente") ambos coinciden.
  cliente_original?: string;
  ceco?: string;
  fecha_ingreso?: string;
  fecha_retiro?: string;
  salario?: number;
  // Valor de la columna "Estado" del Excel (INGRESO / SIN CONFIRMAR / NO INGRESO).
  // undefined si el archivo no trae esa columna.
  estado_registro?: string;
  // ¿La fila es candidata a importación? Solo INGRESO (o sin columna Estado) → true.
  importar?: boolean | null;
  // Salario informativo leído del Excel ("Salario S.M.M.L.V."). NO se persiste.
  salario_excel?: number;
  // Advertencias por fila calculadas por el backend (estado, tipo doc raro, email
  // inválido, fecha de retiro de experiencia laboral, marcador de centro de costo…).
  warnings?: string[];
  numero_cuenta?: string;
  forma_pago?: string;
  banco?: string;
  eps?: string;
  afp?: string;
  ccf?: string;
  email?: string;
  telefono?: string;
  direccion?: string;
  municipio?: string;
  departamento?: string;
  genero?: string;
  fecha_nacimiento?: string;
  es_pensionado?: boolean;
  cantidad_hijos?: number | null;
  estado?: string;
  // Resolución de FKs calculada por el backend en el preview.
  // Si el backend es viejo viene undefined y el import no validará FKs.
  resolucion?: PreviewResolucion;
}

export interface PreviewResponse {
  registros: PreviewRegistro[];
  import_token?: string;
  resumen?: any;
  total_filas_excel?: number;
  registros_validos?: number;
  filas_con_warnings?: number;
  filas_con_fk_no_resuelta?: number;
  resumen_warnings?: Record<string, number>;
  resumen_fk?: Record<string, number>;
  columnas_excel?: string[];
  columnas_mapeadas?: Record<string, string | null>;
  // Código de la plantilla/parser que usó el backend ("DEFAULT", "TU_ALIANZA_IPANEMA").
  plantilla?: string;
}

export interface ImportarRegistrosPayload {
  registros?: PreviewRegistro[];
  import_token?: string;
  edits?: Record<string, Partial<PreviewRegistro>>;
  optimizar_indices?: boolean;
  // Empresa usuaria / plantilla seleccionada (paridad con el preview).
  empresa_usuaria_id?: number;
  template_code?: string;
}

export interface ImportNoAplicable {
  fila_excel: number;
  cedula?: string;
  motivo: string;
}

// ── Guardado de nómina ────────────────────────────────────────────────────
// Mirror de PayrollDtos.ConceptoLiquidadoDto en ms-payroll.
export interface ConceptoLiquidadoPayload {
  codigo: string;
  descripcion?: string;
  naturaleza?: string;          // DEVENGO | DEDUCCION | OTRO
  unidad?: string;              // DIA | HORA | VALOR
  cantidad?: number;
  valor_unitario?: number;
  valor_total?: number;
  clasificacion?: string;
  hace_base_ibc?: boolean;
  disminuye_ibc?: boolean;
  origen_tabla?: string;
  origen_id?: number | null;
  observacion?: string;
}

export interface DetalleLiquidacionPayload {
  id_contrato: number;
  id_empleado: number;
  dias?: number | null;
  sueldo_q?: number;
  aux_trans?: number;
  salud?: number;
  pension?: number;
  neto?: number;
  total_devengado?: number;
  total_deducido?: number;
  dias_efectivos?: number | null;
  dias_no_remunerados?: number | null;
  dias_incapacidad?: number | null;
  dias_laborados?: number | null;
  dias_con_derecho_auxilio?: number | null;
  dias_pagados?: number | null;
  ibc?: number;
  devengos_salariales?: number;
  devengos_no_salariales?: number;
  deducciones_salariales_que_disminuyen_ibc?: number;
  conceptos?: ConceptoLiquidadoPayload[];
}

export interface GuardarLiquidacionPayload {
  periodo_id: number;
  cliente_id?: number | null;
  // Incremento 2.6: el cierre envía ÚNICAMENTE el calculationId (+ datos
  // administrativos). El backend recupera todo desde el snapshot. `detalles`
  // solo se conserva para el flujo legacy (deprecado, sin calculationId).
  calculation_id?: string;
  usuario?: string;
  detalles?: DetalleLiquidacionPayload[];
}

export interface GuardarLiquidacionResponse {
  ok: boolean;
  creados_nomina: number;
  creados_facturacion: number;
  creados_conceptos: number;
  creados_historico_novedades: number;
  estado_periodo: string;
  recalculado: boolean;
  idempotent_replay?: boolean;
  // Presentes solo en error controlado (409/422):
  codigo?: string;
  cambiosDetectados?: string[];
  mensaje?: string;
}

/**
 * Fila del histórico de novedades: una novedad aplicada a un empleado en
 * un cierre de nómina. Espejo de HistoricoNovedadDto en ms-payroll.
 */
export interface HistoricoNovedadRow {
  id_historico: number;
  id_periodo: number;
  id_cliente: number | null;
  cliente_nombre: string | null;
  id_ceco: number | null;
  ceco_nombre: string | null;
  ceco_codigo: string | null;
  id_contrato: number;
  codigo_contrato: string | null;
  id_persona: number;
  identificacion: string;
  tipo_documento: string;
  nombre_completo: string;
  codigo: string;
  descripcion: string;
  naturaleza: string;
  clasificacion: string;
  unidad: string;
  cantidad: number;
  valor_unitario: number;
  valor_total: number;
  hace_base_ibc: boolean;
  disminuye_ibc: boolean;
  origen_tabla: string;
  origen_id: number | null;
  observacion: string;
  liquidado_at: string | null;
}

export interface ImportResult {
  success?: boolean;
  status?: string;
  message?: string;
  count?: number;
  mensaje?: string;
  filas?: number;
  total_procesados?: number;
  personas_creadas?: number;
  personas_actualizadas?: number;
  contratos_creados?: number;
  contratos_actualizados?: number;
  no_aplicables?: ImportNoAplicable[];
  advertencias?: Record<string, number>;
  log?: string[];
}

// ── Actualización por empresa usuaria (Empleados) ───────────────────────────
export interface ActualizacionEmpresaRow {
  row_number: number;
  cedula: string | null;
  nombre_excel: string | null;
  empleado_encontrado: boolean;
  persona_id: number | null;
  contrato_id: number | null;
  empresa_usuaria_id: number | null;
  empresa_usuaria_nombre: string | null;
  ccosto_excel: string | null;
  codigo_c_costo_normalizado: string | null;
  ingreso_excel: string | null;
  fecha_ingreso_parseada: string | null;
  sub_legal_excel: string | null;
  auxilio_transporte_ley_parseado: boolean | null;
  distribucion_excel: string | null;
  ceco_id: number | null;
  ceco_codigo: string | null;
  ceco_nombre: string | null;
  estado_fila: 'valido' | 'advertencia' | 'error';
  errores: string[];
  advertencias: string[];
}

export interface ActualizacionEmpresaPreview {
  empresa_usuaria_id: number | null;
  empresa_usuaria_nombre: string | null;
  plantilla_codigo: string | null;
  total_filas: number;
  total_validas: number;
  total_con_error: number;
  total_con_advertencia: number;
  errores_generales: string[];
  advertencias_generales: string[];
  columnas_detectadas: Record<string, string | null>;
  results: ActualizacionEmpresaRow[];
  import_token: string | null;
}

export interface ActualizacionEmpresaImportResult {
  status: string;
  mensaje: string;
  total_actualizados: number;
  total_omitidos: number;
  errores: string[];
  advertencias: string[];
  results: ActualizacionEmpresaRow[];
}

@Injectable({
  providedIn: 'root'
})
export class NominaService {
  private baseReg = `${environment.apiUrl}/api/nomina/registro-empleado`;
  private baseNom = `${environment.apiUrl}/api/nomina`;

  private _clientesActivos$: Observable<Client[]> | null = null;
  private _conceptosActivos$: Observable<ConceptoNomina[]> | null = null;

  constructor(private http: HttpClient) { }

  // Alias para compatibilidad con import-excel.component.ts.
  // `empresaUsuariaId` selecciona el parser/plantilla en el backend (el formato
  // del Excel puede variar por empresa). Es obligatorio en la UI.
  previewExcel(
    file: File,
    sheetName?: string,
    headerRow?: number,
    empresaUsuariaId?: number | null,
    templateCode?: string,
  ): Observable<PreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) formData.append('sheet_name', sheetName);
    if (headerRow) formData.append('header_row', String(headerRow));
    if (empresaUsuariaId != null) formData.append('empresa_usuaria_id', String(empresaUsuariaId));
    if (templateCode) formData.append('template_code', templateCode);
    return this.http.post<PreviewResponse>(`${this.baseReg}/preview-excel/`, formData);
  }

  getPreviewExcel(file: File): Observable<PreviewRegistro[]> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<PreviewRegistro[]>(`${this.baseReg}/preview-excel/`, formData);
  }

  importarExcel(file: File): Observable<ImportResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportResult>(`${this.baseReg}/importar-excel/`, formData);
  }

  getClientes(params: any = {}): Observable<Client[]> {
    return this.http.get<Client[]>(`${this.baseNom}/organizaciones/`, { params });
  }

  getCentrosCostos(idOrParams: any = {}): Observable<CostCenter[]> {
    let params = idOrParams;
    if (typeof idOrParams === 'number' || typeof idOrParams === 'string') {
      params = { id_cliente: idOrParams };
    }
    return this.http.get<CostCenter[]>(`${this.baseNom}/centros-costos/`, { params });
  }

  getContratosFiltrados(params: any = {}): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseNom}/contratos/`, { params });
  }

  importarRegistros(
    registrosOrPayload: PreviewRegistro[] | ImportarRegistrosPayload,
  ): Observable<ImportResult> {
    const payload: ImportarRegistrosPayload = Array.isArray(registrosOrPayload)
      ? { registros: registrosOrPayload }
      : registrosOrPayload;
    return this.http.post<ImportResult>(`${this.baseReg}/importar-registros/`, payload);
  }

  getPeriodos(): Observable<any> {
    return this.http.get(`${this.baseNom}/periodos/`);
  }

  guardarLiquidacion(payload: GuardarLiquidacionPayload): Observable<GuardarLiquidacionResponse> {
    return this.http.post<GuardarLiquidacionResponse>(
      `${this.baseNom}/payroll/guardar_liquidacion/`, payload,
    );
  }

  calcularLiquidacion(payload: {
    periodo_id: number,
    cliente_id?: number | null,
    cecos?: number[],
    contrato_ids?: number[],
    forzar_dias_completos?: boolean,
  }): Observable<{ empleados: any[], totales: any }> {
    return this.http.post<{ empleados: any[], totales: any }>(
      `${this.baseNom}/payroll/calcular/`, payload,
    );
  }

  descargarPlantilla(payload: {
    periodo_id?: number | null,
    cliente_id?: number | null,
    empleados?: any[],
  }): Observable<HttpResponse<Blob>> {
    return this.http.post(
      `${this.baseNom}/payroll/descargar-plantilla/`, payload,
      { responseType: 'blob', observe: 'response' },
    );
  }

  crearPeriodo(data: any): Observable<any> {
    return this.http.post(`${this.baseNom}/periodos/`, data);
  }

  actualizarPeriodo(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseNom}/periodos/${id}/`, data);
  }

  getHistorico(params: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseNom}/payroll/get_historico/`, { params });
  }

  /**
   * Detalle del desprendible de una liquidación concreta. El backend
   * agrega empresa emisora, empleado, contrato, periodo, devengos,
   * deducciones, totales, préstamos y observaciones.
   */
  getDesprendible(idNominaEmp: number): Observable<DesprendibleData> {
    return this.http.get<DesprendibleData>(
      `${this.baseNom}/payroll/desprendible/${idNominaEmp}/`,
    );
  }

  /**
   * Cambia el estado_pago de una o varias liquidaciones del histórico.
   * Estados permitidos en el backend: PENDIENTE | APROBADA | PAGADA.
   */
  cambiarEstadoNomina(
    ids: number[],
    estado: EstadoPagoNomina,
  ): Observable<{ ok: boolean; actualizados: number; solicitados: number; estado: string }> {
    return this.http.patch<{ ok: boolean; actualizados: number; solicitados: number; estado: string }>(
      `${this.baseNom}/payroll/cambiar-estado/`,
      { ids, estado },
    );
  }

  /**
   * Histórico de novedades aplicadas en cierres anteriores. Filtros
   * opcionales por periodo, empresa usuaria, cecos y query libre.
   */
  getHistoricoNovedades(params: any = {}): Observable<HistoricoNovedadRow[]> {
    return this.http.get<HistoricoNovedadRow[]>(
      `${this.baseNom}/payroll/historico-novedades/`, { params },
    );
  }

  // --- Conceptos / Parametrización de Novedades ---
  getConceptos(params: any = {}): Observable<ConceptoNomina[]> {
    return this.http.get<ConceptoNomina[]>(`${this.baseNom}/conceptos/`, { params });
  }

  crearConcepto(data: ConceptoNomina): Observable<ConceptoNomina> {
    return this.http.post<ConceptoNomina>(`${this.baseNom}/conceptos/`, data);
  }

  actualizarConcepto(id: number, data: Partial<ConceptoNomina>): Observable<ConceptoNomina> {
    return this.http.patch<ConceptoNomina>(`${this.baseNom}/conceptos/${id}/`, data);
  }

  eliminarConcepto(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseNom}/conceptos/${id}/`);
  }

  // --- Homologador de Conceptos Externos ---
  getHomologaciones(params: any = {}): Observable<HomologadorExterno[]> {
    return this.http.get<HomologadorExterno[]>(`${this.baseNom}/homologador/`, { params });
  }

  crearHomologacion(data: Partial<HomologadorExterno>): Observable<HomologadorExterno> {
    return this.http.post<HomologadorExterno>(`${this.baseNom}/homologador/`, data);
  }

  actualizarHomologacion(id: number, data: Partial<HomologadorExterno>): Observable<HomologadorExterno> {
    return this.http.patch<HomologadorExterno>(`${this.baseNom}/homologador/${id}/`, data);
  }

  getClientesActivos(): Observable<Client[]> {
    if (!this._clientesActivos$) {
      this._clientesActivos$ = this.http.get<Client[]>(
        `${this.baseNom}/organizaciones/`, { params: { tipo: 'EMPRESA_USUARIA', activo: 'true' } },
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this._clientesActivos$;
  }

  // ── Actualización por empresa usuaria (Empleados) ──────────────────────
  /** Paso 1: previsualizar (no persiste). La EMPRESA seleccionada manda el parser/plantilla. */
  previewActualizacionEmpresa(empresaUsuariaId: number, file: File): Observable<ActualizacionEmpresaPreview> {
    const fd = new FormData();
    fd.append('archivo', file);
    fd.append('empresa_usuaria_id', String(empresaUsuariaId));
    return this.http.post<ActualizacionEmpresaPreview>(
      `${this.baseNom}/empleados/actualizacion-empresa/preview/`, fd,
    );
  }

  /** Paso 2: confirmar usando el import_token devuelto por el preview. */
  importarActualizacionEmpresa(
    empresaUsuariaId: number, importToken: string,
  ): Observable<ActualizacionEmpresaImportResult> {
    return this.http.post<ActualizacionEmpresaImportResult>(
      `${this.baseNom}/empleados/actualizacion-empresa/importar/`,
      { empresa_usuaria_id: empresaUsuariaId, import_token: importToken },
    );
  }

  getConceptosActivos(): Observable<ConceptoNomina[]> {
    if (!this._conceptosActivos$) {
      this._conceptosActivos$ = this.http.get<ConceptoNomina[]>(
        `${this.baseNom}/conceptos/`, { params: { activo: 'true' } },
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this._conceptosActivos$;
  }

  invalidateCache(): void {
    this._clientesActivos$ = null;
    this._conceptosActivos$ = null;
  }

  // ── Empleados (editor individual) ───────────────────────────────────────
  getEmpleados(query: EmpleadosQuery = {}): Observable<Paged<Empleado>> {
    const params: Record<string, string> = {};
    Object.entries(query).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params[k] = String(v);
    });
    return this.http.get<Paged<Empleado>>(`${this.baseNom}/empleados/`, { params });
  }

  getEmpleado(id: number): Observable<Empleado> {
    return this.http.get<Empleado>(`${this.baseNom}/empleados/${id}/`);
  }

  crearEmpleado(data: Partial<Empleado> & { contrato_inicial?: Partial<EmpleadoContrato> }): Observable<Empleado> {
    return this.http.post<Empleado>(`${this.baseNom}/empleados/`, data);
  }

  actualizarEmpleado(id: number, data: Partial<Empleado>): Observable<Empleado> {
    return this.http.patch<Empleado>(`${this.baseNom}/empleados/${id}/`, data);
  }

  eliminarEmpleado(id: number): Observable<{ ok: boolean; contratos_retirados: number; fecha_retiro: string }> {
    return this.http.delete<{ ok: boolean; contratos_retirados: number; fecha_retiro: string }>(
      `${this.baseNom}/empleados/${id}/`,
    );
  }

  listarContratosEmpleado(id: number): Observable<EmpleadoContrato[]> {
    return this.http.get<EmpleadoContrato[]>(`${this.baseNom}/empleados/${id}/contratos/`);
  }

  crearContratoEmpleado(id: number, data: Partial<EmpleadoContrato>): Observable<EmpleadoContrato> {
    return this.http.post<EmpleadoContrato>(`${this.baseNom}/empleados/${id}/contratos/`, data);
  }

  actualizarContratoEmpleado(
    idEmpleado: number, idContrato: number, data: Partial<EmpleadoContrato>,
  ): Observable<EmpleadoContrato> {
    return this.http.patch<EmpleadoContrato>(
      `${this.baseNom}/empleados/${idEmpleado}/contratos/${idContrato}/`, data,
    );
  }

  terminarContratoEmpleado(
    idEmpleado: number, idContrato: number, fechaRetiro?: string,
  ): Observable<EmpleadoContrato> {
    return this.http.post<EmpleadoContrato>(
      `${this.baseNom}/empleados/${idEmpleado}/contratos/${idContrato}/terminar/`,
      fechaRetiro ? { fecha_retiro: fechaRetiro } : {},
    );
  }

  eliminarContratoEmpleado(idEmpleado: number, idContrato: number): Observable<EmpleadoContrato> {
    return this.http.delete<EmpleadoContrato>(
      `${this.baseNom}/empleados/${idEmpleado}/contratos/${idContrato}/`,
    );
  }

  getEntidadesPorTipo(tipo: 'EMPRESA_USUARIA' | 'EPS' | 'AFP' | 'CCF' | 'BANCO'): Observable<Client[]> {
    return this.http.get<Client[]>(`${this.baseNom}/organizaciones/`, {
      params: { tipo, activo: 'true' },
    });
  }

  calcularConNovedadesExcel(
    file: File,
    periodoId: number,
    clienteId: number,
    opts?: {
      contratoIds?: number[];
      cecos?: number[];
      forzarDiasCompletos?: boolean;
      sheetName?: string;
    },
  ): Observable<CalculoConNovedadesResponse> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('periodo_id', String(periodoId));
    fd.append('cliente_id', String(clienteId));
    if (opts?.contratoIds?.length) fd.append('contrato_ids', JSON.stringify(opts.contratoIds));
    if (opts?.cecos?.length) fd.append('cecos', JSON.stringify(opts.cecos));
    if (opts?.forzarDiasCompletos) fd.append('forzar_dias_completos', 'true');
    if (opts?.sheetName) fd.append('sheet_name', opts.sheetName);
    return this.http.post<CalculoConNovedadesResponse>(
      `${this.baseNom}/calculo-con-novedades/`, fd,
    );
  }
}
