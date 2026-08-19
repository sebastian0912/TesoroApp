import {
  Component,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';

import { SharedModule } from '../../shared.module';
import { OfflineSyncService, CacheCategory } from '../../../core/services/offline-sync.service';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import {
  CatalogPreloadService,
  CatalogPreloadProgress,
} from '../../../core/services/catalog-preload.service';
import { describeQueuedRequest, formatRelativeAge } from '../../../core/utils/offline-response';

interface QueuedRow {
  id: number;
  method: string;
  url: string;
  status: string;
  timestamp?: string;
  last_error?: string | null;
  attempt_count?: number;
  body_type?: 'json' | 'multipart';
  icon: string;
  label: string;
  age: string;
  fileNames: string[];
}

/**
 * Diálogo de sincronización: muestra el estado de la cola de escrituras locales
 * y el caché de lecturas (api_cache), agrupado por recurso.
 * Se abre al hacer clic en el chip "En línea / Sin conexión" del header.
 */
@Component({
  selector: 'app-offline-queue-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SharedModule],
  templateUrl: './offline-queue-dialog.component.html',
  styleUrl: './offline-queue-dialog.component.css',
})
export class OfflineQueueDialogComponent implements OnInit, OnDestroy {
  pending: QueuedRow[] = [];
  failed: QueuedRow[] = [];
  cacheCategories: CacheCategory[] = [];

  loading = true;
  isOnline = true;
  syncing = false;
  showAllCache = false;
  /** Progreso de la precarga de parametrización (null = no está corriendo). */
  catalogProgress: CatalogPreloadProgress | null = null;
  catalogLastRun = '';
  hasLocalDb = false;   // true en todos los navegadores modernos (IndexedDB o SQLite)
  activeTab: 'queue' | 'cache' = 'queue';

  private subs: Subscription[] = [];
  private onQueueEvent?: () => void;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;
  private prevOnline: boolean | null = null;

  constructor(
    private dialogRef: MatDialogRef<OfflineQueueDialogComponent>,
    private offlineSync: OfflineSyncService,
    private networkStatus: NetworkStatusService,
    private catalogPreload: CatalogPreloadService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.hasLocalDb = typeof indexedDB !== 'undefined';

    this.subs.push(
      this.networkStatus.isOnline$.subscribe(async status => {
        const wasOffline = this.prevOnline === false;
        this.prevOnline = status;
        this.isOnline = status;
        // Trigger automático: si acabamos de reconectarnos, refrescar todo
        if (status && wasOffline) {
          await this.reload();
        } else {
          this.cdr.detectChanges();
        }
      }),
      this.offlineSync.syncProgress$.subscribe(progress => {
        this.syncing = progress !== null;
        this.cdr.detectChanges();
      }),
      this.catalogPreload.progress$.subscribe(progress => {
        this.catalogProgress = progress;
        this.cdr.detectChanges();
      }),
      this.catalogPreload.lastRun$.subscribe(iso => {
        this.catalogLastRun = iso ? formatRelativeAge(iso) : '';
        this.cdr.detectChanges();
      }),
    );

    this.onQueueEvent = () => this.scheduleReload();
    for (const ev of ['offline-queue-updated', 'offline-request-synced', 'offline-request-failed', 'offline-request-stalled']) {
      window.addEventListener(ev, this.onQueueEvent);
    }

    await this.reload();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => { try { s.unsubscribe(); } catch { /* noop */ } });
    this.subs = [];
    if (this.onQueueEvent) {
      for (const ev of ['offline-queue-updated', 'offline-request-synced', 'offline-request-failed', 'offline-request-stalled']) {
        window.removeEventListener(ev, this.onQueueEvent);
      }
      this.onQueueEvent = undefined;
    }
    if (this.reloadTimer) { clearTimeout(this.reloadTimer); this.reloadTimer = null; }
  }

  get totalQueue(): number { return this.pending.length + this.failed.length; }

  get visibleCategories(): CacheCategory[] {
    if (this.showAllCache) return this.cacheCategories;
    return this.cacheCategories.filter(c => c.status !== 'synced');
  }

  get hasPendingCache(): boolean {
    return this.cacheCategories.some(c => c.status !== 'synced');
  }

  get totalCacheEntries(): number {
    return this.cacheCategories.reduce((s, c) => s + c.count, 0);
  }

  /**
   * Grupo de parametrización (tablas maestras que alimentan los desplegables
   * de todos los módulos). Se muestra aparte y SIEMPRE, aunque esté todo
   * sincronizado: es el indicador de si se puede trabajar sin conexión.
   */
  get catalogCategory(): CacheCategory | null {
    return this.cacheCategories.find(c => c.name === 'Parametrización') ?? null;
  }

  get totalCatalogos(): number {
    return this.catalogCategory?.count ?? 0;
  }

  /** Categorías de la lista general, sin la de parametrización (va aparte). */
  get visibleCategoriesSinCatalogos(): CacheCategory[] {
    return this.visibleCategories.filter(c => c.name !== 'Parametrización');
  }

  private scheduleReload(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => { void this.reload(); }, 300);
  }

  async reload(): Promise<void> {
    this.loading = true;
    this.cdr.detectChanges();
    try {
      const timeoutMs = 8000;
      const guard = new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error(`reload timeout after ${timeoutMs}ms`)), timeoutMs)
      );
      const [pendingRaw, failedRaw, cats] = await Promise.race([
        Promise.all([
          this.offlineSync.getPendingRequests(),
          this.offlineSync.getFailedRequests(),
          this.offlineSync.getCacheEntriesWithStatus(),
        ]),
        guard,
      ]);
      this.pending = await Promise.all((pendingRaw || []).map(r => this.toRow(r)));
      this.failed = await Promise.all((failedRaw || []).map(r => this.toRow(r)));
      this.cacheCategories = cats;
      // Cambiar tab automáticamente si hay cola activa
      if (this.totalQueue > 0) this.activeTab = 'queue';
      else if (cats.some(c => c.status !== 'synced')) this.activeTab = 'cache';
    } catch {
      // Dejamos las listas como estén si hay error
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async toRow(raw: any): Promise<QueuedRow> {
    const meta = describeQueuedRequest(raw?.method, raw?.url);
    let fileNames: string[] = [];
    if (raw?.body_type === 'multipart' && raw?.id != null) {
      try {
        const files = await this.offlineSync.getRequestFiles(raw.id);
        fileNames = (files || []).map((f: any) => f?.file_name).filter(Boolean);
      } catch { /* noop */ }
    }
    return {
      id: raw?.id,
      method: raw?.method,
      url: raw?.url,
      status: raw?.status,
      timestamp: raw?.timestamp,
      last_error: raw?.last_error ?? null,
      attempt_count: raw?.attempt_count ?? 0,
      body_type: raw?.body_type,
      icon: meta.icon,
      label: meta.label,
      age: formatRelativeAge(raw?.timestamp),
      fileNames,
    };
  }

  async sincronizarAhora(): Promise<void> {
    if (!this.isOnline || this.syncing) return;
    this.syncing = true;
    this.cdr.detectChanges();
    await this.offlineSync.syncNow();
    await this.reload();
  }

  async reintentar(row: QueuedRow): Promise<void> {
    await this.offlineSync.retryFailed(row.id);
    await this.reload();
  }

  async descartar(row: QueuedRow): Promise<void> {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: '¿Descartar este envío?',
      html:
        `Se eliminará <b>${row.label}</b>` +
        (row.fileNames.length ? ` y ${row.fileNames.length} archivo(s) adjunto(s)` : '') +
        '.<br><br>Esta acción <b>no se puede deshacer</b>.',
      showCancelButton: true,
      confirmButtonText: 'Sí, descartar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    });
    if (!confirm.isConfirmed) return;
    await this.offlineSync.discardRequest(row.id);
    await this.reload();
  }

  /**
   * Baja de nuevo TODA la parametrización, sin esperar al refresco automático.
   * Es la acción que deja el equipo listo para irse a trabajar sin señal.
   */
  async actualizarParametrizacion(): Promise<void> {
    if (!this.isOnline || this.catalogProgress !== null) return;
    const res = await this.catalogPreload.preloadNow();
    await this.reload();
    if (res.omitido) {
      Swal.fire({
        icon: 'info',
        title: 'No se pudo actualizar',
        text: `Precarga omitida: ${res.omitido}.`,
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    Swal.fire({
      icon: res.fallidos > 0 ? 'warning' : 'success',
      title: 'Parametrización actualizada',
      html: `${res.ok} catálogo(s) guardado(s) en este equipo.`
        + (res.fallidos > 0
          ? `<br><small>${res.fallidos} no se pudieron bajar (sin permiso o servicio caído).</small>`
          : ''),
      confirmButtonColor: '#3085d6',
    });
  }

  limpiarCache(): void {
    Swal.fire({
      icon: 'warning',
      title: '¿Limpiar caché local?',
      html: 'Se borrarán todos los datos guardados en este equipo.<br>Los cambios pendientes <b>no se tocan</b>.',
      showCancelButton: true,
      confirmButtonText: 'Limpiar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      reverseButtons: true,
    }).then(async r => {
      if (!r.isConfirmed) return;
      await this.offlineSync.clearCache();
      await this.reload();
    });
  }

  setTab(tab: 'queue' | 'cache'): void {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  cerrar(): void { this.dialogRef.close(); }

  statusLabel(s: CacheCategory['status']): string {
    return s === 'pending_write' ? 'Pendiente'
      : s === 'failed_write' ? 'Fallido'
      : s === 'stale' ? 'Desactualizado'
      : 'Sincronizado';
  }

  statusIcon(s: CacheCategory['status']): string {
    return s === 'pending_write' ? 'upload'
      : s === 'failed_write' ? 'error_outline'
      : s === 'stale' ? 'schedule'
      : 'check_circle';
  }

  trackById = (_: number, row: QueuedRow) => row.id;
  trackByCat = (_: number, cat: CacheCategory) => cat.name;
}
