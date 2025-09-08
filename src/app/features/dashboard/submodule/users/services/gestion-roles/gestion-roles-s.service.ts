import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
// si prefieres, usa '@/environments/environment' y deja que Angular reemplace por build
import { environment } from '@/environments/environment.development';

export interface Rol {
  id: string;
  nombre: string;
}

export type UpsertRolPayload = {
  nombre: string;
};

@Injectable({ providedIn: 'root' })
export class GestionRolesSService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/gestion_admin/roles`;

  /** Lista todos los roles */
  list(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.base}/`);
  }

  /** Trae un rol por id */
  get(id: string): Observable<Rol> {
    return this.http.get<Rol>(`${this.base}/${id}/`);
  }

  /** Crea un rol */
  create(body: UpsertRolPayload): Observable<Rol> {
    return this.http.post<Rol>(`${this.base}/`, body);
  }

  /** Actualiza parcialmente un rol (PATCH) */
  update(id: string, body: UpsertRolPayload): Observable<Rol> {
    return this.http.patch<Rol>(`${this.base}/${id}/`, body);
  }

  /** Reemplaza totalmente un rol (PUT) — opcional si lo quieres usar */
  replace(id: string, body: UpsertRolPayload): Observable<Rol> {
    return this.http.put<Rol>(`${this.base}/${id}/`, body);
  }

  /** Elimina un rol */
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}/`);
  }

  /**
   * Reemplaza por completo los permisos de un rol (acción custom del backend):
   * POST /gestion_admin/roles/{id}/asignar_permisos/
   * body: { permiso_ids: string[] }
   */
  asignarPermisos(
    rolId: string,
    permiso_ids: string[]
  ): Observable<{ ok: boolean; rol: string; total_recibidos: number; total_asignados: number; no_encontrados: string[] }> {
    return this.http.post<{ ok: boolean; rol: string; total_recibidos: number; total_asignados: number; no_encontrados: string[] }>(
      `${this.base}/${rolId}/asignar_permisos/`,
      { permiso_ids }
    );
  }
}
