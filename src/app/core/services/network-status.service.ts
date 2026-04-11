import { Injectable, NgZone, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { buildApiUrl } from '../../../environments/api-url';

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
      await fetch(buildApiUrl('health/', environment.apiUrl), {
        method: 'HEAD',
        cache: 'no-store',
        mode: 'no-cors',
        signal: controller.signal
      });

      this.markOnline();
    } catch {
      console.warn('Heartbeat fallo: servidor inalcanzable.');
      this.markOffline();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
