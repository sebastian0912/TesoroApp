import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { NetworkStatusService } from '../services/network-status.service';

export const offlineInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const networkStatus = inject(NetworkStatusService);
  const electron = (window as any).electron;

  // Las peticiones de sync replay NO deben re-encolarse si fallan
  if (req.headers.has('X-Offline-Sync')) {
    return next(req);
  }

  const handleOfflineWrite = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    if (electron && electron.db) {
      electron.db.saveRequestQueue({
        method: request.method,
        url: request.urlWithParams,
        body: request.body ? JSON.stringify(request.body) : null,
        headers: JSON.stringify(request.headers)
      }).then(() => {
        window.dispatchEvent(new CustomEvent('offline-queue-updated'));
      }).catch((err: any) => {
        console.error('Error guardando request offline', err);
      });

      const fakeId = -Math.floor(Math.random() * 1000000);
      let responseBody: any = { success: true, offlineQueue: true, id: fakeId };

      if (request.body && typeof request.body === 'object') {
        const reqBody = request.body as any;
        responseBody = { ...reqBody, id: reqBody.id || fakeId, _isOfflineMock: true };
      }

      return of(new HttpResponse({ status: 200, body: responseBody }));
    }

    return throwError(() => new Error('Offline. No se pudo guardar la peticion.'));
  };

  const handleOfflineRead = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    if (electron && electron.db) {
      return new Observable<HttpEvent<unknown>>(observer => {
        electron.db.cacheGet(request.urlWithParams).then((cachedData: any) => {
          if (cachedData) {
            console.log(`[Cache Hit] Sirviendo ${request.urlWithParams} desde cache local`);
            observer.next(new HttpResponse({ status: 200, body: cachedData }));
            observer.complete();
          } else {
            observer.error(new Error('Sin conexion. No hay datos en cache para esta vista.'));
          }
        }).catch((err: any) => {
          observer.error(err);
        });
      });
    }

    return throwError(() => new Error('Sin conexion. No DB.'));
  };

  if (!networkStatus.isOnline) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return handleOfflineWrite(req);
    }

    if (req.method === 'GET') {
      return handleOfflineRead(req);
    }

    return throwError(() => new Error('Sin conexion. Metodo no soportado offline.'));
  }

  return next(req).pipe(
    filter(event => event instanceof HttpResponse),
    tap((event: HttpEvent<any>) => {
      networkStatus.markOnline();

      if (req.method === 'GET' && electron && electron.db && event instanceof HttpResponse && event.body) {
        if (typeof event.body === 'object' || Array.isArray(event.body)) {
          electron.db.cacheSave({
            url: req.urlWithParams,
            data: JSON.stringify(event.body)
          }).catch((error: any) => console.warn('No se pudo cachear:', error));
        }
      }
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 0) {
        networkStatus.markOffline();

        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
          console.warn('Network call failed with status 0, queuing offline...', error);
          return handleOfflineWrite(req);
        }

        if (req.method === 'GET') {
          return handleOfflineRead(req);
        }
      }

      return throwError(() => error);
    })
  );
};
