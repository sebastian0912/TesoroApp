import { HttpInterceptorFn } from '@angular/common/http';
import { Observable } from 'rxjs';
import { HttpRequest, HttpEvent } from '@angular/common/http';

export const interceptor: HttpInterceptorFn = (req: HttpRequest<any>, next: any): Observable<HttpEvent<any>> => {
  // Detectar si estamos en un entorno de navegador
  const isBrowser = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

  // Si estamos en SSR, dejar pasar la petición sin modificar
  if (!isBrowser) {
    return next(req);
  }

  // Obtener el token JWT del localStorage
  const jwtToken = localStorage.getItem('token');

  // Definir las rutas que queremos omitir del interceptor
  const excludedUrls = [
    '/usuarios/registro',
    '/usuarios/ingresar'
  ];

  // Verificar si la URL de la petición coincide con alguna de las rutas excluidas
  const isExcluded = excludedUrls.some(url => req.url.includes(url));

  if (isExcluded) {
    return next(req);
  }

  // Si no hay token, permitir la petición pero mostrar advertencia
  if (!jwtToken) {
    return next(req);
  }

  // Clonar la solicitud y agregar el token en los headers
  const modifiedReq = req.clone({
    headers: req.headers.set('Authorization', `${jwtToken}`)
  });

  return next(modifiedReq);
};
