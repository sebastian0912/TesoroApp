import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

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

  private buildHeaders(headers?: Record<string, string>): HttpHeaders {
    return new HttpHeaders(headers ?? {});
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
    headers?: Record<string, string>;
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
    const headers = this.buildHeaders(options?.headers);

    return this.http
      .get<PendientesResumenResponse>(url, { params, headers })
      .pipe(catchError((e) => this.handleError(e)));
  }

  // ---------------------------------------------------------------------------
  // ✅ 2) GET /EstadosRobots/pendientes/por-oficina/
  // ---------------------------------------------------------------------------
  getPendientesPorOficina(options?: {
    paquete?: string;
    soloPendientes?: boolean;
    headers?: Record<string, string>;
  }): Observable<PendientesPorOficinaResponse> {
    this.ensureBrowser();

    const url = `${this.baseUrl}/EstadosRobots/pendientes/por-oficina/`;
    const params = this.buildParams({
      paquete: options?.paquete ?? null,
      solo_pendientes: options?.soloPendientes ?? null,
    });
    const headers = this.buildHeaders(options?.headers);

    return this.http
      .get<PendientesPorOficinaResponse>(url, { params, headers })
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
}
