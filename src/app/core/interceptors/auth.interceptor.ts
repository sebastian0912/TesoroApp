import { HttpInterceptorFn } from '@angular/common/http';
import { HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';

export const interceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: HttpHandlerFn): Observable<HttpEvent<any>> => {
  // Detectar si estamos en un entorno de navegador
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  if (!isBrowser) {
    return next(req); // NO usar .handle(req)
  }

  // Obtener el token JWT del localStorage
  const jwtToken = localStorage.getItem('token');

  // Definir las rutas que queremos omitir del interceptor
  const excludedUrls = [
    '/usuarios/ingresar'
  ];

  // Verificar si la URL de la petición coincide con alguna de las rutas excluidas
  const isExcluded = excludedUrls.some(url => req.url.includes(url));

  if (isExcluded) {
    return next(req); // NO usar .handle(req)
  }

  // Si no hay token, permitir la petición pero mostrar advertencia
  if (!jwtToken) {
    return next(req); // NO usar .handle(req)
  }

  // Clonar la solicitud y agregar el token con el prefijo "Bearer"
  const modifiedReq = req.clone({
    headers: req.headers.set('Authorization', `${jwtToken}`)
  });

  return next(modifiedReq); // NO usar .handle(req)
};
