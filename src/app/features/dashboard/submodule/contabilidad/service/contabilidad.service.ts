import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';

export interface DashboardStats {
  total_archivos: number;
  total_registros: number;
  total_empresas: number;
  ultimo_cargue: string | null;
  archivos_por_tipo: Record<string, number>;
  archivos_por_mes: { mes: string; count: number; registros: number }[];
  empresas: string[];
}

export interface ArchivoContabilidad {
  id: number;
  nombre_archivo: string;
  tipo: 'GENERAL' | 'QUINCENA';
  empresa: string;
  periodo: string;
  anio: number | null;
  fecha_carga: string;
  cargado_por: string;
  total_hojas: number;
  total_registros: number;
  observaciones: string;
  hojas_count?: number;
  hojas?: HojaContabilidad[];
}

export interface HojaContabilidad {
  id: number;
  nombre_hoja: string;
  mes_asociado: string;
  orden: number;
  total_filas: number;
  total_columnas: number;
  columnas: string[];
}

export interface ExcelImportResponse {
  archivo_id: number;
  nombre_archivo: string;
  total_hojas: number;
  total_registros: number;
  errors: string[];
}

export interface RegistroPage {
  results: any[];
  total: number;
  page: number;
  page_size: number;
}

export interface AnalisisNominaData {
  kpis: {
    total_registros: number;
    empleados_unicos: number;
    total_salarios: number;
    total_hojas: number;
  };
  mov_por_mes: { mes: string; debito: number; credito: number; orden: number }[];
  top_cuentas: { cuenta: string; total: number }[];
  top_centros_costo: { centro: string; total: number }[];
  empresas_nomina: { empresa: string; count: number; salario_total: number }[];
  conceptos: { hoja: string; registros: number; monto: number }[];
  distribucion_salarial: { rango: string; cantidad: number }[];
  liquidaciones_por_tipo: { tipo: string; cantidad: number }[];
  bonificaciones: { total_personas: number; monto_total: number };
}

@Injectable({ providedIn: 'root' })
export class ContabilidadService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Obtener estadísticas para el dashboard */
  async getDashboardStats(): Promise<DashboardStats> {
    const url = `${this.apiUrl}/gestion_contabilidad/dashboard/`;
    return firstValueFrom(
      this.http.get<DashboardStats>(url).pipe(catchError(this.handleError))
    );
  }

  /** Listar archivos cargados */
  async listarArchivos(): Promise<ArchivoContabilidad[]> {
    const url = `${this.apiUrl}/gestion_contabilidad/archivos/`;
    const res = await firstValueFrom(
      this.http.get<any>(url).pipe(catchError(this.handleError))
    );
    return Array.isArray(res) ? res : (res?.results || []);
  }

  /** Obtener detalle de un archivo con sus hojas */
  async obtenerArchivo(id: number): Promise<ArchivoContabilidad> {
    const url = `${this.apiUrl}/gestion_contabilidad/archivos/${id}/`;
    return firstValueFrom(
      this.http.get<ArchivoContabilidad>(url).pipe(catchError(this.handleError))
    );
  }

  /** Subir archivo Excel al backend */
  async importarExcel(
    file: File,
    tipo: 'GENERAL' | 'QUINCENA',
    empresa: string = '',
    periodo: string = '',
    anio?: number,
    cargadoPor: string = ''
  ): Promise<ExcelImportResponse> {
    const url = `${this.apiUrl}/gestion_contabilidad/import-excel/`;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('tipo', tipo);
    if (empresa) formData.append('empresa', empresa);
    if (periodo) formData.append('periodo', periodo);
    if (anio) formData.append('anio', String(anio));
    if (cargadoPor) formData.append('cargado_por', cargadoPor);

    return firstValueFrom(
      this.http.post<ExcelImportResponse>(url, formData).pipe(catchError(this.handleError))
    );
  }

  /** Obtener registros aplanados de una hoja con paginación y búsqueda */
  async obtenerRegistrosHoja(hojaId: number, page = 1, pageSize = 50, buscar = ''): Promise<RegistroPage> {
    let url = `${this.apiUrl}/gestion_contabilidad/hojas/${hojaId}/registros/?page=${page}&page_size=${pageSize}`;
    if (buscar) url += `&buscar=${encodeURIComponent(buscar)}`;
    return firstValueFrom(
      this.http.get<RegistroPage>(url).pipe(catchError(this.handleError))
    );
  }

  /** Listar todas las hojas del último archivo */
  async listarHojas(): Promise<HojaContabilidad[]> {
    const url = `${this.apiUrl}/gestion_contabilidad/hojas/`;
    const res = await firstValueFrom(
      this.http.get<any>(url).pipe(catchError(this.handleError))
    );
    return Array.isArray(res) ? res : (res?.results || []);
  }

  /** Obtener análisis avanzado de nómina */
  async getAnalisisNomina(): Promise<AnalisisNominaData> {
    const url = `${this.apiUrl}/gestion_contabilidad/analisis-nomina/`;
    return firstValueFrom(
      this.http.get<AnalisisNominaData>(url).pipe(catchError(this.handleError))
    );
  }

  /** Eliminar archivo y todos sus datos */
  async eliminarArchivo(id: number): Promise<any> {
    const url = `${this.apiUrl}/gestion_contabilidad/archivos/${id}/eliminar_con_datos/`;
    return firstValueFrom(
      this.http.delete(url).pipe(catchError(this.handleError))
    );
  }

  private handleError(error: any) {
    console.error('ContabilidadService error:', error);
    return throwError(() => error);
  }
}
