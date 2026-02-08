import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '@/environments/environment';

export type EntrevistasQueryOpts = {
  full?: boolean | string;
  oficina?: string;
};

export type EntrevistasRangoOpts = EntrevistasQueryOpts & {
  from: string; // YYYY-MM-DD (requerido)
  to?: string;  // YYYY-MM-DD (opcional)
};

@Injectable({ providedIn: 'root' })
export class InfoVacantesService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private readonly http: HttpClient) { }

  private buildParams(obj: Record<string, unknown>): HttpParams {
    let params = new HttpParams();

    Object.entries(obj || {}).forEach(([k, v]) => {
      // ignora null/undefined/''
      if (v === null || v === undefined) return;

      const s = String(v).trim();
      if (s === '') return;

      params = params.set(k, s);
    });

    return params;
  }

  private normalizeFull(full?: boolean | string): string | undefined {
    if (full === true) return '1';
    if (full === false || full === undefined || full === null) return undefined;

    const s = String(full).trim();
    return s ? s : undefined; // permite '1', 'true', 'yes', etc.
  }

  private normalizeOficina(oficina?: string): string | undefined {
    const s = (oficina ?? '').trim();
    return s ? s : undefined;
  }

  // =========================================================
  // ✅ GET /candidatos/entrevistas-hoy/
  // =========================================================
  getCandidatosEntrevistasHoy(options?: EntrevistasQueryOpts): Observable<any[]> {
    const url = `${this.apiUrl}/gestion_contratacion/candidatos/entrevistas-hoy/`;

    const params = this.buildParams({
      full: this.normalizeFull(options?.full),
      oficina: this.normalizeOficina(options?.oficina),
    });

    return this.http.get<any[]>(url, { params });
  }

  // =========================================================
  // ✅ GET /candidatos/entrevistas-rango/
  // =========================================================
  getCandidatosEntrevistasRango(options: EntrevistasRangoOpts): Observable<any[]> {
    const url = `${this.apiUrl}/gestion_contratacion/candidatos/entrevistas-rango/`;

    const params = this.buildParams({
      from: (options?.from ?? '').trim(),
      to: (options?.to ?? '').trim(),
      full: this.normalizeFull(options?.full),
      oficina: this.normalizeOficina(options?.oficina),
    });

    return this.http.get<any[]>(url, { params });
  }
}
