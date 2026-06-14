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
import { OfflineSyncService } from '../../../core/services/offline-sync.service';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import { describeQueuedRequest, formatRelativeAge } from '../../../core/utils/offline-response';

/** Fila de la cola tal como la consume la vista (datos crudos + derivados). */
interface QueuedRow {
  id: number;
  method: string;
  url: string;
  status: string;
  timestamp?: string;
  last_error?: string | null;
  attempt_count?: number;
  body_type?: 'json' | 'multipart';

  // Derivados para la plantilla.
  icon: string;
  label: string;
  age: string;
  fileNames: string[];
}

/**
 * Diálogo "Envíos pendientes": muestra al usuario QUÉ no se ha subido todavía
 * (el badge "9" del chip de red) y le da control: sincronizar ahora, reintentar
 * los fallidos o descartarlos. Se abre al hacer clic en el chip del header.
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

  loading = true;
  isOnline = true;
  syncing = false;

  private subs: Subscription[] = [];
  private onQueueEvent?: () => void;
  private reloadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private dialogRef: MatDialogRef<OfflineQueueDialogComponent>,
    private offlineSync: OfflineSyncService,
    private networkStatus: NetworkStatusService,
    private cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    this.subs.push(
      this.networkStatus.isOnline$.subscribe(status => {
        this.isOnline = status;
        this.cdr.markForCheck();
      }),
      this.offlineSync.syncProgress$.subscribe(progress => {
        this.syncing = progress !== null;
        this.cdr.markForCheck();
      }),
    );

    // Refresco en vivo: si la cola cambia mientras el diálogo está abierto
    // (sincronización en curso, fallo, descarte), recargamos las listas.
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

  get total(): number {
    return this.pending.length + this.failed.length;
  }

  private scheduleReload(): void {
    if (this.reloadTimer) clearTimeout(this.reloadTimer);
    this.reloadTimer = setTimeout(() => { void this.reload(); }, 300);
  }

  private async reload(): Promise<void> {
    try {
      const [pendingRaw, failedRaw] = await Promise.all([
        this.offlineSync.getPendingRequests(),
        this.offlineSync.getFailedRequests(),
      ]);
      this.pending = await Promise.all((pendingRaw || []).map(r => this.toRow(r)));
      this.failed = await Promise.all((failedRaw || []).map(r => this.toRow(r)));
    } catch {
      // Si la DB local no responde, dejamos las listas como estén.
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  /** Enriquece una fila cruda con etiqueta, icono, antigüedad y nombres de archivo. */
  private async toRow(raw: any): Promise<QueuedRow> {
    const meta = describeQueuedRequest(raw?.method, raw?.url);
    let fileNames: string[] = [];
    if (raw?.body_type === 'multipart' && raw?.id != null) {
      try {
        const files = await this.offlineSync.getRequestFiles(raw.id);
        fileNames = (files || []).map((f: any) => f?.file_name).filter(Boolean);
      } catch { /* sin nombres de archivo, no es crítico */ }
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
    this.cdr.markForCheck();
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
        '.<br><br>Esta acción <b>no se puede deshacer</b> y los datos no se subirán.',
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

  cerrar(): void {
    this.dialogRef.close();
  }

  trackById = (_: number, row: QueuedRow) => row.id;
}
