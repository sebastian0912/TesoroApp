import { Component, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import Swal from 'sweetalert2';

declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        on: (channel: string, func: (...args: any[]) => void) => () => void;
        send: (channel: string, ...args: any[]) => void;
        invoke: (channel: string, ...args: any[]) => Promise<any>;
        removeAllListeners: (channel: string) => void;
      };
      version: { get: () => Promise<string> };
      env: { get: () => Promise<string> };
      fingerprint: { get: () => Promise<{ success: boolean; data?: string; error?: string }> };
      pdf: {
        editExternal: (fileUrl: string) => Promise<any>;
        readFile: () => Promise<any>;
        finishEdit: () => Promise<any>;
        onFileChanged: (callback: (data: any) => void) => () => void;
      };
      db: {
        saveRequestQueue: (req: any) => Promise<any>;
        getPendingRequests: () => Promise<any[]>;
        deleteRequest: (id: number) => Promise<any>;
        cacheSave: (data: any) => Promise<any>;
        cacheGet: (url: string) => Promise<any>;
        cacheGetAllUrls: () => Promise<string[]>;
        markRequestStatus: (data: { id: number; status: string }) => Promise<any>;
      };
    };
  }
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnDestroy {
  title = 'Tesoreria';

  private cleanupFns: (() => void)[] = [];
  private swalProgressActive = false;

  ngOnInit() {
    if (typeof window !== 'undefined' && window.electron) {
      this.setupUpdateListeners();
    }
  }

  ngOnDestroy() {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }

  private listen(channel: string, handler: (...args: any[]) => void) {
    const unsub = window.electron.ipcRenderer.on(channel, handler);
    if (typeof unsub === 'function') this.cleanupFns.push(unsub);
  }

  private setupUpdateListeners(): void {
    // 1. Actualización disponible
    this.listen('update-available', (info: any) => {
      const ver = info?.version || '';
      Swal.fire({
        title: '',
        html: `
          <div style="text-align:center;padding:10px 0;">
            <div style="width:64px;height:64px;margin:0 auto 16px;background:linear-gradient(135deg,#051b3f,#1565C0);border-radius:16px;display:flex;align-items:center;justify-content:center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </div>
            <h2 style="margin:0 0 8px;font-size:1.3rem;font-weight:700;color:#1e293b;">Nueva actualización disponible</h2>
            ${ver ? `<p style="margin:0 0 4px;color:#64748b;font-size:0.95rem;">Versión <strong style="color:#1565C0;">${ver}</strong></p>` : ''}
            <p style="margin:12px 0 0;color:#94a3b8;font-size:0.85rem;">Descargando en segundo plano. No cierre la aplicación.</p>
          </div>`,
        showConfirmButton: false,
        allowOutsideClick: false,
        allowEscapeKey: false,
        backdrop: 'rgba(5,27,63,0.6)',
      });
    });

    // 2. Progreso de descarga
    this.listen('update-progress', (p: any) => {
      const pct = Math.floor(p?.percent ?? 0);
      const speed = p?.bytesPerSecond ? `${(p.bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s` : '';
      const transferred = p?.transferred ? `${(p.transferred / 1024 / 1024).toFixed(1)}` : '';
      const total = p?.total ? `${(p.total / 1024 / 1024).toFixed(1)}` : '';
      const sizeInfo = transferred && total ? `${transferred} / ${total} MB` : '';

      const html = `
        <div style="text-align:center;padding:10px 0;">
          <div style="width:64px;height:64px;margin:0 auto 16px;background:linear-gradient(135deg,#051b3f,#1565C0);border-radius:16px;display:flex;align-items:center;justify-content:center;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <h2 style="margin:0 0 16px;font-size:1.2rem;font-weight:700;color:#1e293b;">Descargando actualización</h2>
          <div style="background:#e2e8f0;border-radius:10px;height:12px;overflow:hidden;margin:0 0 10px;">
            <div style="background:linear-gradient(90deg,#1565C0,#42a5f5);height:100%;width:${pct}%;transition:width 0.4s ease;border-radius:10px;"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.8rem;color:#64748b;">
            <span><strong style="font-size:1.1rem;color:#1e293b;">${pct}%</strong></span>
            <span>${sizeInfo}</span>
            ${speed ? `<span>${speed}</span>` : ''}
          </div>
          <p style="margin:14px 0 0;color:#94a3b8;font-size:0.8rem;">No cierre la aplicación durante la descarga.</p>
        </div>`;

      if (!this.swalProgressActive) {
        this.swalProgressActive = true;
        Swal.fire({
          title: '', html,
          showConfirmButton: false, allowOutsideClick: false, allowEscapeKey: false,
          backdrop: 'rgba(5,27,63,0.6)',
        });
      } else {
        const container = Swal.getHtmlContainer();
        if (container) container.innerHTML = html;
      }
    });

    // 3. Descarga completada
    this.listen('update-downloaded', () => {
      this.swalProgressActive = false;
      Swal.fire({
        title: '',
        html: `
          <div style="text-align:center;padding:10px 0;">
            <div style="width:64px;height:64px;margin:0 auto 16px;background:linear-gradient(135deg,#2E7D32,#66BB6A);border-radius:16px;display:flex;align-items:center;justify-content:center;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style="margin:0 0 8px;font-size:1.3rem;font-weight:700;color:#1e293b;">Actualización lista</h2>
            <p style="margin:0;color:#64748b;font-size:0.95rem;">La aplicación se reiniciará automáticamente.</p>
            <div style="margin:16px auto 0;width:40px;height:40px;">
              <svg viewBox="0 0 50 50" style="animation:updater-spin 1s linear infinite;"><circle cx="25" cy="25" r="20" fill="none" stroke="#2E7D32" stroke-width="4" stroke-dasharray="80 50" stroke-linecap="round"/></svg>
            </div>
          </div>
          <style>@keyframes updater-spin{to{transform:rotate(360deg)}}</style>`,
        showConfirmButton: false, allowOutsideClick: false, allowEscapeKey: false,
        backdrop: 'rgba(5,27,63,0.6)', timer: 5000,
      });
    });

    // 4. Error — silenciado en UI. Un 404 de latest.yml o un fallo de red no
    //    aporta nada al usuario final; solo se loguea en consola.
    this.listen('update-error', (error: any) => {
      this.swalProgressActive = false;
      const msg = typeof error === 'string' ? error : error?.message || String(error);
      console.warn('[autoUpdater]', msg);
    });
  }
}
