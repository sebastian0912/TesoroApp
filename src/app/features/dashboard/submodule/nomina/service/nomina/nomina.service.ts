import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

export interface ConceptoNomina {
  id_concepto?: number;
  codigo: string;
  descripcion: string;
  abreviatura?: string | null;
  naturaleza: 'DEVENGO' | 'DEDUCCION' | 'APORTE_EMPLEADO' | 'APORTE_EMPLEADOR' | 'PROVISION' | 'OTRO';
  unidad: 'HORA' | 'DIA' | 'VALOR';
  afecta_ibc: boolean;
  activo: boolean;
  naturaleza_display?: string;
  unidad_display?: string;
}

export type EstadoConvalidacion = 'CONVALIDADO' | 'CONVALIDADO_CON_OBSERVACION' | 'REVISAR' | 'SIN_HOMOLOGACION';

export interface ConvalidadorExterno {
  id_convalidacion?: number;
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
  estado_convalidacion: EstadoConvalidacion;
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

// ── Novedades (carga masiva) ──────────────────────────────────────────────
export interface NovedadRegistro {
  fila_excel: number;
  tipo_documento?: string | null;
  numero_documento?: string | null;
  codigo_contrato?: string | null;
  nombre_completo?: string | null;
  _resuelto: { id_contrato: number | null; error?: string };
  novedades: Record<string, Record<string, number | string | null>>;
}

export interface ColumnaMapeada {
  columna_excel: string;
  codigo_externo: string;
  concepto_externo: string;
  tabla: string;
  campo: string;
}

export interface NovedadesPreviewResponse {
  hojas_disponibles: string[];
  hoja_usada: string;
  header_row: number;
  total_filas_excel: number;
  registros_validos: number;
  filas_omitidas: number;
  no_resueltos: number;
  columnas_excel: string[];
  columnas_identificadoras: Record<string, string | null>;
  columnas_mapeadas: ColumnaMapeada[];
  columnas_no_mapeadas: string[];
  import_token: string;
  registros: NovedadRegistro[];
}

export interface NovedadesImportPayload {
  import_token?: string;
  registros?: NovedadRegistro[];
  edits?: Record<string, Partial<NovedadRegistro>>;
  periodo_id: number;
  reemplazar?: boolean;
}

export interface NovedadesImportResult {
  status: string;
  mensaje: string;
  contratos_afectados: number;
  total_insertadas: number;
  total_borradas: number;
  no_resueltos: Array<{
    fila_excel?: number;
    documento?: string;
    codigo_contrato?: string;
    motivo: string;
  }>;
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
  ceco?: string;
  fecha_ingreso?: string;
  fecha_retiro?: string;
  salario?: number;
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
}

export interface PreviewResponse {
  registros: PreviewRegistro[];
  import_token?: string;
  resumen?: any;
}

export interface ImportarRegistrosPayload {
  registros?: PreviewRegistro[];
  import_token?: string;
  edits?: Record<string, Partial<PreviewRegistro>>;
  optimizar_indices?: boolean;
}

export interface ImportResult {
  success: boolean;
  message: string;
  count?: number;
  mensaje?: string;
  filas?: number;
  log?: string[];
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

  // Alias para compatibilidad con import-excel.component.ts
  previewExcel(file: File, sheetName?: string, headerRow?: number): Observable<PreviewResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (sheetName) formData.append('sheet_name', sheetName);
    if (headerRow) formData.append('header_row', String(headerRow));
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

  guardarLiquidacion(payload: {
    periodo_id: number,
    cliente_id?: number | null,
    cecos?: number[],
    contrato_ids?: number[],
    detalles?: any[],
  }): Observable<any> {
    return this.http.post(`${this.baseNom}/payroll/guardar_liquidacion/`, payload);
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

  crearPeriodo(data: any): Observable<any> {
    return this.http.post(`${this.baseNom}/periodos/`, data);
  }

  actualizarPeriodo(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseNom}/periodos/${id}/`, data);
  }

  getHistorico(params: any): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseNom}/payroll/get_historico/`, { params });
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

  // --- Convalidador de Conceptos Externos ---
  getConvalidaciones(params: any = {}): Observable<ConvalidadorExterno[]> {
    return this.http.get<ConvalidadorExterno[]>(`${this.baseNom}/convalidador/`, { params });
  }

  crearConvalidacion(data: Partial<ConvalidadorExterno>): Observable<ConvalidadorExterno> {
    return this.http.post<ConvalidadorExterno>(`${this.baseNom}/convalidador/`, data);
  }

  actualizarConvalidacion(id: number, data: Partial<ConvalidadorExterno>): Observable<ConvalidadorExterno> {
    return this.http.patch<ConvalidadorExterno>(`${this.baseNom}/convalidador/${id}/`, data);
  }

  getClientesActivos(): Observable<Client[]> {
    if (!this._clientesActivos$) {
      this._clientesActivos$ = this.http.get<Client[]>(
        `${this.baseNom}/organizaciones/`, { params: { tipo: 'CLIENTE', activo: 'true' } },
      ).pipe(shareReplay({ bufferSize: 1, refCount: true }));
    }
    return this._clientesActivos$;
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

  getEntidadesPorTipo(tipo: 'CLIENTE' | 'EPS' | 'AFP' | 'CCF' | 'BANCO'): Observable<Client[]> {
    return this.http.get<Client[]>(`${this.baseNom}/organizaciones/`, {
      params: { tipo, activo: 'true' },
    });
  }

  // ── Novedades (carga masiva) ─────────────────────────────────────────────
  previewNovedadesExcel(
    file: File, periodoId: number, clienteId: number,
    opts?: { sheetName?: string; headerRow?: number },
  ): Observable<NovedadesPreviewResponse> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('periodo_id', String(periodoId));
    fd.append('cliente_id', String(clienteId));
    if (opts?.sheetName) fd.append('sheet_name', opts.sheetName);
    if (opts?.headerRow !== undefined && opts?.headerRow !== null) {
      fd.append('header_row', String(opts.headerRow));
    }
    return this.http.post<NovedadesPreviewResponse>(
      `${this.baseReg.replace('registro-empleado', 'registro-novedades')}/preview-excel/`, fd,
    );
  }

  importarNovedades(payload: NovedadesImportPayload): Observable<NovedadesImportResult> {
    return this.http.post<NovedadesImportResult>(
      `${this.baseReg.replace('registro-empleado', 'registro-novedades')}/importar-registros/`, payload,
    );
  }
}
