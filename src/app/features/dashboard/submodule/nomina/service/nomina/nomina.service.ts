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
  fecha_ingreso?: string;
  fecha_retiro?: string;
  salario?: number;
  email?: string;
  estado?: string;
}

export interface PreviewResponse {
  registros: PreviewRegistro[];
  resumen?: any;
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

  importarRegistros(registros: PreviewRegistro[]): Observable<ImportResult> {
    return this.http.post<ImportResult>(`${this.baseReg}/importar-registros/`, { registros });
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
}
