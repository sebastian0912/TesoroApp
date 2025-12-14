import { HttpClient, HttpHeaders, HttpParams, HttpResponse } from '@angular/common/http';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../../../../../environments/environment.development';

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
  ) {}

  private handleError(error: any): Observable<never> {
    return throwError(() => error);
  }

  // --------------------------------------------
  // Helpers
  // --------------------------------------------
  private normalizePdfKey(pdf: string | null | undefined): PdfKey {
    const key = (pdf || 'adress').trim().toLowerCase();

    if (key === 'adres' || key === 'address') return 'adress';
    if (key === 'policivos') return 'policivo';
    if (key === 'afp' || key === 'fondo_pension' || key === 'fondopension' || key === 'pension') return 'fondo';

    // fallback: si llega uno inválido, no rompas (pero ajusta si prefieres throw)
    const allowed: PdfKey[] = ['adress', 'policivo', 'ofac', 'contraloria', 'sisben', 'procuraduria', 'fondo', 'union'];
    return (allowed.includes(key as PdfKey) ? (key as PdfKey) : 'adress');
  }

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
  pickProgresoFromAll(all: ProgresoPrioridadesAllResponse, pdf: string): ProgresoPrioridadesResponse | null {
    const key = this.normalizePdfKey(pdf);
    return all?.por_pdf?.[key] ?? null;
  }

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

  /** Extrae filename del header Content-Disposition */
  getFilename(resp: HttpResponse<Blob>, fallback = 'cedulas_links.xlsx'): string {
    const cd = resp.headers.get('Content-Disposition') || '';
    const m = cd.match(/filename\*?=(?:UTF-8''|")?([^;"']+)/i);
    if (!m) return fallback;

    try {
      return decodeURIComponent(m[1].replace(/"/g, ''));
    } catch {
      return m[1].replace(/"/g, '') || fallback;
    }
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
      params = params.set('excel', '1');
      return this.http
        .get(`${this.apiUrl}/Historial/informe`, { params, responseType: 'blob' })
        .pipe(catchError((e) => this.handleError(e)));
    }

    return this.http
      .get(`${this.apiUrl}/Historial/informe`, { params })
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
      params = params.set('excel', '1');
      return this.http
        .get(`${this.apiUrl}/Historial/informeFecha`, { params, responseType: 'blob' })
        .pipe(catchError((e) => this.handleError(e)));
    }

    return this.http
      .get(`${this.apiUrl}/Historial/informeFecha`, { params })
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

  traerEmpleados(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/Datosbase/datosbase`)
      .pipe(catchError((e) => this.handleError(e)));
  }

  traerAutorizaciones(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/Codigo/codigos`)
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

  traerAutorizacionesPorUsuario(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/Codigo/roles/codigosactivos`)
      .pipe(catchError((e) => this.handleError(e)));
  }

  traerInventarioProductos(): Observable<any> {
    return this.http
      .get(`${this.apiUrl}/Comercio/comercio`)
      .pipe(catchError((e) => this.handleError(e)));
  }

  async traerTralados(concepto: any, nombre: string): Promise<Observable<any>> {
    const ano = new Date().getFullYear();
    if (concepto === 'Todos') {
      return this.http
        .get(`${this.apiUrl}/traslados/traer_todo_base_general?ano=${encodeURIComponent(ano.toString())}`)
        .pipe(catchError((e) => this.handleError(e)));
    }

    const url = `${this.apiUrl}/traslados/buscar-filtro/?responsable=${encodeURIComponent(nombre)}&ano=${encodeURIComponent(ano.toString())}`;
    return this.http.get(url).pipe(catchError((e) => this.handleError(e)));
  }

  traerTraladosAceptados(nombre: string): any {
    const ano = new Date().getFullYear();
    const url = `${this.apiUrl}/traslados/buscar-aceptados/?responsable=${encodeURIComponent(nombre)}&ano=${encodeURIComponent(ano.toString())}`;
    return this.http.get(url).pipe(catchError((e) => this.handleError(e)));
  }

  enviarEstadosRobots(payload: { candidatos_scope: 'nuevos' | 'todos' | 'ninguno'; datos: any[] }): Observable<any> {
    const url = `${this.apiUrl}/EstadosRobots/cargar_excel`;
    return this.http.post(url, payload).pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // Promedios
  // ---------------------------------------------------------------------------
  getPromedios(granularidad?: Granularidad, oficina?: string): Observable<any> {
    let params = new HttpParams();
    if (granularidad) params = params.set('granularidad', granularidad);
    if (oficina) params = params.set('oficina', oficina);

    const url = `${this.apiUrl}/EstadosRobots/promedios/`;
    return this.http.get<any>(url, { params }).pipe(catchError((e) => this.handleError(e)));
  }

  getPromediosResumen(oficina?: string): Observable<any> {
    let params = new HttpParams();
    if (oficina) params = params.set('oficina', oficina);

    const url = `${this.apiUrl}/EstadosRobots/promedios/resumen/`;
    return this.http.get<any>(url, { params }).pipe(catchError((e) => this.handleError(e)));
  }

  getPromediosTodos(oficina?: string): Observable<any> {
    let params = new HttpParams();
    if (oficina) params = params.set('oficina', oficina);

    const url = `${this.apiUrl}/EstadosRobots/promedios/todos/`;
    return this.http.get<any>(url, { params }).pipe(catchError((e) => this.handleError(e)));
  }

  getPromedioPorEstado(estado: string, granularidad?: Granularidad, oficina?: string): Observable<any> {
    let params = new HttpParams();
    if (granularidad) params = params.set('granularidad', granularidad);
    if (oficina) params = params.set('oficina', oficina);

    const url = `${this.apiUrl}/EstadosRobots/promedios/estado/${encodeURIComponent(estado)}/`;
    return this.http.get<any>(url, { params }).pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // Periodos unificado + compat
  // ---------------------------------------------------------------------------
  getRobotPeriodosUnificado(opts?: { oficina?: string; paquete?: string; robot?: string }): Observable<any> {
    let params = new HttpParams().set('format', 'combined');
    if (opts?.oficina) params = params.set('oficina', opts.oficina);
    if (opts?.paquete) params = params.set('paquete', opts.paquete);
    if (opts?.robot) params = params.set('robot', opts.robot);

    const url = `${this.apiUrl}/EstadosRobots/periodos-unificado/`;
    return this.http.get<any>(url, { params }).pipe(catchError((e) => this.handleError(e)));
  }

  getEstadosPorOficinaPeriodos(opts?: { oficina?: string; paquete?: string; robot?: string }): Observable<any> {
    return this.getRobotPeriodosUnificado(opts);
  }

  getEstadosPorOficinaPeriodosArgs(oficina?: string, paquete?: string, robot?: string): Observable<any> {
    return this.getRobotPeriodosUnificado({ oficina, paquete, robot });
  }
}
