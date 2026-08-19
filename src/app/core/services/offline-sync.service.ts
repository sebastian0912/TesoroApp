import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NetworkStatusService } from './network-status.service';
import { PermissionsService } from './permissions.service';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { getLocalStorageItem } from '../utils/safe-storage';
import { entryHostMatchesCurrent, fromCacheKey } from '../utils/cache-key';
import { categorizeCacheUrl, formatRelativeAge } from '../utils/offline-response';
import { isCatalogUrl } from '../utils/catalog-endpoints';
import { OfflineDbService } from '../db/offline-db.service';
import { SyncQueueItem, StoredFile } from '../db/offline-db.types';

export interface CacheEntry {
  url: string;
  label: string;
  category: string;
  icon: string;
  updatedAt: string | null;
  age: string;
  status: 'pending_write' | 'failed_write' | 'synced' | 'stale';
}

export interface CacheCategory {
  name: string;
  icon: string;
  entries: CacheEntry[];
  status: 'pending_write' | 'failed_write' | 'synced' | 'stale';
  lastUpdated: string;
  count: number;
}

@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private isSyncing = false;
  private isRefreshing = false;
  public pendingCount$ = new BehaviorSubject<number>(0);
  public failedCount$ = new BehaviorSubject<number>(0);
  public syncProgress$ = new BehaviorSubject<{ current: number; total: number; phase: string } | null>(null);

  private readonly offlineDb = inject(OfflineDbService);
  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkStatusService);
  private readonly permissions = inject(PermissionsService);

  constructor() {
    this.networkService.isOnline$.subscribe(async isOnline => {
      if (isOnline) {
        await this.syncQueue();
        this.refreshCache();
      }
    });
    this.updatePendingCount();
    this.updateFailedCount();
  }

  private getCurrentUserId(): string | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = getLocalStorageItem('user');
      if (!raw) return null;
      const u = JSON.parse(raw);
      return String(u?.numero_de_documento ?? u?.id ?? '') || null;
    } catch {
      return null;
    }
  }

  async syncQueue(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const userId = this.getCurrentUserId();
      if (!userId) return;

      const pending: SyncQueueItem[] = await this.offlineDb.db.getPendingRequests({ userId });
      if (!pending || pending.length === 0) return;

      const total = pending.length;
      let synced = 0;
      let failed = 0;

      console.log(`[Sync] Iniciando sincronización de ${total} solicitudes pendientes...`);

      for (const item of pending) {
        this.syncProgress$.next({ current: synced + failed + 1, total, phase: 'sync' });

        try {
          let body: any = null;

          if (item.body_type === 'multipart') {
            const reconstructed = await this.rebuildFormData(item);
            if (!reconstructed) {
              const reason = 'Archivos adjuntos no disponibles';
              console.warn(`[Sync] ${reason} para request ${item.id}.`);
              await this.offlineDb.db.markRequestStatus({ id: item.id, status: 'failed', error: reason });
              failed++;
              this.notifyFailed(item, reason);
              continue;
            }
            body = reconstructed;
          } else if (item.body_type === 'json') {
            try {
              body = item.body ? JSON.parse(item.body) : null;
            } catch (e) {
              const reason = 'Body JSON corrupto en la cola offline';
              console.warn(`[Sync] ${reason} (id=${item.id}):`, e);
              await this.offlineDb.db.markRequestStatus({ id: item.id, status: 'failed', error: reason });
              failed++;
              this.notifyFailed(item, reason);
              continue;
            }
          } else if (item.body) {
            try { body = JSON.parse(item.body); } catch { body = item.body; }
          }

          const headers: Record<string, string> = { 'X-Offline-Sync': 'true' };
          if (item.idempotency_key) headers['X-Idempotency-Key'] = item.idempotency_key;

          const effectiveUrl = entryHostMatchesCurrent(item.url)
            ? item.url
            : this.rewriteToCurrentHost(item.url);
          if (effectiveUrl !== item.url) {
            console.log(`[Sync] URL legacy reescrita: ${item.url} → ${effectiveUrl}`);
          }

          const response = await firstValueFrom(
            this.http.request(item.method, effectiveUrl, {
              body,
              headers: new HttpHeaders(headers),
              observe: 'response',
            })
          );

          await this.offlineDb.db.deleteRequest(item.id);

          try {
            window.dispatchEvent(new CustomEvent('offline-request-synced', {
              detail: {
                queueId: item.id,
                tempId: -item.id,
                method: item.method,
                url: item.url,
                response: response?.body ?? null,
              },
            }));
          } catch { /* noop */ }

          await this.invalidateRelatedCache(item.url, item.method).catch(() => null);
          synced++;
        } catch (error: any) {
          const status = error?.status || 0;

          if (status >= 400 && status < 500 && status !== 401) {
            const reason = this.summarizeError(error);
            console.warn(`[Sync] Solicitud ${item.id} falló con ${status}. Marcada como fallida.`);
            await this.offlineDb.db.markRequestStatus({ id: item.id, status: 'failed', error: reason });
            failed++;
            this.notifyFailed(item, reason);
          } else if (status === 401) {
            console.warn('[Sync] Token expirado (401). Sync pausado.');
            break;
          } else {
            const reason = this.summarizeError(error);
            console.warn(`[Sync] Error ${status} en solicitud ${item.id} (${reason}). Se reintentará después.`);
            try {
              await this.offlineDb.db.markRequestStatus({ id: item.id, status: 'pending', error: reason });
              window.dispatchEvent(new CustomEvent('offline-request-stalled', {
                detail: { queueId: item.id, method: item.method, url: item.url, reason },
              }));
            } catch { /* noop */ }
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
      this.updateFailedCount();
      window.dispatchEvent(new CustomEvent('offline-queue-updated'));
    }
  }

  private rewriteToCurrentHost(legacyUrl: string): string {
    try {
      const u = new URL(legacyUrl);
      return fromCacheKey(u.pathname + u.search + u.hash);
    } catch {
      return legacyUrl;
    }
  }

  private summarizeError(error: any): string {
    try {
      const status = error?.status || 0;
      const msg = error?.error?.detail || error?.error?.message || error?.message || 'Error desconocido';
      return `${status}: ${String(msg).slice(0, 500)}`;
    } catch {
      return 'Error desconocido';
    }
  }

  private notifyFailed(item: SyncQueueItem, reason: string): void {
    try {
      window.dispatchEvent(new CustomEvent('offline-request-failed', {
        detail: {
          queueId: item.id, method: item.method, url: item.url, reason,
          attemptCount: (item.attempt_count || 0) + 1,
        },
      }));
    } catch { /* noop */ }
  }

  private async invalidateRelatedCache(url: string, method: string): Promise<void> {
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase())) return;

    let pathname: string;
    try {
      const u = new URL(url, 'http://placeholder.local');
      pathname = u.pathname;
    } catch { return; }

    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return;

    const last = segments[segments.length - 1];
    const looksLikeId = /^[0-9]+$/.test(last) || /^[0-9a-f-]{8,}$/i.test(last);
    const parentSegments = looksLikeId ? segments.slice(0, -1) : segments;
    if (parentSegments.length === 0) return;

    const prefix = '/' + parentSegments.join('/') + '/';
    try {
      await this.offlineDb.db.cacheInvalidatePrefix(prefix);
    } catch (e) {
      console.warn('[Cache] cacheInvalidatePrefix falló:', e);
    }
  }

  async refreshCache(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;

    try {
      const urls: string[] = await this.offlineDb.db.cacheGetAllUrls();
      if (!urls || urls.length === 0) return;

      let apiUrls = urls.filter(u => u.startsWith('http') || u.startsWith('/'));

      // Purgar entradas con host obsoleto (solo aplica a Electron donde las URLs
      // pueden haberse guardado con un host diferente al actual)
      const stale = apiUrls.filter(u => u.startsWith('http') && !entryHostMatchesCurrent(u));
      if (stale.length > 0) {
        await Promise.allSettled(stale.map(u => this.offlineDb.db.cacheInvalidatePrefix(u)));
        console.log(`[Cache] ${stale.length} URL(s) con host obsoleto purgadas.`);
        const staleSet = new Set(stale);
        apiUrls = apiUrls.filter(u => !staleSet.has(u));
      }

      // La parametrización tiene su propio refresco (CatalogPreloadService, que
      // además descubre catálogos nuevos). Si se dejara aquí competiría por el
      // cupo de REFRESH_LIMIT: son decenas de URLs y desplazarían a los datos
      // de trabajo, que sí cambian de un minuto a otro.
      const catalogos = apiUrls.filter(u => isCatalogUrl(u)).length;
      if (catalogos > 0) {
        apiUrls = apiUrls.filter(u => !isCatalogUrl(u));
        console.log(`[Cache] ${catalogos} URL(s) de parametrización las refresca CatalogPreloadService.`);
      }

      if (!this.permissions.canUseSeleccionPipeline()) {
        const before = apiUrls.length;
        apiUrls = apiUrls.filter(u => !this.permissions.isSeleccionPipelineUrl(u));
        const skipped = before - apiUrls.length;
        if (skipped > 0) {
          console.log(`[Cache] ${skipped} URL(s) del pipeline SELECCION omitidas.`);
        }
      }

      if (apiUrls.length === 0) return;

      const REFRESH_LIMIT = 50;
      if (apiUrls.length > REFRESH_LIMIT) apiUrls = apiUrls.slice(0, REFRESH_LIMIT);

      console.log(`[Cache] Refrescando ${apiUrls.length} URLs cacheadas en segundo plano...`);
      const total = apiUrls.length;
      let refreshed = 0;
      let limitados = 0;

      // Ritmo del refresco.
      //
      // El gateway limita a 50 req/s con ráfaga de 100 POR USUARIO. Esto ya iba
      // de 3 en 3, pero SIN PAUSA entre tandas: con respuestas de ~50 ms son
      // ~60 req/s sostenidos, por encima del límite. Vaciaba la ráfaga y a
      // partir de ahí caían con 429 tanto estas peticiones como las de la
      // pantalla que el usuario tuviera abierta — que es lo grave: un refresco
      // de fondo no puede tumbar lo que la persona está mirando.
      //
      // 3 peticiones cada 150 ms ≈ 20 req/s: deja sitio de sobra para el uso
      // normal y refrescar 50 URLs sigue tardando ~2,5 s.
      const LOTE = 3;
      const PAUSA_MS = 150;
      // Si aun así llega un 429, el cubo está vacío: se espera bastante más
      // antes de seguir en vez de insistir y empeorarlo.
      const PAUSA_TRAS_429_MS = 3000;
      const esperar = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

      for (let i = 0; i < apiUrls.length; i += LOTE) {
        if (!this.networkService.isOnline) {
          console.warn('[Cache] Conexión perdida durante refresh. Pausando.');
          break;
        }
        const batch = apiUrls.slice(i, i + LOTE);
        this.syncProgress$.next({ current: i + 1, total, phase: 'cache' });

        const results = await Promise.allSettled(
          batch.map(url =>
            firstValueFrom(this.http.get(fromCacheKey(url)))
              .then(value => ({ value, status: 200 }))
              // El status se conserva para distinguir "no se pudo refrescar"
              // de "me están limitando", que exigen reacciones distintas.
              .catch((e: any) => ({ value: null, status: e?.status ?? 0 }))
          )
        );

        refreshed += results.filter(
          r => r.status === 'fulfilled' && r.value.value !== null).length;
        const hubo429 = results.some(
          r => r.status === 'fulfilled' && r.value.status === 429);

        if (hubo429) {
          limitados++;
          await esperar(PAUSA_TRAS_429_MS);
        } else if (i + LOTE < apiUrls.length) {
          await esperar(PAUSA_MS);
        }
      }

      console.log(`[Cache] Refresh completado: ${refreshed}/${total} URLs actualizadas.`
        + (limitados ? ` (${limitados} tanda(s) frenadas por límite de peticiones)` : ''));
    } catch (e) {
      console.warn('[Cache] Error refrescando cache:', e);
    } finally {
      this.isRefreshing = false;
      this.syncProgress$.next(null);
    }
  }

  public async updatePendingCount(): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const pending = await this.offlineDb.db.getPendingRequests({ userId });
      this.pendingCount$.next(pending?.length ?? 0);
    } catch { /* noop */ }
  }

  public async updateFailedCount(): Promise<void> {
    try {
      const userId = this.getCurrentUserId();
      const failed = await this.offlineDb.db.getFailedRequests({ userId });
      this.failedCount$.next(failed?.length ?? 0);
    } catch { /* noop */ }
  }

  public async getFailedRequests(): Promise<SyncQueueItem[]> {
    try {
      const userId = this.getCurrentUserId();
      return await this.offlineDb.db.getFailedRequests({ userId });
    } catch { return []; }
  }

  public async getPendingRequests(): Promise<SyncQueueItem[]> {
    try {
      const userId = this.getCurrentUserId();
      return await this.offlineDb.db.getPendingRequests({ userId });
    } catch { return []; }
  }

  public async getRequestFiles(requestId: number): Promise<StoredFile[]> {
    try {
      return await this.offlineDb.db.getRequestFiles(requestId);
    } catch { return []; }
  }

  public async syncNow(): Promise<void> {
    if (!this.networkService.isOnline) return;
    await this.syncQueue();
    this.refreshCache();
  }

  public async discardRequest(id: number): Promise<void> {
    await this.offlineDb.db.discardRequest(id);
    this.updatePendingCount();
    this.updateFailedCount();
    window.dispatchEvent(new CustomEvent('offline-queue-updated'));
  }

  public async retryFailed(id: number): Promise<void> {
    await this.offlineDb.db.retryRequest(id);
    this.updateFailedCount();
    this.updatePendingCount();
    if (this.networkService.isOnline) this.syncQueue();
  }

  public async clearCache(): Promise<void> {
    await this.offlineDb.db.clearCache();
  }

  public async getCacheEntriesWithStatus(): Promise<CacheCategory[]> {
    try {
      const userId = this.getCurrentUserId();
      const [rawEntries, pendingItems, failedItems] = await Promise.all([
        this.offlineDb.db.cacheGetAllEntries(),
        this.offlineDb.db.getPendingRequests({ userId }).catch(() => []),
        this.offlineDb.db.getFailedRequests({ userId }).catch(() => []),
      ]);

      const pendingPrefixes = new Set<string>(
        (pendingItems || []).map((r: any) => this.getResourcePrefix(r.url))
      );
      const failedPrefixes = new Set<string>(
        (failedItems || []).map((r: any) => this.getResourcePrefix(r.url))
      );

      const STALE_HOURS = 12;
      const now = Date.now();

      const entries: CacheEntry[] = (rawEntries || []).map(row => {
        const cat = categorizeCacheUrl(row.url);
        const prefix = this.getResourcePrefix(row.url);
        const hasFailed = failedPrefixes.has(prefix);
        const hasPending = pendingPrefixes.has(prefix);
        let isStale = false;
        if (row.updated_at) {
          const iso = row.updated_at.includes('T')
            ? row.updated_at
            : row.updated_at.replace(' ', 'T') + 'Z';
          isStale = now - new Date(iso).getTime() > STALE_HOURS * 3600000;
        }
        const status: CacheEntry['status'] = hasFailed ? 'failed_write'
          : hasPending ? 'pending_write'
          : isStale ? 'stale'
          : 'synced';
        return {
          url: row.url, label: cat.label, category: cat.category, icon: cat.icon,
          updatedAt: row.updated_at ?? null,
          age: formatRelativeAge(row.updated_at),
          status,
        };
      });

      const byCategory = new Map<string, CacheEntry[]>();
      for (const e of entries) {
        const list = byCategory.get(e.category) ?? [];
        list.push(e);
        byCategory.set(e.category, list);
      }

      const categories: CacheCategory[] = [];
      for (const [name, list] of byCategory.entries()) {
        const categoryStatus: CacheCategory['status'] =
          list.some(e => e.status === 'failed_write') ? 'failed_write' :
          list.some(e => e.status === 'pending_write') ? 'pending_write' :
          list.some(e => e.status === 'stale') ? 'stale' : 'synced';

        const mostRecent = list.reduce<string | null>((best, e) =>
          !e.updatedAt ? best : (!best || e.updatedAt > best) ? e.updatedAt : best,
          null
        );

        categories.push({
          name, icon: list[0].icon, entries: list,
          status: categoryStatus,
          lastUpdated: mostRecent ? formatRelativeAge(mostRecent) : 'Sin datos',
          count: list.length,
        });
      }

      const order: Record<CacheEntry['status'], number> = {
        failed_write: 0, pending_write: 1, stale: 2, synced: 3,
      };
      categories.sort((a, b) => order[a.status] - order[b.status]);
      return categories;
    } catch (e) {
      console.warn('[OfflineSync] getCacheEntriesWithStatus falló:', e);
      return [];
    }
  }

  private getResourcePrefix(url: string): string {
    try {
      const u = new URL(url, 'http://placeholder.local');
      const segs = u.pathname.split('/').filter(Boolean);
      return '/' + segs.slice(0, 2).join('/') + '/';
    } catch {
      return url.split('?')[0];
    }
  }

  /** Reconstruye el FormData de una request multipart. base64_data ya viene
   *  resuelto por el adaptador (disco en Electron, IDB en web). */
  private async rebuildFormData(item: SyncQueueItem): Promise<FormData | null> {
    const fd = new FormData();

    if (item.body) {
      try {
        const fields: { name: string; value: string }[] = JSON.parse(item.body);
        if (Array.isArray(fields)) {
          for (const f of fields) fd.append(f.name, f.value);
        }
      } catch (e) {
        console.warn(`[Sync] body JSON corrupto en request ${item.id}:`, e);
      }
    }

    let files: StoredFile[] = [];
    try {
      files = await this.offlineDb.db.getRequestFiles(item.id);
    } catch (e) {
      console.warn(`[Sync] No se pudieron leer files de request ${item.id}:`, e);
      return null;
    }

    for (const f of files) {
      if (!f.base64_data) {
        console.warn(`[Sync] Archivo perdido para request ${item.id}: ${f.file_name}`);
        return null;
      }
      const blob = this.base64ToBlob(f.base64_data, f.mime_type ?? 'application/octet-stream');
      fd.append(f.field_name, blob, f.file_name);
    }

    return fd;
  }

  private base64ToBlob(base64: string, mime: string): Blob {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }
}
