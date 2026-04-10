import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';

export interface Modulo {
  id: string;
  nombre: string;
  descripcion?: string | null;
  ruta?: string | null;
  icono?: string | null;
  orden?: number;
  modulo_padre?: string | null; // UUID del padre
}

export interface ModuloCreateDTO {
  nombre: string;
  descripcion?: string | null;
  ruta?: string | null;
  icono?: string | null;
  orden?: number;
  modulo_padre?: string | null;
}

export interface ModuloUpdateDTO {
  nombre?: string;
  descripcion?: string | null;
  ruta?: string | null;
  icono?: string | null;
  orden?: number;
  modulo_padre?: string | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Etiquetas esperadas; dejar string para futuras acciones personalizadas */
export type AccionEtiqueta = 'LEER' | 'CREAR' | 'ACTUALIZAR' | 'ELIMINAR' | string;

/** Nodo del árbol de permisos por módulo (GET /gestion_admin/modulos/arbol-permisos/) */
export interface ModuloPermisosNode {
  id: string;
  nombre: string;
  acciones: AccionEtiqueta[];             // acciones efectivas en este módulo
  permiso_ids: Record<string, string>;    // { 'LEER': '<permiso_uuid>', ... }
  hijos: ModuloPermisosNode[];            // submódulos
}

@Injectable({ providedIn: 'root' })
export class ModulosService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/gestion_admin/modulos/`;

  // List paginado (compatible con DRF pagination si la tienes activada)
  list(params?: { page?: number; page_size?: number; ordering?: string; q?: string }): Observable<Paginated<Modulo> | Modulo[]> {
    let httpParams = new HttpParams();
    if (params) {
      if (params.page != null) httpParams = httpParams.set('page', String(params.page));
      if (params.page_size != null) httpParams = httpParams.set('page_size', String(params.page_size));
      if (params.ordering) httpParams = httpParams.set('ordering', params.ordering);
      // Si en DRF no configuraste SearchFilter, `q` será ignorado (no rompe)
      if (params.q) httpParams = httpParams.set('q', params.q);
    }
    return this.http.get<Paginated<Modulo> | Modulo[]>(this.base, { params: httpParams });
  }

  // Para combos (sin paginar)

  get(id: string): Observable<Modulo> {
    return this.http.get<Modulo>(`${this.base}${id}/`);
  }

  create(dto: ModuloCreateDTO): Observable<Modulo> {
    return this.http.post<Modulo>(this.base, dto);
  }

  update(id: string, dto: ModuloCreateDTO): Observable<Modulo> {
    return this.http.put<Modulo>(`${this.base}${id}/`, dto);
  }

  patch(id: string, dto: ModuloUpdateDTO): Observable<Modulo> {
    return this.http.patch<Modulo>(`${this.base}${id}/`, dto);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}${id}/`);
  }

  /** Árbol de módulos simple (GET /gestion_admin/modulos/arbol/) */
  tree(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}arbol/`);
  }

  /**
   * Árbol de permisos por módulo (GET /gestion_admin/modulos/arbol-permisos/)
   * - Si no envías `usuario`, usa el usuario autenticado (permisos efectivos).
   * - `include_empty=true` para incluir módulos sin acciones (útil para UI).
   */
  treePermisos(options?: { usuario?: string; include_empty?: boolean }): Observable<ModuloPermisosNode[]> {
    let params = new HttpParams();
    if (options?.usuario) params = params.set('usuario', options.usuario);
    if (options?.include_empty != null) params = params.set('include_empty', String(options.include_empty));
    return this.http.get<ModuloPermisosNode[]>(`${this.base}arbol-permisos/`, { params });
  }
}
