import { Injectable, NgZone, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { environment } from '@/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService {
  public onlineStatus = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  private heartbeatInterval: ReturnType<typeof setInterval> | undefined;
  private readonly ngZone = inject(NgZone);

  // Tolerancia a fallos transitorios: solo marcamos offline después de
  // FAIL_THRESHOLD heartbeats fallidos seguidos. Esto evita que un endpoint
  // pesado o un GC del backend pongan toda la app en modo offline.
  private consecutiveFails = 0;
  private readonly FAIL_THRESHOLD = 3;
  private readonly HEARTBEAT_TIMEOUT_MS = 8000;   // antes 4s; demasiado agresivo
  private readonly HEARTBEAT_INTERVAL_MS = 20000; // antes 15s; un poco más relajado

  constructor() {
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
    this.consecutiveFails = 0;
    if (this.onlineStatus() !== true) {
      this.ngZone.run(() => this.onlineStatus.set(true));
    }
  }

  private initEventListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.addEventListener('online', () => {
      // Cuando el OS reporta online, intentamos validar de inmediato.
      this.consecutiveFails = 0;
      void this.checkRealConnection();
    });

    // OS reporta offline → confiamos en eso de inmediato (caso obvio).
    window.addEventListener('offline', () => {
      this.consecutiveFails = this.FAIL_THRESHOLD;
      this.markOffline();
    });

    this.heartbeatInterval = setInterval(() => {
      void this.checkRealConnection();
    }, this.HEARTBEAT_INTERVAL_MS);

    setTimeout(() => {
      void this.checkRealConnection();
    }, 1000);
  }

  private async checkRealConnection(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.consecutiveFails = this.FAIL_THRESHOLD;
      this.markOffline();
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.HEARTBEAT_TIMEOUT_MS);

    try {
      // GET con `cors` (no `no-cors`) para poder validar el status y el body.
      // El backend responde {"ok": true, "ts": "..."} en /health/.
      const response = await fetch(`${environment.apiUrl}/health/`, {
        method: 'GET',
        cache: 'no-store',
        mode: 'cors',
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        // 4xx/5xx cuentan como fallo, pero NO marcamos offline hasta
        // acumular FAIL_THRESHOLD. Un 502/503 transitorio no debe tirar
        // la app entera a modo offline.
        this.recordFailure(`/health/ respondió ${response.status}`);
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

      if (healthy) {
        this.markOnline();
      } else {
        this.recordFailure('/health/ reportó ok=false');
      }
    } catch (e: any) {
      // Timeout o error de red. Acumula, no marca offline al primer fallo.
      const reason = e?.name === 'AbortError'
        ? `timeout ${this.HEARTBEAT_TIMEOUT_MS}ms`
        : 'fetch error';
      this.recordFailure(reason);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Acumula un fallo. Solo marca offline cuando llega a FAIL_THRESHOLD
   * consecutivos. Esto absorbe baches transitorios (GC del backend,
   * endpoint pesado bloqueando un worker, latencia puntual de red).
   */
  private recordFailure(reason: string): void {
    this.consecutiveFails += 1;
    if (this.consecutiveFails >= this.FAIL_THRESHOLD) {
      // Solo loggea cuando HAY transición (no spam cada 20s).
      if (this.onlineStatus()) {
        console.warn(
          `[Heartbeat] ${this.FAIL_THRESHOLD} fallos consecutivos (${reason}). Marcando offline.`
        );
      }
      this.markOffline();
    }
  }
}
