import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

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
}

@Injectable({
  providedIn: 'root'
})
export class NominaService {
  private baseReg = `${environment.apiUrl}/api/nomina/registro-empleado`;
  private baseNom = `${environment.apiUrl}/api/nomina`;

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

  getOrganizaciones(params: any = {}): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseNom}/organizaciones/`, { params });
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

  guardarLiquidacion(payload: { periodo_id: number, cliente_id?: number | null, detalles: any[] }): Observable<any> {
    return this.http.post(`${this.baseNom}/payroll/guardar_liquidacion/`, payload);
  }

  crearPeriodo(data: any): Observable<any> {
    return this.http.post(`${this.baseNom}/periodos/`, data);
  }

  actualizarPeriodo(id: number, data: any): Observable<any> {
    return this.http.patch(`${this.baseNom}/periodos/${id}/`, data);
  }
}
