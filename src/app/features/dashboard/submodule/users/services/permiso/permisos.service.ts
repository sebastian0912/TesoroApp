import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@/environments/environment';
import { Observable, map } from 'rxjs';

export interface Rol { id: string; nombre: string; }
export type UpsertRolPayload = { nombre: string };

export interface Permiso {
  id: string;
  nombre: string;
  accion: string;
  modulo_id: string;
  modulo_nombre: string;
}

@Injectable({
  providedIn: 'root'
})
export class PermisosService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  list(): Observable<Rol[]> {
    return this.http.get<Rol[]>(`${this.apiUrl}/gestion_admin/roles/`);
  }
  create(payload: UpsertRolPayload): Observable<Rol> {
    return this.http.post<Rol>(`${this.apiUrl}/gestion_admin/roles/`, payload);
  }
  update(id: string, payload: UpsertRolPayload): Observable<Rol> {
    return this.http.put<Rol>(`${this.apiUrl}/gestion_admin/roles/${id}/`, payload);
  }
  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/gestion_admin/roles/${id}/`);
  }

  /** Catálogo completo de permisos (con modulo y acción) */
  listAllPermisos(): Observable<Permiso[]> {
    return this.http
      .get<any[]>(`${this.apiUrl}/gestion_admin/permisos/`)
      .pipe(
        map(rows => (rows ?? []).map(r => ({
          id: r.id,
          nombre: r.nombre,
          // OJO: el backend manda 'accion' (UUID) y 'accion_nombre' (string legible)
          accion: r.accion_nombre ?? r.accion,
          // OJO: el backend manda 'modulo' (UUID) y 'modulo_nombre' (string)
          modulo_id: r.modulo ?? r.modulo_id,
          modulo_nombre: r.modulo_nombre ?? ''
        }) as Permiso))
      );
  }

  /**
   * IDs de permisos asignados actualmente al rol.
   * Usamos el endpoint de la tabla intermedia `rol_permiso` filtrando por rol.
   * Devuelve sólo IDs, luego cruzamos con el catálogo.
   */
  getRolePermisoIds(rolId: string): Observable<string[]> {
    // Ruta correcta según tu router: 'rol-permisos' (guion y plural)
    return this.http
      .get<Array<{ id: string; rol: string; permiso: string }>>(
        `${this.apiUrl}/gestion_admin/rol-permisos/?rol=${encodeURIComponent(rolId)}`
      )
      .pipe(map(rows => rows.map(r => r.permiso)));
  }

  // ---- Reemplazar permisos de un rol ----
  assignPermissions(rolId: string, permisoIds: string[]): Observable<{
    ok: boolean; total_recibidos: number; total_asignados: number; no_encontrados: string[];
  }> {
    return this.http.post<{
      ok: boolean; total_recibidos: number; total_asignados: number; no_encontrados: string[];
    }>(
      `${this.apiUrl}/gestion_admin/roles/${rolId}/asignar_permisos/`,
      { permiso_ids: permisoIds }
    );
  }

  /** Excepciones del usuario (otorgadas/revocadas) */
  getUserOverrides(userId: string): Observable<Array<{ permiso: string; otorgado: boolean }>> {
    return this.http.get<Array<{ id: string; usuario: string; permiso: string; otorgado: boolean }>>(
      `${this.apiUrl}/gestion_admin/usuario-permisos/?usuario=${userId}`
    ).pipe(map(rows => rows.map(r => ({ permiso: r.permiso, otorgado: r.otorgado }))));
  }

  // --- asignar excepciones de usuario (reemplaza por completo)
  assignUserOverrides(userId: string, otorgados: string[], revocados: string[]) {
    return this.http.post(`${this.apiUrl}/gestion_admin/usuarios/${userId}/asignar_permisos/`, { otorgados, revocados });
  }



}
