import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject, untracked } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { NetworkStatusService } from '../services/network-status.service';
import { OfflineDbService } from '../db/offline-db.service';
import { getLocalStorageItem } from '../utils/safe-storage';
import { toCacheKey } from '../utils/cache-key';

const offlineErrorResponse = (req: HttpRequest<unknown>, message: string, cause?: unknown): HttpErrorResponse =>
  new HttpErrorResponse({
    error: { offlineQueue: false, message, cause: cause ? String(cause) : undefined },
    status: 0,
    statusText: 'Offline (no se pudo encolar)',
    url: req.urlWithParams,
  });

const isFormData = (body: unknown): body is FormData =>
  typeof FormData !== 'undefined' && body instanceof FormData;

const fileToBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onloadend = () => {
      const result = String(fr.result || '');
      resolve(result.replace(/^data:[^;]+;base64,/, ''));
    };
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });

const MAX_OFFLINE_FILE_BYTES = 25 * 1024 * 1024;
const MAX_OFFLINE_TOTAL_BYTES = 100 * 1024 * 1024;

const NEVER_QUEUE_PATHS = [
  '/gestion_admin/auth/login/',
  '/gestion_admin/auth/refresh/',
  '/gestion_admin/auth/logout/',
  '/gestion_admin/auth/register/',
  '/gestion_documental/descargar-zip',
  '/EstadosRobots/descargar-zip',
  '/Robots/excel-antecedentes',
  '/Robots/full',
  '/gestion_documental/exportar',
];

const isNeverQueueable = (url: string): boolean =>
  NEVER_QUEUE_PATHS.some(p => url.includes(p));

const isBinaryResponse = (req: HttpRequest<unknown>): boolean =>
  req.responseType === 'blob' || req.responseType === 'arraybuffer';

const getCurrentUserId = (): string | null => {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = getLocalStorageItem('user');
    if (!raw) return null;
    const u = JSON.parse(raw);
    return String(u?.numero_de_documento ?? u?.id ?? '') || null;
  } catch {
    return null;
  }
};

const generateIdempotencyKey = (): string => {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch { /* fallthrough */ }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
};

export const offlineInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  const networkStatus = inject(NetworkStatusService);
  const offlineDb = inject(OfflineDbService);

  if (req.headers.has('X-Offline-Sync')) {
    return next(req);
  }

  // Telemetría fire-and-forget (auditoría de cambios, marcada con X-Skip-Log):
  // NUNCA encolar ni cachear. Si falla (sin red, o CORS/preflight rechazado) se
  // descarta y punto — el emisor ya ignora el error. Encolarla generaba una cola
  // offline que jamás drenaba (el reintento añade X-Offline-Sync, otra cabecera) y
  // crecía con cada navegación, disparando cientos de POST fallidos.
  if (req.headers.has('X-Skip-Log')) {
    return next(req);
  }

  /**
   * Encola una request multipart offline.
   * Convierte cada File a base64 y llama al adaptador, que decide cómo
   * almacenarlo (a disco en Electron, en IDB en web).
   */
  const handleOfflineWriteMultipart = (request: HttpRequest<FormData>): Observable<HttpEvent<unknown>> => {
    const formData = request.body as FormData;
    const formFields: { name: string; value: string }[] = [];
    const filesToEncode: { fieldName: string; file: File }[] = [];

    let valid = true;
    let validErr: Error | null = null;

    formData.forEach((value, key) => {
      if (!valid) return;
      if (value instanceof Blob) {
        const file = value instanceof File ? value : new File([value], 'upload.bin');
        filesToEncode.push({ fieldName: key, file });
      } else if (typeof value === 'string') {
        formFields.push({ name: key, value });
      } else {
        valid = false;
        validErr = new Error(
          `Campo "${key}" del FormData no es string ni File (${typeof value}). No se puede encolar offline.`
        );
      }
    });

    if (!valid && validErr) return throwError(() => validErr as Error);

    let totalBytes = 0;
    for (const { file } of filesToEncode) {
      if (file.size > MAX_OFFLINE_FILE_BYTES) {
        return throwError(() => new Error(
          `El archivo "${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y excede el límite offline de ${MAX_OFFLINE_FILE_BYTES / 1024 / 1024} MB.`
        ));
      }
      totalBytes += file.size;
    }
    if (totalBytes > MAX_OFFLINE_TOTAL_BYTES) {
      return throwError(() => new Error(
        `El total de archivos (${(totalBytes / 1024 / 1024).toFixed(1)} MB) excede el límite offline de ${MAX_OFFLINE_TOTAL_BYTES / 1024 / 1024} MB.`
      ));
    }

    const idempotencyKey = generateIdempotencyKey();
    const userId = getCurrentUserId();

    const persist = async () => {
      // Codificar todos los archivos a base64 (mismo paso para Electron e IDB).
      const encodedFiles = await Promise.all(
        filesToEncode.map(async ({ fieldName, file }) => ({
          fieldName,
          fileName: file.name || 'upload.bin',
          mimeType: file.type || 'application/octet-stream',
          base64: await fileToBase64(file),
        }))
      );

      const saveRes = await offlineDb.db.saveMultipartRequest({
        method: request.method,
        url: request.urlWithParams,
        headers: null,
        formFields,
        files: encodedFiles,
        idempotencyKey,
        userId,
      });
      if (!saveRes?.success) throw new Error(saveRes?.error ?? 'No se pudo guardar la request');

      window.dispatchEvent(new CustomEvent('offline-queue-updated'));
      window.dispatchEvent(new CustomEvent('offline-write-queued', {
        detail: {
          method: request.method,
          url: request.urlWithParams,
          isMultipart: true,
          fileCount: encodedFiles.length,
          fileNames: encodedFiles.map(f => f.fileName),
        },
      }));
      return new HttpResponse({
        status: 200,
        body: { success: true, offlineQueue: true, id: saveRes.id, _isOfflineMock: true },
      });
    };

    return (from(persist()) as Observable<HttpEvent<unknown>>).pipe(
      catchError((err: unknown) => {
        const message = (err as any)?.message ?? 'No se pudo encolar el envío offline';
        return throwError(() => offlineErrorResponse(request, message, err));
      })
    );
  };

  const handleOfflineWrite = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    if (isNeverQueueable(request.url)) {
      return throwError(() => new Error('Esta operación requiere conexión y no puede encolarse offline.'));
    }

    if (isFormData(request.body)) {
      return handleOfflineWriteMultipart(request as HttpRequest<FormData>);
    }

    const idempotencyKey = generateIdempotencyKey();
    const userId = getCurrentUserId();

    const persist = async (): Promise<HttpResponse<unknown>> => {
      const saveRes = await offlineDb.db.saveRequestQueue({
        method: request.method,
        url: request.urlWithParams,
        body: request.body ? JSON.stringify(request.body) : null,
        headers: null,
        idempotencyKey,
        userId,
      });
      if (!saveRes?.success) {
        throw new Error(saveRes?.error ?? 'No se pudo guardar la request en la cola offline');
      }

      window.dispatchEvent(new CustomEvent('offline-queue-updated'));
      window.dispatchEvent(new CustomEvent('offline-write-queued', {
        detail: {
          method: request.method,
          url: request.urlWithParams,
          isMultipart: false,
          fileCount: 0,
          fileNames: [],
        },
      }));

      const fakeId = saveRes.id ? -Math.abs(saveRes.id) : -Math.floor(Math.random() * 1000000);
      let responseBody: any = { success: true, offlineQueue: true, id: fakeId, _isOfflineMock: true };
      if (request.body && typeof request.body === 'object') {
        const reqBody = request.body as any;
        responseBody = { ...reqBody, id: reqBody.id || fakeId, _isOfflineMock: true };
      }
      return new HttpResponse({ status: 200, body: responseBody });
    };

    return (from(persist()) as Observable<HttpEvent<unknown>>).pipe(
      catchError((err: unknown) => {
        const message = (err as any)?.message ?? 'No se pudo encolar el envío offline';
        return throwError(() => offlineErrorResponse(request, message, err));
      })
    );
  };

  const handleOfflineRead = (request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> => {
    const cacheKey = toCacheKey(request.urlWithParams);
    return new Observable<HttpEvent<unknown>>(observer => {
      offlineDb.db.cacheGet(cacheKey).then(cachedData => {
        if (cachedData) {
          console.log(`[Cache Hit] Sirviendo ${request.urlWithParams} desde cache local`);
          observer.next(new HttpResponse({ status: 200, body: cachedData }));
          observer.complete();
        } else {
          observer.error(new Error('Sin conexion. No hay datos en cache para esta vista.'));
        }
      }).catch(err => observer.error(err));
    });
  };

  if (isNeverQueueable(req.urlWithParams) || isBinaryResponse(req)) {
    return next(req);
  }

  // untracked: el interceptor corre síncrono al suscribirse el HTTP. Si el HTTP
  // nace dentro de un effect()/computed, leer aquí la señal onlineStatus le
  // crearía a ese contexto una dependencia accidental (mismo patrón que causó
  // la tormenta de 429 del 2026-08-19 con la señal del loading).
  if (!untracked(() => networkStatus.isOnline)) {
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

        if (req.method === 'GET' && event.body) {
          const isCacheable =
            req.responseType === 'json' &&
            !(event.body instanceof Blob) &&
            !(event.body instanceof ArrayBuffer) &&
            (typeof event.body === 'object' || Array.isArray(event.body));

          if (isCacheable) {
            offlineDb.db.cacheSave({
              url: toCacheKey(req.urlWithParams),
              data: JSON.stringify(event.body),
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
