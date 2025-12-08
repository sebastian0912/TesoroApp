import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '@/environments/environment.development';

@Injectable({
  providedIn: 'root',
})
export class ReportesService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) {}

  /**
   * GET /reportes/?nombre=&fecha_desde=&fecha_hasta=
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
          : filters.fechaDesde;
      params = params.set('fecha_desde', value);
    }

    if (filters?.fechaHasta) {
      const value =
        filters.fechaHasta instanceof Date
          ? this.formatDate(filters.fechaHasta)
          : filters.fechaHasta;
      params = params.set('fecha_hasta', value);
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
   * GET /reportes/cedulas-zip/?fecha_desde=&fecha_hasta=
   * Devuelve un ZIP (Blob) con todas las cédulas de los reportes en el rango.
   *
   * - Si no mandas fechas, el backend usa el día actual.
   */
  downloadCedulasZip(filters?: {
    fechaDesde?: string | Date;
    fechaHasta?: string | Date;
  }): Observable<Blob> {
    let params = new HttpParams();

    if (filters?.fechaDesde) {
      const value =
        filters.fechaDesde instanceof Date
          ? this.formatDate(filters.fechaDesde)
          : filters.fechaDesde;
      params = params.set('fecha_desde', value);
    }

    if (filters?.fechaHasta) {
      const value =
        filters.fechaHasta instanceof Date
          ? this.formatDate(filters.fechaHasta)
          : filters.fechaHasta;
      params = params.set('fecha_hasta', value);
    }

    const url = `${this.apiUrl}/reportes/cedulas-zip/`;

    return this.http
      .get(url, {
        params,
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
   */
  createReporte(payload: any): Observable<any> {
    const url = `${this.apiUrl}/reportes/`;

    return this.http.post<any>(url, payload).pipe(
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

  private handleError(error: any, context: string): Observable<never> {
    const statusCode: number = error?.status ?? 0;
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
    if (statusCode >= 400 && statusCode < 500) {
      return 'client_error';
    }
    if (statusCode >= 500) {
      return 'server_error';
    }
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
