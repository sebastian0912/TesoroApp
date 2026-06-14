import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';

// ----------------------------
// Pendientes (según tu backend Django)
// ----------------------------
export type PendienteEstado = 'SIN_CONSULTAR' | 'EN_PROGRESO';

export type PendientesKey =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo_pension'
  | 'medidas_correctivas';

export interface PendientesResumenResponse {
  estado: 'ok';
  scope: 'global';
  filters: {
    paquete: string | null;
    oficina: string | null;
    robot: string | null;
    prioridad: string | null;
    consulta: string | null;
    solo_pendientes: boolean;
  };
  faltantes: Record<PendientesKey, number>;
  total_registros: number;
  total_con_alguna_pendiente: number;
  pendiente_definicion: PendienteEstado[];
  generated_at: string;
}

export interface PendientesPorOficinaRow {
  oficina: string | null;
  faltantes: Record<PendientesKey, number>;
  total_registros: number;
  total_con_alguna_pendiente: number;
}

export interface PendientesPorOficinaResponse {
  estado: 'ok';
  scope: 'por_oficina';
  filters: {
    paquete: string | null;
    solo_pendientes: boolean;
  };
  pendiente_definicion: PendienteEstado[];
  rows: PendientesPorOficinaRow[];
  generated_at: string;
}

// ----------------------------
// ✅ Stats /EstadosRobots/stats/
// ----------------------------
export type StatsGroup = 'day' | 'week' | 'month';

export interface EstadoRobotStatsPoint {
  period: string;
  registered: number;
  finalized: number;
}

export interface EstadoRobotStatsResponse {
  meta: {
    from: string;
    to: string;
    group: StatsGroup;
    oficina: string | null;
  };
  series: EstadoRobotStatsPoint[];
}

// ----------------------------
// Robots/full/ (tipado flexible)
// ----------------------------
export interface RobotFullRow {
  oficina?: string;

  Robot?: string;
  Cedula?: string;
  Tipo_documento?: string;

  Nombre_Adress?: string | null;
  Estado_Adress?: string;
  Apellido_Adress?: string;
  Entidad_Adress?: string;
  PDF_Adress?: string | null;
  Fecha_Adress?: string | null;

  Estado_Policivo?: string;
  Anotacion_Policivo?: string;
  PDF_Policivo?: string | null;

  Estado_OFAC?: string;
  Anotacion_OFAC?: string;
  PDF_OFAC?: string | null;

  Estado_Contraloria?: string;
  Anotacion_Contraloria?: string;
  PDF_Contraloria?: string | null;

  Estado_Sisben?: string;
  Tipo_Sisben?: string;
  PDF_Sisben?: string | null;
  Fecha_Sisben?: string | null;

  Estado_Procuraduria?: string;
  Anotacion_Procuraduria?: string;
  PDF_Procuraduria?: string | null;

  Estado_FondoPension?: string;
  Entidad_FondoPension?: string;
  PDF_FondoPension?: string | null;
  Fecha_FondoPension?: string | null;

  Estado_Union?: string;
  Union_PDF?: string | null;
  Fecha_UnionPDF?: string | null;
}

// ----------------------------
// ✅ NUEVO: /Robots/ultimos/<antecedente>/
// ----------------------------
export type AntecedenteKey =
  | 'adress'
  | 'policivo'
  | 'procuraduria'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'fondo-pension'
  | 'union'
  | 'medidas-correctivas';

export type UltimosPorMarcaTemporalRow = {
  cedula: string | null;
  tipo_documento: string | null;
  marcaTemporal: string | null; // ISO string o null si viene null
};

export interface RobotLockRow {
  antecedente: string;
  cedula: string | null;
  tipo_documento: string | null;
  locked_by: string | null;
  locked_at: string | null;
  ultima_consulta_estado: string | null;
  ultima_marca_temporal: string | null;
}

// ----------------------------
// ✅ Duplicados (cédulas con más de una fila en EstadoRobotActual)
// ----------------------------
export interface DuplicadoCedulaRow {
  id: number;
  cedula: string;
  tipo_documento: string;
  oficina: string | null;
  paquete: string | null;
  estado_adress: string;
  estado_policivo: string;
  estado_ofac: string;
  estado_contraloria: string;
  estado_sisben: string;
  estado_procuraduria: string;
  estado_fondo_pension: string;
  estado_medidas_correctivas: string;
  created_at: string;
  updated_at: string;
}

export interface DuplicadosCedulasResponse {
  total_cedulas_duplicadas: number;
  total_filas_afectadas: number;
  detalles: DuplicadoCedulaRow[];
}

// ----------------------------
// ✅ Próximos en cola (preview de los próximos N a entregar por el GET real)
// ----------------------------
export type ProximoLockEstado = 'libre' | 'expirado' | 'activo';

export interface ProximoEnColaRow {
  posicion: number;
  id: number;
  cedula: string | null;
  tipo_documento: string | null;
  oficina: string | null;
  paquete: string | null;
  prioridad: string | null;
  estado_actual: string;
  bucket: number;
  bucket_label: string;
  lock_estado: ProximoLockEstado;
  disponible: boolean;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string | null;
}

export interface ProximosEnColaResponse {
  antecedente: string;
  estado_field: string;
  limit: number;
  modo_atencion: 'HORARIO_LABORAL' | 'FUERA_DE_HORARIO';
  total_pendientes: number;
  proximos: ProximoEnColaRow[];
  generated_at: string;
}

// ----------------------------
// ✅ Dashboard Snapshot (endpoint consolidado, cacheado TTL=5s en backend)
// Lo usa el polling "live" del dashboard de robots para refrescar varios
// grids en una sola request en lugar de pegarle a 5+ endpoints.
// ----------------------------
export type DashboardSnapshotFuente =
  | 'adress'
  | 'policivo'
  | 'ofac'
  | 'contraloria'
  | 'sisben'
  | 'procuraduria'
  | 'fondo_pension'
  | 'medidas_correctivas';

export interface DashboardSnapshotPorOficinaRow {
  oficina: string | null;
  total_registros: number;
  faltantes: Record<DashboardSnapshotFuente, number>;
}

export interface DashboardSnapshotLockRow {
  fuente: DashboardSnapshotFuente;
  total_locks: number;
  workers_distintos: number;
}

export interface DashboardSnapshotProximosRow {
  fuente: DashboardSnapshotFuente;
  total_pendientes: number;
}

export interface DashboardSnapshotResponse {
  version: number;
  generated_at: string;
  ttl_seconds: number;
  from_cache?: boolean;
  resumen_global: {
    total_registros: number;
    faltantes: Record<DashboardSnapshotFuente, number>;
  };
  por_oficina: DashboardSnapshotPorOficinaRow[];
  locks_por_fuente: DashboardSnapshotLockRow[];
  proximos_resumen: DashboardSnapshotProximosRow[];
  duplicados_resumen: { total_cedulas_duplicadas: number };
}

@Injectable({ providedIn: 'root' })
export class RobotsService {
  private readonly isBrowser: boolean;
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    const raw =
      (environment as any)?.apiUrl ??
      (environment as any)?.api?.baseUrl ??
      '';

    this.baseUrl = String(raw).replace(/\/$/, '');
  }

  private handleError(error: unknown): Observable<never> {
    return throwError(() => error);
  }

  private ensureBrowser(): void {
    if (!this.isBrowser) {
      throw new Error('RobotsService: llamada HTTP bloqueada en SSR');
    }
  }

  private buildParams(params?: Record<string, string | number | boolean | null | undefined>): HttpParams {
    let httpParams = new HttpParams();
    Object.entries(params ?? {}).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      httpParams = httpParams.set(k, String(v));
    });
    return httpParams;
  }

  // ---------------------------------------------------------------------------
  // ✅ 1) GET /EstadosRobots/pendientes/resumen/
  // ---------------------------------------------------------------------------
  getPendientesResumen(options?: {
    paquete?: string;
    oficina?: string;
    robot?: string;
    prioridad?: string;
    consulta?: string;
    soloPendientes?: boolean;
  }): Observable<PendientesResumenResponse> {
    this.ensureBrowser();

    const url = `${this.baseUrl}/EstadosRobots/pendientes/resumen/`;
    const params = this.buildParams({
      paquete: options?.paquete ?? null,
      oficina: options?.oficina ?? null,
      robot: options?.robot ?? null,
      prioridad: options?.prioridad ?? null,
      consulta: options?.consulta ?? null,
      solo_pendientes: options?.soloPendientes ?? null,
    });

    return this.http
      .get<PendientesResumenResponse>(url, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 2) GET /EstadosRobots/pendientes/por-oficina/
  // ---------------------------------------------------------------------------
  getPendientesPorOficina(options?: {
    paquete?: string;
    soloPendientes?: boolean;
    from?: string;
    to?: string;
  }): Observable<PendientesPorOficinaResponse> {
    this.ensureBrowser();

    const url = `${this.baseUrl}/EstadosRobots/pendientes/por-oficina/`;
    const params = this.buildParams({
      paquete: options?.paquete ?? null,
      solo_pendientes: options?.soloPendientes ?? null,
      from: options?.from ?? null,
      to: options?.to ?? null,
    });

    return this.http
      .get<PendientesPorOficinaResponse>(url, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 3) GET /Robots/full/?cedula=&paquete=
  // ---------------------------------------------------------------------------
  getRobotsFull(options?: {
    cedula?: string;
    paquete?: string;
  }): Observable<RobotFullRow[]> {
    this.ensureBrowser();

    const url = `${this.baseUrl}/Robots/full/`;
    const params = this.buildParams({
      cedula: (options?.cedula ?? '').trim() || null,
      paquete: (options?.paquete ?? '').trim() || null,
    });

    return this.http
      .get<RobotFullRow[]>(url, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 4) GET /EstadosRobots/stats/?from=&to=&group=&oficina=
  // ---------------------------------------------------------------------------
  getEstadosRobotStats(options?: {
    from?: string;
    to?: string;
    group?: StatsGroup;
    oficina?: string | null;
  }): Observable<EstadoRobotStatsResponse> {
    this.ensureBrowser();

    const url = `${this.baseUrl}/EstadosRobots/stats/`;
    const params = this.buildParams({
      from: options?.from ?? null,
      to: options?.to ?? null,
      group: options?.group ?? null,
      oficina: (options?.oficina ?? '')?.trim() || null,
    });

    return this.http
      .get<EstadoRobotStatsResponse>(url, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 5) NUEVO: GET /Robots/ultimos/<antecedente>/?estado=&limit=
  // Ejemplos:
  //   /Robots/ultimos/adress/?limit=50
  //   /Robots/ultimos/ofac/?estado=SIN_CONSULTAR&limit=50
  // ---------------------------------------------------------------------------
  getUltimosPorMarcaTemporal(options: {
    antecedente: AntecedenteKey;  // 'adress' | 'policivo' | ...
    estado?: string | null;       // opcional (SIN_CONSULTAR/EN_PROGRESO/FINALIZADO/etc)
    limit?: number;               // default 50
  }): Observable<UltimosPorMarcaTemporalRow[]> {
    this.ensureBrowser();

    const antecedente = String(options?.antecedente ?? '').trim();
    if (!antecedente) {
      return throwError(() => new Error('RobotsService: antecedente es obligatorio'));
    }

    const url = `${this.baseUrl}/Robots/ultimos/${antecedente}/`;
    const params = this.buildParams({
      estado: (options?.estado ?? '')?.trim() || null,
      limit: options?.limit ?? 50,
    });

    return this.http
      .get<UltimosPorMarcaTemporalRow[]>(url, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 6) NUEVO: GET /Robots/locks/
  // ---------------------------------------------------------------------------
  getMonitoreoLocks(): Observable<RobotLockRow[]> {
    this.ensureBrowser();

    const url = `${this.baseUrl}/Robots/locks/`;

    return this.http
      .get<RobotLockRow[]>(url)
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ GET /Robots/duplicados-cedulas/
  // Cédulas con más de una fila en EstadoRobotActual (mismo número, distinto
  // tipo_documento). Útil para alertar del bug donde el POST cierra el registro
  // equivocado y deja un lock huérfano.
  //
  // Por defecto SOLO trae contadores (modo ligero, ~1 query agregada).
  // Para traer detalles, pasar { detail: true }.
  // ---------------------------------------------------------------------------
  getDuplicadosCedulas(options?: { detail?: boolean; limit?: number }): Observable<DuplicadosCedulasResponse> {
    this.ensureBrowser();

    const url = `${this.baseUrl}/Robots/duplicados-cedulas/`;
    const params = this.buildParams({
      detail: options?.detail ? '1' : null,
      limit: options?.detail ? (options?.limit ?? 200) : null,
    });

    return this.http
      .get<DuplicadosCedulasResponse>(url, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ GET /EstadosRobots/proximos-en-cola/?antecedente=ofac&limit=20
  // Preview SOLO LECTURA de los próximos N registros que el GET real entregaría
  // a los robots. Mismo ordenamiento (buckets, oficina, prioridad, created_at).
  // ---------------------------------------------------------------------------
  getProximosEnCola(options: {
    antecedente: string;   // 'ofac' | 'adress' | 'policivo' | ...
    limit?: number;        // default 20, máx 100
  }): Observable<ProximosEnColaResponse> {
    this.ensureBrowser();

    const ant = String(options?.antecedente ?? '').trim().toLowerCase();
    if (!ant) {
      return throwError(() => new Error('RobotsService: antecedente es obligatorio'));
    }

    const url = `${this.baseUrl}/EstadosRobots/proximos-en-cola/`;
    const params = this.buildParams({
      antecedente: ant,
      limit: options?.limit ?? 20,
    });

    return this.http
      .get<ProximosEnColaResponse>(url, { params })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ GET /EstadosRobots/dashboard-snapshot/
  // Snapshot consolidado del dashboard. Cacheado con TTL=5s en backend.
  // Reemplaza el polling de varios endpoints (resumen, por-oficina, locks,
  // proximos resumen y duplicados resumen).
  // ---------------------------------------------------------------------------
  getDashboardSnapshot(): Observable<DashboardSnapshotResponse> {
    this.ensureBrowser();

    const url = `${this.baseUrl}/EstadosRobots/dashboard-snapshot/`;

    return this.http
      .get<DashboardSnapshotResponse>(url)
      .pipe(catchError((e) => this.handleError(e)));
  }

  makeExcelRequest(url: string, params: HttpParams){ /* unused placeholder */ }

  // ---------------------------------------------------------------------------
  // ✅ 7) NUEVO: POST /Robots/excel-antecedentes/
  // ---------------------------------------------------------------------------
  uploadExcelAntecedentes(file: File, antecedente: string): Observable<Blob> {
    this.ensureBrowser();
    const url = `${this.baseUrl}/Robots/excel-antecedentes/`;
    
    const formData = new FormData();
    formData.append('excel_file', file);
    formData.append('antecedente', antecedente);

    return this.http.post(url, formData, { responseType: 'blob' })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ===== Helpers Promise (si prefieres) =====
  getPendientesResumenOnce(options?: {
    paquete?: string;
    oficina?: string;
    robot?: string;
    prioridad?: string;
    consulta?: string;
    soloPendientes?: boolean;
  }): Promise<PendientesResumenResponse> {
    return firstValueFrom(this.getPendientesResumen(options));
  }

  getPendientesPorOficinaOnce(options?: {
    paquete?: string;
    soloPendientes?: boolean;
  }): Promise<PendientesPorOficinaResponse> {
    return firstValueFrom(this.getPendientesPorOficina(options));
  }

  getRobotsFullOnce(options?: {
    cedula?: string;
    paquete?: string;
  }): Promise<RobotFullRow[]> {
    return firstValueFrom(this.getRobotsFull(options));
  }

  getEstadosRobotStatsOnce(options?: {
    from?: string;
    to?: string;
    group?: StatsGroup;
    oficina?: string | null;
  }): Promise<EstadoRobotStatsResponse> {
    return firstValueFrom(this.getEstadosRobotStats(options));
  }

  getUltimosPorMarcaTemporalOnce(options: {
    antecedente: AntecedenteKey;
    estado?: string | null;
    limit?: number;
  }): Promise<UltimosPorMarcaTemporalRow[]> {
    return firstValueFrom(this.getUltimosPorMarcaTemporal(options));
  }
}
