import {  Injectable, NgZone , signal } from '@angular/core';
import {  Observable } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService {
  public onlineStatus = signal(navigator.onLine);
  private heartbeatInterval: any;

  constructor(private ngZone: NgZone) {
    this.initEventListeners();
  }

  get isOnline$(): Observable<boolean> {
    return toObservable(this.onlineStatus);
  }

  get isOnline(): boolean {
    return this.onlineStatus();
  }

  private initEventListeners() {
    // Eventos naticos del navegador/OS
    window.addEventListener('online', () => this.checkRealConnection());
    window.addEventListener('offline', () => this.setOffline());

    // Polling activo: revisa cada 15 segundos si de verdad hay salida al servidor
    if (typeof window !== 'undefined') {
      this.heartbeatInterval = setInterval(() => this.checkRealConnection(), 15000);
      // Chequeo inicial rápido
      setTimeout(() => this.checkRealConnection(), 1000);
    }
  }

  private setOffline() {
    if (this.onlineStatus() !== false) {
      this.ngZone.run(() => this.onlineStatus.set(false));
    }
  }

  private setOnline() {
    if (this.onlineStatus() !== true) {
      this.ngZone.run(() => this.onlineStatus.set(true));
    }
  }

  private async checkRealConnection() {
    if (!navigator.onLine) {
      this.setOffline();
      return;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 Segundos max
      
      // Un simple GET a la raíz del entorno.
      // Así el backend responda 403 o 401, sabremos que logramos alcanzar la IP del backend.
      await fetch(environment.apiUrl + 'health/', {
        method: 'HEAD', 
        cache: 'no-store',
        mode: 'no-cors', // Evita errores restrictivos de CORS al hacer ping
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      
      this.setOnline();
    } catch (err) {
      console.warn("Heartbeat falló: Falso positivo LAN detectado. El servidor es inalcanzable.");
      this.setOffline();
    }
  }
}
