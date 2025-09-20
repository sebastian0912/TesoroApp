import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment.development';

export interface Modulo {
  id: string;
  nombre: string;
  descripcion?: string | null;
  modulo_padre?: string | null; // UUID del padre
}

export interface ModuloCreateDTO {
  nombre: string;
  descripcion?: string | null;
  modulo_padre?: string | null;
}

export interface ModuloUpdateDTO {
  nombre?: string;
  descripcion?: string | null;
  modulo_padre?: string | null;
}

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
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

  // Para combos (sin paginar) — si tienes paginación, puedes pedir un page_size grande vía querystring
  listAll(): Observable<Modulo[] | Paginated<Modulo>> {
    return this.http.get<Modulo[] | Paginated<Modulo>>(this.base);
  }

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

  tree(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}arbol/`);
  }

}
