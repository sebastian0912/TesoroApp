import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../../../environments/environment';

type Granularidad = 'dia' | 'semana' | 'mes';

// ----------------------------
// Keys
// ----------------------------
export type PdfKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo'
  | 'union';

// si en la UI quieres "any" como opción, que sea SOLO de UI
export type PdfKeyUI = PdfKey | 'any';

// ----------------------------
// Response por 1 PDF (por_pdf[pdf])
// ----------------------------
export type ProgresoRow = {
  prioridad: string;
  total: number;
  llevas: number;
  faltan: number;
};

export type ProgresoPrioridadesResponse = {
  pdf: PdfKey;
  type_ids: number[];
  total: number;
  llevas: number;
  faltan: number;
  por_prioridad: ProgresoRow[];
};

// ----------------------------
// Response ALL (caso 2)
// ----------------------------
export type ProgresoPrioridadesAllResponse = {
  scope: 'global';
  total_registros: number;
  por_pdf: Record<PdfKey, ProgresoPrioridadesResponse>;
};

/** ✅ Respuesta esperada de /full/ (ajústala si tu backend devuelve algo distinto) */
export interface RobotFullRow {
  oficina: string | null;
  robot: string | null;
  cedula: string | null;
  tipo_documento: string | null;

  estado_adress: string | null;
  apellido_adress: string | null;
  entidad_adress: string | null;
  pdf_adress: string | null;
  fecha_adress: string | null;

  estado_policivo: string | null;
  anotacion_policivo: string | null;
  pdf_policivo: string | null;

  estado_ofac: string | null;
  anotacion_ofac: string | null;
  pdf_ofac: string | null;

  estado_contraloria: string | null;
  anotacion_contraloria: string | null;
  pdf_contraloria: string | null;

  estado_sisben: string | null;
  tipo_sisben: string | null;
  pdf_sisben: string | null;
  fecha_sisben: string | null;

  estado_procuraduria: string | null;
  anotacion_procuraduria: string | null;
  pdf_procuraduria: string | null;

  estado_fondo_pension: string | null;
  entidad_fondo_pension: string | null;
  pdf_fondo_pension: string | null;
  fecha_fondo_pension: string | null;

  estado_union: string | null;
  union_pdf: string | null;
  fecha_union_pdf: string | null;
}

@Injectable({ providedIn: 'root' })
export class HomeService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object,
  ) { }

  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  // --------------------------------------------
  // Helpers
  // --------------------------------------------
  // ---------------------------------------------------------------------------
  // ✅ 1) GET /Robots/full/
  // ---------------------------------------------------------------------------
  getRobotsFull(options?: {
    params?: Record<string, string | number | boolean | null | undefined>;
    headers?: Record<string, string>;
    observeResponse?: boolean;
  }): Observable<RobotFullRow[] | HttpResponse<RobotFullRow[]>> {
    const url = `${this.apiUrl}/Robots/full/`;

    let httpParams = new HttpParams();
    const rawParams = options?.params ?? {};
    Object.entries(rawParams).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      httpParams = httpParams.set(k, String(v));
    });

    const httpHeaders = new HttpHeaders(options?.headers ?? {});

    if (options?.observeResponse) {
      return this.http
        .get<RobotFullRow[]>(url, { params: httpParams, headers: httpHeaders, observe: 'response' })
        .pipe(catchError((e) => this.handleError(e)));
    }

    return this.http
      .get<RobotFullRow[]>(url, { params: httpParams, headers: httpHeaders })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 2) GET /Robots/progreso-prioridades/  (CASO 2: TODO EN UN JSON)
  // ---------------------------------------------------------------------------
  getProgresoPrioridadesAll(
    options?: { headers?: Record<string, string> }
  ): Observable<ProgresoPrioridadesAllResponse> {
    const url = `${this.apiUrl}/Robots/progreso-prioridades/`;
    const headers = new HttpHeaders(options?.headers ?? {});

    return this.http
      .get<ProgresoPrioridadesAllResponse>(url, { headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 3) (Opcional) Si aún necesitas: traer un solo bloque desde el ALL
  //     (sin pegarle al backend otra vez)
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // ✅ Excel Links (tu endpoint)
  // ---------------------------------------------------------------------------
  exportarLinksExcel(
    onlyDrive: 1 | 0 = 1,
    offset = 0,
    limit = 0
  ): Observable<HttpResponse<Blob>> {
    const url = `${this.apiUrl}/traslados/cedulas/links.xlsx`;

    let params = new HttpParams().set('only_drive', String(onlyDrive));
    if (offset > 0) params = params.set('offset', String(offset));
    if (limit >= 0) params = params.set('limit', String(limit)); // 0 = sin límite

    const headers = new HttpHeaders({
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    return this.http.get(url, {
      params,
      headers,
      responseType: 'blob' as const,
      observe: 'response',
    });
  }

  // ---------------------------------------------------------------------------
  // Historial
  // ---------------------------------------------------------------------------
  traerHistorialInformePersona(
    fechaInicio: string,
    fechaFin: string,
    user: string,
    excel: boolean = false
  ): Observable<any> {
    let params = new HttpParams()
      .set('nombre', user)
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    if (excel) {
      return this.http
        .get(`${this.apiUrl}/gestion_tesoreria/transacciones/descargar-historial/`, { params, responseType: 'blob' })
        .pipe(catchError((e) => this.handleError(e)));
    }

    return this.http
      .get(`${this.apiUrl}/gestion_tesoreria/transacciones/descargar-historial/`, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }

  traerHistorialInformeSoloFecha(
    fechaInicio: string,
    fechaFin: string,
    excel: boolean = false
  ): Observable<any> {
    let params = new HttpParams()
      .set('fecha_inicio', fechaInicio)
      .set('fecha_fin', fechaFin);

    if (excel) {
      return this.http
        .get(`${this.apiUrl}/gestion_tesoreria/transacciones/descargar-historial/`, { params, responseType: 'blob' })
        .pipe(catchError((e) => this.handleError(e)));
    }

    return this.http
      .get(`${this.apiUrl}/gestion_tesoreria/transacciones/descargar-historial/`, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }


  // ---------------------------------------------------------------------------
  // Home cards / conteos / inventario / etc (tal cual lo tenías)
  // ---------------------------------------------------------------------------
  traerTraladosPorFecha(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/traslados/traer_todo_base_general`)
      .pipe(catchError((e) => this.handleError(e)));
  }

  traerUsuarios(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/usuarios/usuarios`)
      .pipe(catchError((e) => this.handleError(e)));
  }

  contarAutorizacionesActivas(codigos: any): number {
    return (codigos ?? []).filter((codigo: { estado: boolean }) => codigo.estado === true).length;
  }

  contarRol(usuarios: any, rol: string): number {
    return (usuarios ?? []).filter((usuario: { rol: string }) => usuario.rol === rol).length;
  }

  traerTraladosAceptados(nombre: string): any {
    const ano = new Date().getFullYear();
    const url = `${this.apiUrl}/traslados/buscar-aceptados/?responsable=${encodeURIComponent(nombre)}&ano=${encodeURIComponent(ano.toString())}`;
    return this.http.get(url).pipe(catchError((e) => this.handleError(e)));
  }

  enviarEstadosRobots(payload: { candidatos_scope: 'nuevos' | 'todos' | 'ninguno'; datos: any[] }): Observable<any> {
    const url = `${this.apiUrl}/EstadosRobots/cargar-excel/`;
    return this.http.post(url, payload).pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // Promedios
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Periodos unificado + compat
  // ---------------------------------------------------------------------------

  getEstadosPorOficinaPeriodos(opts?: { oficina?: string; paquete?: string; robot?: string }): Observable<any> {
    return this.http.get(this.apiUrl + '/Robots/periodos-unificados/', { params: opts as any });
  }

  getEstadosPorOficinaPeriodosArgs(oficina?: string, paquete?: string, robot?: string): Observable<any> {
    return this.http.get(this.apiUrl + '/Robots/periodos-unificados/', { params: { oficina, paquete, robot } as any });
  }

  /**
   * Variante: permite elegir qué flags poner en false.
   * Ej: fields = ['contratado'] o ['ingreso','contratado']
   */
  bulkResetUltimoProcesoWithFields(file: File, fields: string[]): Observable<HttpResponse<any>> {
    const url = `${this.apiUrl}/gestion_contratacion/contratacion/bulk-reset-ultimo-proceso/`;

    const formData = new FormData();
    formData.append('file', file);

    const cleaned = (fields || [])
      .map(f => (f ?? '').trim())
      .filter(f => !!f);

    if (cleaned.length) {
      formData.append('fields', cleaned.join(','));
    }

    const headers = new HttpHeaders();

    return this.http.post<any>(url, formData, {
      headers,
      observe: 'response',
    }).pipe(
      catchError((err) => {
        const msg =
          err?.error?.message ||
          err?.error?.detail ||
          err?.message ||
          'Error subiendo el Excel para resetear el último proceso.';
        return throwError(() => new Error(msg));
      })
    );
  }

  /**
 * ✅ Descarga el Excel generado por el backend
 * Endpoint: GET /reporte/candidatos-excel/?cedulas=...&persona=...
 *
 * Uso:
 * this.homeService.descargarCandidatosExcel(['1002683090','123'], 'SEBASTIAN')
 *   .subscribe(res => this.saveBlob(res.body!, 'candidatos.xlsx'));
 */
  descargarCandidatosExcel(
    cedulas: string[],
    personaContratacion: string,
  ): Observable<HttpResponse<Blob>> {
    const cedulasClean = (cedulas ?? [])
      .map(c => (c ?? '').toString().trim())
      .filter(Boolean);

    if (!cedulasClean.length) {
      return throwError(() => new Error('Debes enviar al menos una cédula.'));
    }

    let params = new HttpParams()
      .set('cedulas', cedulasClean.join(','));

    if ((personaContratacion ?? '').trim()) {
      params = params.set('persona', personaContratacion.trim());
    }

    // 👇 para blob, NO pongas Content-Type (eso es de request body)
    const headers = new HttpHeaders({
      Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    return this.http.get(`${this.apiUrl}/gestion_contratacion/reporte/candidatos-excel/`, {
      params,
      headers,
      observe: 'response',
      responseType: 'blob',
    }).pipe(
      catchError((err) => {
        return throwError(() => err);
      })
    );
  }

  /**
   * ✅ Helper opcional: guardar Blob como archivo (browser)
   */
  saveBlob(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'reporte.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  }



  /**
 * GET JSON: /reporte/candidatos-mini/
 * Soporta:
 *  - ?cedulas=100,200,300
 *  - ?cedula=100&cedula=200
 */
  getCandidatosMini(cedulas: Array<string | number>): Observable<any[]> {
    const normalized = (cedulas ?? [])
      .map((x) => String(x ?? '').trim())
      .filter((x) => !!x);

    if (normalized.length === 0) {
      return throwError(() => new Error('DEBES ENVIAR AL MENOS UNA CÉDULA.'));
    }

    // ✅ Más óptimo para 500/1000+: una sola key con CSV
    const params = new HttpParams().set('cedulas', normalized.join(','));

    // Ajusta el path si tu backend tiene prefijo adicional
    const url = `${this.apiUrl}/gestion_contratacion/reporte/candidatos-mini/`;

    const headers = new HttpHeaders({
      Accept: 'application/json',
    });

    return this.http.get<any[]>(url, { params, headers }).pipe(
      catchError((err) => {
        const msg =
          err?.error?.detail ||
          err?.error?.message ||
          err?.message ||
          'ERROR CONSULTANDO CANDIDATOS MINI.';
        return throwError(() => new Error(msg));
      })
    );
  }
}
