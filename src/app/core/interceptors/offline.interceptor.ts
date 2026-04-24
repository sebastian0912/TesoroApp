import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { NetworkStatusService } from '../services/network-status.service';

const isFormData = (body: unknown): body is FormData =>
  typeof FormData !== 'undefined' && body instanceof FormData;

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => {
      const result = String(fr.result || '');
      // Solo el contenido base64 (sin "data:...;base64,").
      resolve(result.replace(/^data:[^;]+;base64,/, ''));
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });

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

  /**
   * Encola una request multipart cuyo body es FormData. Cada File se persiste
   * a disco vía IPC y solo su referencia (ruta + metadata) queda en SQLite.
   * Así no inflamos la DB con archivos pesados ni perdemos los binarios al
   * serializar (JSON.stringify(FormData) devolvía "{}" antes de este cambio).
   */
  const handleOfflineWriteMultipart = (request: HttpRequest<FormData>): Observable<HttpEvent<unknown>> => {
    if (!electron?.offline?.saveUpload || !electron?.db?.saveMultipartRequest) {
      return throwError(() => new Error('Sin conexión. Esta build no soporta uploads offline.'));
    }

    const formData = request.body as FormData;
    const formFields: { name: string; value: string }[] = [];
    const filesToStore: { fieldName: string; file: File }[] = [];

    formData.forEach((value, key) => {
      if (typeof value !== 'string' && value instanceof Blob) {
        const file = value instanceof File ? value : new File([value], 'upload.bin');
        filesToStore.push({ fieldName: key, file });
      } else {
        formFields.push({ name: key, value: String(value) });
      }
    });

    const persist = async () => {
      const stored: { fieldName: string; fileName: string; mimeType: string | null; storedPath: string }[] = [];
      try {
        for (const { fieldName, file } of filesToStore) {
          const base64 = await fileToBase64(file);
          const res = await electron.offline.saveUpload({
            base64,
            fileName: file.name || 'upload.bin',
            mimeType: file.type || 'application/octet-stream',
          });
          if (!res?.success || !res.storedPath) {
            throw new Error(res?.error || 'No se pudo guardar el archivo offline');
          }
          stored.push({
            fieldName,
            fileName: file.name || 'upload.bin',
            mimeType: file.type || 'application/octet-stream',
            storedPath: res.storedPath,
          });
        }

        const saveRes = await electron.db.saveMultipartRequest({
          method: request.method,
          url: request.urlWithParams,
          // Content-Type se omite a propósito: al replay el browser lo regenera
          // con el boundary correcto para el nuevo FormData.
          headers: null,
          formFields,
          files: stored,
        });
        if (!saveRes?.success) throw new Error(saveRes?.error || 'No se pudo guardar la request');

        window.dispatchEvent(new CustomEvent('offline-queue-updated'));
        return new HttpResponse({
          status: 200,
          body: { success: true, offlineQueue: true, id: saveRes.id, _isOfflineMock: true },
        });
      } catch (e) {
        // Rollback: si falló a mitad de camino, borrar los archivos ya escritos
        // para no acumular huérfanos en disco.
        for (const s of stored) {
          electron.offline.deleteUpload(s.storedPath).catch(() => { /* noop */ });
        }
        throw e;
      }
    };

    return from(persist()) as Observable<HttpEvent<unknown>>;
  };

  const handleOfflineWrite = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    if (isFormData(request.body)) {
      return handleOfflineWriteMultipart(request as HttpRequest<FormData>);
    }
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
    tap((event: HttpEvent<any>) => {
      if (event instanceof HttpResponse) {
        networkStatus.markOnline();

        if (req.method === 'GET' && electron && electron.db && event.body) {
          if (typeof event.body === 'object' || Array.isArray(event.body)) {
            electron.db.cacheSave({
              url: req.urlWithParams,
              data: JSON.stringify(event.body)
            }).catch((error: any) => console.warn('No se pudo cachear:', error));
          }
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
