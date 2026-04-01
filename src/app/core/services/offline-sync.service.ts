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

  /**
   * Intenta guardar datos en la nube. Si no hay internet, lo guarda en la base de datos de Electron.
   */
  async enqueueOrSend(method: string, url: string, body: any, headers?: any): Promise<any> {
    if (this.networkService.isOnline) {
      try {
        // Enviar directamente
        return await this.http.request(method, url, { body, headers }).toPromise();
      } catch (error) {
        // Si falló (ej. la red se cayó justo al enviar), encolar
        console.warn('Network call failed, enqueuing offline request', error);
        return await this.enqueueLocally(method, url, body, headers);
      }
    } else {
      // Guardar en la DB local de Electron para enviar después
      return await this.enqueueLocally(method, url, body, headers);
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

  /**
   * Sincroniza la cola local con la nube cuando el internet vuelve.
   */
  async syncQueue() {
    if (this.isSyncing) return;
    if (!(window as any).electron || !(window as any).electron.db) return;

    this.isSyncing = true;
    const db = (window as any).electron.db;

    try {
      const pending: any[] = await db.getPendingRequests();
      
      if (pending && pending.length > 0) {
        console.log(`Iniciando sincronización de ${pending.length} peticiones pendientes...`);
        
        for (const req of pending) {
          try {
            // Intentar enviar a la API
            await this.http.request(
              req.method, 
              req.url, 
              { 
                body: req.body ? JSON.parse(req.body) : null,
                headers: req.headers ? JSON.parse(req.headers) : null
              }
            ).toPromise();

            // Si tuvo éxito, borrar de la base de datos local
            await db.deleteRequest(req.id);
            console.log(`Solicitud ${req.id} sincronizada y eliminada.`);
            this.updatePendingCount(); // Update badge on success
          } catch (syncErr) {
            console.error(`Error sincronizando la petición ${req.id}`, syncErr);
            // Romper el ciclo para no desordenar la cola, se intentará de nuevo luego.
            break;
          }
        }
      }
    } catch (err) {
      console.error('Error consultando la cola de sincronización', err);
    } finally {
      this.isSyncing = false;
      this.updatePendingCount();
    }
  }
}
