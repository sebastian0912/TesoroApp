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
