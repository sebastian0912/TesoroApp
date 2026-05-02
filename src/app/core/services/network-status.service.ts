import { Injectable, NgZone, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService {
  public onlineStatus = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private heartbeatInterval: ReturnType<typeof setInterval> | undefined;

  constructor(private ngZone: NgZone) {
    this.initEventListeners();
  }

  get isOnline$(): Observable<boolean> {
    return toObservable(this.onlineStatus);
  }

  get isOnline(): boolean {
    return this.onlineStatus();
  }

  public markOffline(): void {
    if (this.onlineStatus() !== false) {
      this.ngZone.run(() => this.onlineStatus.set(false));
    }
  }

  public markOnline(): void {
    if (this.onlineStatus() !== true) {
      this.ngZone.run(() => this.onlineStatus.set(true));
    }
  }

  private initEventListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => {
      void this.checkRealConnection();
    });
    window.addEventListener('offline', () => this.markOffline());

    this.heartbeatInterval = setInterval(() => {
      void this.checkRealConnection();
    }, 15000);

    setTimeout(() => {
      void this.checkRealConnection();
    }, 1000);
  }

  private async checkRealConnection(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.markOffline();
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      // GET con `cors` (no `no-cors`) para poder validar el status y el body.
      // Antes con `mode: 'no-cors'` cualquier respuesta opaca (502, 405,
      // captive portal con HTML) resolvía la promesa y la app se ponía
      // online: al volver online, syncQueue() reproducía la cola contra ese
      // server roto y todo se marcaba como failed. El backend devuelve
      // {"ok": true, "ts": "..."} en /health/ y CORS está abierto.
      const response = await fetch(`${environment.apiUrl}/health/`, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal,
        // Header explícito para que ningún proxy intermedio responda con HTML
        // de "captive portal" interpretado como JSON válido.
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        console.warn(`[Heartbeat] /health/ respondió ${response.status}, marcando offline.`);
        this.markOffline();
        return;
      }

      // Tolerante: si el endpoint responde texto plano "ok" (versión vieja
      // del backend), también lo aceptamos. El paso load-bearing es haber
      // tenido `cors` + status 2xx; el body es solo señal extra.
      let healthy = true;
      try {
        const ct = (response.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('json')) {
          const body = await response.json();
          if (body && typeof body === 'object' && body.ok === false) healthy = false;
        }
      } catch { /* body opcional, ignoramos parse */ }

      if (healthy) this.markOnline();
      else this.markOffline();
    } catch {
      // Throttle: solo loggear cuando hay transición. El warn cada 15s
      // tapaba logs útiles en `ConsoleLoggerService` (cap de 50 entradas).
      if (this.onlineStatus()) {
        console.warn('[Heartbeat] servidor inalcanzable, pasando a offline.');
      }
      this.markOffline();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
