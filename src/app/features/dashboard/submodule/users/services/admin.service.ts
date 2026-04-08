import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '@/environments/environment';

export interface UsuarioDetail {
  id: string;
  numero_de_documento: string;
  tipo_documento: string;
  correo_electronico: string;
  estado_solicitudes: boolean;
  empresa?: { id: string; nombre: string } | null;
  sede?: { id: string; nombre: string; activa: boolean } | null;
  rol?: { id: string; nombre: string } | null;
  datos_basicos?: { usuario: string; nombres: string; apellidos: string; celular?: string | null } | null;
  permisos_efectivos?: Array<{ id: string; nombre: string; modulo: string; accion: string }>;
  permisos_tree?: any[];
}

export interface AuthResponse {
  token: string;
  user: UsuarioDetail;
}

export type CrearUsuarioPayload = {
  numero_de_documento: string;
  tipo_documento: 'CC' | 'CE' | 'TI' | 'PA' | string;
  correo_electronico: string;
  password: string;
  // opcionales
  nombres?: string;
  apellidos?: string;
  celular?: string | null;
  empresa?: string | null; // acepta alias empresa o empresa_id
  sede?: string | null;
  rol?: string | null;
  estado_solicitudes?: boolean;
};

export type ActualizarUsuarioPayload = Partial<CrearUsuarioPayload>;

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) { }


  // Traer sucursales
  traerSucursales(): any {
    return this.http.get(`${this.apiUrl}/gestion_admin/sedes`,);
  }

  // Subir cedulas

  cambiarContrasenaMe(oldPassword: string, newPassword: string) {
    const url = `${this.apiUrl}/gestion_admin/usuarios/cambiar_contrasena/`;
    const body = { old_password: oldPassword, new_password: newPassword };
    return this.http.post<{ ok: boolean; message: string }>(url, body);
  }

  /** Quita sólo keys con `undefined` (conserva null o '') */
  private compact<T extends Record<string, any>>(obj: T): T {
    return Object.fromEntries(
      Object.entries(obj).filter(([, v]) => v !== undefined)
    ) as T;
  }

  /** Crear usuario (backend: RegisterView). Devuelve token + user detail */
  crear(body: CrearUsuarioPayload): Observable<AuthResponse> {
    // si usas prefijo como en tu ejemplo:
    // return this.http.post<AuthResponse>(`${this.apiUrl}/gestion_admin/auth/register/`, this.compact(body));
    return this.http.post<AuthResponse>(`${this.apiUrl}/gestion_admin/auth/register/`, this.compact(body));
  }

  /** Actualizar usuario (PATCH por defecto). Devuelve UsuarioDetail */
  actualizar(id: string, body: ActualizarUsuarioPayload, partial = true): Observable<UsuarioDetail> {
    const url = `${this.apiUrl}/gestion_admin/usuarios/${id}/`;
    const payload = this.compact(body);
    return partial
      ? this.http.patch<UsuarioDetail>(url, payload)
      : this.http.put<UsuarioDetail>(url, payload);
  }

  eliminar(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/gestion_admin/usuarios/${id}/`);
  }

  // Extras útiles con tus acciones del ViewSet:

  actualizarDatosBasicos(
    id: string,
    payload: { nombres?: string; apellidos?: string; celular?: string | null }
  ): Observable<{ ok: boolean; created: boolean; datos_basicos: UsuarioDetail['datos_basicos'] }> {
    return this.http.post<{ ok: boolean; created: boolean; datos_basicos: any }>(
      `${this.apiUrl}/gestion_admin/usuarios/${id}/actualizar_datos_basicos/`,
      this.compact(payload)
    );
  }

  asignarPermisos(
    id: string,
    payload: { otorgados?: string[]; revocados?: string[] }
  ): Observable<{ ok: boolean; otorgados: number; revocados: number; no_encontrados: string[] }> {
    return this.http.post<{ ok: boolean; otorgados: number; revocados: number; no_encontrados: string[] }>(
      `${this.apiUrl}/gestion_admin/usuarios/${id}/asignar_permisos/`,
      { otorgados: payload.otorgados ?? [], revocados: payload.revocados ?? [] }
    );
  }

}
