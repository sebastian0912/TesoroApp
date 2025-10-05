// src/app/shared/services/gestion-parametrizacion.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, switchMap } from 'rxjs';
import { environment } from '@/environments/environment';

/** === Tipos del backend === */
export type CampoTipo = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'DATE' | 'JSON' | 'ENUM';

export interface MetaCampo {
  id: string;
  campo: string;               // ej. "nivelEducativo"
  tipo: CampoTipo;
  obligatorio: boolean;
  visible: boolean;
  orden: number;
  regex?: string | null;
  placeholder?: string | null;
  help?: string | null;
  config: Record<string, any>; // ej. { min_len, max_len, enum_values, default, ... }
  activo: boolean;
  tabla?: string;              // UUID (en responses puede venir o no, útil para POST/PUT)
}

export interface MetaTabla {
  id: string;                  // UUID
  codigo: string;              // ej. "AFILIADO"
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  campos: MetaCampo[];         // prefetch en el ViewSet
}

export interface MetaValor {
  id: string;                  // UUID
  tabla: string;               // UUID de MetaTabla
  datos: Record<string, any>;  // objeto validado por MetaCampo
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/** Respuesta paginada DRF (si la habilitas) */
export interface DRFPaginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Filtros de list para meta/valores */
export interface MetaValorFilters {
  tablaCodigo?: string;   // se manda como ?tabla=AFILIADO (lookup por código)
  referencia?: string;
  activo?: boolean;
  page?: number;          // por si habilitas paginación DRF
  page_size?: number;
}

/** Filtros para meta/campos */
export interface MetaCampoFilters {
  tablaId?: string;       // ?tabla=<uuid>
  activo?: boolean;
  page?: number;
  page_size?: number;
}

@Injectable({ providedIn: 'root' })
export class GestionParametrizacionService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/gestion_catalogos`;

  // ===== Helpers =====
  private unwrapMaybePaginated<T>() {
    return map((res: T[] | DRFPaginated<T>) => (this.isPaginated(res) ? res.results : (res as T[])));
  }
  private isPaginated<T>(res: any): res is DRFPaginated<T> {
    return res && typeof res === 'object' && Array.isArray(res.results);
  }
  private qp(params?: Record<string, any>): HttpParams {
    let p = new HttpParams();
    if (!params) return p;
    Object.entries(params).forEach(([k, v]) => {
      if (v === null || v === undefined || v === '') return;
      p = p.set(k, String(v));
    });
    return p;
  }

  /** ===========================
   *  MetaTablas (CRUD)
   *  =========================== */

  /** Lista todas las tablas (si hay paginación, devuelve results) */
  listMetaTablas(): Observable<MetaTabla[]> {
    return this.http
      .get<MetaTabla[] | DRFPaginated<MetaTabla>>(`${this.base}/meta/tablas/`)
      .pipe(this.unwrapMaybePaginated<MetaTabla>());
  }

  /** GET /gestion_catalogos/meta/tablas/AFILIADO/ (lookup_field='codigo') */
  getMetaTablaByCodigo(codigo: string): Observable<MetaTabla> {
    return this.http.get<MetaTabla>(`${this.base}/meta/tablas/${encodeURIComponent(codigo)}/`);
  }

  /** Crea una tabla (requiere que el backend permita ModelViewSet) */
  createMetaTabla(payload: Partial<MetaTabla>): Observable<MetaTabla> {
    return this.http.post<MetaTabla>(`${this.base}/meta/tablas/`, payload);
  }

  /** Actualiza parcialmente una tabla por código */
  updateMetaTabla(codigo: string, partial: Partial<MetaTabla>): Observable<MetaTabla> {
    return this.http.patch<MetaTabla>(`${this.base}/meta/tablas/${encodeURIComponent(codigo)}/`, partial);
  }

  /** Elimina una tabla por código */
  deleteMetaTabla(codigo: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meta/tablas/${encodeURIComponent(codigo)}/`);
  }

  /** ===========================
   *  MetaCampos (CRUD)
   *  =========================== */

  /** Lista campos filtrando por tabla UUID (?tabla=<uuid>). Soporta paginación. */
  listMetaCampos(filters: MetaCampoFilters = {}): Observable<MetaCampo[]> {
    const params = this.qp({
      tabla: filters.tablaId,
      activo: typeof filters.activo === 'boolean' ? String(filters.activo) : undefined,
      page: filters.page,
      page_size: filters.page_size,
    });
    return this.http
      .get<MetaCampo[] | DRFPaginated<MetaCampo>>(`${this.base}/meta/campos/`, { params })
      .pipe(this.unwrapMaybePaginated<MetaCampo>());
  }

  /** Crea un campo (debes enviar tabla: <uuid>) */
  createMetaCampo(payload: Omit<MetaCampo, 'id'> & { tabla: string }): Observable<MetaCampo> {
    return this.http.post<MetaCampo>(`${this.base}/meta/campos/`, payload);
  }

  /** Actualiza parcialmente un campo */
  updateMetaCampo(id: string, partial: Partial<MetaCampo>): Observable<MetaCampo> {
    return this.http.patch<MetaCampo>(`${this.base}/meta/campos/${encodeURIComponent(id)}/`, partial);
  }

  /** Elimina un campo */
  deleteMetaCampo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meta/campos/${encodeURIComponent(id)}/`);
  }

  /** ===========================
   *  MetaValores (CRUD)
   *  =========================== */

  /** List con filtros (?tabla=CODIGO&referencia=...&activo=true). Soporta paginación. */
  listMetaValores(filters: MetaValorFilters = {}): Observable<MetaValor[]> {
    const params = this.qp({
      tabla: filters.tablaCodigo, // backend espera 'tabla' por código
      referencia: filters.referencia,
      activo: typeof filters.activo === 'boolean' ? String(filters.activo) : undefined,
      page: filters.page,
      page_size: filters.page_size,
    });
    return this.http
      .get<MetaValor[] | DRFPaginated<MetaValor>>(`${this.base}/meta/valores/`, { params })
      .pipe(this.unwrapMaybePaginated<MetaValor>());
  }

  /** Obtiene un MetaValor por id UUID */
  getMetaValor(id: string): Observable<MetaValor> {
    return this.http.get<MetaValor>(`${this.base}/meta/valores/${encodeURIComponent(id)}/`);
  }

  /**
   * Crea un MetaValor recibiendo { tabla(UUID), referencia?, datos }.
   * La validación central se hace en el backend (clean()).
   */
  createMetaValor(payload: Pick<MetaValor, 'tabla' | 'datos'> & { activo?: boolean }): Observable<MetaValor> {
    return this.http.post<MetaValor>(`${this.base}/meta/valores/`, payload);
  }

  /** (Convenience) Crea un MetaValor pasando el código de tabla (resuelve UUID) */
  createMetaValorByCodigo(tablaCodigo: string, body: Omit<MetaValor, 'id' | 'tabla' | 'created_at' | 'updated_at'>): Observable<MetaValor> {
    return this.getMetaTablaByCodigo(tablaCodigo).pipe(
      switchMap(tabla => this.createMetaValor({ tabla: tabla.id, datos: body.datos, activo: body.activo }))
    );
  }

  /** Actualiza completamente (PUT) un MetaValor */
  updateMetaValor(id: string, payload: Partial<MetaValor>): Observable<MetaValor> {
    return this.http.put<MetaValor>(`${this.base}/meta/valores/${encodeURIComponent(id)}/`, payload);
  }

  /** Actualiza parcialmente (PATCH) un MetaValor */
  patchMetaValor(id: string, partial: Partial<MetaValor>): Observable<MetaValor> {
    return this.http.patch<MetaValor>(`${this.base}/meta/valores/${encodeURIComponent(id)}/`, partial);
  }

  /** Borra (DELETE) un MetaValor */
  deleteMetaValor(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/meta/valores/${encodeURIComponent(id)}/`);
  }

  /** ===========================
   *  Descargas (opcional)
   *  =========================== */

  descargarExcel(path: string): Observable<Blob> {
    // path ejemplo: '/descargar/meta_tablas.xlsx'
    return this.http.get(`${this.base}${path}`, { responseType: 'blob' });
  }

  descargarZip(path: string): Observable<Blob> {
    // path ejemplo: '/descargar/meta_valores.zip'
    return this.http.get(`${this.base}${path}`, { responseType: 'blob' });
  }

  /** Helper para guardar Blob como archivo */
  saveBlobAs(filename: string, blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
}
