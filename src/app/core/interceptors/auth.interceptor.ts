import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpEvent,
  HttpErrorResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, EMPTY, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { environment } from '../../../environments/environment';

const API_BASE = environment.apiUrl;
const API_ORIGIN = new URL(API_BASE).host;

// 🔓 RUTAS PÚBLICAS (¡con "/" inicial!)
const PUBLIC_PATHS = ['/gestion_admin/auth/login/'];

// Prefijo del header Authorization. Si tu backend requiere otro esquema,
// cambia a 'Token' o deja '' si NO usa prefijo.
const AUTH_SCHEME = 'Bearer';

function normalizeUrl(url: string): URL | null {
  try { return new URL(url, API_BASE); } catch { return null; }
}

function isPublicPath(pathname: string): boolean {
  // Acepta exacto o con/ sin slash final
  return PUBLIC_PATHS.some(p => pathname === p || pathname === p.replace(/\/$/, '') || pathname.startsWith(p));
}

function getTokenSafe(): string | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return null;
  try {
    let raw = localStorage.getItem('token') || localStorage.getItem('Authorization');
    if (!raw) {
      const u = localStorage.getItem('user');
      if (u) {
        const user = JSON.parse(u);
        raw = user?.token || user?.jwt || user?.access_token || user?.accessToken || null;
      }
    }
    if (!raw) return null;
    // Añade el esquema si hace falta
    return raw;
    //return AUTH_SCHEME ? (raw.startsWith(`${AUTH_SCHEME} `) ? raw : `${AUTH_SCHEME} ${raw}`) : raw;
  } catch {
    return null;
  }
}

export const interceptor: HttpInterceptorFn = (
  req: HttpRequest<any>,
  next: HttpHandlerFn
): Observable<HttpEvent<any>> => {

  const router = inject(Router);
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  const u = normalizeUrl(req.url);
  if (!u) return next(req);

  const isApiRequest = u.host === API_ORIGIN || u.href.startsWith(API_BASE);
  const isPublic = isPublicPath(u.pathname);

  // 🚫 SSR: no dispares peticiones protegidas
  if (!isBrowser && isApiRequest && !isPublic) {
    return EMPTY;
  }

  let working = req;

  // 🔐 Protegidas: requieren token
  if (isBrowser && isApiRequest && !isPublic) {
    const token = getTokenSafe();
    if (!token) {
      // No envíes la solicitud; redirige al login
      router.navigateByUrl('/');
      return EMPTY;
    }
    working = working.clone({
      setHeaders: {
        Authorization: token,
        Accept: 'application/json',
      },
    });
  }

  // Content-Type JSON solo cuando aplica (no multipart/binario)
  const method = working.method.toUpperCase();
  const hasBodyMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const hasCT = working.headers.has('Content-Type');
  const body = working.body;

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;
  const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer;

  if (isApiRequest && hasBodyMethod && !hasCT && !isFormData && !isBlob && !isArrayBuffer) {
    working = working.clone({ setHeaders: { 'Content-Type': 'application/json' } });
  }

  // Manejo centralizado de 401 → limpiar y mandar al login
  // 403 = autenticado pero sin permisos (NO desloguear)
  return next(working).pipe(
    catchError((err: any) => {
      if (isApiRequest && err instanceof HttpErrorResponse && err.status === 401) {
        try { localStorage.removeItem('token'); } catch { }
        router.navigateByUrl('/');
      }
      return throwError(() => err);
    })
  );
};
