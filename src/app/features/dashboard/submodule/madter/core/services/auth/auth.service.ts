import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface AuthResponse {
  id: number;
  uuid: string;
  username: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  status: string;
  emailVerified: boolean;
  roles: string[];
}

/**
 * Servicio liviano que lee el usuario ya autenticado de TesoroApp
 * desde localStorage('user').  NO hace login propio.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {

  /** No-op: CSRF ya no se necesita, auth va por JWT header */
  initCsrf(): Observable<unknown> {
    return of({ token: '', message: 'noop' });
  }

  /** Compatibilidad: me() retorna el user de localStorage como observable */
  me(): Observable<AuthResponse> {
    return of(this.getStoredUser() as AuthResponse);
  }

  logout(): Observable<unknown> {
    return of(null);
  }

  getStoredUser(): AuthResponse | null {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) as AuthResponse : null;
    } catch {
      return null;
    }
  }

  isLoggedIn(): boolean {
    return !!this.getStoredUser();
  }

  getRoleName(): string {
    const u = this.getStoredUser() as Record<string, any> | null;
    return u?.['rol']?.['nombre'] ?? '';
  }

  hasRole(roleName: string): boolean {
    return this.getStoredUser()?.roles?.includes(roleName) ?? false;
  }

  getUserId(): string | null {
    return this.getStoredUser()?.id?.toString() ?? null;
  }

  getUserDisplayName(): string {
    const u = this.getStoredUser() as Record<string, any> | null;
    if (!u) return '';
    const datos = u['datos_basicos'] ?? u;
    return [datos['nombres'] ?? datos['primer_nombre'] ?? '', datos['apellidos'] ?? datos['primer_apellido'] ?? '']
      .filter(Boolean).join(' ');
  }
}
