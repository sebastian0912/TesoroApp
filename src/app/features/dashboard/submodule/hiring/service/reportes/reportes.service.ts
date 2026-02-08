import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpParams,
  HttpErrorResponse,
} from '@angular/common/http';
import { Observable, throwError, from } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import { environment } from '@/environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ReportesService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * GET /reportes/?nombre=&fecha_desde=&fecha_hasta=
   * - Si NO mandas fecha_desde/fecha_hasta -> backend usa SOLO el día actual.
   */
  getReportes(filters?: {
    nombre?: string;
    fechaDesde?: string | Date;
    fechaHasta?: string | Date;
  }): Observable<{ reportes: any[]; consolidado: any[] }> {
    let params = new HttpParams();

    if (filters?.nombre) {
      params = params.set('nombre', filters.nombre.trim());
    }

    if (filters?.fechaDesde) {
      const value =
        filters.fechaDesde instanceof Date
          ? this.formatDate(filters.fechaDesde)
          : String(filters.fechaDesde).trim();
      if (value) params = params.set('fecha_desde', value);
    }

    if (filters?.fechaHasta) {
      const value =
        filters.fechaHasta instanceof Date
          ? this.formatDate(filters.fechaHasta)
          : String(filters.fechaHasta).trim();
      if (value) params = params.set('fecha_hasta', value);
    }

    const url = `${this.apiUrl}/reportes/`;

    return this.http.get<any>(url, { params }).pipe(
      map((resp: any) => {
        if (resp?.status !== 'success') {
          throw { status: 400, error: resp };
        }

        return {
          reportes: resp.reportes ?? [],
          consolidado: resp.consolidado ?? [],
        };
      }),
      catchError((error) => this.handleError(error, 'getReportes')),
    );
  }

  /**
   * GET /reportes/cedulas-zip/
   * ✅ Django NO recibe filtros aquí (sin fechas, sin sede).
   * Devuelve un ZIP (Blob) con TODAS las cédulas de TODOS los reportes (sin duplicados).
   */
  downloadCedulasZip(): Observable<Blob> {
    const url = `${this.apiUrl}/reportes/cedulas-zip/`;

    return this.http
      .get(url, {
        responseType: 'blob',
      })
      .pipe(catchError((error) => this.handleError(error, 'downloadCedulasZip')));
  }

  /**
   * GET /reportes/:id/
   */
  getReporteById(id: number): Observable<any> {
    const url = `${this.apiUrl}/reportes/${id}/`;

    return this.http.get<any>(url).pipe(
      map((resp: any) => {
        if (resp?.status !== 'success' || !resp.reporte) {
          throw { status: 404, error: resp };
        }
        return resp.reporte;
      }),
      catchError((error) => this.handleError(error, 'getReporteById')),
    );
  }

  /**
   * POST /reportes/
   * ✅ Django:
   * - Si hay archivos -> multipart/form-data (FormData)
   * - Si no hay archivos -> JSON
   *
   * Archivos esperados:
   *  - sst_document (1)
   *  - cruce_document (1)
   *  - cedulas (N)
   *  - traslados (N)
   */
  createReporte(
    payload: any,
    files?: {
      sst_document?: File | null;
      cruce_document?: File | null;
      cedulas?: File[] | null;
      traslados?: File[] | null;
    },
  ): Observable<any> {
    const url = `${this.apiUrl}/reportes/`;

    // Permite que los archivos vengan en payload o en el parámetro files
    const sst = (files?.sst_document ?? payload?.sst_document) as File | null | undefined;
    const cruce = (files?.cruce_document ?? payload?.cruce_document) as File | null | undefined;
    const cedulas = (files?.cedulas ?? payload?.cedulas) as File[] | null | undefined;
    const traslados = (files?.traslados ?? payload?.traslados) as File[] | null | undefined;

    const hasFiles =
      !!sst ||
      !!cruce ||
      (Array.isArray(cedulas) && cedulas.length > 0) ||
      (Array.isArray(traslados) && traslados.length > 0);

    if (!hasFiles) {
      // JSON puro (sin archivos) — Django lo soporta
      const body = {
        ...payload,
        fecha: this.toIsoOrNull(payload?.fecha),
      };

      return this.http.post<any>(url, body).pipe(
        map((resp: any) => {
          if (resp?.status !== 'success' || !resp.reporte) {
            throw { status: 400, error: resp };
          }
          return resp.reporte;
        }),
        catchError((error) => this.handleError(error, 'createReporte')),
      );
    }

    // multipart/form-data (lo normal en tu caso)
    const fd = new FormData();

    // Campos que Django lee por request.POST
    // (si tu UI manda más, no pasa nada, pero estos son los que Django usa)
    fd.append('nombre', String(payload?.nombre ?? '').trim());

    const fechaIso = this.toIsoOrNull(payload?.fecha);
    if (fechaIso) fd.append('fecha', fechaIso);

    if (payload?.sede != null) fd.append('sede', String(payload.sede));

    // Django acepta "" -> None (lo convierte a None)
    fd.append(
      'cantidadContratosTuAlianza',
      payload?.cantidadContratosTuAlianza == null ? '' : String(payload.cantidadContratosTuAlianza),
    );
    fd.append(
      'cantidadContratosApoyoLaboral',
      payload?.cantidadContratosApoyoLaboral == null ? '' : String(payload.cantidadContratosApoyoLaboral),
    );

    if (payload?.nota != null) fd.append('nota', String(payload.nota));

    // Archivos que Django lee por request.FILES
    if (sst) fd.append('sst_document', sst, sst.name);
    if (cruce) fd.append('cruce_document', cruce, cruce.name);

    for (const f of Array.isArray(cedulas) ? cedulas : []) {
      if (f) fd.append('cedulas', f, f.name);
    }

    for (const f of Array.isArray(traslados) ? traslados : []) {
      if (f) fd.append('traslados', f, f.name);
    }

    return this.http.post<any>(url, fd).pipe(
      map((resp: any) => {
        if (resp?.status !== 'success' || !resp.reporte) {
          throw { status: 400, error: resp };
        }
        return resp.reporte;
      }),
      catchError((error) => this.handleError(error, 'createReporte')),
    );
  }

  // ============ Helpers ============

  private formatDate(d: Date): string {
    const year = d.getFullYear();
    const month = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toIsoOrNull(value: any): string | null {
    if (value == null || value === '') return null;
    if (value instanceof Date) return value.toISOString();
    const s = String(value).trim();
    return s ? s : null; // Django acepta ISO o YYYY-MM-DD
  }

  /**
   * Normaliza errores Django:
   * - JSON normal (error.error es objeto)
   * - ZIP/Blob error (error.error es Blob con JSON dentro)
   */
  private handleError(error: any, context: string): Observable<never> {
    const statusCode: number = error?.status ?? 0;

    // Caso especial: cuando responseType='blob', Django puede mandar JsonResponse (error) dentro de Blob
    if (error instanceof HttpErrorResponse && error.error instanceof Blob) {
      return from(error.error.text()).pipe(
        mergeMap((txt: string) => {
          let backend: any = {};
          try {
            backend = txt ? JSON.parse(txt) : {};
          } catch {
            backend = {};
          }

          const normalized = {
            statusCode,
            code: backend?.code || this.defaultCodeForStatus(statusCode),
            message:
              backend?.message ||
              this.defaultMessageForStatus(statusCode) ||
              'Ocurrió un error procesando la solicitud.',
            detail: backend?.detail,
            location: backend?.location || context,
            extra: backend?.extra,
            raw: error,
          };

          // eslint-disable-next-line no-console
          console.error('[ReportesService] Error en', context, normalized);

          return throwError(() => normalized);
        }),
      );
    }

    const backend = error?.error ?? {};

    const normalized = {
      statusCode,
      code: (backend as any).code || this.defaultCodeForStatus(statusCode),
      message:
        (backend as any).message ||
        this.defaultMessageForStatus(statusCode) ||
        'Ocurrió un error procesando la solicitud.',
      detail: (backend as any).detail,
      location: (backend as any).location || context,
      extra: (backend as any).extra,
      raw: error,
    };

    // eslint-disable-next-line no-console
    console.error('[ReportesService] Error en', context, normalized);

    return throwError(() => normalized);
  }

  private defaultCodeForStatus(statusCode: number): string {
    if (statusCode >= 400 && statusCode < 500) return 'client_error';
    if (statusCode >= 500) return 'server_error';
    return 'unknown_error';
  }

  private defaultMessageForStatus(statusCode: number): string {
    switch (statusCode) {
      case 400:
        return 'La solicitud es inválida. Verifica los datos enviados.';
      case 401:
        return 'No autorizado. Inicia sesión nuevamente.';
      case 403:
        return 'No tienes permisos para realizar esta acción.';
      case 404:
        return 'Recurso no encontrado.';
      case 500:
        return 'Error interno del servidor.';
      default:
        return '';
    }
  }
}
