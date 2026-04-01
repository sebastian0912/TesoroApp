import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class NetworkStatusService {
  private onlineStatus = new BehaviorSubject<boolean>(navigator.onLine);
  private heartbeatInterval: any;

  constructor(private ngZone: NgZone) {
    this.initEventListeners();
  }

  get isOnline$(): Observable<boolean> {
    return this.onlineStatus.asObservable();
  }

  get isOnline(): boolean {
    return this.onlineStatus.value;
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
    if (this.onlineStatus.value !== false) {
      this.ngZone.run(() => this.onlineStatus.next(false));
    }
  }

  private setOnline() {
    if (this.onlineStatus.value !== true) {
      this.ngZone.run(() => this.onlineStatus.next(true));
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
      await fetch(environment.apiUrl, { 
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
