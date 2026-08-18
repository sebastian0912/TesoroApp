import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import {
  BuilderRequest,
  FormDetail,
  FormPatchRequest,
  FormStructure,
  FormSummary,
  PageResult,
  ProvisioningResult,
  VersionInfo,
} from '../models/dynamic-forms.models';
import { SupportFile } from '../models/placement.models';

/**
 * Formularios Dinámicos — gestión (ms-forms vía gateway, /api/dynamic-forms).
 * El JWT lo agrega el auth.interceptor global. Los errores llegan como ProblemDetail
 * RFC 7807 con `code` de negocio (df_*); cada pantalla los muestra con Swal/snackbar.
 */
@Injectable({ providedIn: 'root' })
export class DynamicFormService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/api/dynamic-forms`;

  list(opts: {
    q?: string;
    active?: boolean | null;
    owner_user_id?: string;
    page?: number;
    size?: number;
  } = {}): Observable<PageResult<FormSummary>> {
    let params = new HttpParams()
      .set('page', String(opts.page ?? 0))
      .set('size', String(opts.size ?? 25));
    if (opts.q?.trim()) params = params.set('q', opts.q.trim());
    if (opts.active !== undefined && opts.active !== null) params = params.set('active', String(opts.active));
    if (opts.owner_user_id) params = params.set('owner_user_id', opts.owner_user_id);
    return this.http.get<PageResult<FormSummary>>(`${this.base}/forms`, { params });
  }

  get(id: number): Observable<FormDetail> {
    return this.http.get<FormDetail>(`${this.base}/forms/${id}`);
  }

  /** Estructura publicada vigente; con `version` trae esa versión exacta. */
  structure(id: number, version?: number): Observable<FormStructure> {
    let params = new HttpParams();
    if (version != null) params = params.set('version', String(version));
    return this.http.get<FormStructure>(`${this.base}/forms/${id}/structure`, { params });
  }

  createBuilder(req: BuilderRequest): Observable<FormDetail> {
    return this.http.post<FormDetail>(`${this.base}/forms/builder`, req);
  }

  /** Editar estructura = crea versión nueva PUBLISHED y deprecia la anterior. */
  editBuilder(id: number, req: BuilderRequest): Observable<FormDetail> {
    return this.http.put<FormDetail>(`${this.base}/forms/${id}/builder`, req);
  }

  patch(id: number, req: FormPatchRequest): Observable<FormDetail> {
    return this.http.patch<FormDetail>(`${this.base}/forms/${id}`, req);
  }

  softDelete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/forms/${id}`);
  }

  restore(id: number): Observable<FormDetail> {
    return this.http.post<FormDetail>(`${this.base}/forms/${id}/restore`, {});
  }

  hardDelete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/forms/${id}/hard`, {
      params: new HttpParams().set('force', 'true'),
    });
  }

  duplicate(id: number): Observable<FormDetail> {
    return this.http.post<FormDetail>(`${this.base}/forms/${id}/duplicate`, {});
  }

  versions(id: number): Observable<VersionInfo[]> {
    return this.http.get<VersionInfo[]>(`${this.base}/forms/${id}/versions`);
  }

  /**
   * Archivos adjuntos (soportes) de las respuestas de un formulario, paginados en
   * el servidor. Cada elemento es un documento subido en un campo PHOTO/FILE/... de
   * una respuesta; el JWT lo agrega el auth.interceptor.
   */
  supports(id: number, page = 0, size = 25): Observable<PageResult<SupportFile>> {
    const params = new HttpParams()
      .set('page', String(page))
      .set('size', String(size));
    return this.http.get<PageResult<SupportFile>>(`${this.base}/forms/${id}/supports`, { params });
  }

  provisionRetry(id: number): Observable<ProvisioningResult> {
    return this.http.post<ProvisioningResult>(`${this.base}/forms/${id}/provision-module`, {});
  }

  /** Excel generado por el backend (POI); el caller lo baja con saveAs. */
  exportXlsx(id: number, opts: { version?: number; status?: string; from?: string; to?: string } = {}) {
    let params = new HttpParams();
    if (opts.version != null) params = params.set('version', String(opts.version));
    if (opts.status) params = params.set('status', opts.status);
    if (opts.from) params = params.set('from', opts.from);
    if (opts.to) params = params.set('to', opts.to);
    return this.http.get(`${this.base}/forms/${id}/export.xlsx`, {
      params,
      responseType: 'blob',
      observe: 'response',
    });
  }
}
