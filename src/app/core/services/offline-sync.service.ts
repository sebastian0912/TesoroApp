import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { NetworkStatusService } from './network-status.service';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private isSyncing = false;
  public pendingCount$ = new BehaviorSubject<number>(0);

  constructor(
    private http: HttpClient,
    private networkService: NetworkStatusService
  ) {
    // Escuchar cuando vuelva la conexión para sincronizar la cola
    this.networkService.isOnline$.subscribe(isOnline => {
      if (isOnline) {
        this.syncQueue();
      }
    });

    // Inicializar el contador
    this.updatePendingCount();
  }

  public async updatePendingCount() {
    if ((window as any).electron && (window as any).electron.db) {
      try {
        const pending = await (window as any).electron.db.getPendingRequests();
        this.pendingCount$.next(pending ? pending.length : 0);
      } catch(e) { }
    }
  }

  private async enqueueLocally(method: string, url: string, body: any, headers: any): Promise<any> {
    if ((window as any).electron && (window as any).electron.db) {
      const db = (window as any).electron.db;
      try {
        const result = await db.saveRequestQueue({
          method,
          url,
          body: JSON.stringify(body),
          headers: headers ? JSON.stringify(headers) : null
        });
        console.log('Solicitud guardada en cola offline', result);
        this.updatePendingCount(); // Update badge
        return { success: true, offlineQueue: true, id: result.id };
      } catch (err) {
        console.error('Error al guardar en cola offline', err);
        throw err;
      }
    } else {
      console.warn('Entorno de Electron DB no detectado. Solicitud perdida.');
      return { success: false, error: 'No electron IPC' };
    }
  }
}
