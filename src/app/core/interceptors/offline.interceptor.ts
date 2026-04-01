import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, of } from 'rxjs';
import { catchError, filter, tap } from 'rxjs/operators';
import { NetworkStatusService } from '../services/network-status.service';
import Swal from 'sweetalert2';

export const offlineInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn): Observable<HttpEvent<unknown>> => {
  const networkStatus = inject(NetworkStatusService);
  const electron = (window as any).electron;

  const handleOfflineWrite = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    if (electron && electron.db) {
      // Guardar de forma sincrónica con IPC (Promises)
      electron.db.saveRequestQueue({
        method: request.method,
        url: request.urlWithParams,
        body: request.body ? JSON.stringify(request.body) : null,
        headers: JSON.stringify(request.headers)
      }).then(() => {
        window.dispatchEvent(new CustomEvent('offline-queue-updated')); // Actualiza el badge silenciosamente
      }).catch((err: any) => {
        console.error('Error guardando request offline', err);
      });

      // Crear un mock data inteligente basado en lo que mandó el usuario
      const fakeId = -Math.floor(Math.random() * 1000000);
      let responseBody: any = { success: true, offlineQueue: true, id: fakeId };
      
      if (request.body && typeof request.body === 'object') {
        const reqBody = request.body as any;
        responseBody = { ...reqBody, id: reqBody.id || fakeId, _isOfflineMock: true };
      }

      // Retornar un mock "Exitoso" para que los componentes sigan trabajando
      return of(new HttpResponse({ status: 200, body: responseBody }));
    }

    return throwError(() => new Error('Offline. No se pudo guardar la petición.'));
  };

  const handleOfflineRead = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    if (electron && electron.db) {
      // Devolver Promise como Observable
      return new Observable<HttpEvent<unknown>>(observer => {
        electron.db.cacheGet(request.urlWithParams).then((cachedData: any) => {
          if (cachedData) {
            console.log(`[Cache Hit] Sirviendo ${request.urlWithParams} desde caché local`);
            observer.next(new HttpResponse({ status: 200, body: cachedData }));
            observer.complete();
          } else {
            observer.error(new Error('Sin conexión. No hay datos en caché para esta vista.'));
          }
        }).catch((err: any) => {
          observer.error(err);
        });
      });
    }
    return throwError(() => new Error('Sin conexión. No DB.'));
  };

  // 1. Si sabemos seguro que no hay red, redirigimos a Caché o Cola
  if (!networkStatus.isOnline) {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      return handleOfflineWrite(req);
    }
    if (req.method === 'GET') {
      return handleOfflineRead(req);
    }
    return throwError(() => new Error('Sin conexión. Método no soportado offline.'));
  }

  // 2. Si hay red, ejecutamos normalmente y cacheamos resultados GET exitosos
  return next(req).pipe(
    filter(event => event instanceof HttpResponse),
    tap((event: HttpEvent<any>) => {
      // Solo guardar en caché si es una petición GET exitosa (cuerpo JSON)
      if (req.method === 'GET' && electron && electron.db && event instanceof HttpResponse && event.body) {
        // Obviar rutas de archivos binarios o no-JSON
        if (typeof event.body === 'object' || Array.isArray(event.body)) {
          electron.db.cacheSave({
            url: req.urlWithParams,
            data: JSON.stringify(event.body)
          }).catch((e: any) => console.warn('No se pudo cachear:', e));
        }
      }
    }),
    catchError((error: HttpErrorResponse) => {
      // Status 0 significa que no hubo respuesta de red por fallo súbito
      if (error.status === 0) {
        if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
          console.warn('Network call failed with status 0, queuing offline...', error);
          return handleOfflineWrite(req);
        } else if (req.method === 'GET') {
          return handleOfflineRead(req);
        }
      }
      return throwError(() => error);
    })
  );
};
