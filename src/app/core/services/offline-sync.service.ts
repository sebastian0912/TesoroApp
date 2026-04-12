import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NetworkStatusService } from './network-status.service';
import { BehaviorSubject, firstValueFrom } from 'rxjs';

interface SyncQueueItem {
  id: number;
  method: string;
  url: string;
  body: string | null;
  headers: string | null;
  timestamp: string;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService {
  private isSyncing = false;
  private isRefreshing = false;
  public pendingCount$ = new BehaviorSubject<number>(0);
  public syncProgress$ = new BehaviorSubject<{ current: number; total: number; phase: string } | null>(null);

  private get electron(): any {
    return (window as any).electron;
  }

  constructor(
    private http: HttpClient,
    private networkService: NetworkStatusService
  ) {
    this.networkService.isOnline$.subscribe(async isOnline => {
      if (isOnline) {
        await this.syncQueue();
        this.refreshCache();
      }
    });

    this.updatePendingCount();
  }

  /**
   * Sincroniza la cola de peticiones pendientes cuando vuelve la conexión.
   * Reenvía cada petición al backend en orden cronológico.
   */
  async syncQueue(): Promise<void> {
    if (this.isSyncing || !this.electron?.db) return;
    this.isSyncing = true;

    try {
      const pending: SyncQueueItem[] = await this.electron.db.getPendingRequests();
      if (!pending || pending.length === 0) return;

      const total = pending.length;
      let synced = 0;
      let failed = 0;

      console.log(`[Sync] Iniciando sincronización de ${total} solicitudes pendientes...`);

      for (const item of pending) {
        this.syncProgress$.next({ current: synced + failed + 1, total, phase: 'sync' });

        try {
          let body: any = null;
          if (item.body) {
            try { body = JSON.parse(item.body); } catch { body = item.body; }
          }

          // X-Offline-Sync evita que el interceptor offline re-encole esta petición si falla
          await firstValueFrom(
            this.http.request(item.method, item.url, {
              body,
              headers: new HttpHeaders({ 'X-Offline-Sync': 'true' })
            })
          );

          await this.electron.db.deleteRequest(item.id);
          synced++;
        } catch (error: any) {
          const status = error?.status || 0;

          if (status >= 400 && status < 500 && status !== 401) {
            // Error del cliente (datos inválidos, etc.) — no se puede reintentar
            console.warn(`[Sync] Solicitud ${item.id} falló con ${status}. Marcada como fallida.`);
            await this.electron.db.markRequestStatus({ id: item.id, status: 'failed' });
            failed++;
          } else if (status === 401) {
            // Token expirado — pausar sync, el usuario debe re-loguearse
            console.warn('[Sync] Token expirado (401). Sync pausado.');
            break;
          } else {
            // Error de servidor (5xx) o sin red (0) — parar e intentar después
            console.warn(`[Sync] Error ${status} en solicitud ${item.id}. Se reintentará después.`);
            break;
          }
        }
      }

      if (synced > 0 || failed > 0) {
        console.log(`[Sync] Resultado: ${synced} sincronizadas, ${failed} fallidas de ${total} total.`);
      }
    } finally {
      this.isSyncing = false;
      this.syncProgress$.next(null);
      this.updatePendingCount();
      window.dispatchEvent(new CustomEvent('offline-queue-updated'));
    }
  }

  /**
   * Refresca todas las URLs previamente cacheadas con datos frescos del backend.
   * Se ejecuta en segundo plano después de sincronizar la cola.
   */
  async refreshCache(): Promise<void> {
    if (this.isRefreshing || !this.electron?.db) return;
    this.isRefreshing = true;

    try {
      const urls: string[] = await this.electron.db.cacheGetAllUrls();
      if (!urls || urls.length === 0) return;

      // Filtrar URLs que no son endpoints de API (ej: auth_login_password)
      const apiUrls = urls.filter(u => u.startsWith('http'));
      if (apiUrls.length === 0) return;

      console.log(`[Cache] Refrescando ${apiUrls.length} URLs cacheadas en segundo plano...`);

      const total = apiUrls.length;
      let refreshed = 0;

      // Refrescar en lotes de 3 para no saturar el servidor
      for (let i = 0; i < apiUrls.length; i += 3) {
        // Si perdimos conexión durante el refresh, parar
        if (!this.networkService.isOnline) {
          console.warn('[Cache] Conexión perdida durante refresh. Pausando.');
          break;
        }

        const batch = apiUrls.slice(i, i + 3);
        this.syncProgress$.next({ current: i + 1, total, phase: 'cache' });

        const results = await Promise.allSettled(
          batch.map(url =>
            firstValueFrom(this.http.get(url)).catch(() => null)
          )
        );

        refreshed += results.filter(r => r.status === 'fulfilled' && r.value !== null).length;
      }

      console.log(`[Cache] Refresh completado: ${refreshed}/${total} URLs actualizadas.`);
    } catch (e) {
      console.warn('[Cache] Error refrescando cache:', e);
    } finally {
      this.isRefreshing = false;
      this.syncProgress$.next(null);
    }
  }

  public async updatePendingCount(): Promise<void> {
    if (this.electron?.db) {
      try {
        const pending = await this.electron.db.getPendingRequests();
        this.pendingCount$.next(pending ? pending.length : 0);
      } catch { }
    }
  }
}
